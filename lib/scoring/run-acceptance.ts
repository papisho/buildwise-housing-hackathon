import type { AssessmentLookupResult } from "@/lib/assessments/wprdc";
import type { FloodLookupResult } from "@/lib/hazards/flood";
import type { LandslideLookupResult } from "@/lib/hazards/landslide";
import type { SteepSlopeLookupResult } from "@/lib/hazards/steep-slope";
import type { UnderminedLookupResult } from "@/lib/hazards/undermined";
import { buildDecisionSnapshot } from "@/lib/scoring";
import { evaluateUseCompatibility } from "@/lib/zoning/compatibility";
import type { ZoningLookupResult, ZoningSource } from "@/lib/zoning/pittsburgh";

const zoningSource: ZoningSource = {
  name: "test",
  datasetUrl: "https://example.com",
  queryUrl: "https://example.com",
  resourceId: "test",
  zoningCodeUrl: "https://example.com",
  zoningMapUrl: "https://example.com",
  cityZoningPageUrl: "https://example.com",
  sourceLastModified: null,
  retrievedAt: "2026-09-26T00:00:00.000Z",
};

const assessmentOk: AssessmentLookupResult = {
  status: "ok",
  facts: {
    parid: "TEST",
    propertyAddress: "fixture",
    houseNumber: null,
    streetName: null,
    houseNumberFraction: null,
    municipality: null,
    municipalityCode: null,
    classCode: null,
    classDescription: null,
    useCode: null,
    useDescription: null,
    lotArea: 5000,
    countyAssessedLandValue: null,
    countyAssessedBuildingValue: null,
    countyAssessedTotal: null,
    yearBuilt: null,
    stories: null,
    finishedLivingArea: null,
    taxYear: null,
    asOfDate: null,
  },
};

function okSlope(
  overlapPercent: number | null,
  intersects = overlapPercent !== 0,
): SteepSlopeLookupResult {
  return {
    status: "ok",
    intersects,
    overlapPercent,
    overlapAreaSqFt: overlapPercent === null ? null : 100,
    message: "fixture",
    source: {
      name: "slope",
      datasetUrl: "https://example.com",
      queryUrl: "https://example.com",
      resourceId: "x",
      crs: "EPSG:2272",
      sourceLastModified: null,
      retrievedAt: "2026-09-26T00:00:00.000Z",
    },
  };
}

function okClearHazard(): LandslideLookupResult {
  return {
    status: "ok",
    intersects: false,
    overlapPercent: 0,
    overlapAreaSqFt: 0,
    message: "fixture",
    source: {
      name: "hazard",
      datasetUrl: "https://example.com",
      queryUrl: "https://example.com",
      resourceId: "x",
      crs: "EPSG:2272",
      sourceLastModified: null,
      retrievedAt: "2026-09-26T00:00:00.000Z",
    },
  };
}

function okClearMine(): UnderminedLookupResult {
  return {
    status: "ok",
    intersects: false,
    overlapPercent: 0,
    overlapAreaSqFt: 0,
    classifications: [],
    message: "fixture",
    source: {
      name: "hazard",
      datasetUrl: "https://example.com",
      queryUrl: "https://example.com",
      resourceId: "x",
      crs: "EPSG:2272",
      sourceLastModified: null,
      retrievedAt: "2026-09-26T00:00:00.000Z",
    },
  };
}

function okClearFlood(): FloodLookupResult {
  return {
    status: "ok",
    intersects: false,
    overlapPercent: 0,
    overlapAreaSqFt: 0,
    zones: [],
    message: "fixture",
    provenance: "fema_nfhl",
    source: {
      name: "flood",
      datasetUrl: "https://example.com",
      queryUrl: "https://example.com",
      resourceId: null,
      crs: "EPSG:2272",
      sourceLastModified: null,
      retrievedAt: "2026-09-26T00:00:00.000Z",
    },
  };
}

