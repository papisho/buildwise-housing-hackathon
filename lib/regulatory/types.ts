import type {
  RecordReviewClass,
  RegulatoryScreeningStatus,
} from "@/lib/regulatory/status";

export type RegulatorySource = {
  name: string;
  datasetUrl: string;
  resourceId: string;
  queryUrl: string;
  sourceLastModified: string | null;
  retrievedAt: string;
  temporalCoverage: string;
};

export type PermitRecord = {
  permitId: string;
  permitType: string | null;
  status: string | null;
  issueDate: string | null;
  completionDate: string | null;
  workDescription: string | null;
  workType: string | null;
  address: string | null;
  parcelNum: string | null;
  joinMethod: "parcel_id" | "normalized_address";
  reviewClass: RecordReviewClass;
};

export type ViolationRecord = {
  casefileNumber: string;
  department: string | null;
  status: string | null;
  statusesObserved: string[];
  openedDate: string | null;
  closedDate: string | null;
  category: string | null;
  description: string | null;
  address: string | null;
  parcelId: string | null;
  joinMethod: "parcel_id" | "normalized_address";
  reviewClass: RecordReviewClass;
  rowCount: number;
};

export type PermitLookupResult =
  | {
      status: "ok";
      records: PermitRecord[];
      totalMatched: number;
      truncated: boolean;
      joinMethod: "parcel_id" | "normalized_address" | "none";
      parcelIdQueried: string;
      source: RegulatorySource;
    }
  | {
      status: "unavailable";
      message: string;
      parcelIdQueried: string;
      source: RegulatorySource;
    };

export type ViolationLookupResult =
  | {
      status: "ok";
      records: ViolationRecord[];
      totalMatchedRows: number;
      truncated: boolean;
      joinMethod: "parcel_id" | "normalized_address" | "none";
      parcelIdQueried: string;
      source: RegulatorySource;
    }
  | {
      status: "unavailable";
      message: string;
      parcelIdQueried: string;
      source: RegulatorySource;
    };

export type RegulatoryRecordsResult = {
  overallStatus: RegulatoryScreeningStatus;
  overallStatusLabel: string;
  parcelId: string;
  permitCount: number;
  unresolvedPermitCount: number;
  verificationRequiredCount: number;
  violationCount: number;
  unresolvedViolationCount: number;
  permits: PermitLookupResult;
  violations: ViolationLookupResult;
  limitations: string[];
};
