import type { HistoricDesignationResult } from "@/lib/historic";
import type { FloodLookupResult } from "@/lib/hazards/flood";
import type { LandslideLookupResult } from "@/lib/hazards/landslide";
import type { SteepSlopeLookupResult } from "@/lib/hazards/steep-slope";
import type { UnderminedLookupResult } from "@/lib/hazards/undermined";
import type { RegulatoryRecordsResult } from "@/lib/regulatory";
import type { UseCompatibilityResult } from "@/lib/zoning/compatibility";
import type { ZoningLookupResult } from "@/lib/zoning/pittsburgh";
import { FLAG_OVERLAP_THRESHOLD_PERCENT } from "@/lib/scoring/config";

export type CriticalFlagType =
  | "STEEP_SLOPE_REVIEW"
  | "LANDSLIDE_REVIEW"
  | "MINE_UNDERMINED_REVIEW"
  | "FLOOD_REVIEW"
  | "ZONING_USE_REVIEW"
  | "SPLIT_ZONING_REVIEW"
  | "OPEN_PERMIT_REVIEW"
  | "VIOLATION_REVIEW"
  | "HISTORIC_DISTRICT_REVIEW"
  | "HISTORIC_SITE_REVIEW";

export type CriticalFlag = {
  type: CriticalFlagType;
  level: "REVIEW";
  title: string;
  finding: string;
  whyItMatters: string;
  verificationAction: string;
  overlapPercent: number | null;
};

function overlapDetail(overlapPercent: number | null): string {
  if (overlapPercent === null) {
    return "";
  }
  return ` (${overlapPercent.toFixed(1)}% overlap)`;
}

function shouldFlagIntersection(
  intersects: boolean,
  overlapPercent: number | null,
): boolean {
  if (!intersects) {
    return false;
  }
  if (overlapPercent === null) {
    return true;
  }
  return overlapPercent > FLAG_OVERLAP_THRESHOLD_PERCENT;
}

