export type EmailProvider = "gmail" | "outlook";

export type SendEmailInput = {
  provider: EmailProvider;
  to: string;
  subject: string;
  body: string;
  contactId: string;
  departmentId: string;
  municipalityId: string;
  senderName?: string;
  senderCompany?: string;
  senderEmail?: string;
};

import { getGmailOAuthConfig, getValidGmailAccessToken } from "@/lib/gmail-oauth";

function encodeBase64Url(input: string) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function sendWithGmail(input: SendEmailInput) {
  const origin = process.env.APP_BASE_URL || "http://localhost:3000";
  const cfg = getGmailOAuthConfig(origin);
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env vars.");
  }
  const { accessToken } = await getValidGmailAccessToken({
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret
  });
  const fromName = input.senderName?.trim() || "TownReach Sender";
  const fromEmail = input.senderEmail?.trim() || "me";
  const fromHeader = fromEmail === "me" ? fromName : `${fromName} <${fromEmail}>`;
  const mime = [
    `From: ${fromHeader}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    input.body
  ].join("\r\n");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ raw: encodeBase64Url(mime) })
  });
  const json = (await res.json()) as { id?: string; threadId?: string; error?: { message?: string } };
  if (!res.ok || !json.id || !json.threadId) {
    throw new Error(json.error?.message || "Gmail send failed");
  }
  return {
    mode: "live" as const,
    providerMessageId: json.id,
    providerThreadId: json.threadId
  };
}

export async function sendProviderEmail(input: SendEmailInput) {
  if (input.provider === "gmail") {
    return sendWithGmail(input);
  }

  // Outlook remains simulated until Microsoft OAuth/token storage is implemented.
  return {
    mode: "simulated" as const,
    providerMessageId: `${input.provider}_msg_${Date.now()}`,
    providerThreadId: `${input.provider}_thread_${Date.now()}`
  };
}
