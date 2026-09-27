import { findParcelForAddress } from "@/lib/lookup/address-to-parcel";
import { lookupRegulatoryRecords } from "@/lib/regulatory";
import { runRegulatoryStatusTests } from "@/lib/regulatory/run-status-tests";
import { buildDecisionSnapshot } from "@/lib/scoring";
import { runScoringV1FixtureTests } from "@/lib/scoring/run-acceptance";

function printRegulatory(
  title: string,
  result: Awaited<ReturnType<typeof findParcelForAddress>>,
) {
  console.log(`\n=== ${title} ===`);
  if (result.status !== "ok") {
    console.log("LOOKUP FAIL", result.status, "message" in result ? result.message : "");
    return;
  }
  const { regulatoryRecords, decision } = result;
  const analysisPin = result.parcel.pin;
  const permitPin =
    regulatoryRecords.permits.parcelIdQueried ?? regulatoryRecords.parcelId;
  const violationPin =
    regulatoryRecords.violations.parcelIdQueried ?? regulatoryRecords.parcelId;
  console.log({
    enteredAddress: result.request.inputAddress,
    geocodedAddress: result.census.matchedAddress,
    assessmentAddress:
      result.assessment.status === "ok"
        ? result.assessment.facts.propertyAddress
        : result.assessment.status,
    analysisPin,
    permitPin,
    violationPin,
    pinsMatch: analysisPin === permitPin && analysisPin === violationPin,
    regulatoryParcelId: regulatoryRecords.parcelId,
    scoreValue: decision.score.value,
    scoreComplete: decision.score.complete,
    coverage: decision.coverage.percent,
    screeningStatus: decision.screeningStatus,
    flags: decision.flags.map((flag) => flag.type),
    regulatoryStatus: regulatoryRecords.overallStatus,
    verificationRequiredCount: regulatoryRecords.verificationRequiredCount,
    permitCount: regulatoryRecords.permitCount,
    unresolvedPermits: regulatoryRecords.unresolvedPermitCount,
    permitJoin: regulatoryRecords.permits.status === "ok"
      ? regulatoryRecords.permits.joinMethod
      : regulatoryRecords.permits.status,
    permits:
      regulatoryRecords.permits.status === "ok"
        ? regulatoryRecords.permits.records.map((record) => ({
            id: record.permitId,
            type: record.permitType,
            status: record.status,
            reviewClass: record.reviewClass,
            issueDate: record.issueDate,
          }))
        : regulatoryRecords.permits.message,
    violationCount: regulatoryRecords.violationCount,
    unresolvedViolations: regulatoryRecords.unresolvedViolationCount,
    violationJoin:
      regulatoryRecords.violations.status === "ok"
        ? regulatoryRecords.violations.joinMethod
        : regulatoryRecords.violations.status,
    violations:
      regulatoryRecords.violations.status === "ok"
        ? regulatoryRecords.violations.records.map((record) => ({
            id: record.casefileNumber,
            dept: record.department,
            status: record.status,
            reviewClass: record.reviewClass,
            opened: record.openedDate,
          }))
        : regulatoryRecords.violations.message,
  });
}

async function main() {
  console.log("Status mapping tests");
  runRegulatoryStatusTests();
  console.log("Scoring fixtures (must remain unchanged)");
  runScoringV1FixtureTests();

  const grant = await findParcelForAddress(
    "414 Grant St, Pittsburgh, PA 15219",
    "two_unit",
  );
  printRegulatory("LIVE 1: 414 Grant St", grant);

  const fifth = await findParcelForAddress(
    "5061 Fifth Ave, Pittsburgh, PA 15232",
    "single_unit_detached",
  );
  printRegulatory("LIVE 2: 5061 Fifth Ave", fifth);

  const openViolation = await findParcelForAddress(
    "5622 Dellaglen Ave, Pittsburgh, PA 15207",
    "single_unit_detached",
  );
  printRegulatory("LIVE 3: 5622 Dellaglen Ave (identity check only)", openViolation);
  if (openViolation.status === "ok") {
    console.log("Dellaglen identity note: do not treat as unresolved-violation acceptance unless assessment house number is 5622.");
  }

  const mayflower = await findParcelForAddress(
    "32 Mayflower St, Pittsburgh, PA 15206",
    "single_unit_detached",
  );
  printRegulatory("LIVE 3b: 32 Mayflower St", mayflower);

  const badPin = await lookupRegulatoryRecords({
    pin: "not a parid!",
    assessment: { status: "no_record", message: "invalid pin test" },
    censusMatchedAddress: "414 GRANT ST, PITTSBURGH, PA, 15219",
  });
  console.log("\n=== LIVE 4b: invalid pin marks sources Not Evaluated ===");
  console.log({
    overall: badPin.overallStatus,
    permits: badPin.permits.status,
    violations: badPin.violations.status,
  });

  if (fifth.status === "ok") {
    const failedPermits = buildDecisionSnapshot({
      assessment: fifth.assessment,
      zoning: fifth.zoning,
      steepSlope: fifth.steepSlope,
      landslide: fifth.landslide,
      undermined: fifth.undermined,
      flood: fifth.flood,
      useCompatibility: fifth.useCompatibility,
      regulatoryRecords: {
        ...fifth.regulatoryRecords,
        overallStatus: "REGULATORY_RECORDS_NOT_EVALUATED",
        overallStatusLabel: "Regulatory records not evaluated",
        permitCount: 0,
        unresolvedPermitCount: 0,
        permits: {
          status: "unavailable",
          message: "forced permit source failure",
          parcelIdQueried: fifth.parcel.pin,
          source: fifth.regulatoryRecords.permits.source,
        },
      },
    });
    console.log("\n=== LIVE 4: source failure still renders snapshot ===");
    console.log({
      scoreValue: failedPermits.score.value,
      scoreComplete: failedPermits.score.complete,
      coverage: failedPermits.coverage.percent,
      screeningStatus: failedPermits.screeningStatus,
      flags: failedPermits.flags.map((flag) => flag.type),
      permitGap: failedPermits.evidenceGaps.filter(
        (gap) => gap.category === "regulatory_source",
      ),
      scoreUnchanged: failedPermits.score.value === fifth.decision.score.value,
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
