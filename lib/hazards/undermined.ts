import {
  resolveParcelPolygon,
  overlapFromRings,
  queryIntersectingFeatures,
  readText,
  readWprdcVintage,
  ringsFromFeatures,
  type EsriPolygon,
  type HazardSource,
} from "@/lib/hazards/arcgis";

const QUERY_URL =
  "https://services1.arcgis.com/YZCmUqbcsUpOKfj7/arcgis/rest/services/PGHWebUndermined/FeatureServer/0/query";
const WPRDC_RESOURCE_ID = "e1d96015-818f-46fb-88dd-85c20eacb96c";
const WPRDC_DATASET_URL = "https://data.wprdc.org/dataset/undermined-areas";

export type UnderminedLookupResult =
  | {
      status: "ok";
      intersects: boolean;
      overlapAreaSqFt: number | null;
      overlapPercent: number | null;
      classifications: string[];
      message: string;
      source: HazardSource;
    }
  | {
      status: "not_evaluated";
      message: string;
    };

function underminedMessage(intersects: boolean): string {
  return intersects
    ? "Mapped undermined/mine condition detected. Site-specific professional/geotechnical verification may be warranted."
    : "No mapped undermined/mine-area intersection detected in the source used.";
}

function classificationsFromFeatures(
  features: { attributes?: Record<string, string | number | boolean | null> }[],
): string[] {
  const values = new Set<string>();
  for (const feature of features) {
    const classification =
      readText(feature.attributes?.und_aa_field) ??
      readText(feature.attributes?.undermined);
    if (classification) {
      values.add(classification);
    }
  }
  return [...values].sort();
}

async function underminedSource(): Promise<HazardSource> {
  return {
    name: "City of Pittsburgh Undermined Areas (WPRDC / City GIS)",
    datasetUrl: WPRDC_DATASET_URL,
    queryUrl: QUERY_URL,
    resourceId: WPRDC_RESOURCE_ID,
    crs: "EPSG:2272 (NAD83 Pennsylvania State Plane South, US survey feet)",
    sourceLastModified: await readWprdcVintage(WPRDC_RESOURCE_ID),
    retrievedAt: new Date().toISOString(),
  };
}

export async function findUnderminedForPin(
  pin: string,
  parcelGeometry?: EsriPolygon,
  /** Display-only copy of the intersecting rings; never used for scoring. */
  collectDisplayGeometry?: (rings: number[][][]) => void,
): Promise<UnderminedLookupResult> {
  try {
    const parcel = await resolveParcelPolygon(pin, parcelGeometry);
    if (parcel.status === "unavailable") {
      return {
        status: "not_evaluated",
        message: "Mine / undermined: Not Evaluated",
      };
    }

    const query = await queryIntersectingFeatures({
      queryUrl: QUERY_URL,
      parcel: parcel.geometry,
      outFields: "objectid,undermined,und_aa_field",
    });
    if (query.status === "unavailable") {
      return {
        status: "not_evaluated",
        message: "Mine / undermined: Not Evaluated",
      };
    }

    const rings = ringsFromFeatures(query.features);
    collectDisplayGeometry?.(rings);
    const intersects = rings.length > 0;
    const overlap = overlapFromRings(parcel.geometry.rings, rings);

    return {
      status: "ok",
      intersects,
      overlapAreaSqFt: overlap.overlapAreaSqFt,
      overlapPercent: overlap.overlapPercent,
      classifications: classificationsFromFeatures(query.features),
      message: underminedMessage(intersects),
      source: await underminedSource(),
    };
  } catch {
    return {
      status: "not_evaluated",
      message: "Mine / undermined: Not Evaluated",
    };
  }
}
