import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

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
  try {
    const raw = await readFile(TOKEN_FILE, "utf8");
    return JSON.parse(raw) as StoredGmailTokens;
  } catch {
    return null;
  }
}

export async function saveStoredGmailTokens(tokens: StoredGmailTokens) {
  await ensureDataDir();
  await writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), "utf8");
}

export async function clearStoredGmailTokens() {
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
  await saveStoredGmailTokens(stored);
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
