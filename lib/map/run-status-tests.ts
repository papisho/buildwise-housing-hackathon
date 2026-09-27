import { buildEvidenceMap } from "@/lib/map/build";
import {
  boundingBox,
  clipRingsToBox,
  expandBox,
  projectMultiPolygonTo4326,
} from "@/lib/map/project";
import {
  createDisplayGeometrySink,
  type DisplayGeometrySink,
  type EvidenceMapLayer,
} from "@/lib/map/types";
import type { FloodLookupResult } from "@/lib/hazards/flood";
import type { LandslideLookupResult } from "@/lib/hazards/landslide";
import type { SteepSlopeLookupResult } from "@/lib/hazards/steep-slope";
import type { UnderminedLookupResult } from "@/lib/hazards/undermined";
import type { HistoricDesignationResult } from "@/lib/historic/types";
import type { HazardSource } from "@/lib/hazards/arcgis";
import type { ZoningLookupResult } from "@/lib/zoning/pittsburgh";

let failures = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`PASS  ${name}`);
    return;
  }
  failures += 1;
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

/** Small rectangle in EPSG:2272 near downtown Pittsburgh, Esri clockwise. */
const PARCEL_RINGS = [
  [
    [1345000, 411000],
    [1345000, 411100],
    [1345100, 411100],
    [1345100, 411000],
    [1345000, 411000],
  ],
];

/** Overlaps the parcel and extends far past the clip window. */
const BIG_HAZARD_RINGS = [
  [
    [1340000, 406000],
    [1340000, 411050],
    [1345050, 411050],
    [1345050, 406000],
    [1340000, 406000],
  ],
];

const hazardSource: HazardSource = {
  name: "test",
  datasetUrl: "https://example.com",
  queryUrl: "https://example.com",
  resourceId: null,
  crs: "EPSG:2272",
  sourceLastModified: null,
  retrievedAt: "2026-09-27T00:00:00.000Z",
};

const historicSource = {
  name: "test",
  datasetUrl: "https://example.com",
  queryUrl: "https://example.com",
  resourceId: "test",
  crs: "EPSG:2272",
  sourceLastModified: null,
  retrievedAt: "2026-09-27T00:00:00.000Z",
};

const zoningOk: ZoningLookupResult = {
  status: "ok",
  splitZoning: true,
  districts: [
    {
      code: "R1D-VL",
      fullType: "Single-Unit Detached Residential Very Low Density",
      legendType: null,
      status: null,
      correctionLabel: null,
      intersectionAreaSqFt: 8000,
      intersectionPercent: 80,
    },
    {
      code: "GT-B",
      fullType: "Golden Triangle B",
      legendType: null,
      status: null,
      correctionLabel: null,
      intersectionAreaSqFt: 2000,
      intersectionPercent: 20,
    },
  ],
  source: {
    name: "test",
    datasetUrl: "https://example.com",
    queryUrl: "https://example.com",
    resourceId: "test",
    zoningCodeUrl: "https://example.com",
    zoningMapUrl: "https://example.com",
    cityZoningPageUrl: "https://example.com",
    sourceLastModified: null,
    retrievedAt: "2026-09-27T00:00:00.000Z",
  },
};

const slopeNotEvaluated: SteepSlopeLookupResult = {
  status: "not_evaluated",
  message: "Steep slope: Not Evaluated",
};

const landslideClear: LandslideLookupResult = {
  status: "ok",
  intersects: false,
  overlapAreaSqFt: 0,
  overlapPercent: 0,
  message: "clear",
  source: hazardSource,
};

const underminedHit: UnderminedLookupResult = {
  status: "ok",
  intersects: true,
  overlapAreaSqFt: 5000,
  overlapPercent: 50,
  classifications: ["Undermined"],
  message: "hit",
  source: hazardSource,
};

const floodClear: FloodLookupResult = {
  status: "ok",
  intersects: false,
  overlapAreaSqFt: 0,
  overlapPercent: 0,
  zones: [],
  message: "clear",
  provenance: "fema_nfhl",
  source: hazardSource,
};

function historicResult(
  overrides: Partial<HistoricDesignationResult> = {},
): HistoricDesignationResult {
  return {
    overallStatus: "NO_HISTORIC_DESIGNATION_IDENTIFIED",
    overallStatusLabel: "No designation identified",
    parcelId: "0052G00100000000",
    message: "none",
    partialEvidence: false,
    unevaluatedLayers: [],
    districts: {
      status: "ok",
      intersects: false,
      districts: [],
      overlapAreaSqFt: 0,
      overlapPercent: 0,
      message: "none",
      source: historicSource,
    },
    sites: {
      status: "ok",
      intersects: false,
      sites: [],
      overlapAreaSqFt: 0,
      overlapPercent: 0,
      message: "none",
      source: historicSource,
    },
    limitations: [],
    ...overrides,
  };
}

function buildWith(sink: DisplayGeometrySink, historic = historicResult()) {
  return buildEvidenceMap({
    pin: "0052G00100000000",
    parcelRings2272: PARCEL_RINGS,
    assessmentAddress: "5061 5TH AVE",
    lotAreaSqFt: 10000,
    zoning: zoningOk,
    steepSlope: slopeNotEvaluated,
    landslide: landslideClear,
    undermined: underminedHit,
    flood: floodClear,
    historicDesignation: historic,
    geometry: sink,
  });
}

