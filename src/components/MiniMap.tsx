import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export function MiniMap({
  lat,
  lon,
  gpxTrack,
}: {
  lat: number;
  lon: number;
  gpxTrack: [number, number][];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const trackRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        touchZoom: true,
      }).setView([lat, lon], 14);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
      }).addTo(map);

      mapRef.current = map;
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update marker position
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.setView([lat, lon], map.getZoom(), { animate: false });

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
    } else {
      markerRef.current = L.circleMarker([lat, lon], {
        radius: 6,
        fillColor: "#6366f1",
        fillOpacity: 1,
        color: "#fff",
        weight: 2,
      }).addTo(map);
    }
  }, [lat, lon]);

  // Update GPX track
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (trackRef.current) {
      trackRef.current.remove();
      trackRef.current = null;
    }

    if (gpxTrack.length > 1) {
      trackRef.current = L.polyline(
        gpxTrack.map(([lt, ln]) => [lt, ln] as L.LatLngExpression),
        {
          color: "#6366f1",
          weight: 2,
          opacity: 0.5,
        }
      ).addTo(map);
    }
  }, [gpxTrack]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: 160, borderRadius: 6, overflow: "hidden" }}
    />
  );
}
