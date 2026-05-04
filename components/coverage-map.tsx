"use client";

import type { FeatureCollection } from "geojson";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

type Props = {
  stateId: string;
  countyId: string;
  /** Municipality GEOID (state FIPS + place FIPS), when a town is selected */
  municipalityId: string;
  className?: string;
};

export function CoverageMap({ stateId, countyId, municipalityId, className = "" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<{ remove: () => void } | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!stateId || !countyId || !containerRef.current) return;

    let cancelled = false;
    const el = containerRef.current;

    setStatus("loading");
    setErrorMessage("");

    const params = new URLSearchParams({ state: stateId, county: countyId });
    if (municipalityId.trim()) params.set("place", municipalityId.trim());

    (async () => {
      try {
        const res = await fetch(`/api/geography/coverage?${params.toString()}`);
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          const text = await res.text();
          throw new Error(
            text.startsWith("<!DOCTYPE")
              ? "Map API returned an HTML error page. Please refresh after server restart."
              : "Map API returned an unexpected response."
          );
        }
        const json = (await res.json()) as FeatureCollection | { error?: string };
        if (!res.ok || !("features" in json) || !Array.isArray(json.features)) {
          const msg = typeof (json as { error?: string }).error === "string" ? (json as { error: string }).error : "Map data failed to load";
          throw new Error(msg);
        }
        if (cancelled || !el) return;

        const L = (await import("leaflet")).default;
        mapInstanceRef.current?.remove();
        mapInstanceRef.current = null;

        const map = L.map(el, {
          zoomControl: true,
          attributionControl: true,
          scrollWheelZoom: true
        });
        mapInstanceRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &middot; Boundaries U.S. Census TIGERweb 2020'
        }).addTo(map);

        const gjLayer = L.geoJSON(json as FeatureCollection, {
          style(feature) {
            const layer = (feature?.properties as { layer?: string } | null)?.layer;
            if (layer === "county") {
              return { color: "#2563eb", weight: 2, fillColor: "#93c5fd", fillOpacity: 0.12 };
            }
            return { color: "#c2410c", weight: 2, fillColor: "#fb923c", fillOpacity: 0.28 };
          }
        }).addTo(map);

        const b = gjLayer.getBounds();
        if (b.isValid()) {
          map.fitBounds(b, { padding: [18, 18], maxZoom: 14 });
        } else {
          map.setView([39.8283, -98.5795], 4);
        }

        requestAnimationFrame(() => {
          map.invalidateSize();
          setTimeout(() => map.invalidateSize(), 200);
        });

        if (!cancelled) setStatus("idle");
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(e instanceof Error ? e.message : "Map could not load.");
      }
    })();

    return () => {
      cancelled = true;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, [stateId, countyId, municipalityId]);

  return (
    <div className={`relative min-h-[320px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${className}`}>
      <div ref={containerRef} className="h-full min-h-[320px] w-full" aria-label="Coverage map" />
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/60 text-sm font-semibold text-slate-600">
          Loading map…
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 p-4 text-center text-sm text-slate-600">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
