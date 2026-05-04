import { NextResponse } from "next/server";
import { findContacts } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const contacts = findContacts({
    stateId: searchParams.get("stateId"),
    countyId: searchParams.get("countyId"),
    municipalityId: searchParams.get("municipalityId"),
    departmentId: searchParams.get("departmentId")
  });

  return NextResponse.json({ contacts });
}
