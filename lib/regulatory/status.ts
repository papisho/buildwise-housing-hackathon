export type RecordReviewClass =
  | "UNRESOLVED"
  | "REQUIRES_VERIFICATION"
  | "NOT_UNRESOLVED";

export type RegulatoryScreeningStatus =
  | "NO_UNRESOLVED_RECORDS_IDENTIFIED"
  | "REGULATORY_RECORDS_REQUIRE_VERIFICATION"
  | "UNRESOLVED_PERMIT_REVIEW"
  | "UNRESOLVED_VIOLATION_REVIEW"
  | "UNRESOLVED_PERMIT_AND_VIOLATION_REVIEW"
  | "REGULATORY_RECORDS_NOT_EVALUATED";

export const REGULATORY_SCREENING_LABELS: Record<
  RegulatoryScreeningStatus,
  string
> = {
  NO_UNRESOLVED_RECORDS_IDENTIFIED:
    "No unresolved records identified in the queried dataset",
  REGULATORY_RECORDS_REQUIRE_VERIFICATION:
    "Regulatory records require verification",
  UNRESOLVED_PERMIT_REVIEW: "Unresolved permit review",
  UNRESOLVED_VIOLATION_REVIEW: "Unresolved violation review",
  UNRESOLVED_PERMIT_AND_VIOLATION_REVIEW:
    "Unresolved permit and violation review",
  REGULATORY_RECORDS_NOT_EVALUATED: "Regulatory records not evaluated",
};

/**
 * Permit `status` has no WPRDC data-dictionary definition.
 * Mapping uses observed current-feed values only.
 * "Issued" is not treated as clearly open/unresolved.
 * Observed values include: Completed, Issued, Expired, Revoked,
 * In Review, Amendment Review, Application Finalization, Stop Work.
 */
const PERMIT_UNRESOLVED = new Set([
  "IN REVIEW",
  "AMENDMENT REVIEW",
  "APPLICATION FINALIZATION",
  "STOP WORK",
]);

const PERMIT_NOT_UNRESOLVED = new Set([
  "COMPLETED",
  "EXPIRED",
  "REVOKED",
]);

const VIOLATION_UNRESOLVED = new Set([
  "UNDER INVESTIGATION",
  "IN COURT",
  "IN VIOLATION",
  "CLEAN & LIEN",
]);

const VIOLATION_NOT_UNRESOLVED = new Set([
  "CLOSED",
  "CANCELLED",
  "CANCELED",
]);

/** Observed but not clearly open/closed: Ready to Close → REQUIRES_VERIFICATION. */

function normalizeStatus(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().replace(/\s+/g, " ").toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

export function classifyPermitStatus(
  status: string | null,
): RecordReviewClass {
  const normalized = normalizeStatus(status);
  if (!normalized) {
    return "REQUIRES_VERIFICATION";
  }
  if (PERMIT_UNRESOLVED.has(normalized)) {
    return "UNRESOLVED";
  }
  if (PERMIT_NOT_UNRESOLVED.has(normalized)) {
    return "NOT_UNRESOLVED";
  }
  return "REQUIRES_VERIFICATION";
}

export function classifyViolationStatus(
  status: string | null,
): RecordReviewClass {
  const normalized = normalizeStatus(status);
  if (!normalized) {
    return "REQUIRES_VERIFICATION";
  }
  if (VIOLATION_UNRESOLVED.has(normalized)) {
    return "UNRESOLVED";
  }
  if (VIOLATION_NOT_UNRESOLVED.has(normalized)) {
    return "NOT_UNRESOLVED";
  }
  return "REQUIRES_VERIFICATION";
}

export function classifyCasefileStatuses(
  statuses: Array<string | null>,
): RecordReviewClass {
  const classes = statuses.map((status) => classifyViolationStatus(status));
  if (classes.includes("UNRESOLVED")) {
    return "UNRESOLVED";
  }
  if (classes.includes("REQUIRES_VERIFICATION") || classes.length === 0) {
    return "REQUIRES_VERIFICATION";
  }
  return "NOT_UNRESOLVED";
}

export function resolveRegulatoryScreeningStatus(input: {
  permitsEvaluated: boolean;
  violationsEvaluated: boolean;
  unresolvedPermitCount: number;
  unresolvedViolationCount: number;
  verificationRequiredCount: number;
}): RegulatoryScreeningStatus {
  const unresolvedPermits = input.unresolvedPermitCount > 0;
  const unresolvedViolations = input.unresolvedViolationCount > 0;

  if (unresolvedPermits && unresolvedViolations) {
    return "UNRESOLVED_PERMIT_AND_VIOLATION_REVIEW";
  }
  if (unresolvedViolations) {
    return "UNRESOLVED_VIOLATION_REVIEW";
  }
  if (unresolvedPermits) {
    return "UNRESOLVED_PERMIT_REVIEW";
  }
  if (!input.permitsEvaluated || !input.violationsEvaluated) {
    return "REGULATORY_RECORDS_NOT_EVALUATED";
  }
  if (input.verificationRequiredCount > 0) {
    return "REGULATORY_RECORDS_REQUIRE_VERIFICATION";
  }
  return "NO_UNRESOLVED_RECORDS_IDENTIFIED";
}
