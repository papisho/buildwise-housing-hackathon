import { findParcelForAddress } from "@/lib/lookup/address-to-parcel";
import { runAddressMatchTests } from "@/lib/parcels/run-match-address";

const PREVIOUS_POINT_HIT_PIN: Record<string, string> = {
  "5061 5TH AVE, PITTSBURGH, PA 15232": "0052G00106000000",
  "5622 DELLAGLEN AVE, PITTSBURGH, PA 15207": "0185S00066000000",
  "414 GRANT ST, PITTSBURGH, PA 15219": "0002E00284000000",
  "5059 5TH AVE, PITTSBURGH, PA 15232": "unknown-adjacent",
};

function summarize(
  title: string,
  address: string,
  result: Awaited<ReturnType<typeof findParcelForAddress>>,
) {
  const previousPin = PREVIOUS_POINT_HIT_PIN[address] ?? "n/a";

  if (result.status === "ok") {
    const assessmentAddress =
      result.assessment.status === "ok"
        ? result.assessment.facts.propertyAddress
        : result.assessment.status;
    console.log({
      title,
      status: result.status,
      previousPointHitPin: previousPin,
      validatedPin: result.parcel.pin,
      pinChanged: result.parcel.pin !== previousPin,
      assessmentAddress,
      regulatoryPin: result.regulatoryRecords.parcelId,
      permitPin: result.regulatoryRecords.permits.parcelIdQueried,
      violationPin: result.regulatoryRecords.violations.parcelIdQueried,
      downstreamPinsMatch:
        result.parcel.pin === result.regulatoryRecords.parcelId &&
        result.parcel.pin === result.regulatoryRecords.permits.parcelIdQueried &&
        result.parcel.pin ===
          result.regulatoryRecords.violations.parcelIdQueried,
      census: result.census.matchedAddress,
    });
    return;
  }

  if (result.status === "parcel_identity_verification_required") {
    console.log({
      title,
      status: result.status,
      previousPointHitPin: previousPin,
      validatedPin: null,
      directHitPin: result.directHitPin,
      analysisRan: false,
      candidatePins: result.parcels.map((parcel) => ({
        pin: parcel.pin,
        assessmentAddress: parcel.assessmentAddress,
        addressMatched: parcel.addressMatched,
      })),
      census: result.census.matchedAddress,
      message: result.message,
    });
    return;
  }

  console.log({
    title,
    status: result.status,
    previousPointHitPin: previousPin,
    result,
  });
}

async function main() {
  runAddressMatchTests();

  const fifth = await findParcelForAddress(
    "5061 5TH AVE, PITTSBURGH, PA 15232",
    "single_unit_detached",
  );
  summarize("5061 5TH AVE", "5061 5TH AVE, PITTSBURGH, PA 15232", fifth);

  const dellaglen = await findParcelForAddress(
    "5622 DELLAGLEN AVE, PITTSBURGH, PA 15207",
    "single_unit_detached",
  );
  summarize(
    "5622 DELLAGLEN AVE",
    "5622 DELLAGLEN AVE, PITTSBURGH, PA 15207",
    dellaglen,
  );

  const grant = await findParcelForAddress(
    "414 GRANT ST, PITTSBURGH, PA 15219",
    "two_unit",
  );
  summarize("414 GRANT ST", "414 GRANT ST, PITTSBURGH, PA 15219", grant);

  const unreliable = await findParcelForAddress(
    "5059 5TH AVE, PITTSBURGH, PA 15232",
    "single_unit_detached",
  );
  summarize(
    "5059 5TH AVE (no reliable house match)",
    "5059 5TH AVE, PITTSBURGH, PA 15232",
    unreliable,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
