import {
  historicEvidenceIsPartial,
  resolveHistoricScreeningStatus,
} from "@/lib/historic/status";
import type {
  HistoricDistrictLookupResult,
  HistoricSiteLookupResult,
  HistoricSource,
} from "@/lib/historic/types";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const source: HistoricSource = {
  name: "test",
  datasetUrl: "https://example.com",
  queryUrl: "https://example.com",
  resourceId: "test",
  crs: "EPSG:2272",
  sourceLastModified: null,
  retrievedAt: "2026-09-27T00:00:00.000Z",
};

function districtsOk(intersects: boolean): HistoricDistrictLookupResult {
  return {
    status: "ok",
    intersects,
    districts: intersects
      ? [
          {
            name: "Mexican War Streets",
            districtType: "CHD",
            guidelineLink: null,
            overlapAreaSqFt: 1000,
            overlapPercent: 80,
          },
        ]
      : [],
    overlapAreaSqFt: intersects ? 1000 : 0,
    overlapPercent: intersects ? 80 : 0,
    message: intersects ? "hit" : "none",
    source,
  };
}

function sitesOk(intersects: boolean): HistoricSiteLookupResult {
  return {
    status: "ok",
    intersects,
    sites: intersects
      ? [
          {
            name: "August Wilson House",
            address: "1727 Bedford Ave",
            lotblock: "0009S00036000000",
            overlapAreaSqFt: 2000,
            overlapPercent: 100,
          },
        ]
      : [],
    overlapAreaSqFt: intersects ? 2000 : 0,
    overlapPercent: intersects ? 100 : 0,
    message: intersects ? "hit" : "none",
    source,
  };
}

const notEvaluatedDistricts: HistoricDistrictLookupResult = {
  status: "not_evaluated",
  message: "Historic districts: Not Evaluated",
  source,
};

const notEvaluatedSites: HistoricSiteLookupResult = {
  status: "not_evaluated",
  message: "Individual historic sites: Not Evaluated",
  source,
};

export function runHistoricStatusTests() {
  assert(
    resolveHistoricScreeningStatus({
      districts: districtsOk(false),
      sites: sitesOk(false),
    }) === "NO_HISTORIC_DESIGNATION_IDENTIFIED",
    "no intersection should be no designation identified",
  );
  assert(
    resolveHistoricScreeningStatus({
      districts: districtsOk(true),
      sites: sitesOk(false),
    }) === "HISTORIC_DISTRICT_REVIEW",
    "district only",
  );
  assert(
    resolveHistoricScreeningStatus({
      districts: districtsOk(false),
      sites: sitesOk(true),
    }) === "INDIVIDUAL_HISTORIC_DESIGNATION_REVIEW",
    "site only",
  );
  assert(
    resolveHistoricScreeningStatus({
      districts: districtsOk(true),
      sites: sitesOk(true),
    }) === "MULTIPLE_HISTORIC_REVIEW",
    "both intersections",
  );
  assert(
    resolveHistoricScreeningStatus({
      districts: notEvaluatedDistricts,
      sites: notEvaluatedSites,
    }) === "HISTORIC_STATUS_NOT_EVALUATED",
    "both sources failed",
  );
  assert(
    resolveHistoricScreeningStatus({
      districts: districtsOk(false),
      sites: notEvaluatedSites,
    }) === "HISTORIC_STATUS_NOT_EVALUATED",
    "clear district plus failed site is not a no-designation finding",
  );
  assert(
    resolveHistoricScreeningStatus({
      districts: notEvaluatedDistricts,
      sites: sitesOk(true),
    }) === "INDIVIDUAL_HISTORIC_DESIGNATION_REVIEW",
    "site hit still reviews even if districts failed",
  );
  assert(
    historicEvidenceIsPartial({
      districts: notEvaluatedDistricts,
      sites: sitesOk(true),
    }) === true,
    "site hit plus district failure is partial evidence",
  );
  assert(
    historicEvidenceIsPartial({
      districts: districtsOk(true),
      sites: notEvaluatedSites,
    }) === true,
    "district hit plus site failure is partial evidence",
  );
  assert(
    historicEvidenceIsPartial({
      districts: districtsOk(true),
      sites: sitesOk(false),
    }) === false,
    "both layers evaluated is not partial",
  );
  console.log("historic status tests passed");
}

if (process.argv[1]?.includes("run-status-tests")) {
  runHistoricStatusTests();
}
