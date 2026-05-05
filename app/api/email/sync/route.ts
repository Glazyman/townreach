import { NextResponse } from "next/server";
import { parsePrimaryEmailFromFromHeader, normalizeEmailAddress } from "@/lib/email-parse";
import { getGmailOAuthConfig, getStoredGmailTokens, getValidGmailAccessToken } from "@/lib/gmail-oauth";

type SyncThreadInput = {
  provider: "gmail" | "outlook";
  providerThreadId: string;
  /** When set, only a From matching this address counts as a reply (same recipient). */
  recipientEmail?: string;
};

function headerValue(headers: { name: string; value: string }[] | undefined, name: string) {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

type GmailMessage = {
  internalDate?: string;
  payload?: { headers?: { name: string; value: string }[] };
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { threads?: SyncThreadInput[] };
  const threads = Array.isArray(body.threads) ? body.threads : [];
  const gmailThreads = threads
    .filter((t) => t.provider === "gmail" && t.providerThreadId)
    .slice(0, 100);

  const stored = await getStoredGmailTokens();
  if (!stored?.refreshToken || gmailThreads.length === 0) {
    return NextResponse.json({ ok: true, mode: "no-op", syncedReplies: [] });
  }

  const origin = new URL(request.url).origin;
  const cfg = getGmailOAuthConfig(origin);
  if (!cfg.clientId || !cfg.clientSecret) {
    return NextResponse.json({ ok: false, error: "Missing Gmail OAuth env vars." }, { status: 500 });
  }

  const { accessToken, email: connectedEmail } = await getValidGmailAccessToken({
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret
  });
  const selfEmail = normalizeEmailAddress(connectedEmail || "");
  const syncedReplies: { providerThreadId: string; status: "replied"; receivedAt: string }[] = [];

  for (const thread of gmailThreads) {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(thread.providerThreadId)}?format=metadata&metadataHeaders=From`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) continue;
    const json = (await res.json()) as { messages?: GmailMessage[] };
    const messages = json.messages ?? [];
    if (!selfEmail) continue;

    const sorted = [...messages].sort((a, b) => Number(a.internalDate ?? 0) - Number(b.internalDate ?? 0));
    const targetRecipient = thread.recipientEmail?.trim()
      ? normalizeEmailAddress(thread.recipientEmail)
      : null;

    let incoming: GmailMessage | undefined;

    for (const m of sorted) {
      const fromHeader = headerValue(m.payload?.headers, "From");
      const fromAddr = parsePrimaryEmailFromFromHeader(fromHeader);
      if (!fromAddr) continue;
      if (fromAddr === selfEmail) continue;

      if (targetRecipient) {
        if (fromAddr === targetRecipient) {
          incoming = m;
          break;
        }
        continue;
      }

      // Legacy threads (no recipientEmail): first non-self From still counts as a reply.
      incoming = m;
      break;
    }

    if (!incoming) continue;
    syncedReplies.push({
      providerThreadId: thread.providerThreadId,
      status: "replied",
      receivedAt: incoming.internalDate ? new Date(Number(incoming.internalDate)).toISOString() : new Date().toISOString()
    });
  }

  return NextResponse.json({ ok: true, mode: "live", syncedReplies });
}
