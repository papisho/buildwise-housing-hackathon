import { findHistoricDistrictsForPin } from "@/lib/historic/districts";
import { findHistoricSitesForPin } from "@/lib/historic/sites";
import {
  DESIGNATION_FOUND_MESSAGE,
  NO_DESIGNATION_MESSAGE,
  historicEvidenceIsPartial,
  historicStatusLabel,
  resolveHistoricScreeningStatus,
  unevaluatedHistoricLayers,
} from "@/lib/historic/status";
import type { HistoricDesignationResult } from "@/lib/historic/types";
import type { EsriPolygon } from "@/lib/hazards/arcgis";

export async function lookupHistoricDesignation(input: {
  pin: string;
  geometry?: EsriPolygon;
  /** Display-only geometry collectors; they do not affect screening status. */
  collectDistrictGeometry?: (name: string, rings: number[][][]) => void;
  collectSiteGeometry?: (name: string, rings: number[][][]) => void;
}): Promise<HistoricDesignationResult> {
  const [districts, sites] = await Promise.all([
    findHistoricDistrictsForPin(
      input.pin,
      input.geometry,
      input.collectDistrictGeometry,
    ).catch(
      (): Awaited<ReturnType<typeof findHistoricDistrictsForPin>> => ({
        status: "not_evaluated",
        message: "Historic districts: Not Evaluated",
        source: {
          name: "City of Pittsburgh / WPRDC City Designated Historic Districts",
          datasetUrl:
            "https://data.wprdc.org/dataset/city-designated-historic-districts",
          queryUrl:
            "https://services1.arcgis.com/YZCmUqbcsUpOKfj7/arcgis/rest/services/PGHWebCHDHistoricDistricts/FeatureServer/0/query",
          resourceId: "a7d619d1-b074-4f5b-959e-dc2389e85425",
          crs: "EPSG:2272",
          sourceLastModified: null,
          retrievedAt: new Date().toISOString(),
        },
      }),
    ),
    findHistoricSitesForPin(
      input.pin,
      input.geometry,
      input.collectSiteGeometry,
    ).catch(
      (): Awaited<ReturnType<typeof findHistoricSitesForPin>> => ({
        status: "not_evaluated",
        message: "Individual historic sites: Not Evaluated",
        source: {
          name: "City of Pittsburgh / WPRDC City Designated Individual Historic Sites",
          datasetUrl:
            "https://data.wprdc.org/dataset/city-designated-individual-historic-sites",
          queryUrl:
            "https://services1.arcgis.com/YZCmUqbcsUpOKfj7/arcgis/rest/services/PGHWEBCHDIndividialProperties/FeatureServer/0/query",
          resourceId: "2a55085b-57e2-4b98-a784-a0ad7cbcc9fb",
          crs: "EPSG:2272",
          sourceLastModified: null,
          retrievedAt: new Date().toISOString(),
        },
      }),
    ),
  ]);

  const overallStatus = resolveHistoricScreeningStatus({ districts, sites });
  const partialEvidence = historicEvidenceIsPartial({ districts, sites });
  const unevaluatedLayers = unevaluatedHistoricLayers({ districts, sites });
  const limitations = [
    "This is a GIS screening against City/WPRDC historic-designation layers. It is not a Historic Review Commission determination, Certificate of Appropriateness, or a finding that work is prohibited or permitted.",
    "Intersection with a mapped district or site means City historic/design review may apply. It does not mean demolition is prohibited, exterior work is prohibited, or the project cannot proceed.",
    "The district layer currently publishes City Historic Districts (type CHD). National Register listing is not independently evaluated here.",
    "Overlaps under 1% are ignored as a BuildWise geometry-noise heuristic unless the site lotblock matches the validated PIN. 1% is an implementation choice, not an official City Historic Review threshold. Matching lotblock to the canonical PIN still counts as a hit.",
    "Do not treat a source failure as the absence of historic designation.",
  ];

  if (districts.status !== "ok") {
    limitations.push(
      "City historic districts were Not Evaluated. Missing district data is not treated as clear/favorable.",
    );
  }
  if (sites.status !== "ok") {
    limitations.push(
      "Individually designated historic sites were Not Evaluated. Missing site data is not treated as clear/favorable.",
    );
  }

  const foundMessage = partialEvidence
    ? `${DESIGNATION_FOUND_MESSAGE} This is partial historic evidence: ${unevaluatedLayers.join(" and ")} ${unevaluatedLayers.length === 1 ? "was" : "were"} Not Evaluated. Do not treat this card as a complete historic screening.`
    : DESIGNATION_FOUND_MESSAGE;

  return {
    overallStatus,
    overallStatusLabel: historicStatusLabel(overallStatus, partialEvidence),
    parcelId: input.pin,
    message:
      overallStatus === "NO_HISTORIC_DESIGNATION_IDENTIFIED"
        ? NO_DESIGNATION_MESSAGE
        : overallStatus === "HISTORIC_STATUS_NOT_EVALUATED"
          ? "Historic designation was Not Evaluated for at least one queried layer. Missing historic evidence is not treated as the absence of designation."
          : foundMessage,
    partialEvidence,
    unevaluatedLayers,
    districts,
    sites,
    limitations,
  };
}

export type { HistoricDesignationResult } from "@/lib/historic/types";
export {
  HISTORIC_SCREENING_LABELS,
  historicEvidenceIsPartial,
  resolveHistoricScreeningStatus,
} from "@/lib/historic/status";
