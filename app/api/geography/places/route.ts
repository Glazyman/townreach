import { NextResponse } from "next/server";
import { fetchPlacesInCounty } from "@/lib/geography/tigerweb-places";
import { getStateById } from "@/lib/states";

/**
 * ?state=co&county=08-041
 * county id format: {stateFips}-{countyFips} from /api/geography/counties
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const stateId = url.searchParams.get("state")?.trim().toLowerCase();
  const countyId = url.searchParams.get("county")?.trim();
  if (!stateId || !countyId) {
    return NextResponse.json({ error: "Query parameters \"state\" and \"county\" are required (e.g. county=08-041)." }, { status: 400 });
  }
  const state = getStateById(stateId);
  if (!state) {
    return NextResponse.json({ error: "Unknown state id." }, { status: 400 });
  }
  const parts = countyId.split("-");
  if (parts.length < 2) {
    return NextResponse.json({ error: "Invalid county id. Expected format like 08-041." }, { status: 400 });
  }
  const stateFips = parts[0]!.padStart(2, "0");
  const countyFips = parts.slice(1).join("-");
  if (stateFips !== state.fips) {
    return NextResponse.json({ error: "County does not belong to the selected state." }, { status: 400 });
  }
  try {
    const places = await fetchPlacesInCounty(stateFips, countyFips, countyId);
    return NextResponse.json({
      places,
      source: "US Census Bureau TIGERweb 2020 (incorporated places + CDPs intersecting county)"
    });
  } catch {
    return NextResponse.json({ error: "Unable to load places for this county. Try again shortly." }, { status: 502 });
  }
}
