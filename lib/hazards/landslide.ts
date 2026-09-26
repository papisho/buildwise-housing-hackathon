import {
  resolveParcelPolygon,
  overlapFromRings,
  queryIntersectingFeatures,
  readWprdcVintage,
  ringsFromFeatures,
  type EsriPolygon,
  type HazardSource,
} from "@/lib/hazards/arcgis";

const QUERY_URL =
  "https://services1.arcgis.com/YZCmUqbcsUpOKfj7/arcgis/rest/services/PGHWebLandslideProne/FeatureServer/0/query";
const WPRDC_RESOURCE_ID = "b5b45ac6-f8ef-4805-b4e4-fc7c63fb4075";
const WPRDC_DATASET_URL =
  "https://data.wprdc.org/dataset/landslide-prone-areas";

export type LandslideLookupResult =
  | {
      status: "ok";
      intersects: boolean;
      overlapAreaSqFt: number | null;
      overlapPercent: number | null;
      message: string;
      source: HazardSource;
    }
  | {
      status: "not_evaluated";
      message: string;
    };

function landslideMessage(intersects: boolean): string {
  return intersects
    ? "Mapped landslide-prone area intersects this parcel. Site-specific geotechnical review may be warranted."
    : "No mapped landslide-prone-area intersection detected in the source used.";
}

async function landslideSource(): Promise<HazardSource> {
  return {
    name: "City of Pittsburgh Landslide-Prone Areas (WPRDC / City GIS)",
    datasetUrl: WPRDC_DATASET_URL,
    queryUrl: QUERY_URL,
    resourceId: WPRDC_RESOURCE_ID,
    crs: "EPSG:2272 (NAD83 Pennsylvania State Plane South, US survey feet)",
    sourceLastModified: await readWprdcVintage(WPRDC_RESOURCE_ID),
    retrievedAt: new Date().toISOString(),
  };
}

export async function findLandslideForPin(
  pin: string,
  parcelGeometry?: EsriPolygon,
): Promise<LandslideLookupResult> {
  try {
    const parcel = await resolveParcelPolygon(pin, parcelGeometry);
    if (parcel.status === "unavailable") {
      return { status: "not_evaluated", message: "Landslide: Not Evaluated" };
    }

    const query = await queryIntersectingFeatures({
      queryUrl: QUERY_URL,
      parcel: parcel.geometry,
      outFields: "objectid,landslideprone,code",
    });
    if (query.status === "unavailable") {
      return { status: "not_evaluated", message: "Landslide: Not Evaluated" };
    }

    const rings = ringsFromFeatures(query.features);
    const intersects = rings.length > 0;
    const overlap = overlapFromRings(parcel.geometry.rings, rings);

    return {
      status: "ok",
      intersects,
      overlapAreaSqFt: overlap.overlapAreaSqFt,
      overlapPercent: overlap.overlapPercent,
      message: landslideMessage(intersects),
      source: await landslideSource(),
    };
  } catch {
    return { status: "not_evaluated", message: "Landslide: Not Evaluated" };
  }
}
