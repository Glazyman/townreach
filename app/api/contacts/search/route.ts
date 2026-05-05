import { NextResponse } from "next/server";
import { greetingFirstName } from "@/lib/contact-greeting";
import {
  extractEmailsFromText,
  filterAcceptableEmails,
  isAcceptableOutreachEmail,
  isFetchableContactUrl
} from "@/lib/contact-email";
import { crawlMunicipalDepartmentPages, discoverMunicipalHost, topicFromIntent } from "@/lib/municipal-site-search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const municipality = searchParams.get("municipality")?.trim();
  const state = searchParams.get("state")?.trim();
  const department = searchParams.get("department")?.trim();
  const intent = searchParams.get("intent")?.trim();
  const topic = topicFromIntent(intent);

  if (!municipality || !state || !department) {
    return NextResponse.json({ error: "municipality, state, and department are required" }, { status: 400 });
  }

  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Contact search is not configured. Set SERPER_API_KEY in .env.local (see https://serper.dev).",
        candidates: []
      },
      { status: 503 }
    );
  }

  const queries: string[] = [];
  let resolvedHost: string | null = null;

  try {
    const { host, discoveryQuery } = await discoverMunicipalHost(apiKey, municipality, state);
    resolvedHost = host;
    queries.push(discoveryQuery);

    if (host) {
      queries.push(
        `${department}${topic} site:${host}`,
        `${municipality} ${department}${topic} site:${host} email`,
        `${department}${topic} staff directory site:${host}`
      );
    }

    queries.push(
      `${municipality} ${state} ${department}${topic} site:.gov staff directory email`,
      `${municipality} ${state} ${department}${topic} contact email phone`,
      `${municipality} ${state} ${department}${topic} site:.gov "@"`
    );

    const crawlOrganic = host ? await crawlMunicipalDepartmentPages(host, department, topic) : [];

    const serperResults = await Promise.all(
      queries.slice(1).map((q) =>
        fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ q, num: 8 })
        }).then((r) => r.json())
      )
    );

    const seen = new Set<string>();
    const organic: SerperResult[] = [];

    for (const item of crawlOrganic) {
      if (item.link && !seen.has(item.link)) {
        seen.add(item.link);
        organic.push(item);
      }
    }

    for (const result of serperResults) {
      for (const item of result.organic ?? []) {
        if (item.link && !seen.has(item.link)) {
          seen.add(item.link);
          organic.push(item);
        }
      }
    }

    const baseCandidates = organic.map((item) => buildCandidate(item, municipality, department, resolvedHost));
    const enriched = await enrichWithPageEmails(baseCandidates, resolvedHost);

    const candidates = enriched
      .filter((c) => c.email && isAcceptableOutreachEmail(c.email))
      .sort((a, b) => b.confidence - a.confidence);

    return NextResponse.json({
      candidates,
      query: queries[queries.length > 1 ? 1 : 0] ?? queries[0],
      queriesUsed: queries,
      resolvedHost
    });
  } catch {
    return NextResponse.json({ error: "Search request failed" }, { status: 500 });
  }
}

type SerperResult = { title: string; link: string; snippet: string };

type Candidate = {
  name: string;
  title: string;
  email: string;
  allEmails: string[];
  phone: string;
  allPhones: string[];
  sourceUrl: string;
  snippet: string;
  pageTitle: string;
  confidence: number;
};

function sameRegistrableHost(host: string | null, link: string): boolean {
  if (!host) return false;
  try {
    const h = new URL(link).hostname.toLowerCase().replace(/^www\./, "");
    const root = host.toLowerCase().replace(/^www\./, "");
    return h === root || h.endsWith("." + root);
  } catch {
    return false;
  }
}

function buildCandidate(
  item: SerperResult,
  municipality: string,
  department: string,
  resolvedHost: string | null
): Candidate {
  const text = `${item.title} ${item.snippet}`;
  const emails = filterAcceptableEmails(extractEmailsFromText(text));
  const phones = extractAllPhones(text);
  const nameFromPatterns = extractName(text);
  const name =
    nameFromPatterns ||
    greetingFirstName({
      pageTitle: item.title,
      snippet: item.snippet,
      email: emails[0] ?? ""
    });

  return {
    name,
    title: extractTitle(text, department),
    email: emails[0] ?? "",
    allEmails: emails,
    phone: phones[0] ?? "",
    allPhones: phones,
    sourceUrl: item.link,
    snippet: item.snippet,
    pageTitle: item.title,
    confidence: scoreResult(item, municipality, department, emails, phones, resolvedHost)
  };
}

async function enrichWithPageEmails(candidates: Candidate[], resolvedHost: string | null): Promise<Candidate[]> {
  const out = [...candidates];
  const fetchCap = resolvedHost ? 6 : 3;
  const needFetch = out
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !c.email && isFetchableContactUrl(c.sourceUrl, resolvedHost))
    .slice(0, fetchCap);

  await Promise.all(
    needFetch.map(async ({ c, i }) => {
      try {
        const res = await fetch(c.sourceUrl, {
          redirect: "follow",
          headers: { "User-Agent": "TownReach/1.0 (public municipal directory; +https://www.census.gov)" },
          signal: AbortSignal.timeout(5000)
        });
        if (!res.ok) return;
        const html = await res.text();
        const slice = html.length > 150_000 ? html.slice(0, 150_000) : html;
        const found = filterAcceptableEmails(extractEmailsFromText(slice));
        if (found.length === 0) return;
        out[i] = {
          ...c,
          email: found[0] ?? c.email,
          allEmails: [...new Set([...found, ...c.allEmails])],
          confidence: Math.min(99, c.confidence + 20)
        };
      } catch {
        /* ignore */
      }
    })
  );

  return out;
}

function extractAllPhones(text: string): string[] {
  const matches = text.match(/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/g);
  return matches ? [...new Set(matches)] : [];
}

function extractName(text: string): string {
  const patterns = [
    /(?:contact|director|manager|coordinator|officer|clerk|administrator|chief|superintendent)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i,
    /([A-Z][a-z]+ [A-Z][a-z]+),?\s+(?:director|manager|coordinator|officer|clerk|administrator|chief)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1] ?? "";
  }
  return "";
}

function extractTitle(text: string, department: string): string {
  const titles = [
    "Director", "Manager", "Coordinator", "Administrator", "Officer",
    "Clerk", "Commissioner", "Superintendent", "Chief", "Inspector", "Deputy"
  ];
  for (const title of titles) {
    if (text.toLowerCase().includes(title.toLowerCase())) {
      return `${title}, ${department}`;
    }
  }
  return department;
}

function scoreResult(
  item: SerperResult,
  municipality: string,
  department: string,
  emails: string[],
  phones: string[],
  resolvedHost: string | null
): number {
  let score = 35;
  const text = `${item.title} ${item.snippet} ${item.link}`.toLowerCase();
  if (text.includes(municipality.toLowerCase())) score += 15;
  if (text.includes(department.toLowerCase())) score += 10;
  if (item.link.includes(".gov")) score += 15;
  if (resolvedHost && sameRegistrableHost(resolvedHost, item.link)) score += 28;
  if (emails.length > 0) score += 20;
  if (phones.length > 0) score += 8;
  if (text.includes("contact")) score += 5;
  if (text.includes("staff") || text.includes("directory")) score += 7;
  return Math.min(score, 99);
}