export function buildCriticalFlags(input: {
  zoning?: ZoningLookupResult;
  steepSlope: SteepSlopeLookupResult;
  landslide: LandslideLookupResult;
  undermined: UnderminedLookupResult;
  flood: FloodLookupResult;
  useCompatibility?: UseCompatibilityResult;
  regulatoryRecords?: RegulatoryRecordsResult;
  historicDesignation?: HistoricDesignationResult;
}): CriticalFlag[] {
  const flags: CriticalFlag[] = [];
  const zoning = input.useCompatibility;
  if (
    zoning &&
    zoning.overallStatus !== "NOT_EVALUATED" &&
    zoning.overallStatus !== "PERMITTED_BY_RIGHT"
  ) {
    flags.push({
      type: "ZONING_USE_REVIEW",
      level: "REVIEW",
      title: "Zoning use-table review",
      finding: `Preliminary § 911.02 status: ${zoning.overallStatus} for ${zoning.proposedUseLabel}.`,
      whyItMatters:
        "This is a first-pass encoding of the published use table. It is not a determination that a use is permitted, approved, or prohibited as an entitlement.",
      verificationAction:
        "Verify the proposed use against Pittsburgh Zoning Code § 911.02, any cited use standards, overlays, and City Planning / Zoning Administrator interpretation.",
      overlapPercent: null,
    });
  }

  if (input.zoning?.status === "ok" && input.zoning.splitZoning) {
    const percents = input.zoning.districts
      .map((district) => {
        const area =
          district.intersectionAreaSqFt !== null
            ? `${Math.round(district.intersectionAreaSqFt).toLocaleString("en-US")} sq ft`
            : "area not calculated";
        const pct =
          district.intersectionPercent !== null
            ? `${district.intersectionPercent.toFixed(1)}%`
            : "percent not calculated";
        return `${district.code} (${pct}; ${area})`;
      })
      .join("; ");
    flags.push({
      type: "SPLIT_ZONING_REVIEW",
      level: "REVIEW",
      title: "Split zoning",
      finding: `Multiple mapped zoning districts intersect this parcel: ${percents}. A controlling district was not selected.`,
      whyItMatters:
        "Which district applies depends on the proposed development envelope. This is not a determination of the controlling zoning district.",
      verificationAction:
        "Verify with City Planning which district(s) apply to the proposed building area.",
      overlapPercent: null,
    });
  }

  if (input.steepSlope.status === "ok") {
    const overlap = input.steepSlope.overlapPercent;
    if (shouldFlagIntersection(input.steepSlope.intersects, overlap)) {
      flags.push({
        type: "STEEP_SLOPE_REVIEW",
        level: "REVIEW",
        title: "Steep-slope review",
        finding: `Mapped ≥25% slope intersects this parcel${overlapDetail(overlap)}.`,
        whyItMatters:
          "Mapped steep slope is a site constraint that can affect layout, grading, and due diligence. It is not a determination that the parcel is unsafe, prohibited, or unbuildable.",
        verificationAction:
          "Site-specific professional/geotechnical review may be warranted.",
        overlapPercent: overlap,
      });
    }
  }

  if (input.landslide.status === "ok") {
    const overlap = input.landslide.overlapPercent;
    if (shouldFlagIntersection(input.landslide.intersects, overlap)) {
      flags.push({
        type: "LANDSLIDE_REVIEW",
        level: "REVIEW",
        title: "Landslide review",
        finding: `Mapped landslide-prone area intersects this parcel${overlapDetail(overlap)}.`,
        whyItMatters:
          "Mapped landslide-prone area is GIS evidence of a site constraint. It is not a determination that the parcel is unsafe or unbuildable.",
        verificationAction:
          "Site-specific geotechnical review may be warranted.",
        overlapPercent: overlap,
      });
    }
  }

  if (input.undermined.status === "ok") {
    const overlap = input.undermined.overlapPercent;
    if (shouldFlagIntersection(input.undermined.intersects, overlap)) {
      const classification =
        input.undermined.classifications.length > 0
          ? ` Source classification: ${input.undermined.classifications.join(", ")}.`
          : "";
      flags.push({
        type: "MINE_UNDERMINED_REVIEW",
        level: "REVIEW",
        title: "Mine / undermined review",
        finding: `Mapped undermined/mine condition detected${overlapDetail(overlap)}.${classification}`,
        whyItMatters:
          "Mapped undermined/mine condition can affect cost and due diligence. It is not a determination that the parcel is unsafe or unbuildable.",
        verificationAction:
          "Site-specific professional/geotechnical verification may be warranted.",
        overlapPercent: overlap,
      });
    }
  }

  if (input.flood.status === "ok") {
    const overlap = input.flood.overlapPercent;
    if (shouldFlagIntersection(input.flood.intersects, overlap)) {
      const zones = input.flood.zones
        .map((zone) => {
          const parts = [
            zone.fldZone ? `Zone ${zone.fldZone}` : null,
            zone.zoneSubtype,
            zone.sfha === "T" ? "SFHA" : null,
          ].filter(Boolean);
          return parts.join(" / ");
        })
        .filter(Boolean)
        .join("; ");
      const provenanceNote =
        input.flood.provenance === "living_atlas_secondary"
          ? " Secondary flood-hazard fallback; not direct FEMA NFHL evidence."
          : input.flood.provenance === "wprdc_2014_extract"
            ? " Source is the City/WPRDC 2014-vintage FEMA extract, not current FEMA NFHL."
            : " Authoritative primary source: FEMA NFHL.";
      flags.push({
        type: "FLOOD_REVIEW",
        level: "REVIEW",
        title: "Flood review",
        finding: `Mapped FEMA flood hazard intersects this parcel${overlapDetail(overlap)}${zones ? `. ${zones}` : "."}${provenanceNote}`,
        whyItMatters:
          "Mapped FEMA flood hazard is GIS evidence that floodplain review may be required. It is not a determination of flood risk, insurance cost, or unbuildability.",
        verificationAction: "Floodplain review may be required.",
        overlapPercent: overlap,
      });
    }
  }

  const regulatory = input.regulatoryRecords;
  if (regulatory && regulatory.unresolvedPermitCount > 0) {
    const examples = (
      regulatory.permits.status === "ok" ? regulatory.permits.records : []
    )
      .filter((record) => record.reviewClass === "UNRESOLVED")
      .slice(0, 3)
      .map((record) => `${record.permitId} (${record.status ?? "status not reported"})`)
      .join("; ");
    flags.push({
      type: "OPEN_PERMIT_REVIEW",
      level: "REVIEW",
      title: "Open permit review",
      finding: `${regulatory.unresolvedPermitCount} permit record(s) have a clearly in-process official status in the queried PLI Permits feed${examples ? `: ${examples}` : "."}`,
      whyItMatters:
        "An in-process permit status is screening evidence that existing applications or work may still be under City review. It is not a determination that work is illegal, approved, or that a new housing use is entitled.",
      verificationAction:
        "Verify unresolved permit status with Pittsburgh permitting staff / OneStopPGH before relying on this screening.",
      overlapPercent: null,
    });
  }

  if (regulatory && regulatory.unresolvedViolationCount > 0) {
    const examples = (
      regulatory.violations.status === "ok"
        ? regulatory.violations.records
        : []
    )
      .filter((record) => record.reviewClass === "UNRESOLVED")
      .slice(0, 3)
      .map(
        (record) =>
          `${record.casefileNumber} (${record.status ?? "status not reported"})`,
      )
      .join("; ");
    flags.push({
      type: "VIOLATION_REVIEW",
      level: "REVIEW",
      title: "Violation review",
      finding: `${regulatory.unresolvedViolationCount} violation casefile(s) have a clearly unresolved official status in the queried PLI/DOMI/ES violations feed${examples ? `: ${examples}` : "."}`,
      whyItMatters:
        "An unresolved violation casefile is screening evidence of an open regulatory record. It is not a determination of legal liability, site condition, or that a proposed housing use is prohibited.",
      verificationAction:
        "Verify unresolved violations with the issuing department before relying on this screening.",
      overlapPercent: null,
    });
  }

  const historic = input.historicDesignation;
  if (historic?.districts.status === "ok" && historic.districts.intersects) {
    const names = historic.districts.districts.map((district) => district.name).join("; ");
    const overlap = historic.districts.overlapPercent;
    flags.push({
      type: "HISTORIC_DISTRICT_REVIEW",
      level: "REVIEW",
      title: "Historic district review",
      finding: `Mapped City historic district intersects this parcel${overlapDetail(overlap)}${names ? `: ${names}` : "."}`,
      whyItMatters:
        "Historic district designation can add review time and design constraints. It is not a determination that demolition is prohibited, that exterior work is prohibited, or that the project cannot proceed.",
      verificationAction:
        "Verify current designation status and whether the proposed scope triggers historic/design review with Pittsburgh Historic Review / City Planning.",
      overlapPercent: overlap,
    });
  }

  if (historic?.sites.status === "ok" && historic.sites.intersects) {
    const names = historic.sites.sites.map((site) => site.name).join("; ");
    const overlap = historic.sites.overlapPercent;
    flags.push({
      type: "HISTORIC_SITE_REVIEW",
      level: "REVIEW",
      title: "Historic site review",
      finding: `Mapped individually designated historic site intersects this parcel${overlapDetail(overlap)}${names ? `: ${names}` : "."}`,
      whyItMatters:
        "Individual historic designation can add review time and design constraints. It is not a determination that demolition is prohibited, that exterior work is prohibited, or that the project cannot proceed.",
      verificationAction:
        "Verify current individual designation status and demolition/exterior-alteration requirements with Pittsburgh Historic Review / City Planning.",
      overlapPercent: overlap,
    });
  }

  return flags;
}
