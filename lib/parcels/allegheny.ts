const PARCEL_QUERY_URL =
  "https://gisdata.alleghenycounty.us/arcgis/rest/services/OPENDATA/Parcels/MapServer/0/query";
const REQUEST_TIMEOUT_MS = 15_000;
const STREET_CENTERLINE_SEARCH_FEET = 20;

export type CountyParcel = {
  pin: string;
  mapBlockLot: string | null;
  municipalityCode: number | null;
  calculatedAcreage: number | null;
};

export type ParcelPolygon =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

export type ParcelGeometryResult =
  | { status: "ok"; geometry: ParcelPolygon }
  | { status: "no_match" }
  | { status: "unavailable"; message: string };

export type ParcelLookupResult =
  | { status: "ok"; parcel: CountyParcel }
  | { status: "no_match" }
  | { status: "ambiguous"; parcels: CountyParcel[] }
  | { status: "unavailable"; message: string };

type ArcGisAttributeValue = string | number | boolean | null;

type ArcGisFeature = {
  attributes?: Record<string, ArcGisAttributeValue>;
};

type ArcGisQueryResponse = {
  features?: ArcGisFeature[];
  error?: { message?: string; code?: number };
};

function readString(value: ArcGisAttributeValue | undefined): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function readNumber(value: ArcGisAttributeValue | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const NORMAL_PARCEL_PIN = /^[A-Za-z0-9]{16}$/;

function isNormalParcelPin(pin: string): boolean {
  return NORMAL_PARCEL_PIN.test(pin);
}

function parseParcel(feature: ArcGisFeature): CountyParcel | null {
  const pin = readString(feature.attributes?.PIN);
  if (!pin) {
    return null;
  }

  return {
    pin,
    mapBlockLot: readString(feature.attributes?.MAPBLOCKLOT),
    municipalityCode: readNumber(feature.attributes?.MUNICODE),
    calculatedAcreage: readNumber(feature.attributes?.CALCACREAGE),
  };
}

function selectNormalParcels(candidates: CountyParcel[]): CountyParcel[] {
  const unique = new Map<string, CountyParcel>();
  for (const candidate of candidates) {
    if (!isNormalParcelPin(candidate.pin)) {
      continue;
    }
    unique.set(candidate.pin, candidate);
  }
  return [...unique.values()];
}

async function queryParcelsAtPoint(
  longitude: number,
  latitude: number,
  searchDistanceFeet?: number,
): Promise<ParcelLookupResult> {
  const geometry = JSON.stringify({
    x: longitude,
    y: latitude,
    spatialReference: { wkid: 4326 },
  });

  const url = new URL(PARCEL_QUERY_URL);
  url.searchParams.set("geometry", geometry);
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("outFields", "PIN,MAPBLOCKLOT,MUNICODE,CALCACREAGE");
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("f", "json");

  if (searchDistanceFeet !== undefined) {
    url.searchParams.set("distance", String(searchDistanceFeet));
    url.searchParams.set("units", "esriSRUnit_Foot");
  }

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
      return {
        status: "unavailable",
        message: `Allegheny County parcel service returned HTTP ${response.status}.`,
      };
    }

    const payload = (await response.json()) as ArcGisQueryResponse;
    if (payload.error) {
      return {
        status: "unavailable",
        message:
          payload.error.message ??
          "Allegheny County parcel service returned an error.",
      };
    }

    const parcels = selectNormalParcels(
      (payload.features ?? [])
        .map(parseParcel)
        .filter((parcel): parcel is CountyParcel => parcel !== null),
    );

    if (parcels.length === 0) {
      return { status: "no_match" };
    }

    if (parcels.length > 1) {
      return { status: "ambiguous", parcels };
    }

    return { status: "ok", parcel: parcels[0] };
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("abort"));

    return {
      status: "unavailable",
      message: aborted
        ? "Allegheny County parcel service timed out."
        : "Allegheny County parcel service could not be reached.",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function findParcelByPoint(
  longitude: number,
  latitude: number,
): Promise<ParcelLookupResult> {
  const exact = await queryParcelsAtPoint(longitude, latitude);
  if (exact.status !== "no_match") {
    return exact;
  }

  // Census interpolates to the street centerline, which usually sits in the
  // right-of-way rather than inside a parcel polygon. A 20-foot search is still
  // a point query; multiple hits are returned as ambiguous, not auto-selected.
  return queryParcelsAtPoint(
    longitude,
    latitude,
    STREET_CENTERLINE_SEARCH_FEET,
  );
}

type GeoJsonFeatureCollection = {
  features?: Array<{
    properties?: Record<string, ArcGisAttributeValue>;
    geometry?: unknown;
  }>;
};

function isParcelPolygon(value: unknown): value is ParcelPolygon {
  if (!value || typeof value !== "object") {
    return false;
  }
  const geometry = value as { type?: unknown; coordinates?: unknown };
  return (
    (geometry.type === "Polygon" || geometry.type === "MultiPolygon") &&
    Array.isArray(geometry.coordinates)
  );
}

export async function findParcelGeometryByPin(
  pin: string,
): Promise<ParcelGeometryResult> {
  if (!NORMAL_PARCEL_PIN.test(pin)) {
    return { status: "no_match" };
  }

  const url = new URL(PARCEL_QUERY_URL);
  url.searchParams.set("where", `PIN='${pin}'`);
  url.searchParams.set("outFields", "PIN");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("f", "geojson");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/geo+json, application/json" },
    });

    if (!response.ok) {
      return {
        status: "unavailable",
        message: `Allegheny County parcel geometry service returned HTTP ${response.status}.`,
      };
    }

    const payload = (await response.json()) as GeoJsonFeatureCollection;
    const candidate = (payload.features ?? []).find(
      (feature) => readString(feature.properties?.PIN) === pin,
    )?.geometry;

    if (!isParcelPolygon(candidate)) {
      return { status: "no_match" };
    }

    return { status: "ok", geometry: candidate };
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("abort"));

    return {
      status: "unavailable",
      message: aborted
        ? "Allegheny County parcel geometry service timed out."
        : "Allegheny County parcel geometry service could not be reached.",
    };
  } finally {
    clearTimeout(timer);
  }
}
