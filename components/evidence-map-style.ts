import type { EvidenceMapLayerId } from "@/lib/map/types";

export type EvidenceLayerStyle = {
  color: string;
  weight: number;
  fillOpacity: number;
  dashArray?: string;
};

/**
 * Shared by the Leaflet layers and the legend swatches so the two can never
 * drift. Zoning is the only dashed outline, so it stays distinguishable from
 * the hazard fills without relying on hue alone.
 */
export const EVIDENCE_LAYER_STYLES: Record<
  EvidenceMapLayerId,
  EvidenceLayerStyle
> = {
  parcel: { color: "#142433", weight: 3, fillOpacity: 0.06 },
  zoning: { color: "#1d4ed8", weight: 2, fillOpacity: 0.1, dashArray: "6 4" },
  steep_slope: { color: "#8a5a12", weight: 1.5, fillOpacity: 0.3 },
  landslide: { color: "#7a2e2e", weight: 1.5, fillOpacity: 0.3 },
  undermined: { color: "#5b21b6", weight: 1.5, fillOpacity: 0.28 },
  flood: { color: "#0e7490", weight: 1.5, fillOpacity: 0.28 },
  historic: { color: "#1b4f4a", weight: 2, fillOpacity: 0.25 },
};
