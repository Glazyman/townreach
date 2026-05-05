import { NextResponse } from "next/server";
import { sendProviderEmail } from "@/lib/email-providers";

export async function POST(request: Request) {
  const input = await request.json();
  const required = ["provider", "to", "subject", "body", "contactId", "departmentId", "municipalityId"];
  const missing = required.filter((key) => !input[key]);

  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing fields: ${missing.join(", ")}` }, { status: 400 });
  }

  try {
    const result = await sendProviderEmail(input);
    return NextResponse.json({
      ok: true,
      mode: result.mode,
      thread: {
        id: `thread_${Date.now()}`,
        contactId: input.contactId,
        departmentId: input.departmentId,
        municipalityId: input.municipalityId,
        recipientEmail: String(input.to ?? "").trim(),
        provider: input.provider,
        subject: input.subject,
        status: "sent",
        sentAt: new Date().toISOString(),
        providerThreadId: result.providerThreadId,
        providerMessageId: result.providerMessageId
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send email." },
      { status: 500 }
    );
  }
}
