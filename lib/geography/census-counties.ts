import type { CountyRecord } from "../types";
import { getStateByFips } from "../states";

/** All counties / county-equivalents for a state from 2020 Census PL (public, no API key). */
export async function fetchCensusCountiesForState(stateFips: string): Promise<CountyRecord[]> {
  const url = `https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:*&in=state:${stateFips}`;
  const res = await fetch(url, { next: { revalidate: 86_400 } });
  if (!res.ok) throw new Error(`Census counties HTTP ${res.status}`);
  const json: unknown = await res.json();
  if (!Array.isArray(json) || json.length < 2) throw new Error("Unexpected Census counties response");

  const rows = json as string[][];
  const [, ...dataRows] = rows;
  const out: CountyRecord[] = [];

  for (const row of dataRows) {
    const [name, st, countyFips] = row;
    const state = getStateByFips(st);
    if (!state) continue;
    const cleanName = name.replace(/, [^,]+$/, "").trim();
    out.push({
      id: `${st}-${countyFips}`,
      stateId: state.id,
      name: cleanName,
      fips: countyFips
    });
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
