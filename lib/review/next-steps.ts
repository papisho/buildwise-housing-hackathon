import type { FloodLookupResult } from "@/lib/hazards/flood";
import type { LandslideLookupResult } from "@/lib/hazards/landslide";
import type { SteepSlopeLookupResult } from "@/lib/hazards/steep-slope";
import type { UnderminedLookupResult } from "@/lib/hazards/undermined";
import type { HistoricDesignationResult } from "@/lib/historic";
import type { RegulatoryRecordsResult } from "@/lib/regulatory";
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
  regulatoryRecords?: RegulatoryRecordsResult;
  historicDesignation?: HistoricDesignationResult;
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

  const regulatory = input.regulatoryRecords;
  if (!regulatory || regulatory.permits.status !== "ok") {
    steps.push(
      "PLI permits were not evaluated. Do not treat missing permit data as the absence of permit or approval issues.",
    );
  } else if (regulatory.unresolvedPermitCount > 0) {
    steps.push(
      "Verify unresolved permit status with Pittsburgh permitting staff / OneStopPGH before relying on this screening.",
    );
  } else if (
    regulatory.permits.status === "ok" &&
    regulatory.permits.records.some(
      (record) => record.reviewClass === "REQUIRES_VERIFICATION",
    )
  ) {
    steps.push(
      "One or more queried permit statuses are ambiguous (for example Issued). Verify current status with Pittsburgh permitting staff / OneStopPGH. Do not treat Issued as proof that a permit is open or closed.",
    );
  } else {
    steps.push(
      "No unresolved permit statuses were identified in the queried PLI Permits feed. Confirm whether existing approvals or records affect the proposed housing use; absence from this feed is not proof that no permit issues exist.",
    );
  }

  if (!regulatory || regulatory.violations.status !== "ok") {
    steps.push(
      "PLI/DOMI/ES violations were not evaluated. Do not treat missing violation data as the absence of code-enforcement issues.",
    );
  } else if (regulatory.unresolvedViolationCount > 0) {
    steps.push(
      "Verify unresolved violations with the issuing department before relying on this screening.",
    );
  } else if (
    regulatory.violations.status === "ok" &&
    regulatory.violations.records.some(
      (record) => record.reviewClass === "REQUIRES_VERIFICATION",
    )
  ) {
    steps.push(
      "One or more queried violation statuses are ambiguous (for example Ready to Close). Verify current status with the issuing department before relying on this screening.",
    );
  } else {
    steps.push(
      "No unresolved violation statuses were identified in the queried PLI/DOMI/ES violations feed. This is not a finding that no regulatory issues exist.",
    );
  }

  steps.push(
    "Confirm whether existing approvals or records affect the proposed housing use with Pittsburgh permitting and zoning staff.",
  );

  for (const gap of input.decision.evidenceGaps) {
    if (gap.category !== "core_source") {
      continue;
    }
    const alreadyNoted = steps.some((step) =>
      step.toLowerCase().includes(gap.label.toLowerCase().split(" ")[0] ?? ""),
    );
    if (!alreadyNoted) {
      steps.push(
        `${gap.label} — Not Evaluated. Do not treat this gap as a favorable finding.`,
      );
    }
  }

  const historic = input.historicDesignation;
  if (
    historic &&
    (historic.overallStatus === "HISTORIC_DISTRICT_REVIEW" ||
      historic.overallStatus === "INDIVIDUAL_HISTORIC_DESIGNATION_REVIEW" ||
      historic.overallStatus === "MULTIPLE_HISTORIC_REVIEW")
  ) {
    steps.push(
      "Verify current historic designation status with Pittsburgh City Planning / Historic Review before relying on this screening.",
    );
    steps.push(
      "Confirm whether the proposed scope triggers City historic/design review.",
    );
    steps.push(
      "Where relevant, verify demolition and exterior-alteration requirements with Historic Review / City Planning. This screening does not determine that demolition or exterior work is prohibited.",
    );
    if (historic.partialEvidence) {
      steps.push(
        `Historic evidence is partial: ${historic.unevaluatedLayers.join(" and ")} ${historic.unevaluatedLayers.length === 1 ? "was" : "were"} Not Evaluated. Verify that missing historic sublayer with City Planning before treating this as a complete historic screening.`,
      );
    }
  } else if (historic && historic.overallStatus === "HISTORIC_STATUS_NOT_EVALUATED") {
    steps.push(
      "Historic designation was Not Evaluated. Do not treat missing historic evidence as the absence of designation. Verify with City Planning if historic/design review may apply.",
    );
  }

  steps.push(
    "Not independently evaluated in this MVP (require further due diligence; not scored): dimensional standards, overlays not separately evaluated, legal access/frontage, utilities/service capacity, stormwater/drainage, legal lot/title/easements, Certificate of Occupancy / existing legal use, and financial feasibility.",
  );

  return steps;
}
