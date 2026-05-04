import type { MunicipalityRecord } from "../types";
import { getStateByFips } from "../states";

const COUNTY_LAYER = "https://tigerweb.geo.census.gov/arcgis/rest/services/Census2020/State_County/MapServer/7";
const PLACES_SERVICE = "https://tigerweb.geo.census.gov/arcgis/rest/services/Census2020/Places_CouSub_ConCity_SubMCD/MapServer";

type EsriPolygon = { rings: number[][][]; spatialReference: { wkid: number } };

function lsadcToKind(lsadc: string): MunicipalityRecord["kind"] {
  const c = lsadc?.trim() ?? "";
  if (c === "25") return "city";
  if (c === "43" || c === "47") return "town";
  if (c === "21") return "borough";
  if (c === "46") return "township";
  if (c === "57") return "village";
  return "city";
}

async function fetchCountyPolygonRings(stateFips: string, countyFips: string): Promise<number[][]> {
  const params = new URLSearchParams({
    where: `STATE='${stateFips}' AND COUNTY='${countyFips}'`,
    outFields: "NAME",
    returnGeometry: "true",
    outSR: "4326",
    f: "json",
    maxAllowableOffset: "0.02"
  });
  const res = await fetch(`${COUNTY_LAYER}/query?${params.toString()}`, { next: { revalidate: 86_400 } });
  if (!res.ok) throw new Error(`County geometry HTTP ${res.status}`);
  const json = (await res.json()) as { features?: { geometry?: EsriPolygon }[] };
  const rings = json.features?.[0]?.geometry?.rings?.[0];
  if (!rings?.length) throw new Error("County polygon not found");
  return rings;
}

async function queryPlaceLayer(
  layerId: number,
  geometryRings: number[][],
  stateFips: string,
  countyCompositeId: string
): Promise<MunicipalityRecord[]> {
  const geometry: EsriPolygon = {
    rings: [geometryRings],
    spatialReference: { wkid: 4326 }
  };

  const body = new URLSearchParams({
    geometry: JSON.stringify(geometry),
    geometryType: "esriGeometryPolygon",
    spatialRel: "esriSpatialRelIntersects",
    inSR: "4326",
    where: `STATE='${stateFips}'`,
    outFields: "BASENAME,NAME,LSADC,STATE,PLACE,GEOID",
    returnGeometry: "false",
    f: "json",
    orderByFields: "BASENAME",
    resultRecordCount: "2000"
  });

  const state = getStateByFips(stateFips);
  if (!state) return [];

  const out: MunicipalityRecord[] = [];
  let offset = 0;

  for (;;) {
    body.set("resultOffset", String(offset));
    const res = await fetch(`${PLACES_SERVICE}/${layerId}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      next: { revalidate: 86_400 }
    });
    if (!res.ok) throw new Error(`Places layer ${layerId} HTTP ${res.status}`);
    const json = (await res.json()) as {
      features?: { attributes: Record<string, string> }[];
      exceededTransferLimit?: boolean;
    };
    const feats = json.features ?? [];

    for (const f of feats) {
      const a = f.attributes;
      const geoid = (a.GEOID ?? `${a.STATE}${a.PLACE}`).trim();
      const lsadc = a.LSADC ?? "";
      out.push({
        id: geoid,
        countyId: countyCompositeId,
        stateId: state.id,
        name: (a.BASENAME || a.NAME || "Unknown").trim(),
        kind: lsadcToKind(lsadc),
        placeFips: (a.PLACE ?? "").trim()
      });
    }

    if (!json.exceededTransferLimit || feats.length === 0) break;
    offset += feats.length;
    if (offset > 50_000) break;
  }

  return out;
}

/**
 * Incorporated places (layer 4) + CDPs (layer 5) intersecting the county polygon (Census 2020).
 */
export async function fetchPlacesInCounty(
  stateFips: string,
  countyFips: string,
  countyCompositeId: string
): Promise<MunicipalityRecord[]> {
  const rings = await fetchCountyPolygonRings(stateFips, countyFips);
  const [inc, cdps] = await Promise.all([
    queryPlaceLayer(4, rings, stateFips, countyCompositeId),
    queryPlaceLayer(5, rings, stateFips, countyCompositeId)
  ]);
  const byId = new Map<string, MunicipalityRecord>();
  for (const r of [...inc, ...cdps]) byId.set(r.id, r);
  const list = [...byId.values()];
  list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}
