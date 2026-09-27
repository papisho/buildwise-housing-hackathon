import { findAssessmentByParid } from "@/lib/assessments/wprdc";
import {
  esriRingsCentroid,
  planarDistanceFeet,
} from "@/lib/geometry/planar";
import type { EsriPolygon } from "@/lib/parcels/allegheny";
import {
  readResourceLastModified,
  readText,
  SAFE_PARID,
} from "@/lib/regulatory/ckan";
import {
  VALIDATED_SALE_CODE,
  VALIDATED_SALE_DESCRIPTION,
  isCountyCodedValidSale,
} from "@/lib/financial/validation";
import type {
  FinancialSource,
  NearbySaleCandidate,
  NearbySalesLookupResult,
} from "@/lib/financial/types";

const SALES_RESOURCE_ID = "5bbe6c55-bce6-4edb-9d04-68edeb6bf7b1";
const SALES_DATASET_URL =
  "https://data.wprdc.org/dataset/real-estate-sales";
const SALES_QUERY_URL =
  "https://data.wprdc.org/api/3/action/datastore_search_sql";
const PARCEL_QUERY_URL =
  "https://gisdata.alleghenycounty.us/arcgis/rest/services/OPENDATA/Parcels/MapServer/0/query";

export const SALES_NEAR_RADIUS_FEET = 1320;
export const SALES_EXTENDED_RADIUS_FEET = 2640;
export const SALES_LOOKBACK_YEARS = 5;
export const SALES_UI_LIMIT = 5;
const NEIGHBOR_PIN_CAP = 80;
const REQUEST_TIMEOUT_MS = 15_000;

export function meaningfulLotAreaSqFt(value: number | null): number | null {
  if (value === null || value <= 0) {
    return null;
  }
  return value;
}

type NeighborParcel = {
  pin: string;
  centroid: { x: number; y: number };
  distanceFeet: number;
};

