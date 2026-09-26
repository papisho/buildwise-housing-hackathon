import type { FloodLookupResult } from "@/lib/hazards/flood";
import type { LandslideLookupResult } from "@/lib/hazards/landslide";
import type { SteepSlopeLookupResult } from "@/lib/hazards/steep-slope";
import type { UnderminedLookupResult } from "@/lib/hazards/undermined";
import type { DecisionSnapshot } from "@/lib/scoring";
import type { UseCompatibilityResult } from "@/lib/zoning/compatibility";
import type { ZoningLookupResult } from "@/lib/zoning/pittsburgh";

export function buildRecommendedVerification(input: {
  zoning: ZoningLookupResult;
  useCompatibility: UseCompatibilityResult;
  steepSlope: SteepSlopeLookupResult;
  landslide: LandslideLookupResult;
  undermined: UnderminedLookupResult;
  flood: FloodLookupResult;
  decision: DecisionSnapshot;
}): string[] {
  const steps: string[] = [];

  const useStatus = input.useCompatibility.overallStatus;
  if (useStatus === "NOT_IDENTIFIED") {
    steps.push(
      "Unsupported / unencoded mapped zoning district: zoning interpretation is required from Pittsburgh zoning staff or the Zoning Administrator. Do not infer use permission.",
    );
  } else if (
    useStatus === "NOT_COMPATIBLE" ||
    useStatus === "REQUIRES_VERIFICATION" ||
    useStatus === "SPECIAL_EXCEPTION" ||
    useStatus === "CONDITIONAL_USE" ||
    useStatus === "ADMINISTRATOR_EXCEPTION"
  ) {
    steps.push(
      "Zoning-use compatibility requires review: verify the proposed use with Pittsburgh zoning staff against Zoning Code § 911.02. This preliminary table lookup is not an entitlement.",
    );
  } else if (useStatus === "PERMITTED_BY_RIGHT") {
    steps.push(
      "Confirm the preliminary by-right use-table cell with Pittsburgh zoning staff. All other applicable standards, overlays, and dimensional rules still apply.",
    );
  } else {
    steps.push(
      "Proposed-use compatibility was not evaluated. Select a housing type and verify § 911.02 with Pittsburgh zoning staff.",
    );
  }

  if (input.zoning.status === "ok" && input.zoning.splitZoning) {
    steps.push(
      "Split zoning: ask City Planning which district(s) apply to the proposed building area.",
    );
  }

  if (
    input.steepSlope.status === "ok" &&
    input.steepSlope.intersects
  ) {
    steps.push(
      "Mapped steep slope intersects this parcel: site-specific geotechnical review may be warranted.",
    );
  } else if (input.steepSlope.status !== "ok") {
    steps.push(
      "Steep slope was not evaluated. Do not treat missing slope evidence as the absence of steep slope.",
    );
  }

  if (
    input.landslide.status === "ok" &&
    input.landslide.intersects
  ) {
    steps.push(
      "Mapped landslide-prone area intersects this parcel: site-specific geotechnical review may be warranted.",
    );
  } else if (input.landslide.status !== "ok") {
    steps.push(
      "Landslide was not evaluated. Do not treat missing landslide evidence as the absence of landslide-prone area.",
    );
  }

  if (
    input.undermined.status === "ok" &&
    input.undermined.intersects
  ) {
    steps.push(
      "Mapped undermined/mine condition detected: professional mine/geotechnical verification may be warranted.",
    );
  } else if (input.undermined.status !== "ok") {
    steps.push(
      "Mine / undermined evidence was not evaluated. Do not treat missing mine evidence as a clear site.",
    );
  }

  if (input.flood.status === "ok" && input.flood.intersects) {
    steps.push(
      "Mapped FEMA flood hazard intersects this parcel: floodplain review may be required.",
    );
  } else if (input.flood.status !== "ok") {
    steps.push(
      "Flood hazard was not evaluated. This is not a finding of no flood risk.",
    );
  }

  for (const gap of input.decision.evidenceGaps) {
    const alreadyNoted = steps.some((step) =>
      step.toLowerCase().includes(gap.label.toLowerCase().split(" ")[0] ?? ""),
    );
    if (!alreadyNoted) {
      steps.push(
        `${gap.label} — Not Evaluated. Do not treat this gap as a favorable finding.`,
      );
    }
  }

  steps.push(
    "Financial feasibility is not assessed. Do not infer asking price, costs, rents, or whether a project pencils.",
  );

  return steps;
}
