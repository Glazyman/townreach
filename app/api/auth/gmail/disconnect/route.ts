import { NextResponse } from "next/server";
import { clearStoredGmailTokens } from "@/lib/gmail-oauth";

export async function POST() {
  await clearStoredGmailTokens();
  return NextResponse.json({ ok: true });
}
