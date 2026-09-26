export const PROPOSED_PROJECT_TYPES = [
  {
    value: "general_screening",
    label: "General screening",
  },
  {
    value: "single_unit_detached",
    label: "Single-Unit Detached Residential",
  },
  {
    value: "single_unit_attached",
    label: "Single-Unit Attached Residential",
  },
  {
    value: "two_unit",
    label: "Two-Unit Residential",
  },
  {
    value: "three_unit",
    label: "Three-Unit Residential",
  },
  {
    value: "multi_unit",
    label: "Multi-Unit Residential (4+)",
  },
] as const;

export type ProposedProjectType =
  (typeof PROPOSED_PROJECT_TYPES)[number]["value"];

const ALIASES: Record<string, ProposedProjectType> = {
  general_screening: "general_screening",
  single_unit_detached: "single_unit_detached",
  single_unit_attached: "single_unit_attached",
  two_unit: "two_unit",
  two_unit_duplex: "two_unit",
  three_unit: "three_unit",
  multi_unit: "multi_unit",
  small_multifamily: "multi_unit",
};

export function parseProposedProjectType(
  value: unknown,
): ProposedProjectType {
  if (typeof value === "string" && value in ALIASES) {
    return ALIASES[value];
  }
  return "general_screening";
}

export function proposedProjectTypeLabel(
  value: ProposedProjectType,
): string {
  const match = PROPOSED_PROJECT_TYPES.find((item) => item.value === value);
  return match?.label ?? "General screening";
}
