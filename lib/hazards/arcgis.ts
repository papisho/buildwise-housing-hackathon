import {
  esriPolygonAreaSqFt,
  intersectionAreaSqFt,
} from "@/lib/geometry/planar";
import {
  findParcelEsriGeometryByPin,
  type EsriPolygon,
} from "@/lib/parcels/allegheny";

export type { EsriPolygon };

export const PA_STATE_PLANE_SOUTH_FT = 2272;
export const REQUEST_TIMEOUT_MS = 15_000;
export const FEMA_REQUEST_TIMEOUT_MS = 20_000;

export type ArcGisAttributeValue = string | number | boolean | null;

export type ArcGisFeature = {
  attributes?: Record<string, ArcGisAttributeValue>;
  geometry?: { rings?: number[][][] };
};

type ArcGisQueryResponse = {
  features?: ArcGisFeature[];
  error?: { message?: string };
};

export type HazardSource = {
  name: string;
  datasetUrl: string;
  queryUrl: string;
  resourceId: string | null;
  crs: string;
  sourceLastModified: string | null;
  mapVintage?: string | null;
  retrievedAt: string;
};

export async function readWprdcVintage(
  resourceId: string,
): Promise<string | null> {
  const url = new URL("https://data.wprdc.org/api/3/action/resource_show");
  url.searchParams.set("id", resourceId);
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

export function readText(
  value: ArcGisAttributeValue | undefined,
): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

export async function loadParcelPolygon(
  pin: string,
): Promise<
  | { status: "ok"; geometry: EsriPolygon }
  | { status: "unavailable" }
> {
  const parcel = await findParcelEsriGeometryByPin(
    pin,
    PA_STATE_PLANE_SOUTH_FT,
  );
  if (parcel.status !== "ok") {
    return { status: "unavailable" };
  }
  return parcel;
}

export async function resolveParcelPolygon(
  pin: string,
  geometry?: EsriPolygon,
): Promise<
  | { status: "ok"; geometry: EsriPolygon }
  | { status: "unavailable" }
> {
  if (geometry) {
    return { status: "ok", geometry };
  }
  return loadParcelPolygon(pin);
}

export async function queryIntersectingFeatures(options: {
  queryUrl: string;
  parcel: EsriPolygon;
  outFields: string;
  timeoutMs?: number;
  extraParams?: Record<string, string>;
}): Promise<
  | { status: "ok"; features: ArcGisFeature[] }
  | { status: "unavailable"; message: string }
> {
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const body = new URLSearchParams({
    geometry: JSON.stringify(options.parcel),
    geometryType: "esriGeometryPolygon",
    inSR: String(PA_STATE_PLANE_SOUTH_FT),
    spatialRel: "esriSpatialRelIntersects",
    outFields: options.outFields,
    returnGeometry: "true",
    outSR: String(PA_STATE_PLANE_SOUTH_FT),
    f: "json",
    ...options.extraParams,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(options.queryUrl, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "BuildWise/0.1 (housing-hackathon)",
      },
      body,
    });

    if (!response.ok) {
      return {
        status: "unavailable",
        message: `Hazard service returned HTTP ${response.status}.`,
      };
    }

    const payload = (await response.json()) as ArcGisQueryResponse;
    if (payload.error) {
      return {
        status: "unavailable",
        message: payload.error.message ?? "Hazard service returned an error.",
      };
    }

    return { status: "ok", features: payload.features ?? [] };
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("abort"));
    return {
      status: "unavailable",
      message: aborted
        ? "Hazard service timed out."
        : "Hazard service could not be reached.",
    };
  } finally {
    clearTimeout(timer);
  }
}

export function overlapFromRings(
  parcelRings: number[][][],
  hazardRings: number[][][],
): { overlapAreaSqFt: number | null; overlapPercent: number | null } {
  if (hazardRings.length === 0) {
    return { overlapAreaSqFt: 0, overlapPercent: 0 };
  }

  const parcelArea = esriPolygonAreaSqFt(parcelRings);
  const overlapArea = intersectionAreaSqFt(parcelRings, hazardRings);
  const overlapPercent =
    overlapArea !== null && parcelArea > 0
      ? Math.min(100, (overlapArea / parcelArea) * 100)
      : null;

  return { overlapAreaSqFt: overlapArea, overlapPercent };
}

export function ringsFromFeatures(features: ArcGisFeature[]): number[][][] {
  return features.flatMap((feature) => feature.geometry?.rings ?? []);
}
