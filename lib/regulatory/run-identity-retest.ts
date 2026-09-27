import { findParcelForAddress } from "@/lib/lookup/address-to-parcel";
import { runRegulatoryStatusTests } from "@/lib/regulatory/run-status-tests";
import { runScoringV1FixtureTests } from "@/lib/scoring/run-acceptance";

async function retest(title: string, address: string) {
  console.log(`\n=== ${title} ===`);
  const result = await findParcelForAddress(address, "general_screening");
  if (result.status !== "ok") {
    console.log("IDENTITY", {
      status: result.status,
      message: "message" in result ? result.message : null,
      directHitPin:
        result.status === "parcel_identity_verification_required"
          ? result.directHitPin
          : null,
      candidates:
        result.status === "parcel_identity_verification_required" ||
        result.status === "ambiguous_parcel_match"
          ? result.parcels.map((parcel) => ({
              pin: parcel.pin,
              assessmentAddress: parcel.assessmentAddress,
              addressMatched: parcel.addressMatched,
            }))
          : null,
    });
    return;
  }

  const analysisPin = result.parcel.pin;
  const permitPin = result.regulatoryRecords.permits.parcelIdQueried;
  const violationPin = result.regulatoryRecords.violations.parcelIdQueried;
  console.log({
    enteredAddress: address,
    geocodedAddress: result.census.matchedAddress,
    assessmentAddress:
      result.assessment.status === "ok"
        ? result.assessment.facts.propertyAddress
        : result.assessment.status,
    assessmentHouse:
      result.assessment.status === "ok"
        ? result.assessment.facts.houseNumber
        : null,
    assessmentUse:
      result.assessment.status === "ok"
        ? result.assessment.facts.useDescription
        : null,
    analysisPin,
    permitPin,
    violationPin,
    regulatoryParcelId: result.regulatoryRecords.parcelId,
    pinsMatch:
      analysisPin === permitPin &&
      analysisPin === violationPin &&
      analysisPin === result.regulatoryRecords.parcelId,
    overall: result.regulatoryRecords.overallStatus,
    permitCount: result.regulatoryRecords.permitCount,
    unresolvedPermits: result.regulatoryRecords.unresolvedPermitCount,
    violationCount: result.regulatoryRecords.violationCount,
    unresolvedViolations: result.regulatoryRecords.unresolvedViolationCount,
    verificationRequiredCount: result.regulatoryRecords.verificationRequiredCount,
  });
}

async function main() {
  runRegulatoryStatusTests();
  runScoringV1FixtureTests();
  await retest("414 Grant St", "414 Grant St, Pittsburgh, PA 15219");
  await retest("5061 Fifth Ave", "5061 Fifth Ave, Pittsburgh, PA 15232");
  await retest("5622 Dellaglen Ave", "5622 Dellaglen Ave, Pittsburgh, PA 15207");
  await retest("5059 Fifth Ave", "5059 Fifth Ave, Pittsburgh, PA 15232");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
