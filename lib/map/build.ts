import type { FloodLookupResult } from "@/lib/hazards/flood";
import type { LandslideLookupResult } from "@/lib/hazards/landslide";
import type { SteepSlopeLookupResult } from "@/lib/hazards/steep-slope";
import type { UnderminedLookupResult } from "@/lib/hazards/undermined";
import type { HistoricDesignationResult } from "@/lib/historic/types";
import type { ZoningLookupResult } from "@/lib/zoning/pittsburgh";
import {
  boundingBox,
  clipRingsToBox,
  expandBox,
  projectBoxTo4326,
  projectMultiPolygonTo4326,
  type PlanarBox,
} from "@/lib/map/project";
import type {
  DisplayGeometrySink,
  EvidenceMapData,
  EvidenceMapFeature,
  EvidenceMapLayer,
} from "@/lib/map/types";

/** Feet of context around the parcel for the initial view. */
const MIN_VIEW_BUFFER_FEET = 100;
const MAX_VIEW_BUFFER_FEET = 400;
const VIEW_BUFFER_RATIO = 0.6;

const NOT_EVALUATED_NOTE =
  "Not Evaluated — the source did not return evidence. This is not a finding of no intersection.";
const NO_INTERSECTION_NOTE = "No mapped intersection with this parcel.";
const NO_DISPLAY_GEOMETRY_NOTE =
  "Intersection found, but the source returned no renderable geometry.";

function viewBufferFeet(box: PlanarBox): number {
  const span = Math.max(box.maxX - box.minX, box.maxY - box.minY);
  return Math.min(
    MAX_VIEW_BUFFER_FEET,
    Math.max(MIN_VIEW_BUFFER_FEET, span * VIEW_BUFFER_RATIO),
  );
}

function formatPercent(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  return `${value < 0.1 && value > 0 ? "<0.1" : value.toFixed(1)}%`;
}

function overlapLine(value: number | null): string {
  const formatted = formatPercent(value);
  return formatted
    ? `Parcel overlap: ${formatted}`
    : "Parcel overlap: not computed";
}

function feature(
  id: string,
  label: string,
  detail: Array<string | null>,
  rings: number[][][],
  clipBox: PlanarBox,
): EvidenceMapFeature | null {
  const geometry = projectMultiPolygonTo4326(clipRingsToBox(rings, clipBox));
  if (geometry.length === 0) {
    return null;
  }
  return {
    id,
    label,
    detail: detail.filter((line): line is string => Boolean(line)),
    geometry,
  };
}

/**
 * Collapses an evaluated hazard into a single drawable layer. `intersects`
 * comes from the scored evidence, never from whether geometry survived
 * clipping.
 */
function hazardLayer(input: {
  id: EvidenceMapLayer["id"];
  name: string;
  evaluated: boolean;
  intersects: boolean;
  overlapPercent: number | null;
  detail: Array<string | null>;
  rings: number[][][];
  clipBox: PlanarBox;
}): EvidenceMapLayer {
  if (!input.evaluated) {
    return {
      id: input.id,
      name: input.name,
      state: "not_evaluated",
      defaultVisible: false,
      features: [],
      note: NOT_EVALUATED_NOTE,
    };
  }

  if (!input.intersects) {
    return {
      id: input.id,
      name: input.name,
      state: "no_intersection",
      defaultVisible: false,
      features: [],
      note: NO_INTERSECTION_NOTE,
    };
  }

  const hit = feature(
    input.id,
    input.name,
    [overlapLine(input.overlapPercent), ...input.detail],
    input.rings,
    input.clipBox,
  );

  return {
    id: input.id,
    name: input.name,
    state: "mapped",
    defaultVisible: hit !== null,
    features: hit ? [hit] : [],
    note: hit ? null : NO_DISPLAY_GEOMETRY_NOTE,
  };
}

function zoningLayer(
  zoning: ZoningLookupResult,
  sink: DisplayGeometrySink,
  clipBox: PlanarBox,
): EvidenceMapLayer {
  if (zoning.status === "unavailable") {
    return {
      id: "zoning",
      name: "Base zoning",
      state: "not_evaluated",
      defaultVisible: false,
      features: [],
      note: NOT_EVALUATED_NOTE,
    };
  }

  if (zoning.status === "no_district") {
    return {
      id: "zoning",
      name: "Base zoning",
      state: "no_intersection",
      defaultVisible: false,
      features: [],
      note: "No mapped zoning district found for this parcel.",
    };
  }

  const byCode = new Map(sink.zoning.map((entry) => [entry.code, entry.rings]));
  // Every intersecting district is drawn separately so split zoning stays
  // visible instead of being collapsed into one shape.
  const features = zoning.districts.flatMap((district) => {
    const rings = byCode.get(district.code) ?? [];
    const hit = feature(
      `zoning-${district.code}`,
      district.code,
      [
        district.fullType ?? district.legendType,
        overlapLine(district.intersectionPercent),
      ],
      rings,
      clipBox,
    );
    return hit ? [hit] : [];
  });

  return {
    id: "zoning",
    name: zoning.splitZoning ? "Base zoning (split)" : "Base zoning",
    state: "mapped",
    defaultVisible: features.length > 0,
    features,
    note: features.length > 0 ? null : NO_DISPLAY_GEOMETRY_NOTE,
  };
}

