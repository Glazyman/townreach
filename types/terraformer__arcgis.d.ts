declare module "@terraformer/arcgis" {
  import type { Feature, FeatureCollection, Geometry } from "geojson";

  /** Converts ArcGIS JSON (geometry, feature, or feature collection) to GeoJSON. */
  export function arcgisToGeoJSON(arcgis: unknown, idAttribute?: string): Feature | FeatureCollection | Geometry;
}
