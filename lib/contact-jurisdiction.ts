/**
 * Keep only contacts that belong to the selected place’s jurisdiction:
 * prefer the resolved official government host; otherwise tie rows to the place name / URL host.
 */

export type JurisdictionCandidate = {
  sourceUrl: string;
  pageTitle: string;
  snippet: string;
  email: string;
};

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

/** Same registrable host (handles www.). */
export function sameRegistrableHost(rootHost: string, pageUrl: string): boolean {
  try {
    const h = normalizeHost(new URL(pageUrl).hostname);
    const r = normalizeHost(rootHost);
    return h === r || h.endsWith("." + r);
  } catch {
    return false;
  }
}

/** Require mailbox domain to align with page host (drops cross-town / neighbor scrape noise). */
function emailDomainAlignedWithPage(email: string, pageUrl: string): boolean {
  const dom = email.split("@")[1]?.toLowerCase().trim().replace(/^www\./, "");
  if (!dom) return false;
  try {
    const pageHost = normalizeHost(new URL(pageUrl).hostname);
    return dom === pageHost || pageHost.endsWith("." + dom);
  } catch {
    return false;
  }
}

/** Place name signals in page text/path (helps when discovery did not yield a single host). */
function mentionsPlace(blob: string, municipality: string): boolean {
  const muniNorm = municipality.toLowerCase().replace(/\s+/g, " ").trim();
  const mCompact = muniNorm.replace(/\s/g, "");
  const b = blob.toLowerCase();
  if (b.includes(muniNorm)) return true;
  if (mCompact.length >= 4 && b.includes(mCompact)) return true;
  return false;
}

function pathnameOf(urlStr: string): string {
  try {
    return new URL(urlStr).pathname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Drops neighboring jurisdictions when we can anchor to official host; otherwise requires the
 * selected place name (or slug-like host/path) so Red Hook/Ramapo mix-ups disappear.
 */
export function filterCandidatesToJurisdiction<T extends JurisdictionCandidate>(
  candidates: T[],
  municipality: string,
  _state: string,
  resolvedHost: string | null
): T[] {
  let out = candidates.filter((c) => emailDomainAlignedWithPage(c.email.trim(), c.sourceUrl));

  if (resolvedHost) {
    return out.filter((c) => sameRegistrableHost(resolvedHost, c.sourceUrl));
  }

  const muniNorm = municipality.toLowerCase().replace(/\s+/g, " ").trim();
  const mCompact = muniNorm.replace(/\s/g, "");
  const prefix = mCompact.length >= 4 ? mCompact.slice(0, Math.min(10, mCompact.length)) : "";

  out = out.filter((c) => {
    const path = pathnameOf(c.sourceUrl);
    const blob = `${c.pageTitle} ${c.snippet} ${c.sourceUrl} ${path}`.toLowerCase();
    if (mentionsPlace(blob, municipality)) return true;

    try {
      const h = normalizeHost(new URL(c.sourceUrl).hostname);
      if (prefix && h.includes(prefix)) return true;
    } catch {
      /* skip */
    }
    return false;
  });

  return out;
}
