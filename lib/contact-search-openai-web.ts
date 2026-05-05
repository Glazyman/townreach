/**
 * Optional contact discovery via OpenAI Responses API + hosted web_search tool.
 * We only trust emails after fetching cited URLs (same pipeline as Serper HTML enrichment).
 */

import type { SerperOrganic } from "@/lib/municipal-site-search";
import { extractEmailsFromText, filterAcceptableEmails } from "@/lib/contact-email";

const RESPONSES_URL = "https://api.openai.com/v1/responses";

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_")) u.searchParams.delete(key);
    }
    return u.href;
  } catch {
    return null;
  }
}

function extractUrlsFromText(text: string): string[] {
  const out: string[] = [];
  const re = /\bhttps?:\/\/[^\s\])"'<>]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = normalizeUrl(m[0]);
    if (n) out.push(n);
  }
  return out;
}

/** Walk Responses `output` items for url_citation annotations and tool sources. */
function collectUrlsFromOutput(output: unknown): string[] {
  const found = new Set<string>();
  if (!Array.isArray(output)) return [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;

    if (o.type === "message" && o.role === "assistant") {
      const parts = o.content;
      if (!Array.isArray(parts)) continue;
      for (const p of parts) {
        if (!p || typeof p !== "object") continue;
        const part = p as Record<string, unknown>;
        if (part.annotations && Array.isArray(part.annotations)) {
          for (const a of part.annotations) {
            if (!a || typeof a !== "object") continue;
            const ann = a as Record<string, unknown>;
            if (ann.type === "url_citation" && typeof ann.url === "string") {
              const nu = normalizeUrl(ann.url);
              if (nu) found.add(nu);
            }
          }
        }
        if (typeof part.text === "string") {
          for (const u of extractUrlsFromText(part.text)) found.add(u);
        }
      }
    }

    if (o.type === "web_search_call") {
      const action = o.action as Record<string, unknown> | undefined;
      const sources = action?.sources;
      if (Array.isArray(sources)) {
        for (const s of sources) {
          if (!s || typeof s !== "object") continue;
          const url = (s as { url?: unknown }).url;
          if (typeof url === "string") {
            const nu = normalizeUrl(url);
            if (nu) found.add(nu);
          }
        }
      }
    }
  }

  return [...found];
}

function extractAssistantText(output: unknown): string {
  if (!Array.isArray(output)) return "";
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (o.type !== "message" || o.role !== "assistant") continue;
    const parts = o.content;
    if (!Array.isArray(parts)) continue;
    for (const p of parts) {
      if (!p || typeof p !== "object") continue;
      const t = (p as { text?: unknown }).text;
      if (typeof t === "string") chunks.push(t);
    }
  }
  return chunks.join("\n\n");
}

const STATE_FEDERAL_AGENCY_HINTS =
  /\b(dec|dot|dmv|doj|dept|department|education|health|labor|tax|treasury|parks|police|fire|epa|fema|usda|usgs|nps|senate|assembly|governor)\b/i;

function toSignificantTokens(raw: string): string[] {
  return raw
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((x) => x.length >= 4);
}

function hostScore(host: string, municipality: string, state: string): number {
  const h = host.toLowerCase().replace(/^www\./, "");
  const muniTokens = toSignificantTokens(municipality);
  const stateTokens = toSignificantTokens(state);
  let score = 0;

  if (h.endsWith(".gov")) score += 25;
  if (/\.[a-z]{2}\.us$/i.test(h) || h.endsWith(".state.us")) score += 20;
  if (h.endsWith(".org")) score += 5;

  for (const t of muniTokens) {
    if (h.includes(t)) score += 45;
  }
  if (h.includes("town") || h.includes("city") || h.includes("village") || h.includes("county")) score += 14;

  // Penalize likely state/federal agency domains unless municipality token is present.
  if (STATE_FEDERAL_AGENCY_HINTS.test(h) && !muniTokens.some((t) => h.includes(t))) score -= 50;

  // Penalize plain state root domains (e.g. ny.gov) that usually route to statewide content.
  const isPlainStateGovRoot =
    stateTokens.some((tok) => h === `${tok}.gov`) ||
    /^[a-z]{2}\.gov$/i.test(h);
  if (isPlainStateGovRoot) score -= 35;

  return score;
}

function guessResolvedHost(urls: string[], municipality: string, state: string): string | null {
  const weighted = new Map<string, number>();
  for (const u of urls) {
    try {
      const host = new URL(u).hostname.toLowerCase().replace(/^www\./, "");
      const base = hostScore(host, municipality, state);
      weighted.set(host, (weighted.get(host) ?? 0) + base + 12);
    } catch {
      /* skip */
    }
  }
  let best: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const [h, s] of weighted) {
    if (s > bestScore) {
      best = h;
      bestScore = s;
    }
  }
  if (!best) return null;
  return bestScore >= 5 ? best : null;
}

function isSameRegistrableHost(rootHost: string, url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const r = rootHost.toLowerCase().replace(/^www\./, "");
    return h === r || h.endsWith("." + r);
  } catch {
    return false;
  }
}

