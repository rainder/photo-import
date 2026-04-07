import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PhotoMeta, GpxMatch } from "../lib/commands";

export function FullMap({
  photos,
  gpxMatches,
  gpxTrack,
  focusedIndex,
  onFocus,
  onPreview,
}: {
  photos: PhotoMeta[];
  gpxMatches: Record<string, GpxMatch>;
  gpxTrack: [number, number][];
  focusedIndex: number;
  onFocus: (index: number) => void;
  onPreview: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ marker: L.CircleMarker; index: number }[]>([]);
  const focusedMarkerRef = useRef<L.CircleMarker | null>(null);
  const trackRef = useRef<L.Polyline | null>(null);

  // Build geolocated photos list
  const geoPhotos = useRef<{ lat: number; lon: number; index: number; name: string }[]>([]);
  useEffect(() => {
    geoPhotos.current = [];
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      const lat = p.latitude ?? gpxMatches[p.path]?.lat;
      const lon = p.longitude ?? gpxMatches[p.path]?.lon;
      if (lat != null && lon != null) {
        geoPhotos.current.push({ lat, lon, index: i, name: p.name });
      }
    }
  }, [photos, gpxMatches]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([0, 0], 2);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const handleMarkerClick = useCallback(
    (index: number) => {
      onFocus(index);
    },
    [onFocus]
  );

  const handleMarkerDblClick = useCallback(
    (index: number) => {
      onPreview(index);
    },
    [onPreview]
  );

  // Render markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    for (const { marker } of markersRef.current) {
      marker.remove();
    }
    markersRef.current = [];

    if (focusedMarkerRef.current) {
      focusedMarkerRef.current.remove();
      focusedMarkerRef.current = null;
    }

    // Clear track
    if (trackRef.current) {
      trackRef.current.remove();
      trackRef.current = null;
    }

    const geo = geoPhotos.current;
    if (geo.length === 0) return;

    // Add GPX track
    if (gpxTrack.length > 1) {
      trackRef.current = L.polyline(
        gpxTrack.map(([lt, ln]) => [lt, ln] as L.LatLngExpression),
        { color: "#6366f1", weight: 2, opacity: 0.4 }
      ).addTo(map);
    }

    // Add markers
    for (const g of geo) {
      const isFocused = g.index === focusedIndex;
      const marker = L.circleMarker([g.lat, g.lon], {
        radius: isFocused ? 8 : 5,
        fillColor: isFocused ? "#f59e0b" : "#6366f1",
        fillOpacity: isFocused ? 1 : 0.7,
        color: isFocused ? "#fff" : "rgba(255,255,255,0.5)",
        weight: isFocused ? 2 : 1,
      }).addTo(map);

      marker.bindTooltip(g.name, { direction: "top", offset: [0, -8] });
      marker.on("click", () => handleMarkerClick(g.index));
      marker.on("dblclick", () => handleMarkerDblClick(g.index));

      if (isFocused) {
        focusedMarkerRef.current = marker;
      }

      markersRef.current.push({ marker, index: g.index });
    }

    // Fit bounds
    const bounds = L.latLngBounds(geo.map((g) => [g.lat, g.lon] as L.LatLngExpression));
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
  }, [photos, gpxMatches, gpxTrack, focusedIndex, handleMarkerClick, handleMarkerDblClick]);

  return (
    <div
      ref={containerRef}
      className="full-map"
    />
  );
}
