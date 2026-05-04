import { NextResponse } from "next/server";
import { getStoredGmailTokens } from "@/lib/gmail-oauth";

export async function GET() {
  const stored = await getStoredGmailTokens();
  return NextResponse.json({
    connected: Boolean(stored?.refreshToken),
    email: stored?.email ?? null,
    updatedAt: stored?.updatedAt ?? null
  });
}
