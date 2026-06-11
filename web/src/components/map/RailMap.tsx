"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { RouteStop } from "@/lib/types";

export interface RailMapMarker {
  lat: number;
  lon: number;
  headingDeg: number;
  label: string;
}

interface RailMapProps {
  route: RouteStop[];
  marker?: RailMapMarker | null;
  /** Stations with sequenceNumber <= this are rendered "passed" (filled). */
  passedSequence?: number;
  /** Re-invalidates the map's size when this becomes true (fixes blank
   * tiles when the map starts inside a hidden tab panel). */
  active?: boolean;
  /** 'fitRoute' fits bounds to the whole route once on mount; 'focusMarker'
   * centers/zooms on the marker once on mount. */
  initialView?: "fitRoute" | "focusMarker";
}

function createTrainIcon(headingDeg: number) {
  return L.divIcon({
    className: "train-marker",
    html: `<div style="font-size:22px;line-height:24px;color:#38bdf8;text-shadow:0 0 6px rgba(56,189,248,0.9);transform:rotate(${headingDeg}deg);transform-origin:center;display:flex;align-items:center;justify-content:center;">▲</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function ResizeOnActive({ active }: { active?: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(id);
  }, [active, map]);
  return null;
}

function InitialView({
  mode,
  routeLatLngs,
  marker,
}: {
  mode: "fitRoute" | "focusMarker";
  routeLatLngs: [number, number][];
  marker?: RailMapMarker | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (mode === "fitRoute") {
      map.fitBounds(L.latLngBounds(routeLatLngs), { padding: [20, 20] });
    } else if (mode === "focusMarker" && marker) {
      map.setView([marker.lat, marker.lon], 6);
    }
    // run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function RailMap({ route, marker, passedSequence = 0, active, initialView = "fitRoute" }: RailMapProps) {
  const routeLatLngs = useMemo<[number, number][]>(() => route.map((s) => [s.lat, s.lon]), [route]);
  const center = routeLatLngs[Math.floor(routeLatLngs.length / 2)];

  return (
    <MapContainer center={center} zoom={5} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
      <ResizeOnActive active={active} />
      <InitialView mode={initialView} routeLatLngs={routeLatLngs} marker={marker} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={18}
      />
      <Polyline positions={routeLatLngs} pathOptions={{ color: "#3b82f6", weight: 3, opacity: 0.6 }} />
      {route.map((s) => {
        const isPassed = s.sequenceNumber <= passedSequence;
        return (
          <CircleMarker
            key={s.code}
            center={[s.lat, s.lon]}
            radius={isPassed ? 6 : 5}
            pathOptions={{
              color: isPassed ? "#94a3b8" : "#475569",
              fillColor: isPassed ? "#94a3b8" : "#0b1220",
              fillOpacity: 1,
              weight: 2,
            }}
          >
            <Tooltip>
              {s.code} — {s.name}
            </Tooltip>
          </CircleMarker>
        );
      })}
      {marker && (
        <Marker position={[marker.lat, marker.lon]} icon={createTrainIcon(marker.headingDeg)}>
          <Tooltip>{marker.label}</Tooltip>
        </Marker>
      )}
    </MapContainer>
  );
}
