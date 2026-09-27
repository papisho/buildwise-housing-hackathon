"use client";

import { useEffect, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { EVIDENCE_LAYER_STYLES } from "@/components/evidence-map-style";
import type {
  EvidenceMapData,
  EvidenceMapFeature,
  EvidenceMapLayerId,
} from "@/lib/map/types";

const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors — basemap context only, not a BuildWise evidence source';
const FIT_OPTIONS: L.FitBoundsOptions = { padding: [16, 16], maxZoom: 18 };

/**
 * Built with textContent rather than innerHTML because labels come from GIS
 * attribute values.
 */
function popupElement(
  layerName: string,
  feature: EvidenceMapFeature,
): HTMLElement {
  const root = document.createElement("div");

  const kicker = document.createElement("p");
  kicker.textContent = layerName;
  kicker.style.cssText =
    "margin:0;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#5a6874";
  root.appendChild(kicker);

  const title = document.createElement("p");
  title.textContent = feature.label;
  title.style.cssText = "margin:2px 0 0;font-size:13px;font-weight:600";
  root.appendChild(title);

  for (const line of feature.detail) {
    const item = document.createElement("p");
    item.textContent = line;
    item.style.cssText = "margin:2px 0 0;font-size:12px;color:#142433";
    root.appendChild(item);
  }

  return root;
}

export default function EvidenceMapCanvas({
  data,
  visibleLayerIds,
  resetCount,
  onTileError,
}: {
  data: EvidenceMapData;
  visibleLayerIds: EvidenceMapLayerId[];
  resetCount: number;
  onTileError: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupsRef = useRef(new Map<EvidenceMapLayerId, L.LayerGroup>());
  const tileErrorRef = useRef(onTileError);

  useEffect(() => {
    tileErrorRef.current = onTileError;
  }, [onTileError]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const map = L.map(container, {
      // Wheel zoom off so the page still scrolls past the map on touch devices.
      scrollWheelZoom: false,
      zoomControl: true,
    });
    mapRef.current = map;

    const tiles = L.tileLayer(OSM_TILE_URL, {
      attribution: OSM_ATTRIBUTION,
      maxZoom: 19,
    });
    tiles.on("tileerror", () => tileErrorRef.current());
    tiles.addTo(map);

    const groups = groupsRef.current;
    for (const layer of data.layers) {
      if (layer.features.length === 0) {
        continue;
      }
      const style = EVIDENCE_LAYER_STYLES[layer.id];
      const group = L.layerGroup();
      for (const feature of layer.features) {
        L.geoJSON(
          {
            type: "Feature",
            properties: {},
            geometry: { type: "MultiPolygon", coordinates: feature.geometry },
          } as GeoJSON.Feature,
          { style: () => ({ ...style, fillColor: style.color }) },
        )
          .bindPopup(popupElement(layer.name, feature))
          .addTo(group);
      }
      groups.set(layer.id, group);
    }

    map.fitBounds(data.bounds, FIT_OPTIONS);

    return () => {
      map.remove();
      mapRef.current = null;
      groups.clear();
    };
  }, [data]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    for (const [id, group] of groupsRef.current) {
      const shouldShow = visibleLayerIds.includes(id);
      if (shouldShow && !map.hasLayer(group)) {
        group.addTo(map);
      } else if (!shouldShow && map.hasLayer(group)) {
        map.removeLayer(group);
      }
    }
    // Keep the subject parcel readable through any overlapping evidence fill.
    groupsRef.current.get("parcel")?.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON) {
        layer.bringToFront();
      }
    });
  }, [visibleLayerIds]);

  useEffect(() => {
    if (resetCount > 0) {
      mapRef.current?.fitBounds(data.bounds, FIT_OPTIONS);
    }
  }, [resetCount, data.bounds]);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={`Map of validated parcel ${data.parcelPin} and mapped evidence`}
      className="h-[20rem] w-full rounded-lg border border-line bg-paper sm:h-[26rem]"
    />
  );
}
