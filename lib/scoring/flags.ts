import type { SteepSlopeLookupResult } from "@/lib/hazards/steep-slope";
import { FLAG_OVERLAP_THRESHOLD_PERCENT } from "@/lib/scoring/config";

export type CriticalFlag = {
  type: "STEEP_SLOPE_REVIEW";
  level: "REVIEW";
  title: string;
  finding: string;
  whyItMatters: string;
  verificationAction: string;
  overlapPercent: number;
};

export function buildCriticalFlags(
  steepSlope: SteepSlopeLookupResult,
): CriticalFlag[] {
  if (steepSlope.status !== "ok") {
    return [];
  }

  const overlap = steepSlope.overlapPercent;
  if (overlap === null || overlap <= FLAG_OVERLAP_THRESHOLD_PERCENT) {
    return [];
  }

  return [
    {
      type: "STEEP_SLOPE_REVIEW",
      level: "REVIEW",
      title: "Steep-slope review",
      finding: `Mapped ≥25% slope intersects this parcel (${overlap.toFixed(1)}% overlap).`,
      whyItMatters:
        "Mapped steep slope is a site constraint that can affect layout, grading, and due diligence. It is not a determination that the parcel is unsafe, prohibited, or unbuildable.",
      verificationAction:
        "Site-specific professional/geotechnical review may be warranted.",
      overlapPercent: overlap,
    },
  ];
}
