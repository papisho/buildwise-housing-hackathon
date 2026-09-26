import type { ProposedProjectType } from "@/lib/project-type";

export const USE_TABLE_CITATION = "Pittsburgh Zoning Code § 911.02 Use Table";
export const USE_TABLE_CODE_URL = "https://ecode360.com/45476528";

export const RESIDENTIAL_BASE_FAMILIES = [
  "R1D",
  "R1A",
  "R2",
  "R3",
  "RM",
] as const;

export type ResidentialBaseFamily =
  (typeof RESIDENTIAL_BASE_FAMILIES)[number];

export type EncodedHousingUse =
  | "single_unit_detached"
  | "single_unit_attached"
  | "two_unit"
  | "three_unit"
  | "multi_unit";

export const HOUSING_USE_LABELS: Record<EncodedHousingUse, string> = {
  single_unit_detached: "Single-Unit Detached Residential",
  single_unit_attached: "Single-Unit Attached Residential",
  two_unit: "Two-Unit Residential",
  three_unit: "Three-Unit Residential",
  multi_unit: "Multi-Unit Residential (4+)",
};

const DENSITY_SUFFIX = /^(R1D|R1A|R2|R3|RM)(?:-(?:VL|L|M|H|VH))?$/i;

/**
 * Encoded from the official § 911.02 Use Table (ecode360 Chapter 911).
 * Cells are the published letters only. Blank means not permitted in that
 * district column. Qualified cells such as P/S are stored verbatim.
 */
const USE_TABLE: Record<
  EncodedHousingUse,
  Record<ResidentialBaseFamily, string>
> = {
  single_unit_detached: {
    R1D: "P",
    R1A: "P",
    R2: "P",
    R3: "P",
    RM: "P",
  },
  single_unit_attached: {
    R1D: "P/S",
    R1A: "P",
    R2: "P",
    R3: "P",
    RM: "P",
  },
  two_unit: {
    R1D: "",
    R1A: "",
    R2: "P",
    R3: "P",
    RM: "P",
  },
  three_unit: {
    R1D: "",
    R1A: "",
    R2: "",
    R3: "P",
    RM: "P",
  },
  multi_unit: {
    R1D: "",
    R1A: "",
    R2: "",
    R3: "",
    RM: "P",
  },
};

const USE_STANDARDS: Record<EncodedHousingUse, string | null> = {
  single_unit_detached: "§ 911.04A.69",
  single_unit_attached: "§ 911.04A.69; § 911.04A.69A",
  two_unit: null,
  three_unit: null,
  multi_unit: "§ 911.04A.85",
};

export function housingUseFromProjectType(
  projectType: ProposedProjectType,
): EncodedHousingUse | null {
  switch (projectType) {
    case "single_unit_detached":
      return "single_unit_detached";
    case "single_unit_attached":
      return "single_unit_attached";
    case "two_unit":
      return "two_unit";
    case "three_unit":
      return "three_unit";
    case "multi_unit":
      return "multi_unit";
    case "general_screening":
      return null;
  }
}

export function baseZoningFamily(
  mappedCode: string,
): ResidentialBaseFamily | null {
  const compact = mappedCode.trim().toUpperCase().replace(/\s+/g, "");
  const match = compact.match(DENSITY_SUFFIX);
  if (!match) {
    return null;
  }
  return match[1].toUpperCase() as ResidentialBaseFamily;
}

export function useTableCell(
  use: EncodedHousingUse,
  family: ResidentialBaseFamily,
): string {
  return USE_TABLE[use][family];
}

export function useTableStandards(use: EncodedHousingUse): string | null {
  return USE_STANDARDS[use];
}
