/**
 * Display-only types for the Parcel & Evidence Map.
 *
 * Nothing in this module feeds scoring, coverage, flags or Claude. Geometry
 * here is captured from the evidence queries that already ran, clipped to the
 * parcel vicinity and reprojected to EPSG:4326 purely so Leaflet can draw it.
 */

export type EvidenceMapLayerId =
  | "parcel"
  | "zoning"
  | "steep_slope"
  | "landslide"
  | "undermined"
  | "flood"
  | "historic";

/** EPSG:4326 MultiPolygon coordinates: [polygon][ring][vertex][lon, lat]. */
export type DisplayMultiPolygon = number[][][][];

export type EvidenceMapFeature = {
  id: string;
  /** Popup title. Never an owner name or mailing address. */
  label: string;
  /** Popup body lines. Non-PII attributes only. */
  detail: string[];
  geometry: DisplayMultiPolygon;
};

/**
 * `mapped` — evidence evaluated and something intersects the parcel.
 * `no_intersection` — evidence evaluated, nothing mapped intersects.
 * `not_evaluated` — the source failed. Never render this as clear.
 */
export type EvidenceMapLayerState =
  | "mapped"
  | "no_intersection"
  | "not_evaluated";

export type EvidenceMapLayer = {
  id: EvidenceMapLayerId;
  name: string;
  state: EvidenceMapLayerState;
  defaultVisible: boolean;
  features: EvidenceMapFeature[];
  /** Short qualifier shown next to the legend entry, not on the map. */
  note: string | null;
};

/** Leaflet bounds order: [[south, west], [north, east]]. */
export type EvidenceMapBounds = [[number, number], [number, number]];

export type EvidenceMapData = {
  parcelPin: string;
  bounds: EvidenceMapBounds;
  layers: EvidenceMapLayer[];
};

/**
 * Write-only collector handed to the evidence providers so display geometry can
 * be captured from the same features the analysis scored. Keeping it out of the
 * evidence result objects stops unclipped EPSG:2272 rings from being serialized
 * to the browser with the rest of the analysis.
 */
export type DisplayGeometrySink = {
  zoning: Array<{ code: string; rings: number[][][] }>;
  steepSlope: number[][][];
  landslide: number[][][];
  undermined: number[][][];
  flood: number[][][];
  historicDistricts: Array<{ name: string; rings: number[][][] }>;
  historicSites: Array<{ name: string; rings: number[][][] }>;
};

export function createDisplayGeometrySink(): DisplayGeometrySink {
  return {
    zoning: [],
    steepSlope: [],
    landslide: [],
    undermined: [],
    flood: [],
    historicDistricts: [],
    historicSites: [],
  };
}