function layer(
  layers: EvidenceMapLayer[],
  id: EvidenceMapLayer["id"],
): EvidenceMapLayer {
  const found = layers.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`missing layer ${id}`);
  }
  return found;
}

// 1. EPSG:2272 -> EPSG:4326 lands on the correct Pittsburgh coordinates.
const projectedParcel = projectMultiPolygonTo4326([
  PARCEL_RINGS.map((ring) => ring.map((point) => [point[0], point[1]])),
]);
const [lon, lat] = projectedParcel[0][0][0];
check(
  "reprojection places the parcel in Pittsburgh",
  Math.abs(lon + 79.99) < 0.02 && Math.abs(lat - 40.44) < 0.02,
  `got ${lon}, ${lat}`,
);

// 2. Clipping trims citywide geometry to the parcel vicinity.
const parcelBox = boundingBox(PARCEL_RINGS);
if (!parcelBox) {
  throw new Error("parcel bounding box failed");
}
const clipBox = expandBox(parcelBox, 400);
const clipped = clipRingsToBox(BIG_HAZARD_RINGS, clipBox);
const clippedBox = boundingBox(clipped.flat());
check(
  "hazard geometry is clipped to the parcel vicinity",
  clippedBox !== null && clippedBox.minX >= clipBox.minX - 1,
  clippedBox ? `minX ${clippedBox.minX} vs ${clipBox.minX}` : "no geometry",
);

// 3. A failed source is Not Evaluated, never a clear/no-intersection state.
const sink = createDisplayGeometrySink();
sink.zoning.push({ code: "R1D-VL", rings: BIG_HAZARD_RINGS });
sink.zoning.push({ code: "GT-B", rings: BIG_HAZARD_RINGS });
sink.undermined = BIG_HAZARD_RINGS;
const base = buildWith(sink);
if (!base) {
  throw new Error("evidence map build returned null");
}

check(
  "failed source renders as Not Evaluated",
  layer(base.layers, "steep_slope").state === "not_evaluated" &&
    layer(base.layers, "steep_slope").features.length === 0,
);
check(
  "evaluated clear source renders as no intersection",
  layer(base.layers, "landslide").state === "no_intersection",
);
check(
  "mapped hazard renders geometry",
  layer(base.layers, "undermined").state === "mapped" &&
    layer(base.layers, "undermined").features.length === 1,
);

// 4. Split zoning stays split.
check(
  "split zoning renders every intersecting district",
  layer(base.layers, "zoning").features.length === 2,
  `got ${layer(base.layers, "zoning").features.length}`,
);

// 5. Historic geometry is only what survived the screening filter.
const sliverSink = createDisplayGeometrySink();
const sliverMap = buildWith(sliverSink);
check(
  "historic sliver ignored by screening is not drawn",
  sliverMap !== null &&
    layer(sliverMap.layers, "historic").state === "no_intersection" &&
    layer(sliverMap.layers, "historic").features.length === 0,
);

const historicSink = createDisplayGeometrySink();
historicSink.historicDistricts.push({
  name: "Mexican War Streets",
  rings: BIG_HAZARD_RINGS,
});
const historicMap = buildWith(
  historicSink,
  historicResult({
    overallStatus: "HISTORIC_DISTRICT_REVIEW",
    districts: {
      status: "ok",
      intersects: true,
      districts: [
        {
          name: "Mexican War Streets",
          districtType: "CHD",
          guidelineLink: null,
          overlapAreaSqFt: 9000,
          overlapPercent: 90,
        },
      ],
      overlapAreaSqFt: 9000,
      overlapPercent: 90,
      message: "hit",
      source: historicSource,
    },
  }),
);
check(
  "surviving historic district is drawn",
  historicMap !== null &&
    layer(historicMap.layers, "historic").state === "mapped" &&
    layer(historicMap.layers, "historic").features[0].label ===
      "Mexican War Streets",
);

// 6. Historic Not Evaluated must not present as clear.
const historicFailedMap = buildWith(
  createDisplayGeometrySink(),
  historicResult({
    overallStatus: "HISTORIC_STATUS_NOT_EVALUATED",
    districts: {
      status: "not_evaluated",
      message: "Historic districts: Not Evaluated",
      source: historicSource,
    },
    sites: {
      status: "not_evaluated",
      message: "Individual historic sites: Not Evaluated",
      source: historicSource,
    },
  }),
);
check(
  "historic source failure renders as Not Evaluated",
  historicFailedMap !== null &&
    layer(historicFailedMap.layers, "historic").state === "not_evaluated",
);

// 7. Parcel popup carries canonical identity and no owner/mailing fields.
const parcelDetail = layer(base.layers, "parcel").features[0].detail.join(" ");
check(
  "parcel popup shows the canonical PARID and lot area",
  parcelDetail.includes("PARID 0052G00100000000") &&
    parcelDetail.includes("10,000 sq ft"),
  parcelDetail,
);
check(
  "parcel popup carries no owner or mailing fields",
  !/owner|mail/i.test(parcelDetail),
);

// 8. Payload stays small.
const payloadBytes = JSON.stringify(base).length;
check(
  "browser payload stays well under 250 KB",
  payloadBytes < 250_000,
  `${payloadBytes} bytes`,
);

console.log(failures === 0 ? "\nAll map status tests passed." : `\n${failures} failing.`);
process.exit(failures === 0 ? 0 : 1);
