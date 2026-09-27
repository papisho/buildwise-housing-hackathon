import {
  classifyPermitStatus,
  classifyViolationStatus,
  classifyCasefileStatuses,
  resolveRegulatoryScreeningStatus,
} from "@/lib/regulatory/status";
import { streetLineKey, addressesMatch } from "@/lib/regulatory/address";

function assert(name: string, condition: boolean, detail: string): void {
  if (!condition) {
    throw new Error(`FAIL ${name}: ${detail}`);
  }
  console.log(`PASS ${name}: ${detail}`);
}

export function runRegulatoryStatusTests(): void {
  assert(
    "permit Stop Work unresolved",
    classifyPermitStatus("Stop Work") === "UNRESOLVED",
    classifyPermitStatus("Stop Work"),
  );
  assert(
    "permit In Review unresolved",
    classifyPermitStatus("In Review") === "UNRESOLVED",
    classifyPermitStatus("In Review"),
  );
  assert(
    "permit Issued requires verification",
    classifyPermitStatus("Issued") === "REQUIRES_VERIFICATION",
    classifyPermitStatus("Issued"),
  );
  assert(
    "permit Completed not unresolved",
    classifyPermitStatus("Completed") === "NOT_UNRESOLVED",
    classifyPermitStatus("Completed"),
  );
  assert(
    "permit unknown requires verification",
    classifyPermitStatus("Mystery Status") === "REQUIRES_VERIFICATION",
    classifyPermitStatus("Mystery Status"),
  );
  assert(
    "violation In Violation unresolved",
    classifyViolationStatus("In Violation") === "UNRESOLVED",
    classifyViolationStatus("In Violation"),
  );
  assert(
    "violation Closed not unresolved",
    classifyViolationStatus("Closed") === "NOT_UNRESOLVED",
    classifyViolationStatus("Closed"),
  );
  assert(
    "casefile any unresolved wins",
    classifyCasefileStatuses(["Closed", "In Violation"]) === "UNRESOLVED",
    classifyCasefileStatuses(["Closed", "In Violation"]),
  );
  assert(
    "overall both sources clear",
    resolveRegulatoryScreeningStatus({
      permitsEvaluated: true,
      violationsEvaluated: true,
      unresolvedPermitCount: 0,
      unresolvedViolationCount: 0,
      verificationRequiredCount: 0,
    }) === "NO_UNRESOLVED_RECORDS_IDENTIFIED",
    "clear",
  );
  assert(
    "overall source failure not favorable",
    resolveRegulatoryScreeningStatus({
      permitsEvaluated: false,
      violationsEvaluated: true,
      unresolvedPermitCount: 0,
      unresolvedViolationCount: 0,
      verificationRequiredCount: 0,
    }) === "REGULATORY_RECORDS_NOT_EVALUATED",
    "not evaluated",
  );
  assert(
    "overall unresolved violation",
    resolveRegulatoryScreeningStatus({
      permitsEvaluated: true,
      violationsEvaluated: true,
      unresolvedPermitCount: 0,
      unresolvedViolationCount: 1,
      verificationRequiredCount: 0,
    }) === "UNRESOLVED_VIOLATION_REVIEW",
    "violation",
  );
  assert(
    "overall Issued requires verification",
    resolveRegulatoryScreeningStatus({
      permitsEvaluated: true,
      violationsEvaluated: true,
      unresolvedPermitCount: 0,
      unresolvedViolationCount: 0,
      verificationRequiredCount: 1,
    }) === "REGULATORY_RECORDS_REQUIRE_VERIFICATION",
    "issued",
  );
  assert(
    "address exact only",
    addressesMatch("414 GRANT ST, Pittsburgh, PA 15219", "414 Grant St") &&
      !addressesMatch("414 GRANT ST", "413 GRANT ST"),
    streetLineKey("414 GRANT ST, Pittsburgh, PA 15219") ?? "",
  );
}

if (process.argv[1]?.includes("run-status-tests")) {
  runRegulatoryStatusTests();
}