function historicLayer(
  historic: HistoricDesignationResult,
  sink: DisplayGeometrySink,
  clipBox: PlanarBox,
): EvidenceMapLayer {
  const { districts, sites } = historic;
  const name = "Historic district / site";

  if (districts.status !== "ok" && sites.status !== "ok") {
    return {
      id: "historic",
      name,
      state: "not_evaluated",
      defaultVisible: false,
      features: [],
      note: NOT_EVALUATED_NOTE,
    };
  }

  // The sink only ever receives rings that survived the <1% geometry-noise
  // filter and the canonical-PIN lotblock override, so an ignored sliver is
  // never drawn as a positive historic finding.
  const features = [
    ...sink.historicDistricts.map((entry, index) => ({
      id: `historic-district-${index}`,
      label: entry.name,
      detail: [
        "City historic district",
        overlapLine(
          districts.status === "ok"
            ? (districts.districts.find(
                (district) => district.name === entry.name,
              )?.overlapPercent ?? null)
            : null,
        ),
      ],
      rings: entry.rings,
    })),
    ...sink.historicSites.map((entry, index) => ({
      id: `historic-site-${index}`,
      label: entry.name,
      detail: [
        "Individually designated historic site",
        overlapLine(
          sites.status === "ok"
            ? (sites.sites.find((site) => site.name === entry.name)
                ?.overlapPercent ?? null)
            : null,
        ),
      ],
      rings: entry.rings,
    })),
  ].flatMap((entry) => {
    const hit = feature(
      entry.id,
      entry.label,
      entry.detail,
      entry.rings,
      clipBox,
    );
    return hit ? [hit] : [];
  });

  const intersects =
    (districts.status === "ok" && districts.intersects) ||
    (sites.status === "ok" && sites.intersects);
  const partial = districts.status !== "ok" || sites.status !== "ok";
  const partialNote = partial
    ? " One historic layer was Not Evaluated, so this is partial evidence."
    : "";

  if (!intersects) {
    return {
      id: "historic",
      name,
      state: "no_intersection",
      defaultVisible: false,
      features: [],
      note: `No mapped City historic district or site intersection.${partialNote}`,
    };
  }

  return {
    id: "historic",
    name,
    state: "mapped",
    defaultVisible: features.length > 0,
    features,
    note:
      features.length > 0
        ? partialNote.trim() || null
        : `${NO_DISPLAY_GEOMETRY_NOTE}${partialNote}`,
  };
}

export function buildEvidenceMap(input: {
  pin: string;
  parcelRings2272: number[][][];
  assessmentAddress: string | null;
  lotAreaSqFt: number | null;
  zoning: ZoningLookupResult;
  steepSlope: SteepSlopeLookupResult;
  landslide: LandslideLookupResult;
  undermined: UnderminedLookupResult;
  flood: FloodLookupResult;
  historicDesignation: HistoricDesignationResult;
  geometry: DisplayGeometrySink;
}): EvidenceMapData | null {
  const parcelBox = boundingBox(input.parcelRings2272);
  if (!parcelBox) {
    return null;
  }

  const viewBuffer = viewBufferFeet(parcelBox);
  const bounds = projectBoxTo4326(expandBox(parcelBox, viewBuffer));
  const clipBox = expandBox(parcelBox, Math.max(viewBuffer * 2, 400));

  const parcel = feature(
    "parcel",
    "Validated subject parcel",
    [
      `PARID ${input.pin}`,
      input.assessmentAddress
        ? `Assessment address: ${input.assessmentAddress}`
        : null,
      input.lotAreaSqFt !== null
        ? `County lot area: ${Math.round(input.lotAreaSqFt).toLocaleString("en-US")} sq ft`
        : null,
    ],
    input.parcelRings2272,
    clipBox,
  );

  if (!bounds || !parcel) {
    return null;
  }

  const layers: EvidenceMapLayer[] = [
    {
      id: "parcel",
      name: "Subject parcel",
      state: "mapped",
      defaultVisible: true,
      features: [parcel],
      note: null,
    },
    zoningLayer(input.zoning, input.geometry, clipBox),
    hazardLayer({
      id: "steep_slope",
      name: "Steep slope ≥25%",
      evaluated: input.steepSlope.status === "ok",
      intersects:
        input.steepSlope.status === "ok" && input.steepSlope.intersects,
      overlapPercent:
        input.steepSlope.status === "ok"
          ? input.steepSlope.overlapPercent
          : null,
      detail: [],
      rings: input.geometry.steepSlope,
      clipBox,
    }),
    hazardLayer({
      id: "landslide",
      name: "Landslide-prone area",
      evaluated: input.landslide.status === "ok",
      intersects: input.landslide.status === "ok" && input.landslide.intersects,
      overlapPercent:
        input.landslide.status === "ok" ? input.landslide.overlapPercent : null,
      detail: [],
      rings: input.geometry.landslide,
      clipBox,
    }),
    hazardLayer({
      id: "undermined",
      name: "Undermined / mine",
      evaluated: input.undermined.status === "ok",
      intersects:
        input.undermined.status === "ok" && input.undermined.intersects,
      overlapPercent:
        input.undermined.status === "ok"
          ? input.undermined.overlapPercent
          : null,
      detail:
        input.undermined.status === "ok" &&
        input.undermined.classifications.length > 0
          ? [`Classification: ${input.undermined.classifications.join(", ")}`]
          : [],
      rings: input.geometry.undermined,
      clipBox,
    }),
    hazardLayer({
      id: "flood",
      name: "Flood hazard",
      evaluated: input.flood.status === "ok",
      intersects: input.flood.status === "ok" && input.flood.intersects,
      overlapPercent:
        input.flood.status === "ok" ? input.flood.overlapPercent : null,
      detail:
        input.flood.status === "ok" && input.flood.zones.length > 0
          ? [
              `Zone: ${input.flood.zones
                .map((zone) => zone.fldZone ?? "unlabelled")
                .join(", ")}`,
            ]
          : [],
      rings: input.geometry.flood,
      clipBox,
    }),
    historicLayer(input.historicDesignation, input.geometry, clipBox),
  ];

  return { parcelPin: input.pin, bounds, layers };
}
