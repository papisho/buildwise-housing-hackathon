import type { FloodLookupResult } from "@/lib/hazards/flood";
import type { LandslideLookupResult } from "@/lib/hazards/landslide";
import type { SteepSlopeLookupResult } from "@/lib/hazards/steep-slope";
import type { UnderminedLookupResult } from "@/lib/hazards/undermined";
import { FLAG_OVERLAP_THRESHOLD_PERCENT } from "@/lib/scoring/config";

export type CriticalFlagType =
  | "STEEP_SLOPE_REVIEW"
  | "LANDSLIDE_REVIEW"
  | "MINE_UNDERMINED_REVIEW"
  | "FLOOD_REVIEW";

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
  steepSlope: SteepSlopeLookupResult;
  landslide: LandslideLookupResult;
  undermined: UnderminedLookupResult;
  flood: FloodLookupResult;
}): CriticalFlag[] {
  const flags: CriticalFlag[] = [];

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

  return flags;
}
