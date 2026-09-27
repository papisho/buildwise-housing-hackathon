import {
  overlapFromRings,
  queryIntersectingFeatures,
  readText,
  readWprdcVintage,
  resolveParcelPolygon,
  type EsriPolygon,
} from "@/lib/hazards/arcgis";
import type {
  HistoricSiteHit,
  HistoricSiteLookupResult,
  HistoricSource,
} from "@/lib/historic/types";
import { HISTORIC_MEANINGFUL_OVERLAP_PERCENT } from "@/lib/historic/districts";

export const HISTORIC_SITES_QUERY_URL =
  "https://services1.arcgis.com/YZCmUqbcsUpOKfj7/arcgis/rest/services/PGHWEBCHDIndividialProperties/FeatureServer/0/query";
export const HISTORIC_SITES_DATASET_URL =
  "https://data.wprdc.org/dataset/city-designated-individual-historic-sites";
export const HISTORIC_SITES_RESOURCE_ID =
  "2a55085b-57e2-4b98-a784-a0ad7cbcc9fb";

function siteSource(
  sourceLastModified: string | null,
  retrievedAt: string,
): HistoricSource {
  return {
    name: "City of Pittsburgh / WPRDC City Designated Individual Historic Sites",
    datasetUrl: HISTORIC_SITES_DATASET_URL,
    queryUrl: HISTORIC_SITES_QUERY_URL,
    resourceId: HISTORIC_SITES_RESOURCE_ID,
    crs: "EPSG:2272",
    sourceLastModified,
    retrievedAt,
  };
}

export async function findHistoricSitesForPin(
  pin: string,
  parcelGeometry?: EsriPolygon,
): Promise<HistoricSiteLookupResult> {
  const retrievedAt = new Date().toISOString();
  const vintage = await readWprdcVintage(HISTORIC_SITES_RESOURCE_ID);
  const source = siteSource(vintage, retrievedAt);

  try {
    const parcel = await resolveParcelPolygon(pin, parcelGeometry);
    if (parcel.status !== "ok") {
      return {
        status: "not_evaluated",
        message:
          "Individual historic sites: Not Evaluated / parcel geometry unavailable.",
        source,
      };
    }

    const query = await queryIntersectingFeatures({
      queryUrl: HISTORIC_SITES_QUERY_URL,
      parcel: parcel.geometry,
      outFields: "name,address,street,historic_i,lotblock,alternativ",
    });
    if (query.status === "unavailable") {
      return {
        status: "not_evaluated",
        message: "Individual historic sites: Not Evaluated",
        source,
      };
    }

    const survivingRings: number[][][] = [];
    const sites: HistoricSiteHit[] = query.features.flatMap((feature) => {
      const name =
        readText(feature.attributes?.name) ??
        readText(feature.attributes?.historic_i);
      if (!name) {
        return [];
      }
      const rings = feature.geometry?.rings ?? [];
      const overlap = overlapFromRings(parcel.geometry.rings, rings);
      const lotblock = readText(feature.attributes?.lotblock);
      const sameParcel = lotblock === pin;
      if (
        !sameParcel &&
        overlap.overlapPercent !== null &&
        overlap.overlapPercent < HISTORIC_MEANINGFUL_OVERLAP_PERCENT
      ) {
        return [];
      }
      survivingRings.push(...rings);
      return [
        {
          name,
          address:
            readText(feature.attributes?.address) ??
            readText(feature.attributes?.street),
          lotblock,
          overlapAreaSqFt: overlap.overlapAreaSqFt,
          overlapPercent: overlap.overlapPercent,
        },
      ];
    });

    const union = overlapFromRings(parcel.geometry.rings, survivingRings);
    const intersects = sites.length > 0;

    return {
      status: "ok",
      intersects,
      sites,
      overlapAreaSqFt: union.overlapAreaSqFt,
      overlapPercent: union.overlapPercent,
      message: intersects
        ? `Mapped individually designated historic site intersection: ${sites.map((site) => site.name).join("; ")}.`
        : "No mapped individually designated historic site intersection detected in the queried dataset.",
      source,
    };
  } catch {
    return {
      status: "not_evaluated",
      message: "Individual historic sites: Not Evaluated",
      source,
    };
  }
}
