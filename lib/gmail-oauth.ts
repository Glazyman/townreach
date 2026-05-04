import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

type StoredGmailTokens = {
  refreshToken: string;
  accessToken?: string;
  expiryDate?: number;
  scope?: string;
  tokenType?: string;
  email?: string;
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const TOKEN_FILE = path.join(DATA_DIR, "gmail-oauth.json");
const GMAIL_OAUTH_COOKIE = "tr_gmail_oauth";

function isVercelServerless() {
  return process.env.VERCEL === "1";
}

function gmailCookieSigningSecret() {
  return process.env.TOWNREACH_OAUTH_SECRET || process.env.GOOGLE_CLIENT_SECRET;
}

function encodeSignedGmailPayload(store: StoredGmailTokens) {
  const secret = gmailCookieSigningSecret();
  if (!secret) {
    throw new Error(
      "Set TOWNREACH_OAUTH_SECRET (recommended) or rely on GOOGLE_CLIENT_SECRET to sign the Gmail session cookie on Vercel."
    );
  }
  const payload = Buffer.from(JSON.stringify(store), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  const value = `${payload}.${sig}`;
  if (value.length > 3800) {
    throw new Error("Gmail OAuth data is too large for cookie storage.");
  }
  return value;
}

function decodeSignedGmailPayload(raw: string): StoredGmailTokens | null {
  const secret = gmailCookieSigningSecret();
  if (!secret) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as StoredGmailTokens;
  } catch {
    return null;
  }
}

const gmailCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 400
};

function oauthBase() {
  return "https://oauth2.googleapis.com/token";
}

export function getGmailOAuthConfig(origin: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/gmail/callback`;
  return { clientId, clientSecret, redirectUri };
}

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function getStoredGmailTokens(): Promise<StoredGmailTokens | null> {
  if (isVercelServerless()) {
    const cookieStore = await cookies();
    const raw = cookieStore.get(GMAIL_OAUTH_COOKIE)?.value;
    if (!raw) return null;
    return decodeSignedGmailPayload(raw);
  }
  try {
    const raw = await readFile(TOKEN_FILE, "utf8");
    return JSON.parse(raw) as StoredGmailTokens;
  } catch {
    return null;
  }
}

/** On Vercel, pass `response` from the OAuth callback so Set-Cookie is applied to the redirect. */
export async function saveStoredGmailTokens(tokens: StoredGmailTokens, response?: NextResponse) {
  if (isVercelServerless()) {
    const value = encodeSignedGmailPayload(tokens);
    if (response) {
      response.cookies.set(GMAIL_OAUTH_COOKIE, value, gmailCookieOptions);
      return;
    }
    const cookieStore = await cookies();
    cookieStore.set(GMAIL_OAUTH_COOKIE, value, gmailCookieOptions);
    return;
  }
  await ensureDataDir();
  await writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), "utf8");
}

export async function clearStoredGmailTokens() {
  if (isVercelServerless()) {
    const cookieStore = await cookies();
    cookieStore.delete(GMAIL_OAUTH_COOKIE);
  }
  try {
    await rm(TOKEN_FILE, { force: true });
  } catch {
    /* ignore */
  }
}

async function fetchGoogleToken(params: URLSearchParams) {
  const res = await fetch(oauthBase(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Google token exchange failed");
  }
  return json;
}

export async function exchangeCodeForGmailTokens(args: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  const params = new URLSearchParams({
    code: args.code,
    client_id: args.clientId,
    client_secret: args.clientSecret,
    redirect_uri: args.redirectUri,
    grant_type: "authorization_code"
  });
  const token = await fetchGoogleToken(params);

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` }
  });
  const profile = (await profileRes.json()) as { email?: string };

  const stored: StoredGmailTokens = {
    refreshToken: token.refresh_token || "",
    accessToken: token.access_token,
    expiryDate: Date.now() + (token.expires_in ?? 3600) * 1000 - 60_000,
    scope: token.scope,
    tokenType: token.token_type,
    email: profile.email,
    updatedAt: new Date().toISOString()
  };
  if (!stored.refreshToken) {
    const previous = await getStoredGmailTokens();
    if (previous?.refreshToken) stored.refreshToken = previous.refreshToken;
  }
  if (!stored.refreshToken) {
    throw new Error("Google did not return a refresh token. Re-consent is required.");
  }
  return stored;
}

export async function getValidGmailAccessToken(args: {
  clientId: string;
  clientSecret: string;
}) {
  const stored = await getStoredGmailTokens();
  if (!stored?.refreshToken) {
    throw new Error("Gmail is not connected.");
  }
  if (stored.accessToken && stored.expiryDate && stored.expiryDate > Date.now()) {
    return { accessToken: stored.accessToken, email: stored.email };
  }

  const params = new URLSearchParams({
    client_id: args.clientId,
    client_secret: args.clientSecret,
    refresh_token: stored.refreshToken,
    grant_type: "refresh_token"
  });
  const token = await fetchGoogleToken(params);
  const next: StoredGmailTokens = {
    ...stored,
    accessToken: token.access_token,
    expiryDate: Date.now() + (token.expires_in ?? 3600) * 1000 - 60_000,
    scope: token.scope ?? stored.scope,
    tokenType: token.token_type ?? stored.tokenType,
    updatedAt: new Date().toISOString()
  };
  await saveStoredGmailTokens(next);
  return { accessToken: next.accessToken!, email: next.email };
}
