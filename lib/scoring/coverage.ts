import type { AssessmentLookupResult } from "@/lib/assessments/wprdc";
import type { FloodLookupResult } from "@/lib/hazards/flood";
import type { LandslideLookupResult } from "@/lib/hazards/landslide";
import type { SteepSlopeLookupResult } from "@/lib/hazards/steep-slope";
import type { UnderminedLookupResult } from "@/lib/hazards/undermined";
import type { ZoningLookupResult } from "@/lib/zoning/pittsburgh";
import {
  COVERAGE_THRESHOLDS,
  COVERAGE_WEIGHTS,
} from "@/lib/scoring/config";

export type EvidenceState =
  | "EVALUATED"
  | "NOT_EVALUATED"
  | "SOURCE_UNAVAILABLE";

export type CoverageItem = {
  id: keyof typeof COVERAGE_WEIGHTS;
  label: string;
  weight: number;
  state: EvidenceState;
};

export type CoverageResult = {
  percent: number;
  label: string;
  items: CoverageItem[];
};

function coverageLabel(percent: number): string {
  if (percent >= COVERAGE_THRESHOLDS.normalMin) {
    return "Normal";
  }
  if (percent >= COVERAGE_THRESHOLDS.preliminaryMin) {
    return "Preliminary — incomplete evidence";
  }
  return "Insufficient evidence for reliable scoring";
}

function evaluatedOrUnavailable(ok: boolean): EvidenceState {
  return ok ? "EVALUATED" : "SOURCE_UNAVAILABLE";
}

export function computeEvidenceCoverage(input: {
  assessment: AssessmentLookupResult;
  zoning: ZoningLookupResult;
  steepSlope: SteepSlopeLookupResult;
  landslide: LandslideLookupResult;
  undermined: UnderminedLookupResult;
  flood: FloodLookupResult;
}): CoverageResult {
  const items: CoverageItem[] = [
    {
      id: "parcelIdentity",
      label: "Parcel identity / geometry",
      weight: COVERAGE_WEIGHTS.parcelIdentity,
      state: "EVALUATED",
    },
    {
      id: "propertyFacts",
      label: "Property facts",
      weight: COVERAGE_WEIGHTS.propertyFacts,
      state: evaluatedOrUnavailable(input.assessment.status === "ok"),
    },
    {
      id: "baseZoning",
      label: "Base zoning",
      weight: COVERAGE_WEIGHTS.baseZoning,
      state:
        input.zoning.status === "unavailable"
          ? "SOURCE_UNAVAILABLE"
          : "EVALUATED",
    },
    {
      id: "steepSlope",
      label: "Steep slope",
      weight: COVERAGE_WEIGHTS.steepSlope,
      state: evaluatedOrUnavailable(input.steepSlope.status === "ok"),
    },
    {
      id: "landslide",
      label: "Landslide",
      weight: COVERAGE_WEIGHTS.landslide,
      state: evaluatedOrUnavailable(input.landslide.status === "ok"),
    },
    {
      id: "mine",
      label: "Mine / undermined",
      weight: COVERAGE_WEIGHTS.mine,
      state: evaluatedOrUnavailable(input.undermined.status === "ok"),
    },
    {
      id: "flood",
      label: "Flood",
      weight: COVERAGE_WEIGHTS.flood,
      state: evaluatedOrUnavailable(input.flood.status === "ok"),
    },
  ];

  const percent = items.reduce(
    (sum, item) => (item.state === "EVALUATED" ? sum + item.weight : sum),
    0,
  );

  return {
    percent,
    label: coverageLabel(percent),
    items,
  };
}
