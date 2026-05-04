import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getGmailOAuthConfig } from "@/lib/gmail-oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;
  const cfg = getGmailOAuthConfig(origin);
  if (!cfg.clientId || !cfg.clientSecret) {
    return NextResponse.redirect(`${origin}/connect/gmail?error=missing_env`);
  }
  const state = randomBytes(24).toString("hex");

  const googleAuth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuth.searchParams.set("client_id", cfg.clientId);
  googleAuth.searchParams.set("redirect_uri", cfg.redirectUri);
  googleAuth.searchParams.set("response_type", "code");
  googleAuth.searchParams.set("scope", "openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly");
  googleAuth.searchParams.set("access_type", "offline");
  googleAuth.searchParams.set("prompt", "consent");
  googleAuth.searchParams.set("state", state);

  const response = NextResponse.redirect(googleAuth.toString());
  response.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600
  });
  return response;
}
