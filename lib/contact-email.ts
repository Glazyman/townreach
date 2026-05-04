/** Generic mailboxes we skip when picking a *person* — department inboxes can still be real; Serp snippets rarely hold both. */
const BLOCKED_LOCALPARTS = /^(test|demo|sample|example|webmaster|postmaster|hostmaster|noreply|no-reply|donotreply|do-not-reply|mailer-daemon|bounce|abuse|newsletter|marketing)$/i;

const BLOCKED_DOMAINS =
  /(example\.(com|org|net)|test\.com|localhost|sentry\.io|schema\.org|w3\.org|googleusercontent\.com|gstatic\.com)$/i;

/** Government-ish hosts we allow for optional HTML fetch enrichment. */
export function isAllowedContactPageUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const h = u.hostname.toLowerCase();
    if (h.endsWith(".gov") || h.endsWith(".mil")) return true;
    if (h.endsWith(".state.us")) return true;
    if (/^[a-z0-9-]+\.[a-z]{2}\.us$/i.test(h)) return true;
    return false;
  } catch {
    return false;
  }
}

export function isAcceptableOutreachEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
  const [local, domain] = e.split("@");
  if (!local || !domain) return false;
  if (BLOCKED_DOMAINS.test(domain)) return false;
  const lp = local.split(/[.+]/)[0] ?? local;
  if (BLOCKED_LOCALPARTS.test(lp)) return false;
  if (domain.endsWith(".png") || domain.endsWith(".jpg")) return false;
  return true;
}

export function filterAcceptableEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const e = raw.trim().toLowerCase();
    if (!isAcceptableOutreachEmail(e)) continue;
    if (seen.has(e)) continue;
    seen.add(e);
    out.push(raw.trim());
  }
  return out;
}

export function extractEmailsFromText(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
  return matches ? [...new Set(matches)] : [];
}