function r1dZoning(): ZoningLookupResult {
  return {
    status: "ok",
    splitZoning: false,
    source: zoningSource,
    districts: [
      {
        code: "R1D-VL",
        fullType: "Single-Unit Detached Residential",
        legendType: null,
        status: null,
        correctionLabel: null,
        intersectionAreaSqFt: 5000,
        intersectionPercent: 100,
      },
    ],
  };
}

function gtBZoning(): ZoningLookupResult {
  return {
    status: "ok",
    splitZoning: false,
    source: zoningSource,
    districts: [
      {
        code: "GT-B",
        fullType: "Golden Triangle",
        legendType: null,
        status: null,
        correctionLabel: null,
        intersectionAreaSqFt: 8000,
        intersectionPercent: 100,
      },
    ],
  };
}

function assert(name: string, condition: boolean, detail: string): void {
  if (!condition) {
    throw new Error(`FAIL ${name}: ${detail}`);
  }
  console.log(`PASS ${name}: ${detail}`);
}

export function runScoringV1FixtureTests(): void {
  const hazards = {
    steepSlope: okSlope(8.9, true),
    landslide: okClearHazard(),
    undermined: okClearMine(),
    flood: okClearFlood(),
  };

  const fifthSingle = buildDecisionSnapshot({
    assessment: assessmentOk,
    zoning: r1dZoning(),
    ...hazards,
    useCompatibility: evaluateUseCompatibility({
      proposedProjectType: "single_unit_detached",
      zoning: r1dZoning(),
    }),
  });
  assert(
    "1 Fifth Single-Unit score",
    fifthSingle.score.complete && fifthSingle.score.value === 98.2,
    `value=${fifthSingle.score.value} complete=${fifthSingle.score.complete}`,
  );
  assert(
    "1 Fifth Single-Unit status",
    fifthSingle.screeningStatus === "REVIEW_REQUIRED",
    fifthSingle.screeningStatus,
  );
  assert(
    "1 Fifth Single-Unit not major",
    fifthSingle.screeningStatus !== "MAJOR_REGULATORY_BARRIER_IDENTIFIED",
    "no major regulatory barrier",
  );

  const fifthTwo = buildDecisionSnapshot({
    assessment: assessmentOk,
    zoning: r1dZoning(),
    ...hazards,
    useCompatibility: evaluateUseCompatibility({
      proposedProjectType: "two_unit",
      zoning: r1dZoning(),
    }),
  });
  assert(
    "2 Fifth Two-Unit score",
    fifthTwo.score.complete && fifthTwo.score.value === 48.2,
    `value=${fifthTwo.score.value}`,
  );
  assert(
    "2 Fifth Two-Unit status",
    fifthTwo.screeningStatus === "MAJOR_REGULATORY_BARRIER_IDENTIFIED",
    fifthTwo.screeningStatus,
  );
  assert(
    "2 Fifth Two-Unit slope flag",
    fifthTwo.flags.some((flag) => flag.type === "STEEP_SLOPE_REVIEW"),
    "slope flag present",
  );

  const grantTwo = buildDecisionSnapshot({
    assessment: assessmentOk,
    zoning: gtBZoning(),
    steepSlope: okSlope(0, false),
    landslide: okClearHazard(),
    undermined: okClearMine(),
    flood: okClearFlood(),
    useCompatibility: evaluateUseCompatibility({
      proposedProjectType: "two_unit",
      zoning: gtBZoning(),
    }),
  });
  assert(
    "3 Grant Incomplete",
    grantTwo.presentation.mode === "incomplete" &&
      grantTwo.presentation.valueLine === "Incomplete" &&
      grantTwo.score.value === null,
    `mode=${grantTwo.presentation.mode} value=${String(grantTwo.score.value)} heading=${grantTwo.presentation.heading}`,
  );
  assert(
    "3 Grant regulatory unscored",
    grantTwo.score.regulatoryFit.state === "not_evaluated",
    grantTwo.score.regulatoryFit.display,
  );
  assert(
    "3 Grant physical 50/50",
    grantTwo.score.physicalSite.complete &&
      grantTwo.score.physicalSite.earned === 50,
    grantTwo.score.physicalSite.display,
  );
  assert(
    "3 Grant status",
    grantTwo.screeningStatus === "DATA_VERIFICATION_REQUIRED",
    grantTwo.screeningStatus,
  );

  const floodFail = buildDecisionSnapshot({
    assessment: assessmentOk,
    zoning: r1dZoning(),
    steepSlope: okSlope(8.9, true),
    landslide: okClearHazard(),
    undermined: okClearMine(),
    flood: { status: "not_evaluated", message: "source failure fixture" },
    useCompatibility: evaluateUseCompatibility({
      proposedProjectType: "single_unit_detached",
      zoning: r1dZoning(),
    }),
  });
  const floodFactor = floodFail.score.contributions.find((item) => item.id === "flood");
  assert(
    "4 flood unscored not zero penalty",
    floodFactor?.state === "not_evaluated" && floodFactor.earnedPoints === null,
    JSON.stringify(floodFactor),
  );
  assert(
    "4 incomplete score",
    floodFail.presentation.mode === "incomplete" && floodFail.score.value === null,
    floodFail.presentation.heading,
  );
  assert(
    "4 coverage dropped",
    floodFail.coverage.percent === 85 && floodFail.coverage.percent <= 100,
    `coverage=${floodFail.coverage.percent}`,
  );
  assert(
    "4 status verification",
    floodFail.screeningStatus === "DATA_VERIFICATION_REQUIRED",
    floodFail.screeningStatus,
  );

  const splitZoning: ZoningLookupResult = {
    status: "ok",
    splitZoning: true,
    source: zoningSource,
    districts: [
      {
        code: "R1D-VL",
        fullType: null,
        legendType: null,
        status: null,
        correctionLabel: null,
        intersectionAreaSqFt: 3000,
        intersectionPercent: 60,
      },
      {
        code: "R2-H",
        fullType: null,
        legendType: null,
        status: null,
        correctionLabel: null,
        intersectionAreaSqFt: 2000,
        intersectionPercent: 40,
      },
    ],
  };
  const split = buildDecisionSnapshot({
    assessment: assessmentOk,
    zoning: splitZoning,
    steepSlope: okSlope(0, false),
    landslide: okClearHazard(),
    undermined: okClearMine(),
    flood: okClearFlood(),
    useCompatibility: evaluateUseCompatibility({
      proposedProjectType: "two_unit",
      zoning: splitZoning,
    }),
  });
  assert(
    "5 split not MAJOR from one incompatible district",
    split.screeningStatus === "DATA_VERIFICATION_REQUIRED",
    `${split.screeningStatus} districts=${splitZoning.districts.map((d) => `${d.code} ${d.intersectionPercent}%`).join(", ")} use=${split.score.regulatoryFit.display}`,
  );
  assert(
    "5 split incomplete mixed zoning",
    split.score.regulatoryFit.state === "not_evaluated" &&
      split.presentation.mode === "incomplete",
    split.score.regulatoryFit.display,
  );
  assert(
    "5 split flag lists both districts",
    split.flags.some((flag) => flag.type === "SPLIT_ZONING_REVIEW" && flag.finding.includes("R1D-VL") && flag.finding.includes("R2-H")),
    split.flags.map((flag) => flag.type).join(","),
  );

  const withRegulatory = buildDecisionSnapshot({
    assessment: assessmentOk,
    zoning: r1dZoning(),
    ...hazards,
    useCompatibility: evaluateUseCompatibility({
      proposedProjectType: "single_unit_detached",
      zoning: r1dZoning(),
    }),
    regulatoryRecords: {
      overallStatus: "UNRESOLVED_VIOLATION_REVIEW",
      overallStatusLabel: "Unresolved violation review",
      parcelId: "TEST",
      permitCount: 0,
      unresolvedPermitCount: 0,
      verificationRequiredCount: 0,
      violationCount: 1,
      unresolvedViolationCount: 1,
      permits: {
        status: "ok",
        records: [],
        totalMatched: 0,
        truncated: false,
        joinMethod: "none",
        parcelIdQueried: "TEST",
        source: {
          name: "test permits",
          datasetUrl: "https://example.com",
          resourceId: "x",
          queryUrl: "https://example.com",
          sourceLastModified: null,
          retrievedAt: "2026-09-26T00:00:00.000Z",
          temporalCoverage: "test",
        },
      },
      violations: {
        status: "ok",
        records: [
          {
            casefileNumber: "CF-PLI-TEST",
            department: "PLI",
            status: "In Violation",
            statusesObserved: ["In Violation"],
            openedDate: "2026-01-01",
            closedDate: null,
            category: "test",
            description: "fixture",
            address: "fixture",
            parcelId: "TEST",
            joinMethod: "parcel_id",
            reviewClass: "UNRESOLVED",
            rowCount: 1,
          },
        ],
        totalMatchedRows: 1,
        truncated: false,
        joinMethod: "parcel_id",
        parcelIdQueried: "TEST",
        source: {
          name: "test violations",
          datasetUrl: "https://example.com",
          resourceId: "x",
          queryUrl: "https://example.com",
          sourceLastModified: null,
          retrievedAt: "2026-09-26T00:00:00.000Z",
          temporalCoverage: "test",
        },
      },
      limitations: [],
    },
  });
  assert(
    "6 score unchanged with unresolved violation flag",
    withRegulatory.score.complete &&
      withRegulatory.score.value === fifthSingle.score.value &&
      withRegulatory.coverage.percent === fifthSingle.coverage.percent &&
      withRegulatory.flags.some((flag) => flag.type === "VIOLATION_REVIEW"),
    `score=${String(withRegulatory.score.value)} coverage=${withRegulatory.coverage.percent}`,
  );

  const sourceFail = buildDecisionSnapshot({
    assessment: assessmentOk,
    zoning: r1dZoning(),
    ...hazards,
    useCompatibility: evaluateUseCompatibility({
      proposedProjectType: "single_unit_detached",
      zoning: r1dZoning(),
    }),
    regulatoryRecords: {
      overallStatus: "REGULATORY_RECORDS_NOT_EVALUATED",
      overallStatusLabel: "Regulatory records not evaluated",
      parcelId: "TEST",
      permitCount: 0,
      unresolvedPermitCount: 0,
      verificationRequiredCount: 0,
      violationCount: 0,
      unresolvedViolationCount: 0,
      permits: {
        status: "unavailable",
        message: "forced permit source failure",
        parcelIdQueried: "TEST",
        source: {
          name: "test permits",
          datasetUrl: "https://example.com",
          resourceId: "x",
          queryUrl: "https://example.com",
          sourceLastModified: null,
          retrievedAt: "2026-09-26T00:00:00.000Z",
          temporalCoverage: "test",
        },
      },
      violations: {
        status: "ok",
        records: [],
        totalMatchedRows: 0,
        truncated: false,
        joinMethod: "none",
        parcelIdQueried: "TEST",
        source: {
          name: "test violations",
          datasetUrl: "https://example.com",
          resourceId: "x",
          queryUrl: "https://example.com",
          sourceLastModified: null,
          retrievedAt: "2026-09-26T00:00:00.000Z",
          temporalCoverage: "test",
        },
      },
      limitations: ["permits not evaluated"],
    },
  });
  assert(
    "7 source failure score still complete",
    sourceFail.score.complete &&
      sourceFail.score.value === fifthSingle.score.value &&
      !sourceFail.flags.some((flag) => flag.type === "VIOLATION_REVIEW") &&
      sourceFail.evidenceGaps.some((gap) => gap.label === "PLI permits"),
    `score=${String(sourceFail.score.value)}`,
  );
}

if (process.argv[1]?.includes("run-acceptance")) {
  runScoringV1FixtureTests();
}
