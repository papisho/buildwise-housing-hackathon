import { findParcelForAddress } from "@/lib/lookup/address-to-parcel";
import { buildDecisionSnapshot } from "@/lib/scoring";
import { runHistoricStatusTests } from "@/lib/historic/run-status-tests";

function printHistoric(
  title: string,
  result: Awaited<ReturnType<typeof findParcelForAddress>>,
) {
  console.log(`\n=== ${title} ===`);
  if (result.status !== "ok") {
    console.log({
      status: result.status,
      message: "message" in result ? result.message : null,
    });
    return;
  }

  const historic = result.historicDesignation;
  console.log({
    validatedPin: result.parcel.pin,
    historicParcelId: historic.parcelId,
    pinsMatch: result.parcel.pin === historic.parcelId,
    overallStatus: historic.overallStatus,
    message: historic.message,
    districtStatus: historic.districts.status,
    districtIntersects:
      historic.districts.status === "ok" ? historic.districts.intersects : null,
    districtNames:
      historic.districts.status === "ok"
        ? historic.districts.districts.map((district) => ({
            name: district.name,
            type: district.districtType,
            overlapPercent: district.overlapPercent,
          }))
        : historic.districts.message,
    siteStatus: historic.sites.status,
    siteIntersects:
      historic.sites.status === "ok" ? historic.sites.intersects : null,
    siteNames:
      historic.sites.status === "ok"
        ? historic.sites.sites.map((site) => ({
            name: site.name,
            address: site.address,
            lotblock: site.lotblock,
            overlapPercent: site.overlapPercent,
          }))
        : historic.sites.message,
    flags: result.decision.flags
      .filter(
        (flag) =>
          flag.type === "HISTORIC_DISTRICT_REVIEW" ||
          flag.type === "HISTORIC_SITE_REVIEW",
      )
      .map((flag) => flag.type),
    scoreValue: result.decision.score.value,
    coveragePercent: result.decision.coverage.percent,
    claudeHistoricPin: result.claudeContext.historic_designation.parcel_id,
  });
}

async function main() {
  runHistoricStatusTests();

  const district = await findParcelForAddress(
    "1211 RESACA PLACE, PITTSBURGH, PA 15212",
    "single_unit_detached",
  );
  printHistoric("District candidate: 1211 Resaca Place", district);

  const individual = await findParcelForAddress(
    "1727 BEDFORD AVE, PITTSBURGH, PA 15219",
    "single_unit_detached",
  );
  printHistoric("Individual site: 1727 Bedford Ave (August Wilson House)", individual);

  const fifth = await findParcelForAddress(
    "5061 5TH AVE, PITTSBURGH, PA 15232",
    "single_unit_detached",
  );
  printHistoric("5061 5TH AVE", fifth);

  const grant = await findParcelForAddress(
    "414 GRANT ST, PITTSBURGH, PA 15219",
    "two_unit",
  );
  printHistoric("414 GRANT ST", grant);

  if (fifth.status === "ok") {
    const failed = buildDecisionSnapshot({
      assessment: fifth.assessment,
      zoning: fifth.zoning,
      steepSlope: fifth.steepSlope,
      landslide: fifth.landslide,
      undermined: fifth.undermined,
      flood: fifth.flood,
      useCompatibility: fifth.useCompatibility,
      regulatoryRecords: fifth.regulatoryRecords,
      historicDesignation: {
        ...fifth.historicDesignation,
        overallStatus: "HISTORIC_STATUS_NOT_EVALUATED",
        overallStatusLabel: "Historic status not evaluated",
        message: "forced historic source failure",
        partialEvidence: false,
        unevaluatedLayers: [
          "City historic districts",
          "City individual historic sites",
        ],
        districts: {
          status: "not_evaluated",
          message: "forced district failure",
          source: fifth.historicDesignation.districts.source,
        },
        sites: {
          status: "not_evaluated",
          message: "forced site failure",
          source: fifth.historicDesignation.sites.source,
        },
      },
    });
    console.log("\n=== Source failure snapshot still renders ===");
    console.log({
      screeningStatus: failed.screeningStatus,
      scoreValue: failed.score.value,
      coveragePercent: failed.coverage.percent,
      historicFlags: failed.flags.filter((flag) =>
        flag.type.startsWith("HISTORIC_"),
      ),
      historicGaps: failed.evidenceGaps.filter(
        (gap) => gap.category === "historic_source",
      ),
      snapshotKeys: Object.keys(failed),
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
