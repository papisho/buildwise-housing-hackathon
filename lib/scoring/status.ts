import type { FloodLookupResult } from "@/lib/hazards/flood";
import type { LandslideLookupResult } from "@/lib/hazards/landslide";
import type { SteepSlopeLookupResult } from "@/lib/hazards/steep-slope";
import type { UnderminedLookupResult } from "@/lib/hazards/undermined";
import type { UseCompatibilityResult } from "@/lib/zoning/compatibility";
import type { ZoningLookupResult } from "@/lib/zoning/pittsburgh";
import type { ZoningScoreResolution } from "@/lib/scoring/score";

export type ScreeningStatus =
  | "MAJOR_REGULATORY_BARRIER_IDENTIFIED"
  | "DATA_VERIFICATION_REQUIRED"
  | "REVIEW_REQUIRED"
  | "NO_MAJOR_CORE_BARRIER_IDENTIFIED";

export const SCREENING_STATUS_LABELS: Record<ScreeningStatus, string> = {
  MAJOR_REGULATORY_BARRIER_IDENTIFIED: "Major regulatory barrier identified",
  DATA_VERIFICATION_REQUIRED: "Data verification required",
  REVIEW_REQUIRED: "Review required",
  NO_MAJOR_CORE_BARRIER_IDENTIFIED: "No major core barrier identified",
};

function hazardSourceFailed(
  evidence:
    | SteepSlopeLookupResult
    | LandslideLookupResult
    | UnderminedLookupResult
    | FloodLookupResult,
): boolean {
  return evidence.status !== "ok";
}

function hazardIntersects(
  evidence:
    | SteepSlopeLookupResult
    | LandslideLookupResult
    | UnderminedLookupResult
    | FloodLookupResult,
): boolean {
  return evidence.status === "ok" && evidence.intersects;
}

function slopeOverlapUnknown(steepSlope: SteepSlopeLookupResult): boolean {
  return (
    steepSlope.status === "ok" &&
    steepSlope.intersects &&
    (steepSlope.overlapPercent === null || !Number.isFinite(steepSlope.overlapPercent))
  );
}

export function computeScreeningStatus(input: {
  zoning: ZoningLookupResult;
  useCompatibility?: UseCompatibilityResult;
  zoningResolution: ZoningScoreResolution;
  steepSlope: SteepSlopeLookupResult;
  landslide: LandslideLookupResult;
  undermined: UnderminedLookupResult;
  flood: FloodLookupResult;
}): ScreeningStatus {
  if (input.zoningResolution.parcelWideIncompatible) {
    return "MAJOR_REGULATORY_BARRIER_IDENTIFIED";
  }

  const split = input.zoning.status === "ok" && input.zoning.splitZoning;
  const zoningUnavailable =
    input.zoning.status !== "ok" ||
    input.zoningResolution.state === "not_evaluated" ||
    input.useCompatibility?.overallStatus === "NOT_IDENTIFIED" ||
    input.useCompatibility?.overallStatus === "NOT_EVALUATED";

  const sourceFailure =
    hazardSourceFailed(input.steepSlope) ||
    hazardSourceFailed(input.landslide) ||
    hazardSourceFailed(input.undermined) ||
    hazardSourceFailed(input.flood);

  if (
    split ||
    zoningUnavailable ||
    sourceFailure ||
    slopeOverlapUnknown(input.steepSlope)
  ) {
    return "DATA_VERIFICATION_REQUIRED";
  }

  const processZoning =
    input.zoningResolution.state === "scored" &&
    (input.zoningResolution.status === "ADMINISTRATOR_EXCEPTION" ||
      input.zoningResolution.status === "SPECIAL_EXCEPTION" ||
      input.zoningResolution.status === "CONDITIONAL_USE" ||
      input.zoningResolution.status === "REQUIRES_VERIFICATION");

  if (
    processZoning ||
    hazardIntersects(input.steepSlope) ||
    hazardIntersects(input.landslide) ||
    hazardIntersects(input.undermined) ||
    hazardIntersects(input.flood)
  ) {
    return "REVIEW_REQUIRED";
  }

  return "NO_MAJOR_CORE_BARRIER_IDENTIFIED";
}
