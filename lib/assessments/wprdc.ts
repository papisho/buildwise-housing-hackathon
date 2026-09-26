const DATASTORE_SQL_URL =
  "https://data.wprdc.org/api/3/action/datastore_search_sql";
const ASSESSMENT_RESOURCE_ID = "65855e14-549e-4992-b5be-d629afc676fa";
const REQUEST_TIMEOUT_MS = 15_000;
const SAFE_PARID = /^[A-Za-z0-9]+$/;

const ASSESSMENT_FIELDS = [
  "PARID",
  "PROPERTYHOUSENUM",
  "PROPERTYFRACTION",
  "PROPERTYADDRESS",
  "PROPERTYCITY",
  "PROPERTYSTATE",
  "PROPERTYZIP",
  "MUNICODE",
  "MUNIDESC",
  "CLASS",
  "CLASSDESC",
  "USECODE",
  "USEDESC",
  "LOTAREA",
  "COUNTYBUILDING",
  "COUNTYLAND",
  "COUNTYTOTAL",
  "YEARBLT",
  "STORIES",
  "FINISHEDLIVINGAREA",
  "TAXYEAR",
  "ASOFDATE",
] as const;

export type ParcelFacts = {
  parid: string;
  propertyAddress: string | null;
  houseNumber: string | null;
  streetName: string | null;
  houseNumberFraction: string | null;
  municipality: string | null;
  municipalityCode: string | null;
  classCode: string | null;
  classDescription: string | null;
  useCode: string | null;
  useDescription: string | null;
  lotArea: number | null;
  countyAssessedLandValue: number | null;
  countyAssessedBuildingValue: number | null;
  countyAssessedTotal: number | null;
  yearBuilt: number | null;
  stories: number | null;
  finishedLivingArea: number | null;
  taxYear: number | null;
  asOfDate: string | null;
};

export type AssessmentLookupResult =
  | { status: "ok"; facts: ParcelFacts }
  | { status: "no_record"; message: string }
  | { status: "malformed"; message: string }
  | { status: "unavailable"; message: string };

type CkanSqlResponse = {
  success?: boolean;
  error?: { message?: string; query?: string[] };
  result?: {
    records?: Record<string, unknown>[];
  };
};

function readText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function readPositiveNumber(value: unknown): number | null {
  const parsed = readNumber(value);
  if (parsed === null || parsed <= 0) {
    return null;
  }
  return parsed;
}

function buildPropertyAddress(record: Record<string, unknown>): string | null {
  const house = readText(record.PROPERTYHOUSENUM);
  const fraction = readText(record.PROPERTYFRACTION);
  const street = readText(record.PROPERTYADDRESS);
  const city = readText(record.PROPERTYCITY);
  const state = readText(record.PROPERTYSTATE);
  const zip = readText(record.PROPERTYZIP);

  const streetLine = [house, fraction, street].filter(Boolean).join(" ");
  const cityLine = [city, state].filter(Boolean).join(", ");
  const withZip = zip ? `${cityLine} ${zip}`.trim() : cityLine;
  const full = [streetLine, withZip].filter(Boolean).join(", ");
  return full.length > 0 ? full : null;
}

function pickRecord(record: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const field of ASSESSMENT_FIELDS) {
    if (field in record) {
      picked[field] = record[field];
    }
  }
  return picked;
}

function normalizeFacts(record: Record<string, unknown>): ParcelFacts | null {
  const picked = pickRecord(record);
  const parid = readText(picked.PARID);
  if (!parid) {
    return null;
  }

  return {
    parid,
    propertyAddress: buildPropertyAddress(picked),
    houseNumber: readText(picked.PROPERTYHOUSENUM),
    streetName: readText(picked.PROPERTYADDRESS),
    houseNumberFraction: readText(picked.PROPERTYFRACTION),
    municipality: readText(picked.MUNIDESC),
    municipalityCode: readText(picked.MUNICODE) ?? (readNumber(picked.MUNICODE) !== null
      ? String(readNumber(picked.MUNICODE))
      : null),
    classCode: readText(picked.CLASS),
    classDescription: readText(picked.CLASSDESC),
    useCode: readText(picked.USECODE),
    useDescription: readText(picked.USEDESC),
    lotArea: readNumber(picked.LOTAREA),
    countyAssessedLandValue: readNumber(picked.COUNTYLAND),
    countyAssessedBuildingValue: readNumber(picked.COUNTYBUILDING),
    countyAssessedTotal: readNumber(picked.COUNTYTOTAL),
    yearBuilt: readPositiveNumber(picked.YEARBLT),
    stories: readPositiveNumber(picked.STORIES),
    finishedLivingArea: readPositiveNumber(picked.FINISHEDLIVINGAREA),
    taxYear: readPositiveNumber(picked.TAXYEAR),
    asOfDate: readText(picked.ASOFDATE),
  };
}

function buildSql(parid: string): string {
  return `SELECT * FROM "${ASSESSMENT_RESOURCE_ID}" WHERE "PARID" = '${parid}' LIMIT 2`;
}

export async function findAssessmentByParid(
  parid: string,
): Promise<AssessmentLookupResult> {
  if (!SAFE_PARID.test(parid)) {
    return {
      status: "malformed",
      message: "The parcel ID is not a valid PARID for assessment lookup.",
    };
  }

  const url = new URL(DATASTORE_SQL_URL);
  url.searchParams.set("sql", buildSql(parid));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok) {
      return {
        status: "unavailable",
        message: `WPRDC assessment service returned HTTP ${response.status}.`,
      };
    }
    if (!contentType.includes("application/json")) {
      return {
        status: "malformed",
        message: "WPRDC assessment service returned a non-JSON response.",
      };
    }

    const payload = (await response.json()) as CkanSqlResponse;
    if (!payload.success) {
      return {
        status: "unavailable",
        message:
          payload.error?.message ??
          payload.error?.query?.[0] ??
          "WPRDC assessment query failed.",
      };
    }

    const records = payload.result?.records;
    if (!Array.isArray(records)) {
      return {
        status: "malformed",
        message: "WPRDC assessment response was missing a records array.",
      };
    }

    if (records.length === 0) {
      return {
        status: "no_record",
        message: `No Allegheny County assessment record was found for PARID ${parid}.`,
      };
    }

    if (records.length > 1) {
      return {
        status: "malformed",
        message:
          "WPRDC returned more than one assessment record for this PARID. Facts were not applied.",
      };
    }

    const facts = normalizeFacts(records[0]);
    if (!facts) {
      return {
        status: "malformed",
        message: "The assessment record was missing PARID and could not be used.",
      };
    }

    if (facts.parid !== parid) {
      return {
        status: "malformed",
        message: "The assessment PARID did not match the requested parcel PIN.",
      };
    }

    return { status: "ok", facts };
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("abort"));

    return {
      status: "unavailable",
      message: aborted
        ? "WPRDC assessment service timed out."
        : "WPRDC assessment service could not be reached.",
    };
  } finally {
    clearTimeout(timer);
  }
}
