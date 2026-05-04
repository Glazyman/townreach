import { arcgisToGeoJSON } from "@terraformer/arcgis";
import type { Feature, FeatureCollection } from "geojson";

const COUNTY_LAYER =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/Census2020/State_County/MapServer/7";
const PLACES_SERVICE =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/Census2020/Places_CouSub_ConCity_SubMCD/MapServer";

type EsriFeature = { geometry?: { rings?: number[][][]; spatialReference?: { wkid: number } }; attributes?: Record<string, string> };
type EsriQueryJson = { features?: EsriFeature[] };

/**
 * County polygon for map coverage (Census 2020 county / equivalent, WGS84).
 */
export async function fetchCountyCoverageFeature(stateFips: string, countyFips: string): Promise<Feature> {
  const params = new URLSearchParams({
    where: `STATE='${stateFips}' AND COUNTY='${countyFips}'`,
    outFields: "NAME,STATE,COUNTY",
    returnGeometry: "true",
    outSR: "4326",
    f: "json"
  });
  const res = await fetch(`${COUNTY_LAYER}/query?${params.toString()}`, { next: { revalidate: 86_400 } });
  if (!res.ok) throw new Error(`County coverage HTTP ${res.status}`);
  const json = (await res.json()) as EsriQueryJson;
  const raw = json.features?.[0];
  if (!raw?.geometry) throw new Error("County polygon not found");
  const gj = arcgisToGeoJSON(raw) as Feature;
  if (!gj.geometry) throw new Error("County geometry conversion failed");
  gj.properties = { layer: "county", name: (raw.attributes?.NAME ?? "").trim() || "County" };
  return gj;
}

/**
 * Incorporated place (layer 4) or CDP (layer 5) boundary by state + place FIPS.
 */
export async function fetchPlaceCoverageFeature(stateFips: string, placeFips: string): Promise<Feature | null> {
  const place = placeFips.padStart(5, "0");
  const where = `STATE='${stateFips}' AND PLACE='${place}'`;

  for (const layerId of [4, 5]) {
    const params = new URLSearchParams({
      where,
      outFields: "BASENAME,NAME,GEOID,LSADC",
      returnGeometry: "true",
      outSR: "4326",
      f: "json"
    });
    const res = await fetch(`${PLACES_SERVICE}/${layerId}/query?${params.toString()}`, { next: { revalidate: 86_400 } });
    if (!res.ok) continue;
    const json = (await res.json()) as EsriQueryJson;
    const raw = json.features?.[0];
    if (!raw?.geometry) continue;
    const gj = arcgisToGeoJSON(raw) as Feature;
    if (!gj.geometry) continue;
    const label = (raw.attributes?.BASENAME || raw.attributes?.NAME || "Place").trim();
    gj.properties = { layer: layerId === 4 ? "incorporated_place" : "cdp", name: label };
    return gj;
  }
  return null;
}

/** Build a FeatureCollection for the coverage map (county always; place when geoid present). */
export async function buildCoverageFeatureCollection(
  stateFips: string,
  countyFips: string,
  placeGeoid?: string | null
): Promise<FeatureCollection> {
  const countyFeature = await fetchCountyCoverageFeature(stateFips, countyFips);
  const features: Feature[] = [countyFeature];

  if (placeGeoid && placeGeoid.length >= 7) {
    const st = placeGeoid.slice(0, 2);
    const pl = placeGeoid.slice(2);
    if (st === stateFips) {
      const placeFeat = await fetchPlaceCoverageFeature(stateFips, pl);
      if (placeFeat) features.push(placeFeat);
    }
  }

  return { type: "FeatureCollection", features };
}
