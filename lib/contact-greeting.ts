/**
 * Derive a short first name for email greetings ("Hi, Pat,").
 * Returns "" when the source text looks like a document title, URL noise, or we cannot infer a person.
 */

const JUNK_SUBSTRINGS = [
  "[pdf]",
  "by electronic mail",
  "http://",
  "https://",
  "www.",
  "electronic submission",
  "click here",
  "download",
  "application/pdf"
];

const SKIP_LOCALS = new Set([
  "info",
  "admin",
  "contact",
  "clerk",
  "office",
  "help",
  "support",
  "noreply",
  "no-reply",
  "mail",
  "webmaster",
  "records",
  "inquiries",
  "inquiry",
  "notifications",
  "newsletter",
  "postmaster",
  "daemon"
]);

function hasJunkSignals(s: string): boolean {
  const lower = s.toLowerCase();
  if (lower.length > 120) return true;
  for (const frag of JUNK_SUBSTRINGS) {
    if (lower.includes(frag)) return true;
  }
  if (/@|\.gov\s*$|\.org\/|\.com\//i.test(s)) return true;
  const digits = (s.match(/\d/g) ?? []).length;
  if (digits > 4) return true;
  if (/^\[[^\]]{2,80}\]/.test(s.trim())) return true;
  return false;
}

/** "Hon. Michelle L. Phillips" → "Michelle" */
function tryHonorificLine(s: string): string | undefined {
  const re =
    /\b(?:Hon|Mr|Mrs|Ms|Miss|Dr|Prof)\.?\s+([A-Z][a-z]{1,20})(?:\s+[A-Z]\.?)?\s+([A-Z][a-z]{1,20})\b/;
  const m = s.match(re);
  if (m?.[1]) return m[1];
  return undefined;
}

/** Strict "First Last" whole string or leading segment. */
function tryPlainPersonName(s: string): string | undefined {
  const t = s.trim();
  if (!t || t.length > 48 || hasJunkSignals(t)) return undefined;
  const two = t.match(/^([A-Z][a-z]{1,20})\s+([A-Z][a-z]{1,20})(?:\s|$|[,;])/);
  if (two?.[1]) return two[1];
  const one = t.match(/^([A-Z][a-z]{1,23})$/);
  if (one?.[1]) return one[1];
  return undefined;
}

function tryEmailLocalPart(email: string): string | undefined {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (!local || local.length < 2) return undefined;
  const parts = local.split(/[._+-]+/).filter(Boolean);
  if (parts.length === 0) return undefined;
  const first = parts[0];
  if (first.length < 2 || first.length > 24) return undefined;
  if (SKIP_LOCALS.has(first)) return undefined;
  if (!/^[a-z]+$/.test(first)) return undefined;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export function greetingFirstName(input: {
  name?: string;
  pageTitle?: string;
  snippet?: string;
  email?: string;
}): string {
  const chunks = [input.name, input.pageTitle, input.snippet].filter(Boolean) as string[];

  // Honorific + two-part name can appear at the end of noisy PDF titles; scan before junk filtering.
  for (const chunk of chunks) {
    const h = tryHonorificLine(chunk);
    if (h) return h;
  }

  if (input.name && !hasJunkSignals(input.name)) {
    const p = tryPlainPersonName(input.name);
    if (p) return p;
  }

  for (const chunk of chunks) {
    if (!chunk || hasJunkSignals(chunk)) continue;
    const p = tryPlainPersonName(chunk);
    if (p) return p;
  }

  return tryEmailLocalPart(input.email ?? "") ?? "";
}

/** After template substitution: "Hi {{contactName}}," with empty name → "Hi ," */
export function polishSalutationSpacing(text: string): string {
  return text.replace(/\b(Hi|Hello|Dear)\s+,/gi, (_, word: string) => `${word},`);
}
