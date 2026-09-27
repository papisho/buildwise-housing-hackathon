import { findParcelForAddress } from "@/lib/lookup/address-to-parcel";
import { buildDecisionSnapshot } from "@/lib/scoring";
import { runScoringV1FixtureTests } from "@/lib/scoring/run-acceptance";

function printSnapshot(title: string, result: Awaited<ReturnType<typeof findParcelForAddress>>) {
  console.log(`\n=== ${title} ===`);
  if (result.status !== "ok") {
    console.log("LOOKUP FAIL", result.status, "message" in result ? result.message : "");
    return;
  }
  const { decision, zoning, useCompatibility, steepSlope, landslide, undermined, flood } =
    result;
  console.log({
    address: result.census.matchedAddress,
    pin: result.parcel.pin,
    proposed: result.request.proposedProjectType,
    districts:
      zoning.status === "ok"
        ? zoning.districts.map((district) => ({
            code: district.code,
            intersectionPercent: district.intersectionPercent,
            intersectionAreaSqFt: district.intersectionAreaSqFt,
          }))
        : zoning,
    splitZoning: zoning.status === "ok" ? zoning.splitZoning : false,
    useStatus: useCompatibility.overallStatus,
    slope: steepSlope.status === "ok" ? { intersects: steepSlope.intersects, overlap: steepSlope.overlapPercent } : steepSlope,
    landslide: landslide.status === "ok" ? landslide.intersects : landslide.status,
    mine: undermined.status === "ok" ? undermined.intersects : undermined.status,
    flood: flood.status === "ok" ? flood.intersects : flood.status,
    scoreComplete: decision.score.complete,
    scoreValue: decision.score.value,
    presentation: decision.presentation,
    regulatoryFit: decision.score.regulatoryFit,
    physicalSite: decision.score.physicalSite,
    contributions: decision.score.contributions.map((item) => ({
      id: item.id,
      state: item.state,
      earned: item.earnedPoints,
      max: item.maxPoints,
    })),
    screeningStatus: decision.screeningStatus,
    coverage: decision.coverage.percent,
    flags: decision.flags.map((flag) => flag.type),
    heuristic: decision.heuristicLabel,
  });
}

async function main() {
  console.log("Fixture tests");
  runScoringV1FixtureTests();

  const fifthSingle = await findParcelForAddress(
    "5061 Fifth Ave, Pittsburgh, PA",
    "single_unit_detached",
  );
  printSnapshot("LIVE 1: 5061 Fifth + Single-Unit Detached", fifthSingle);

  const fifthTwo = await findParcelForAddress(
    "5061 Fifth Ave, Pittsburgh, PA",
    "two_unit",
  );
  printSnapshot("LIVE 2: 5061 Fifth + Two-Unit", fifthTwo);

  const grantTwo = await findParcelForAddress(
    "414 Grant St, Pittsburgh, PA",
    "two_unit",
  );
  printSnapshot("LIVE 3: 414 Grant + Two-Unit", grantTwo);

  if (fifthSingle.status === "ok") {
    const failed = buildDecisionSnapshot({
      assessment: fifthSingle.assessment,
      zoning: fifthSingle.zoning,
      steepSlope: fifthSingle.steepSlope,
      landslide: fifthSingle.landslide,
      undermined: fifthSingle.undermined,
      flood: { status: "not_evaluated", message: "forced source failure" },
      useCompatibility: fifthSingle.useCompatibility,
    });
    console.log("\n=== LIVE 4: Fifth Single-Unit with flood source failure ===");
    console.log({
      complete: failed.score.complete,
      value: failed.score.value,
      heading: failed.presentation.heading,
      flood: failed.score.contributions.find((item) => item.id === "flood"),
      coverage: failed.coverage.percent,
      screeningStatus: failed.screeningStatus,
    });
  }

  if (grantTwo.status === "ok" && grantTwo.zoning.status === "ok") {
    console.log("\n=== LIVE 5 split-zoning check on Grant ===");
    console.log({
      splitZoning: grantTwo.zoning.splitZoning,
      districts: grantTwo.zoning.districts.map((district) => ({
        code: district.code,
        intersectionPercent: district.intersectionPercent,
      })),
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
