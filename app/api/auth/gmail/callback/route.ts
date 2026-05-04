import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeCodeForGmailTokens,
  getGmailOAuthConfig,
  saveStoredGmailTokens
} from "@/lib/gmail-oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("gmail_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${origin}/connect/gmail?error=state`);
  }

  const cfg = getGmailOAuthConfig(origin);
  if (!cfg.clientId || !cfg.clientSecret) {
    return NextResponse.redirect(`${origin}/connect/gmail?error=missing_env`);
  }

  try {
    const stored = await exchangeCodeForGmailTokens({
      code,
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      redirectUri: cfg.redirectUri
    });
    const res = NextResponse.redirect(`${origin}/?gmail_connected=1`);
    await saveStoredGmailTokens(stored, res);
    return res;
  } catch (err) {
    console.error("[gmail/callback] token_exchange", err);
    return NextResponse.redirect(`${origin}/connect/gmail?error=token_exchange`);
  }
}
