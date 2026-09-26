import {
  esriPolygonAreaSqFt,
  intersectionAreaSqFt,
} from "@/lib/geometry/planar";
import {
  findParcelEsriGeometryByPin,
  type EsriPolygon,
} from "@/lib/parcels/allegheny";

const SLOPE_QUERY_URL =
  "https://services1.arcgis.com/YZCmUqbcsUpOKfj7/arcgis/rest/services/PGHWebSlope25/FeatureServer/0/query";
const WPRDC_RESOURCE_ID = "5ce91a56-0799-46ea-9585-13fa8db5979e";
const WPRDC_DATASET_URL = "https://data.wprdc.org/dataset/25-or-greater-slope";
const PA_STATE_PLANE_SOUTH_FT = 2272;
const REQUEST_TIMEOUT_MS = 15_000;

export type SteepSlopeSource = {
  name: string;
  datasetUrl: string;
  queryUrl: string;
  resourceId: string;
  crs: string;
  sourceLastModified: string | null;
  retrievedAt: string;
};

export type SteepSlopeLookupResult =
  | {
      status: "ok";
      intersects: boolean;
      overlapAreaSqFt: number | null;
      overlapPercent: number | null;
      message: string;
      source: SteepSlopeSource;
    }
  | {
      status: "not_evaluated";
      message: string;
    };

type ArcGisAttributeValue = string | number | boolean | null;

type ArcGisFeature = {
  attributes?: Record<string, ArcGisAttributeValue>;
  geometry?: { rings?: number[][][] };
};

type ArcGisQueryResponse = {
  features?: ArcGisFeature[];
  error?: { message?: string };
};

function steepSlopeMessage(intersects: boolean): string {
  return intersects
    ? "Mapped ≥25% slope intersects this parcel. Site-specific review may be warranted."
    : "No mapped ≥25% slope intersection detected in the source used.";
}

async function readSourceVintage(): Promise<string | null> {
  const url = new URL("https://data.wprdc.org/api/3/action/resource_show");
  url.searchParams.set("id", WPRDC_RESOURCE_ID);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as {
      success?: boolean;
      result?: { last_modified?: string };
    };
    return payload.success ? (payload.result?.last_modified ?? null) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function slopeSource(): Promise<SteepSlopeSource> {
  return {
    name: "City of Pittsburgh 25% or Greater Slope (WPRDC / City GIS)",
    datasetUrl: WPRDC_DATASET_URL,
    queryUrl: SLOPE_QUERY_URL,
    resourceId: WPRDC_RESOURCE_ID,
    crs: "EPSG:2272 (NAD83 Pennsylvania State Plane South, US survey feet)",
    sourceLastModified: await readSourceVintage(),
    retrievedAt: new Date().toISOString(),
  };
}

async function querySlopePolygons(
  parcel: EsriPolygon,
): Promise<
  | { status: "ok"; rings: number[][][] }
  | { status: "unavailable"; message: string }
> {
  const body = new URLSearchParams({
    geometry: JSON.stringify(parcel),
    geometryType: "esriGeometryPolygon",
    inSR: String(PA_STATE_PLANE_SOUTH_FT),
    spatialRel: "esriSpatialRelIntersects",
    outFields: "objectid,slope25",
    returnGeometry: "true",
    outSR: String(PA_STATE_PLANE_SOUTH_FT),
    f: "json",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(SLOPE_QUERY_URL, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      return {
        status: "unavailable",
        message: `Steep-slope service returned HTTP ${response.status}.`,
      };
    }

    const payload = (await response.json()) as ArcGisQueryResponse;
    if (payload.error) {
      return {
        status: "unavailable",
        message:
          payload.error.message ?? "Steep-slope service returned an error.",
      };
    }

    const rings = (payload.features ?? []).flatMap(
      (feature) => feature.geometry?.rings ?? [],
    );
    return { status: "ok", rings };
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("abort"));
    return {
      status: "unavailable",
      message: aborted
        ? "Steep-slope service timed out."
        : "Steep-slope service could not be reached.",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function findSteepSlopeForPin(
  pin: string,
  parcelGeometry?: EsriPolygon,
): Promise<SteepSlopeLookupResult> {
  try {
    const parcel = parcelGeometry
      ? { status: "ok" as const, geometry: parcelGeometry }
      : await findParcelEsriGeometryByPin(pin, PA_STATE_PLANE_SOUTH_FT);
    if (parcel.status === "unavailable") {
      return { status: "not_evaluated", message: "Steep slope: Not Evaluated" };
    }
    if (parcel.status === "no_match") {
      return { status: "not_evaluated", message: "Steep slope: Not Evaluated" };
    }

    const slope = await querySlopePolygons(parcel.geometry);
    if (slope.status === "unavailable") {
      return { status: "not_evaluated", message: "Steep slope: Not Evaluated" };
    }

    const source = await slopeSource();
    const intersects = slope.rings.length > 0;
    if (!intersects) {
      return {
        status: "ok",
        intersects: false,
        overlapAreaSqFt: 0,
        overlapPercent: 0,
        message: steepSlopeMessage(false),
        source,
      };
    }

    const parcelArea = esriPolygonAreaSqFt(parcel.geometry.rings);
    const overlapArea = intersectionAreaSqFt(parcel.geometry.rings, slope.rings);
    const overlapPercent =
      overlapArea !== null && parcelArea > 0
        ? Math.min(100, (overlapArea / parcelArea) * 100)
        : null;

    return {
      status: "ok",
      intersects: true,
      overlapAreaSqFt: overlapArea,
      overlapPercent,
      message: steepSlopeMessage(true),
      source,
    };
  } catch {
    return { status: "not_evaluated", message: "Steep slope: Not Evaluated" };
  }
}
