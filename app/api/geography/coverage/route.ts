import { NextResponse } from "next/server";
import { buildCoverageFeatureCollection } from "@/lib/geography/coverage-polygons";
import { getStateById } from "@/lib/states";

/**
 * GeoJSON for the dashboard coverage map (Census 2020 TIGERweb, WGS84).
 *
 * Query: ?state=ca&county=06-073  (required)
 *        &place=0677000           (optional municipality GEOID = state FIPS + place FIPS)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const stateId = url.searchParams.get("state")?.trim().toLowerCase();
  const countyId = url.searchParams.get("county")?.trim();
  const placeGeoid = url.searchParams.get("place")?.trim() || null;

  if (!stateId || !countyId) {
    return NextResponse.json(
      { error: 'Query parameters "state" and "county" are required (e.g. county=06-073).' },
      { status: 400 }
    );
  }
  const state = getStateById(stateId);
  if (!state) {
    return NextResponse.json({ error: "Unknown state id." }, { status: 400 });
  }
  const parts = countyId.split("-");
  if (parts.length < 2) {
    return NextResponse.json({ error: "Invalid county id. Expected format like 06-073." }, { status: 400 });
  }
  const stateFips = parts[0]!.padStart(2, "0");
  const countyFips = parts.slice(1).join("-");
  if (stateFips !== state.fips) {
    return NextResponse.json({ error: "County does not belong to the selected state." }, { status: 400 });
  }

  try {
    const collection = await buildCoverageFeatureCollection(stateFips, countyFips, placeGeoid);
    return NextResponse.json(collection, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" }
    });
  } catch {
    return NextResponse.json({ error: "Unable to load map geometry for this area." }, { status: 502 });
  }
}
