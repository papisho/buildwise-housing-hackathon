import type { AssessmentLookupResult } from "@/lib/assessments/wprdc";
import { findPermitsForParcel } from "@/lib/regulatory/permits";
import {
  REGULATORY_SCREENING_LABELS,
  resolveRegulatoryScreeningStatus,
} from "@/lib/regulatory/status";
import type { RegulatoryRecordsResult } from "@/lib/regulatory/types";
import { findViolationsForParcel } from "@/lib/regulatory/violations";

export async function lookupRegulatoryRecords(input: {
  pin: string;
  assessment: AssessmentLookupResult;
  censusMatchedAddress: string;
}): Promise<RegulatoryRecordsResult> {
  const [permits, violations] = await Promise.all([
    findPermitsForParcel(input).catch(
      (): Awaited<ReturnType<typeof findPermitsForParcel>> => ({
        status: "unavailable",
        message: "PLI permits: Not Evaluated",
        parcelIdQueried: input.pin,
        source: {
          name: "City of Pittsburgh / WPRDC PLI Permits",
          datasetUrl: "https://data.wprdc.org/dataset/pli-permits",
          resourceId: "f4d1177a-f597-4c32-8cbf-7885f56253f6",
          queryUrl: "https://data.wprdc.org/api/3/action/datastore_search",
          sourceLastModified: null,
          retrievedAt: new Date().toISOString(),
          temporalCoverage: "2019-06-01/present (current feed)",
        },
      }),
    ),
    findViolationsForParcel(input).catch(
      (): Awaited<ReturnType<typeof findViolationsForParcel>> => ({
        status: "unavailable",
        message: "Violations: Not Evaluated",
        parcelIdQueried: input.pin,
        source: {
          name: "City of Pittsburgh / WPRDC PLI/DOMI/ES Violations",
          datasetUrl:
            "https://data.wprdc.org/dataset/pittsburgh-pli-violations-report",
          resourceId: "70c06278-92c5-4040-ab28-17671866f81c",
          queryUrl: "https://data.wprdc.org/api/3/action/datastore_search",
          sourceLastModified: null,
          retrievedAt: new Date().toISOString(),
          temporalCoverage: "2020-06-01/present (current feed)",
        },
      }),
    ),
  ]);

  const permitRecords = permits.status === "ok" ? permits.records : [];
  const violationRecords =
    violations.status === "ok" ? violations.records : [];
  const unresolvedPermitCount = permitRecords.filter(
    (record) => record.reviewClass === "UNRESOLVED",
  ).length;
  const unresolvedViolationCount = violationRecords.filter(
    (record) => record.reviewClass === "UNRESOLVED",
  ).length;
  const verificationRequiredCount = [...permitRecords, ...violationRecords].filter(
    (record) => record.reviewClass === "REQUIRES_VERIFICATION",
  ).length;

  const overallStatus = resolveRegulatoryScreeningStatus({
    permitsEvaluated: permits.status === "ok",
    violationsEvaluated: violations.status === "ok",
    unresolvedPermitCount,
    unresolvedViolationCount,
    verificationRequiredCount,
  });

  const limitations = [
    "Queried current WPRDC feeds only. Historical PLI permits (pre-2019) and historical violations (2015–May 2020) are not included.",
    "No record found is not proof that no regulatory issue exists.",
    "A closed or completed record is not a finding that all regulatory issues are resolved.",
    "Permit status 'Issued' and other unmapped statuses are shown for verification and are not classified as clearly open/unresolved because the WPRDC status field has no official definition.",
    "Plumbing permits are not in the PLI Permits dataset (Allegheny County Health Department).",
    "This is decision support only; it is not a legal, permitting, or code-enforcement determination.",
  ];

  if (permits.status === "ok" && permits.truncated) {
    limitations.push(
      "Permit query hit the 500-record cap; additional matching rows may exist.",
    );
  }
  if (violations.status === "ok" && violations.truncated) {
    limitations.push(
      "Violation query hit the 500-row cap before casefile collapse; additional matching rows may exist.",
    );
  }
  if (permits.status !== "ok") {
    limitations.push(
      "PLI permits were Not Evaluated. Missing permit data is not treated as favorable.",
    );
  }
  if (violations.status !== "ok") {
    limitations.push(
      "Violations were Not Evaluated. Missing violation data is not treated as favorable.",
    );
  }

  return {
    overallStatus,
    overallStatusLabel: REGULATORY_SCREENING_LABELS[overallStatus],
    parcelId: input.pin,
    permitCount: permitRecords.length,
    unresolvedPermitCount,
    verificationRequiredCount,
    violationCount: violationRecords.length,
    unresolvedViolationCount,
    permits,
    violations,
    limitations,
  };
}

export type { RegulatoryRecordsResult } from "@/lib/regulatory/types";
export {
  REGULATORY_SCREENING_LABELS,
  classifyPermitStatus,
  classifyViolationStatus,
} from "@/lib/regulatory/status";
