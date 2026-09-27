import { findParcelForAddress } from "@/lib/lookup/address-to-parcel";
import type { EvidenceMapData, EvidenceMapLayer } from "@/lib/map/types";

let failures = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`PASS  ${name}`);
    return;
  }
  failures += 1;
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

function layer(map: EvidenceMapData, id: EvidenceMapLayer["id"]) {
  return map.layers.find((entry) => entry.id === id);
}

function summarize(map: EvidenceMapData): string {
  return map.layers
    .map((entry) => `${entry.id}:${entry.state}(${entry.features.length})`)
    .join(" ");
}

async function analyze(address: string) {
  const result = await findParcelForAddress(address, "general_screening");
  console.log(`\n=== ${address} -> ${result.status} ===`);
  return result;
}

/** Acceptance 1: corrected canonical parcel, R1D-VL zoning, no 5057 leakage. */
async function fifthAvenue(): Promise<void> {
  const result = await analyze("5061 5TH AVE, PITTSBURGH, PA 15232");
  if (result.status !== "ok" || !result.evidenceMap) {
    check("5061 5TH AVE produces a map", false, result.status);
    return;
  }

  const map = result.evidenceMap;
  console.log(summarize(map), `${JSON.stringify(map).length} bytes`);
  check(
    "5061 map is keyed to validated PIN 0052G00100000000",
    map.parcelPin === "0052G00100000000" &&
      result.parcel.pin === "0052G00100000000",
    map.parcelPin,
  );

  const parcelDetail =
    layer(map, "parcel")?.features[0]?.detail.join(" ") ?? "";
  check(
    "5061 parcel popup carries the canonical PARID only",
    parcelDetail.includes("PARID 0052G00100000000") &&
      !parcelDetail.includes("5057"),
    parcelDetail,
  );
  check(
    "5061 zoning shows R1D-VL",
    (layer(map, "zoning")?.features ?? []).some(
      (feature) => feature.label === "R1D-VL",
    ),
    JSON.stringify(layer(map, "zoning")?.features.map((entry) => entry.label)),
  );
}

/** Acceptance 2: occupied parcel with a visible undermined intersection. */
async function dellaglen(): Promise<void> {
  const result = await analyze("5622 DELLAGLEN AVE, PITTSBURGH, PA");
  if (result.status !== "ok" || !result.evidenceMap) {
    check("5622 DELLAGLEN AVE produces a map", false, result.status);
    return;
  }

  const map = result.evidenceMap;
  console.log(summarize(map), `${JSON.stringify(map).length} bytes`);
  check(
    "5622 map is keyed to validated PIN 0185S00058000000",
    map.parcelPin === "0185S00058000000",
    map.parcelPin,
  );

  const undermined = layer(map, "undermined");
  check(
    "5622 undermined overlay intersects the parcel",
    undermined?.state === "mapped" && undermined.features.length > 0,
    `${undermined?.state} ${undermined?.features.length}`,
  );
}

/** Acceptance 3: GT-B zoning, historic site geometry, no core hazard. */
async function grantStreet(): Promise<void> {
  const result = await analyze("414 GRANT ST, PITTSBURGH, PA 15219");
  if (result.status !== "ok" || !result.evidenceMap) {
    check("414 GRANT ST produces a map", false, result.status);
    return;
  }

  const map = result.evidenceMap;
  console.log(summarize(map), `${JSON.stringify(map).length} bytes`);
  check(
    "414 Grant zoning shows GT-B",
    (layer(map, "zoning")?.features ?? []).some(
      (feature) => feature.label === "GT-B",
    ),
    JSON.stringify(layer(map, "zoning")?.features.map((entry) => entry.label)),
  );

  const historic = layer(map, "historic");
  check(
    "414 Grant historic site geometry is drawn",
    historic?.state === "mapped" && historic.features.length > 0,
    JSON.stringify(historic?.features.map((entry) => entry.label)),
  );

  const hazards = (["steep_slope", "landslide", "undermined", "flood"] as const)
    .map((id) => layer(map, id))
    .filter((entry) => entry?.state === "mapped");
  check(
    "414 Grant shows no mapped core hazard intersection",
    hazards.length === 0,
    JSON.stringify(hazards.map((entry) => entry?.id)),
  );
}

/** Acceptance 4: Mexican War Streets district intersects the parcel. */
async function resacaPlace(): Promise<void> {
  const result = await analyze("1211 RESACA PL, PITTSBURGH, PA 15212");
  if (result.status !== "ok" || !result.evidenceMap) {
    check("1211 Resaca Place produces a map", false, result.status);
    return;
  }

  const map = result.evidenceMap;
  console.log(summarize(map), `${JSON.stringify(map).length} bytes`);
  const historic = layer(map, "historic");
  check(
    "1211 Resaca Place shows the Mexican War Streets district",
    historic?.state === "mapped" &&
      historic.features.some((feature) => /mexican war/i.test(feature.label)),
    JSON.stringify(historic?.features.map((entry) => entry.label)),
  );
}

/** Acceptance 5: an unresolved parcel must not get an authoritative map. */
async function unresolvedParcel(): Promise<void> {
  const result = await analyze("5059 5TH AVE, PITTSBURGH, PA 15232");
  check(
    "unresolved parcel returns no map payload",
    result.status === "parcel_identity_verification_required" &&
      !("evidenceMap" in result),
    result.status,
  );
}

async function main(): Promise<void> {
  await fifthAvenue();
  await dellaglen();
  await grantStreet();
  await resacaPlace();
  await unresolvedParcel();
}

main()
  .then(() => {
    console.log(
      failures === 0
        ? "\nAll map live acceptance checks passed."
        : `\n${failures} failing.`,
    );
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
