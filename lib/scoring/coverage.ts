import type { AssessmentLookupResult } from "@/lib/assessments/wprdc";
import type { SteepSlopeLookupResult } from "@/lib/hazards/steep-slope";
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

export function computeEvidenceCoverage(input: {
  assessment: AssessmentLookupResult;
  zoning: ZoningLookupResult;
  steepSlope: SteepSlopeLookupResult;
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
      state: input.assessment.status === "ok" ? "EVALUATED" : "SOURCE_UNAVAILABLE",
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
      state: input.steepSlope.status === "ok" ? "EVALUATED" : "SOURCE_UNAVAILABLE",
    },
    {
      id: "landslide",
      label: "Landslide",
      weight: COVERAGE_WEIGHTS.landslide,
      state: "NOT_EVALUATED",
    },
    {
      id: "mine",
      label: "Mine / undermined",
      weight: COVERAGE_WEIGHTS.mine,
      state: "NOT_EVALUATED",
    },
    {
      id: "flood",
      label: "Flood",
      weight: COVERAGE_WEIGHTS.flood,
      state: "NOT_EVALUATED",
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
