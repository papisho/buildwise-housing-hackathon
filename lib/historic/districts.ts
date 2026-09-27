import {
  overlapFromRings,
  queryIntersectingFeatures,
  readText,
  readWprdcVintage,
  resolveParcelPolygon,
  type EsriPolygon,
} from "@/lib/hazards/arcgis";
import type {
  HistoricDistrictHit,
  HistoricDistrictLookupResult,
  HistoricSource,
} from "@/lib/historic/types";

/** BuildWise geometry-noise heuristic, not an official City overlap threshold. */
export const HISTORIC_MEANINGFUL_OVERLAP_PERCENT = 1;

export const HISTORIC_DISTRICTS_QUERY_URL =
  "https://services1.arcgis.com/YZCmUqbcsUpOKfj7/arcgis/rest/services/PGHWebCHDHistoricDistricts/FeatureServer/0/query";
export const HISTORIC_DISTRICTS_DATASET_URL =
  "https://data.wprdc.org/dataset/city-designated-historic-districts";
export const HISTORIC_DISTRICTS_RESOURCE_ID =
  "a7d619d1-b074-4f5b-959e-dc2389e85425";

function districtSource(
  sourceLastModified: string | null,
  retrievedAt: string,
): HistoricSource {
  return {
    name: "City of Pittsburgh / WPRDC City Designated Historic Districts",
    datasetUrl: HISTORIC_DISTRICTS_DATASET_URL,
    queryUrl: HISTORIC_DISTRICTS_QUERY_URL,
    resourceId: HISTORIC_DISTRICTS_RESOURCE_ID,
    crs: "EPSG:2272",
    sourceLastModified,
    retrievedAt,
  };
}

export async function findHistoricDistrictsForPin(
  pin: string,
  parcelGeometry?: EsriPolygon,
  /**
   * Display-only copy of the rings that survived the geometry-noise filter.
   * Ignored slivers are never handed over, so they cannot be drawn as a hit.
   */
  collectDisplayGeometry?: (name: string, rings: number[][][]) => void,
): Promise<HistoricDistrictLookupResult> {
  const retrievedAt = new Date().toISOString();
  const vintage = await readWprdcVintage(HISTORIC_DISTRICTS_RESOURCE_ID);
  const source = districtSource(vintage, retrievedAt);

  try {
    const parcel = await resolveParcelPolygon(pin, parcelGeometry);
    if (parcel.status !== "ok") {
      return {
        status: "not_evaluated",
        message: "Historic districts: Not Evaluated / parcel geometry unavailable.",
        source,
      };
    }

    const query = await queryIntersectingFeatures({
      queryUrl: HISTORIC_DISTRICTS_QUERY_URL,
      parcel: parcel.geometry,
      outFields: "type,historic_name,guideline_link",
    });
    if (query.status === "unavailable") {
      return {
        status: "not_evaluated",
        message: "Historic districts: Not Evaluated",
        source,
      };
    }

    const survivingRings: number[][][] = [];
    const districts: HistoricDistrictHit[] = query.features.flatMap((feature) => {
      const name = readText(feature.attributes?.historic_name);
      if (!name) {
        return [];
      }
      const rings = feature.geometry?.rings ?? [];
      const overlap = overlapFromRings(parcel.geometry.rings, rings);
      if (
        overlap.overlapPercent !== null &&
        overlap.overlapPercent < HISTORIC_MEANINGFUL_OVERLAP_PERCENT
      ) {
        return [];
      }
      survivingRings.push(...rings);
      collectDisplayGeometry?.(name, rings);
      return [
        {
          name,
          districtType: readText(feature.attributes?.type),
          guidelineLink: readText(feature.attributes?.guideline_link),
          overlapAreaSqFt: overlap.overlapAreaSqFt,
          overlapPercent: overlap.overlapPercent,
        },
      ];
    });

    const union = overlapFromRings(parcel.geometry.rings, survivingRings);
    const intersects = districts.length > 0;

    return {
      status: "ok",
      intersects,
      districts,
      overlapAreaSqFt: union.overlapAreaSqFt,
      overlapPercent: union.overlapPercent,
      message: intersects
        ? `Mapped City historic district intersection: ${districts.map((district) => district.name).join("; ")}.`
        : "No mapped City historic district intersection detected in the queried dataset.",
      source,
    };
  } catch {
    return {
      status: "not_evaluated",
      message: "Historic districts: Not Evaluated",
      source,
    };
  }
}