function shouldKeepUrlForLocalContacts(
  url: string,
  municipality: string,
  state: string,
  resolvedHost: string | null
): boolean {
  if (resolvedHost) return isSameRegistrableHost(resolvedHost, url);
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const score = hostScore(host, municipality, state);
    return score >= 0;
  } catch {
    return false;
  }
}

function titleFromHtml(html: string): string {
  const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  return m?.[1]?.replace(/\s+/g, " ").trim() || "";
}

async function fetchUrlToOrganic(url: string, assistantContext: string): Promise<SerperOrganic | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "TownReach/1.0 (public municipal directory; +https://www.census.gov)" },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    const slice = html.length > 140_000 ? html.slice(0, 140_000) : html;
    const plain = slice.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
    const text = plain.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const emails = filterAcceptableEmails(extractEmailsFromText(text));
    const title = titleFromHtml(slice) || new URL(url).hostname;
    const snippetBase = emails.length > 0 ? `${emails.slice(0, 4).join(", ")} — ` : "";
    const snippetTail = assistantContext.includes(url)
      ? assistantContext.slice(0, 200)
      : text.slice(0, 420);
    return {
      title,
      link: url,
      snippet: `${snippetBase}${snippetTail}`
    };
  } catch {
    return null;
  }
}

export type OpenAiWebSearchPack = {
  organic: SerperOrganic[];
  queriesUsed: string[];
  resolvedHost: string | null;
  model: string;
};

/**
 * Run OpenAI web search tool, harvest cited URLs, fetch pages locally, return organic rows with real emails/snippets.
 */
export async function gatherContactsViaOpenAiWebSearch(params: {
  municipality: string;
  state: string;
  department: string;
  intent?: string;
}): Promise<OpenAiWebSearchPack> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for OpenAI web search.");
  }

  const model =
    process.env.OPENAI_WEB_CONTACT_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4.1-mini";

  const userText = [
    `Place: "${params.municipality}", ${params.state}`,
    `Department / function: ${params.department}`,
    params.intent ? `Resident/user question: ${params.intent}` : null,
    ``,
    `Search the official public web and prioritize the local governing municipality/county site for that place.`,
    `Find who to contact — especially shared department inboxes AND named staff emails when published.`,
    `If "${params.municipality}" is a Census place/CDP serviced by another town/village government, prioritize that jurisdiction's actual official site.`,
    `Avoid state/federal agency pages unless they are clearly the local governing authority for the municipal department asked.`,
    `Reply with short guidance and rely on citations to official URLs (the app will scrape those pages for mailboxes).`
  ]
    .filter(Boolean)
    .join("\n");

  const toolsA = [{ type: "web_search" as const, search_context_size: "high" as const }];

  const bodyBase = {
    model,
    tool_choice: "required" as const,
    temperature: 0.3,
    input: [
      {
        role: "user" as const,
        content: [{ type: "input_text" as const, text: userText }]
      }
    ]
  };

  let res = await fetch(RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ...bodyBase, tools: toolsA }),
    signal: AbortSignal.timeout(120_000)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    const fallbackTools = [{ type: "web_search_preview" as const }];
    const res2 = await fetch(RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...bodyBase,
        tools: fallbackTools,
        tool_choice: "auto"
      }),
      signal: AbortSignal.timeout(120_000)
    });
    if (!res2.ok) {
      throw new Error(
        `OpenAI Responses error ${res.status}: ${errText.slice(0, 200)} · fallback ${res2.status}`
      );
    }
    res = res2;
  }

  const data: { output?: unknown; model?: string } = await res.json();
  const output = data.output;
  let urls = collectUrlsFromOutput(output);
  const assistText = extractAssistantText(output);
  if (urls.length < 6) {
    for (const u of extractUrlsFromText(assistText)) {
      if (!urls.includes(u)) urls.push(u);
    }
  }

  urls = urls.slice(0, 22);

  /** Prefer gov / us public-sector hosts early in crawl budget. */
  urls.sort((a, b) => {
    try {
      const ha = new URL(a).hostname;
      const hb = new URL(b).hostname;
      const score = (h: string) =>
        (h.endsWith(".gov") ? 2 : 0) + (/\.[a-z]{2}\.us$/i.test(h) ? 2 : 0) + (h.endsWith(".org") ? 1 : 0);
      return score(hb) - score(ha);
    } catch {
      return 0;
    }
  });

  const resolvedHost = guessResolvedHost(urls, params.municipality, params.state);

  const organic: SerperOrganic[] = [];
  const seen = new Set<string>();

  await Promise.all(
    urls
      .filter((u) => shouldKeepUrlForLocalContacts(u, params.municipality, params.state, resolvedHost))
      .slice(0, 18)
      .map(async (url) => {
      const row = await fetchUrlToOrganic(url, assistText);
      if (!row?.link || seen.has(row.link)) return;
      seen.add(row.link);
      organic.push(row);
      })
  );

  const queriesUsed = [
    `OpenAI Responses (${data.model ?? model}) + hosted web_search`,
    userText.replace(/\s+/g, " ").slice(0, 600)
  ];

  return { organic, queriesUsed, resolvedHost, model };
}