function salesSource(
  retrievedAt: string,
  lastModified: string | null,
): FinancialSource {
  return {
    name: "Allegheny County / WPRDC Property Sale Transactions",
    datasetUrl: SALES_DATASET_URL,
    queryUrl: SALES_QUERY_URL,
    resourceId: SALES_RESOURCE_ID,
    sourceLastModified: lastModified,
    retrievedAt,
  };
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function lookbackDateIso(retrievedAt: string): string {
  const retrieved = new Date(retrievedAt);
  retrieved.setUTCFullYear(retrieved.getUTCFullYear() - SALES_LOOKBACK_YEARS);
  return retrieved.toISOString().slice(0, 10);
}

async function queryNeighborParcels(
  geometry: EsriPolygon,
  origin: { x: number; y: number },
  distanceFeet: number,
): Promise<NeighborParcel[] | null> {
  const url = new URL(PARCEL_QUERY_URL);
  url.searchParams.set("geometry", JSON.stringify(geometry));
  url.searchParams.set("geometryType", "esriGeometryPolygon");
  url.searchParams.set("inSR", "2272");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("distance", String(distanceFeet));
  url.searchParams.set("units", "esriSRUnit_Foot");
  url.searchParams.set("outFields", "PIN");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "2272");
  url.searchParams.set("resultRecordCount", String(NEIGHBOR_PIN_CAP));
  url.searchParams.set("f", "json");

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
      features?: Array<{
        attributes?: { PIN?: unknown };
        geometry?: { rings?: number[][][] };
      }>;
      error?: { message?: string };
    };
    if (payload.error) {
      return null;
    }
    const neighbors: NeighborParcel[] = [];
    for (const feature of payload.features ?? []) {
      const pin = readText(feature.attributes?.PIN);
      if (!pin || !SAFE_PARID.test(pin)) {
        continue;
      }
      const rings = feature.geometry?.rings;
      if (!rings || rings.length === 0) {
        continue;
      }
      const centroid = esriRingsCentroid(rings);
      if (!centroid) {
        continue;
      }
      neighbors.push({
        pin,
        centroid,
        distanceFeet: planarDistanceFeet(origin, centroid),
      });
    }
    return neighbors;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function searchSalesForPin(
  pin: string,
): Promise<Record<string, unknown>[] | null> {
  const url = new URL("https://data.wprdc.org/api/3/action/datastore_search");
  url.searchParams.set("resource_id", SALES_RESOURCE_ID);
  url.searchParams.set("filters", JSON.stringify({ PARID: pin }));
  url.searchParams.set("limit", "50");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as {
      success?: boolean;
      result?: { records?: Record<string, unknown>[] };
    };
    if (!payload.success || !Array.isArray(payload.result?.records)) {
      return [];
    }
    return payload.result.records;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function queryValidatedSales(
  pins: string[],
  sinceIso: string,
): Promise<Record<string, unknown>[] | null> {
  if (pins.length === 0) {
    return [];
  }
  const since = Date.parse(`${sinceIso}T00:00:00.000Z`);
  const records: Record<string, unknown>[] = [];
  const chunkSize = 8;
  let anySuccess = false;
  for (let i = 0; i < pins.length; i += chunkSize) {
    const chunk = pins.slice(i, i + chunkSize);
    const parts = await Promise.all(chunk.map((pin) => searchSalesForPin(pin)));
    for (const part of parts) {
      if (part === null) {
        continue;
      }
      anySuccess = true;
      for (const row of part) {
        const saleDate = readText(row.SALEDATE);
        if (!saleDate) {
          continue;
        }
        const saleTime = Date.parse(saleDate);
        if (!Number.isFinite(saleTime) || saleTime < since) {
          continue;
        }
        records.push(row);
      }
    }
  }
  return anySuccess ? records : null;
}

export async function findNearbyValidatedSales(input: {
  pin: string;
  geometry: EsriPolygon | undefined;
}): Promise<NearbySalesLookupResult> {
  const retrievedAt = new Date().toISOString();
  const lastModified = await readResourceLastModified(SALES_RESOURCE_ID);
  const source = salesSource(retrievedAt, lastModified);

  if (!input.geometry) {
    return {
      status: "not_evaluated",
      message:
        "Nearby sales: Not Evaluated / parcel geometry unavailable.",
      source,
    };
  }

  const origin = esriRingsCentroid(input.geometry.rings);
  if (!origin) {
    return {
      status: "not_evaluated",
      message: "Nearby sales: Not Evaluated / parcel centroid unavailable.",
      source,
    };
  }

  const near = await queryNeighborParcels(
    input.geometry,
    origin,
    SALES_NEAR_RADIUS_FEET,
  );
  if (near === null) {
    return {
      status: "not_evaluated",
      message: "Nearby sales: Not Evaluated / parcel proximity query failed.",
      source,
    };
  }

  let neighbors = near.filter((parcel) => parcel.pin !== input.pin);
  let searchRadiusFeet = SALES_NEAR_RADIUS_FEET;
  const sinceIso = lookbackDateIso(retrievedAt);

  let salesRows = await queryValidatedSales(
    neighbors.map((parcel) => parcel.pin),
    sinceIso,
  );
  if (salesRows === null) {
    return {
      status: "not_evaluated",
      message: "Nearby sales: Not Evaluated / WPRDC sales query failed.",
      source,
    };
  }

  const uniqueValidatedPins = new Set(
    salesRows
      .map((row) => readText(row.PARID))
      .filter((pin): pin is string => Boolean(pin)),
  );
  if (uniqueValidatedPins.size < 3) {
    const extended = await queryNeighborParcels(
      input.geometry,
      origin,
      SALES_EXTENDED_RADIUS_FEET,
    );
    if (extended === null) {
      return {
        status: "not_evaluated",
        message:
          "Nearby sales: Not Evaluated / expanded parcel proximity query failed.",
        source,
      };
    }
    neighbors = extended.filter((parcel) => parcel.pin !== input.pin);
    searchRadiusFeet = SALES_EXTENDED_RADIUS_FEET;
    salesRows = await queryValidatedSales(
      neighbors.map((parcel) => parcel.pin),
      sinceIso,
    );
    if (salesRows === null) {
      return {
        status: "not_evaluated",
        message: "Nearby sales: Not Evaluated / WPRDC sales query failed.",
        source,
      };
    }
  }

  const distanceByPin = new Map(
    neighbors.map((parcel) => [parcel.pin, parcel.distanceFeet]),
  );

  const candidates: NearbySaleCandidate[] = [];
  for (const row of salesRows) {
    const parid = readText(row.PARID);
    const saleCode = readText(row.SALECODE);
    const saleDescription = readText(row.SALEDESC);
    const price = readNumber(row.PRICE);
    if (
      !parid ||
      parid === input.pin ||
      !isCountyCodedValidSale({ saleCode, saleDescription }) ||
      price === null ||
      price <= 0
    ) {
      continue;
    }
    const distanceFeet = distanceByPin.get(parid);
    if (distanceFeet === undefined) {
      continue;
    }
    candidates.push({
      parid,
      address: readText(row.FULL_ADDRESS),
      saleDate: readText(row.SALEDATE),
      price,
      saleCode: saleCode ?? VALIDATED_SALE_CODE,
      saleDescription: saleDescription ?? VALIDATED_SALE_DESCRIPTION,
      instrumentDescription: readText(row.INSTRTYPDESC),
      distanceFeet,
      useDescription: null,
      classDescription: null,
      lotAreaSqFt: null,
      yearBuilt: null,
      provenance: "PUBLIC_DATA",
    });
  }

  candidates.sort((a, b) => {
    const dateA = a.saleDate ?? "";
    const dateB = b.saleDate ?? "";
    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }
    return a.distanceFeet - b.distanceFeet;
  });

  const selected = candidates.slice(0, SALES_UI_LIMIT);
  const enriched = await Promise.all(
    selected.map(async (sale) => {
      const assessment = await findAssessmentByParid(sale.parid);
      if (assessment.status !== "ok") {
        return sale;
      }
      return {
        ...sale,
        useDescription: assessment.facts.useDescription,
        classDescription: assessment.facts.classDescription,
        lotAreaSqFt: meaningfulLotAreaSqFt(assessment.facts.lotArea),
        yearBuilt: assessment.facts.yearBuilt,
      };
    }),
  );

  return {
    status: "ok",
    records: enriched,
    searchRadiusFeet,
    neighborParcelCount: neighbors.length,
    validatedFilter: `SALECODE ${VALIDATED_SALE_CODE} / SALEDESC ${VALIDATED_SALE_DESCRIPTION}`,
    source,
  };
}
