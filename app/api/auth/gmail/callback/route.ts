import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForGmailTokens, getGmailOAuthConfig } from "@/lib/gmail-oauth";

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
    await exchangeCodeForGmailTokens({
      code,
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      redirectUri: cfg.redirectUri
    });
  } catch {
    return NextResponse.redirect(`${origin}/connect/gmail?error=token_exchange`);
  }

  return NextResponse.redirect(`${origin}/?gmail_connected=1`);
}
