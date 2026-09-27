import type {
  HistoricDistrictLookupResult,
  HistoricScreeningStatus,
  HistoricSiteLookupResult,
} from "@/lib/historic/types";

export const HISTORIC_SCREENING_LABELS: Record<HistoricScreeningStatus, string> =
  {
    NO_HISTORIC_DESIGNATION_IDENTIFIED:
      "No historic designation identified in queried datasets",
    HISTORIC_DISTRICT_REVIEW: "Historic district review",
    INDIVIDUAL_HISTORIC_DESIGNATION_REVIEW:
      "Individual historic designation review",
    MULTIPLE_HISTORIC_REVIEW: "Multiple historic review",
    HISTORIC_STATUS_NOT_EVALUATED: "Historic status not evaluated",
  };

export const NO_DESIGNATION_MESSAGE =
  "No historic designation identified in the queried historic-designation datasets.";

export const DESIGNATION_FOUND_MESSAGE =
  "Historic designation identified — City historic/design review may apply. Verify requirements with Pittsburgh Historic Review / City Planning before relying on this screening.";

export function unevaluatedHistoricLayers(input: {
  districts: HistoricDistrictLookupResult;
  sites: HistoricSiteLookupResult;
}): string[] {
  const layers: string[] = [];
  if (input.districts.status !== "ok") {
    layers.push("City historic districts");
  }
  if (input.sites.status !== "ok") {
    layers.push("City individual historic sites");
  }
  return layers;
}

export function historicEvidenceIsPartial(input: {
  districts: HistoricDistrictLookupResult;
  sites: HistoricSiteLookupResult;
}): boolean {
  const districtHit =
    input.districts.status === "ok" && input.districts.intersects;
  const siteHit = input.sites.status === "ok" && input.sites.intersects;
  return (
    (districtHit && input.sites.status !== "ok") ||
    (siteHit && input.districts.status !== "ok")
  );
}

export function historicStatusLabel(
  status: HistoricScreeningStatus,
  partialEvidence: boolean,
): string {
  const base = HISTORIC_SCREENING_LABELS[status];
  return partialEvidence ? `${base} — partial historic evidence` : base;
}

export function resolveHistoricScreeningStatus(input: {
  districts: HistoricDistrictLookupResult;
  sites: HistoricSiteLookupResult;
}): HistoricScreeningStatus {
  const districtHit = input.districts.status === "ok" && input.districts.intersects;
  const siteHit = input.sites.status === "ok" && input.sites.intersects;

  if (districtHit && siteHit) {
    return "MULTIPLE_HISTORIC_REVIEW";
  }
  if (districtHit) {
    return "HISTORIC_DISTRICT_REVIEW";
  }
  if (siteHit) {
    return "INDIVIDUAL_HISTORIC_DESIGNATION_REVIEW";
  }

  if (input.districts.status !== "ok" || input.sites.status !== "ok") {
    return "HISTORIC_STATUS_NOT_EVALUATED";
  }

  return "NO_HISTORIC_DESIGNATION_IDENTIFIED";
}
