import type { ParcelPolygon } from "@/lib/parcels/allegheny";

const ZONING_QUERY_URL =
  "https://services1.arcgis.com/YZCmUqbcsUpOKfj7/arcgis/rest/services/PGHWebZoning/FeatureServer/0/query";
const WPRDC_RESOURCE_ID = "6127f35e-f36b-4a53-80b3-f4409609e9df";
const WPRDC_DATASET_URL = "https://data.wprdc.org/dataset/zoning";
const ZONING_CODE_URL = "https://ecode360.com/45474054";
const CITY_ZONING_MAP_URL =
  "https://pittsburghpa.maps.arcgis.com/apps/instant/sidebar/index.html?appid=4bb79ea64bf848b3a0560e3856efeccb";
const CITY_ZONING_PAGE_URL =
  "https://www.pittsburghpa.gov/Business-Development/City-Planning/Zoning";
const REQUEST_TIMEOUT_MS = 15_000;

export type ZoningDistrict = {
  code: string;
  fullType: string | null;
  legendType: string | null;
  status: string | null;
  correctionLabel: string | null;
};

export type ZoningSource = {
  name: string;
  datasetUrl: string;
  queryUrl: string;
  resourceId: string;
  zoningCodeUrl: string;
  zoningMapUrl: string;
  cityZoningPageUrl: string;
  sourceLastModified: string | null;
  retrievedAt: string;
};

export type ZoningLookupResult =
  | {
      status: "ok";
      districts: ZoningDistrict[];
      splitZoning: boolean;
      source: ZoningSource;
    }
  | {
      status: "no_district";
      message: string;
      source: ZoningSource;
    }
  | {
      status: "unavailable";
      message: string;
    };

type ArcGisAttributeValue = string | number | boolean | null;

type ArcGisFeature = {
  attributes?: Record<string, ArcGisAttributeValue>;
};

type ArcGisQueryResponse = {
  features?: ArcGisFeature[];
  error?: { message?: string };
};

function readText(value: ArcGisAttributeValue | undefined): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function ringsFromParcel(geometry: ParcelPolygon): number[][][] {
  if (geometry.type === "Polygon") {
    return geometry.coordinates;
  }
  return geometry.coordinates.flat();
}

function parseDistrict(feature: ArcGisFeature): ZoningDistrict | null {
  const code = readText(feature.attributes?.zon_new);
  if (!code) {
    return null;
  }

  return {
    code,
    fullType: readText(feature.attributes?.full_zoning_type),
    legendType: readText(feature.attributes?.legendtype),
    status: readText(feature.attributes?.status),
    correctionLabel: readText(feature.attributes?.correctionlabel),
  };
}

function uniqueDistricts(districts: ZoningDistrict[]): ZoningDistrict[] {
  const unique = new Map<string, ZoningDistrict>();
  for (const district of districts) {
    if (!unique.has(district.code)) {
      unique.set(district.code, district);
    }
  }
  return [...unique.values()];
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

async function zoningSource(): Promise<ZoningSource> {
  return {
    name: "City of Pittsburgh Zoning Districts (WPRDC / City GIS)",
    datasetUrl: WPRDC_DATASET_URL,
    queryUrl: ZONING_QUERY_URL,
    resourceId: WPRDC_RESOURCE_ID,
    zoningCodeUrl: ZONING_CODE_URL,
    zoningMapUrl: CITY_ZONING_MAP_URL,
    cityZoningPageUrl: CITY_ZONING_PAGE_URL,
    sourceLastModified: await readSourceVintage(),
    retrievedAt: new Date().toISOString(),
  };
}

export async function findZoningForParcelGeometry(
  geometry: ParcelPolygon,
): Promise<ZoningLookupResult> {
  const source = await zoningSource();
  const esriGeometry = JSON.stringify({
    rings: ringsFromParcel(geometry),
    spatialReference: { wkid: 4326 },
  });

  const body = new URLSearchParams({
    geometry: esriGeometry,
    geometryType: "esriGeometryPolygon",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields:
      "zon_new,full_zoning_type,status,correctionlabel,legendtype,last_edited_date",
    returnGeometry: "false",
    f: "json",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(ZONING_QUERY_URL, {
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
        message: `Pittsburgh zoning service returned HTTP ${response.status}.`,
      };
    }

    const payload = (await response.json()) as ArcGisQueryResponse;
    if (payload.error) {
      return {
        status: "unavailable",
        message:
          payload.error.message ?? "Pittsburgh zoning service returned an error.",
      };
    }

    const districts = uniqueDistricts(
      (payload.features ?? [])
        .map(parseDistrict)
        .filter((district): district is ZoningDistrict => district !== null),
    );

    if (districts.length === 0) {
      return {
        status: "no_district",
        message: "Zoning not evaluated / no mapped district found.",
        source,
      };
    }

    return {
      status: "ok",
      districts,
      splitZoning: districts.length > 1,
      source,
    };
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("abort"));

    return {
      status: "unavailable",
      message: aborted
        ? "Pittsburgh zoning service timed out."
        : "Pittsburgh zoning service could not be reached.",
    };
  } finally {
    clearTimeout(timer);
  }
}
