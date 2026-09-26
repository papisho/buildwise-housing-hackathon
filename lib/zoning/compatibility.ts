import type { ProposedProjectType } from "@/lib/project-type";
import type { ZoningLookupResult } from "@/lib/zoning/pittsburgh";
import {
  USE_TABLE_CITATION,
  USE_TABLE_CODE_URL,
  baseZoningFamily,
  housingUseFromProjectType,
  HOUSING_USE_LABELS,
  useTableCell,
  useTableStandards,
  type EncodedHousingUse,
} from "@/lib/zoning/use-table";

export type UseTableStatus =
  | "PERMITTED_BY_RIGHT"
  | "ADMINISTRATOR_EXCEPTION"
  | "SPECIAL_EXCEPTION"
  | "CONDITIONAL_USE"
  | "NOT_COMPATIBLE"
  | "NOT_IDENTIFIED"
  | "NOT_EVALUATED"
  | "REQUIRES_VERIFICATION";

export type DistrictUseCompatibility = {
  mappedZoningCode: string;
  baseZoningFamily: string | null;
  tableSymbol: string | null;
  status: UseTableStatus;
  verificationRequired: boolean;
  conditionNote: string | null;
};

export type UseCompatibilityResult = {
  proposedUseLabel: string;
  proposedUseKey: EncodedHousingUse | null;
  citation: string;
  citationUrl: string;
  standardsCitation: string | null;
  overallStatus: UseTableStatus;
  verificationRequired: boolean;
  message: string;
  districts: DistrictUseCompatibility[];
};

function statusFromSymbol(symbol: string): {
  status: UseTableStatus;
  verificationRequired: boolean;
  conditionNote: string | null;
} {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    return {
      status: "NOT_COMPATIBLE",
      verificationRequired: true,
      conditionNote: null,
    };
  }
  if (normalized.includes("/")) {
    return {
      status: "REQUIRES_VERIFICATION",
      verificationRequired: true,
      conditionNote: `Use-table cell is ${normalized}; this qualified entry was not simplified.`,
    };
  }
  if (normalized === "P") {
    return {
      status: "PERMITTED_BY_RIGHT",
      verificationRequired: true,
      conditionNote: null,
    };
  }
  if (normalized === "A") {
    return {
      status: "ADMINISTRATOR_EXCEPTION",
      verificationRequired: true,
      conditionNote: null,
    };
  }
  if (normalized === "S") {
    return {
      status: "SPECIAL_EXCEPTION",
      verificationRequired: true,
      conditionNote: null,
    };
  }
  if (normalized === "C") {
    return {
      status: "CONDITIONAL_USE",
      verificationRequired: true,
      conditionNote: null,
    };
  }
  return {
    status: "REQUIRES_VERIFICATION",
    verificationRequired: true,
    conditionNote: `Use-table cell is ${normalized}; this entry was not simplified.`,
  };
}

function statusLabel(status: UseTableStatus): string {
  switch (status) {
    case "PERMITTED_BY_RIGHT":
      return "Permitted by right (P)";
    case "ADMINISTRATOR_EXCEPTION":
      return "Administrator exception (A)";
    case "SPECIAL_EXCEPTION":
      return "Special exception (S)";
    case "CONDITIONAL_USE":
      return "Conditional use (C)";
    case "NOT_COMPATIBLE":
      return "Not compatible / blank in the use table";
    case "NOT_IDENTIFIED":
      return "Not identified";
    case "NOT_EVALUATED":
      return "Not evaluated";
    case "REQUIRES_VERIFICATION":
      return "Verification required";
  }
}

function overallFromDistricts(
  districts: DistrictUseCompatibility[],
): UseTableStatus {
  const statuses = new Set(districts.map((district) => district.status));
  if (statuses.size === 1) {
    return districts[0]?.status ?? "NOT_IDENTIFIED";
  }
  return "REQUIRES_VERIFICATION";
}

function evaluateDistrict(
  mappedZoningCode: string,
  use: EncodedHousingUse,
): DistrictUseCompatibility {
  const family = baseZoningFamily(mappedZoningCode);
  if (!family) {
    return {
      mappedZoningCode,
      baseZoningFamily: null,
      tableSymbol: null,
      status: "NOT_IDENTIFIED",
      verificationRequired: true,
      conditionNote:
        "This mapped district is not in the encoded R1D / R1A / R2 / R3 / RM use-table set. No use permission was guessed.",
    };
  }

  const tableSymbol = useTableCell(use, family);
  const mapped = statusFromSymbol(tableSymbol);
  return {
    mappedZoningCode,
    baseZoningFamily: family,
    tableSymbol: tableSymbol || null,
    ...mapped,
  };
}

export function evaluateUseCompatibility(input: {
  proposedProjectType: ProposedProjectType;
  zoning: ZoningLookupResult;
}): UseCompatibilityResult {
  const citation = USE_TABLE_CITATION;
  const citationUrl = USE_TABLE_CODE_URL;
  const use = housingUseFromProjectType(input.proposedProjectType);

  if (!use) {
    return {
      proposedUseLabel: "General screening",
      proposedUseKey: null,
      citation,
      citationUrl,
      standardsCitation: null,
      overallStatus: "NOT_EVALUATED",
      verificationRequired: true,
      message:
        "General screening does not select a proposed housing use, so § 911.02 compatibility is Not Evaluated.",
      districts: [],
    };
  }

  const proposedUseLabel = HOUSING_USE_LABELS[use];
  const standardsCitation = useTableStandards(use);

  if (input.zoning.status === "unavailable" || input.zoning.status === "no_district") {
    return {
      proposedUseLabel,
      proposedUseKey: use,
      citation,
      citationUrl,
      standardsCitation,
      overallStatus: "NOT_EVALUATED",
      verificationRequired: true,
      message:
        "Proposed-use compatibility is Not Evaluated because mapped base zoning was not available.",
      districts: [],
    };
  }

  const districts = input.zoning.districts.map((district) =>
    evaluateDistrict(district.code, use),
  );
  const overallStatus = overallFromDistricts(districts);
  const verificationRequired = true;

  const parts = districts.map((district) => {
    const family = district.baseZoningFamily ?? "unsupported family";
    const symbol =
      district.status === "NOT_IDENTIFIED"
        ? "no encoded cell"
        : (district.tableSymbol ?? "blank");
    return `${district.mappedZoningCode} (lookup family ${family}): ${statusLabel(district.status)} [${symbol}]`;
  });

  const splitNote = input.zoning.splitZoning
    ? " Split zoning: each intersecting district was evaluated; none was selected as the sole district."
    : "";

  return {
    proposedUseLabel,
    proposedUseKey: use,
    citation,
    citationUrl,
    standardsCitation,
    overallStatus,
    verificationRequired,
    message: `Preliminary § 911.02 lookup only. ${parts.join(" ")} This is not an entitlement, permit, or Zoning Administrator determination.${splitNote} Confirm the use table, any use standards, overlays, and dimensional rules with City Planning.`,
    districts,
  };
}
