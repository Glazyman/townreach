import { NextResponse } from "next/server";
import { getGmailOAuthConfig, getStoredGmailTokens, getValidGmailAccessToken } from "@/lib/gmail-oauth";

type SyncThreadInput = {
  provider: "gmail" | "outlook";
  providerThreadId: string;
};

function headerValue(headers: { name: string; value: string }[] | undefined, name: string) {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

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
  const selfEmail = (connectedEmail || "").toLowerCase();
  const syncedReplies: { providerThreadId: string; status: "replied"; receivedAt: string }[] = [];

  for (const thread of gmailThreads) {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(thread.providerThreadId)}?format=metadata&metadataHeaders=From`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) continue;
    const json = (await res.json()) as {
      messages?: { internalDate?: string; payload?: { headers?: { name: string; value: string }[] } }[];
    };
    const messages = json.messages ?? [];
    if (!selfEmail) continue;
    const incoming = messages.find((m) => {
      const from = headerValue(m.payload?.headers, "From").toLowerCase();
      return !from.includes(selfEmail);
    });
    if (!incoming) continue;
    syncedReplies.push({
      providerThreadId: thread.providerThreadId,
      status: "replied",
      receivedAt: incoming.internalDate ? new Date(Number(incoming.internalDate)).toISOString() : new Date().toISOString()
    });
  }

  return NextResponse.json({ ok: true, mode: "live", syncedReplies });
}
