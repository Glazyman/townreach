/** Normalize for comparison (trim + lower). */
export function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Primary mailbox from a From / Sender-style header.
 * Handles `"Name" <user@host>` and bare `user@host`.
 */
export function parsePrimaryEmailFromFromHeader(header: string): string | null {
  if (!header) return null;
  const angle = header.match(/<([^>]+)>/);
  const chunk = (angle ? angle[1] : header).trim();
  const match = chunk.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  return match ? normalizeEmailAddress(match[1]) : null;
}
