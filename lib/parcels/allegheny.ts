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

    const parcels = (payload.features ?? [])
      .map(parseParcel)
      .filter((parcel): parcel is CountyParcel => parcel !== null);

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
