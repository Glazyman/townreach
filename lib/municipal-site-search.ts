/**
 * Resolve a likely official municipal website host, then crawl same-host pages
 * for department-related paths so contact search is grounded to one jurisdiction.
 */

import { extractEmailsFromText, filterAcceptableEmails } from "@/lib/contact-email";

export type SerperOrganic = { title: string; link: string; snippet: string };

const SERPER_URL = "https://google.serper.dev/search";

const HOST_BLOCK =
  /facebook|wikipedia|linkedin|yelp|instagram|google\.|youtube|pinterest|twitter\.|x\.com|tripadvisor|mapquest|zillow|realtor|indeed|glassdoor/i;

function isLikelyGovernmentHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h.endsWith(".gov") || h.endsWith(".mil")) return true;
  if (h.endsWith(".state.us") || /^[a-z0-9-]+\.[a-z]{2}\.us$/i.test(h)) return true;
  // Many NY villages/towns use .org for the public site
  if (h.endsWith(".org")) return true;
  return false;
}

/** Drop ultra-short intent tails that pollute Google queries (e.g. "sub"). */
export function topicFromIntent(raw: string | undefined | null): string {
  const t = raw?.trim() ?? "";
  if (t.length < 4) return "";
  return ` ${t}`;
}

export async function serperOrganic(apiKey: string, q: string, num = 8): Promise<SerperOrganic[]> {
  const res = await fetch(SERPER_URL, {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q, num })
  });
  const json: { organic?: SerperOrganic[] } = await res.json();
  return json.organic ?? [];
}

/**
 * Pick a primary host from Serp results for "official" site discovery.
 */
export function pickPrimaryMunicipalHost(items: SerperOrganic[], municipality: string): string | null {
  const muniNorm = municipality.toLowerCase().replace(/\s+/g, " ").trim();
  const muniCompact = muniNorm.replace(/\s/g, "");

  const scored = items
    .map((item) => {
      if (!item.link || HOST_BLOCK.test(item.link)) return null;
      let host: string;
      try {
        host = new URL(item.link).hostname.toLowerCase();
      } catch {
        return null;
      }
      if (!isLikelyGovernmentHost(host)) return null;
      const blob = `${item.title} ${item.snippet} ${item.link}`.toLowerCase();
      let score = 0;
      if (blob.includes(muniNorm)) score += 40;
      if (blob.includes(muniCompact)) score += 25;
      if (host.includes(muniCompact.slice(0, Math.min(8, muniCompact.length)))) score += 15;
      if (host.endsWith(".gov")) score += 8;
      return { host, score };
    })
    .filter((x): x is { host: string; score: number } => x !== null && x.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.host ?? null;
}

function pathKeywords(department: string): string[] {
  const base = [
    "planning",
    "zoning",
    "department",
    "staff",
    "directory",
    "contact",
    "board",
    "commission",
    "official",
    "government"
  ];
  const extra = department
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
  return [...new Set([...base, ...extra])];
}

function scorePath(pathname: string, keywords: string[]): number {
  const p = pathname.toLowerCase();
  let s = 0;
  for (const k of keywords) {
    if (p.includes(k)) s += k.length > 6 ? 5 : 3;
  }
  return s;
}

function extractTitleFromHtml(html: string): string {
  const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  return m?.[1]?.replace(/\s+/g, " ").trim() ?? "Municipal page";
}

/**
 * Fetch homepage on a host, find same-host links, fetch top department-related pages, return synthetic organic rows.
 */
export async function crawlMunicipalDepartmentPages(
  host: string,
  department: string,
  topic: string
): Promise<SerperOrganic[]> {
  const keywords = pathKeywords(department);
  const roots = [`https://${host}/`, `https://www.${host}/`];
  let baseUrl = "";
  let html = "";
  for (const root of roots) {
    try {
      const res = await fetch(root, {
        redirect: "follow",
        headers: { "User-Agent": "TownReach/1.0 (public municipal directory; +https://www.census.gov)" },
        signal: AbortSignal.timeout(6000)
      });
      if (!res.ok) continue;
      html = await res.text();
      baseUrl = res.url || root;
      break;
    } catch {
      /* try next */
    }
  }
  if (!html || !baseUrl) return [];

  const hrefs = [...html.matchAll(/href\s*=\s*["']([^"'#?]+)/gi)]
    .map((m) => m[1]?.trim())
    .filter(Boolean) as string[];

  const seenPath = new Set<string>();
  const candidates: { url: string; score: number }[] = [];
  for (const h of hrefs) {
    let abs: URL;
    try {
      abs = new URL(h, baseUrl);
    } catch {
      continue;
    }
    if (abs.hostname.replace(/^www\./, "") !== host.replace(/^www\./, "")) continue;
    if (abs.protocol !== "http:" && abs.protocol !== "https:") continue;
    const pathKey = abs.pathname.toLowerCase();
    if (pathKey.length < 2 || seenPath.has(pathKey)) continue;
    const sc = scorePath(abs.pathname, keywords);
    if (sc < 3) continue;
    seenPath.add(pathKey);
    candidates.push({ url: abs.href.split("#")[0]!, score: sc });
  }

  candidates.sort((a, b) => b.score - a.score);
  const toFetch = candidates.slice(0, 6);
  const out: SerperOrganic[] = [];

  await Promise.all(
    toFetch.map(async ({ url }) => {
      try {
        const res = await fetch(url, {
          redirect: "follow",
          headers: { "User-Agent": "TownReach/1.0 (public municipal directory; +https://www.census.gov)" },
          signal: AbortSignal.timeout(6000)
        });
        if (!res.ok) return;
        const page = await res.text();
        const slice = page.length > 120_000 ? page.slice(0, 120_000) : page;
        const text = slice.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
        const emails = filterAcceptableEmails(extractEmailsFromText(text));
        if (emails.length === 0) return;
        const title = extractTitleFromHtml(slice);
        const plain = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const snippet = `${emails.slice(0, 3).join(", ")} — ${plain.slice(0, 240)}`;
        out.push({ title, link: url, snippet });
      } catch {
        /* skip */
      }
    })
  );

  return out;
}

export async function discoverMunicipalHost(
  apiKey: string,
  municipality: string,
  state: string
): Promise<{ host: string | null; discoveryQuery: string }> {
  const discoveryQuery = `"${municipality}" "${state}" official town OR city OR village government website`;
  const organic = await serperOrganic(apiKey, discoveryQuery, 8);
  const host = pickPrimaryMunicipalHost(organic, municipality);
  return { host, discoveryQuery };
}
