import { NextResponse } from "next/server";
import { fetchCensusCountiesForState } from "@/lib/geography/census-counties";
import { getStateById } from "@/lib/states";

export async function GET(request: Request) {
  const stateId = new URL(request.url).searchParams.get("state")?.trim().toLowerCase();
  if (!stateId) {
    return NextResponse.json({ error: "Query parameter \"state\" is required (e.g. state=co)." }, { status: 400 });
  }
  const state = getStateById(stateId);
  if (!state) {
    return NextResponse.json({ error: "Unknown state id." }, { status: 400 });
  }
  try {
    const counties = await fetchCensusCountiesForState(state.fips);
    return NextResponse.json({ counties, source: "US Census Bureau 2020 PL (county-equivalent entities)" });
  } catch {
    return NextResponse.json({ error: "Unable to load counties from the Census API. Try again shortly." }, { status: 502 });
  }
}
