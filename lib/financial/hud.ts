import { readHudUserApiToken } from "@/lib/financial/env";
import type {
  FinancialSource,
  HudBedroomRents,
  HudRentLookupResult,
} from "@/lib/financial/types";

const HUD_DATASET_URL = "https://www.huduser.gov/portal/datasets/fmr.html";
const HUD_API_BASE = "https://www.huduser.gov/hudapi/public/fmr";
export const HUD_PITTSBURGH_ENTITY_ID = "METRO38300M38300";
export const HUD_REQUESTED_YEAR = "2026";
const REQUEST_TIMEOUT_MS = 15_000;

type HudBasicRow = {
  zip_code?: unknown;
  Efficiency?: unknown;
  "One-Bedroom"?: unknown;
  "Two-Bedroom"?: unknown;
  "Three-Bedroom"?: unknown;
  "Four-Bedroom"?: unknown;
  year?: unknown;
};

type HudApiPayload = {
  data?: {
    area_name?: unknown;
    metro_name?: unknown;
    counties_msa?: unknown;
    smallarea_status?: unknown;
    year?: unknown;
    basicdata?: HudBasicRow | HudBasicRow[];
  };
};

export type HudGeographySelection =
  | {
      ok: true;
      geographyType: "ZIP_SAFMR" | "MSA_FMR";
      zip: string | null;
      row: HudBasicRow;
    }
  | { ok: false; reason: string };

function hudSource(retrievedAt: string, year: string | null): FinancialSource {
  const url = new URL(`${HUD_API_BASE}/data/${HUD_PITTSBURGH_ENTITY_ID}`);
  if (year) {
    url.searchParams.set("year", year);
  }
  return {
    name: "HUD Fair Market Rents / Small Area FMRs",
    datasetUrl: HUD_DATASET_URL,
    queryUrl: url.toString(),
    resourceId: HUD_PITTSBURGH_ENTITY_ID,
    sourceLastModified: null,
    retrievedAt,
  };
}

function readMoney(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function rentsFromRow(row: HudBasicRow): HudBedroomRents {
  return {
    efficiency: readMoney(row.Efficiency),
    oneBedroom: readMoney(row["One-Bedroom"]),
    twoBedroom: readMoney(row["Two-Bedroom"]),
    threeBedroom: readMoney(row["Three-Bedroom"]),
    fourBedroom: readMoney(row["Four-Bedroom"]),
  };
}

function asRows(basicdata: HudApiPayload["data"]): HudBasicRow[] {
  if (!basicdata?.basicdata) {
    return [];
  }
  return Array.isArray(basicdata.basicdata)
    ? basicdata.basicdata
    : [basicdata.basicdata];
}

function zipKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isMsaLevelRow(row: HudBasicRow): boolean {
  return zipKey(row.zip_code) === "msa level";
}

export function selectHudGeography(input: {
  zip: string;
  smallareaStatus: unknown;
  rows: HudBasicRow[];
}): HudGeographySelection {
  if (input.rows.length === 0) {
    return { ok: false, reason: "HUD API had no FMR rows." };
  }

  const usesSafmr =
    String(input.smallareaStatus ?? "") === "1" ||
    input.rows.some((row) => zipKey(row.zip_code).length === 5);

  if (usesSafmr) {
    const zipRow = input.rows.find(
      (row) => String(row.zip_code ?? "").padStart(5, "0") === input.zip,
    );
    if (zipRow) {
      return {
        ok: true,
        geographyType: "ZIP_SAFMR",
        zip: input.zip,
        row: zipRow,
      };
    }
    const msaRow = input.rows.find(isMsaLevelRow);
    if (msaRow) {
      return {
        ok: true,
        geographyType: "MSA_FMR",
        zip: null,
        row: msaRow,
      };
    }
    return {
      ok: false,
      reason:
        "subject ZIP was not in the SAFMR table and no MSA-level row was returned.",
    };
  }

  if (input.rows.length === 1 && !input.rows[0].zip_code) {
    return {
      ok: true,
      geographyType: "MSA_FMR",
      zip: null,
      row: input.rows[0],
    };
  }

  return {
    ok: false,
    reason: "HUD geography could not be mapped for this parcel ZIP.",
  };
}

function failureMessage(kind: "auth" | "request" | "empty" | "geography" | "config" | "zip" | "network", detail?: string): string {
  switch (kind) {
    case "config":
      return "HUD rent benchmark: Not Evaluated / HUD API token is not configured.";
    case "zip":
      return "HUD rent benchmark: Not Evaluated / parcel ZIP was not available from assessment facts.";
    case "auth":
      return "HUD rent benchmark: Not Evaluated / HUD API authentication failed.";
    case "request":
      return "HUD rent benchmark: Not Evaluated / HUD API request failed.";
    case "empty":
      return "HUD rent benchmark: Not Evaluated / HUD API returned no data.";
    case "geography":
      return `HUD rent benchmark: Not Evaluated / ${detail ?? "geography could not be mapped."}`;
    case "network":
      return "HUD rent benchmark: Not Evaluated / HUD API could not be reached.";
  }
}

async function fetchHudPayload(input: {
  token: string;
  year: string | null;
}): Promise<{ httpStatus: number; payload: HudApiPayload | null }> {
  const url = new URL(`${HUD_API_BASE}/data/${HUD_PITTSBURGH_ENTITY_ID}`);
  if (input.year) {
    url.searchParams.set("year", input.year);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${input.token}`,
      },
    });
    if (!response.ok) {
      return { httpStatus: response.status, payload: null };
    }
    return {
      httpStatus: response.status,
      payload: (await response.json()) as HudApiPayload,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupHudRentBenchmark(input: {
  zip: string | null;
  accessToken?: string | null;
}): Promise<HudRentLookupResult> {
  const retrievedAt = new Date().toISOString();
  const source = hudSource(retrievedAt, HUD_REQUESTED_YEAR);
  const token = input.accessToken ?? readHudUserApiToken();
  if (!token) {
    return {
      status: "not_evaluated",
      message: failureMessage("config"),
      source,
    };
  }
  if (!input.zip) {
    return {
      status: "not_evaluated",
      message: failureMessage("zip"),
      source,
    };
  }

  try {
    let result = await fetchHudPayload({ token, year: HUD_REQUESTED_YEAR });
    let usedYear: string | null = HUD_REQUESTED_YEAR;
    if (result.httpStatus === 400) {
      result = await fetchHudPayload({ token, year: null });
      usedYear = null;
    }

    if (result.httpStatus === 401 || result.httpStatus === 403) {
      return {
        status: "not_evaluated",
        message: failureMessage("auth"),
        source: hudSource(retrievedAt, usedYear),
      };
    }
    if (result.httpStatus !== 200 || !result.payload) {
      return {
        status: "not_evaluated",
        message: failureMessage("request"),
        source: hudSource(retrievedAt, usedYear),
      };
    }

    const data = result.payload.data;
    if (!data) {
      return {
        status: "not_evaluated",
        message: failureMessage("empty"),
        source: hudSource(retrievedAt, usedYear),
      };
    }

    const selected = selectHudGeography({
      zip: input.zip,
      smallareaStatus: data.smallarea_status,
      rows: asRows(data),
    });
    if (!selected.ok) {
      return {
        status: "not_evaluated",
        message: failureMessage("geography", selected.reason),
        source: hudSource(retrievedAt, usedYear),
      };
    }

    const year =
      typeof data.year === "string" || typeof data.year === "number"
        ? String(data.year)
        : typeof selected.row.year === "string" ||
            typeof selected.row.year === "number"
          ? String(selected.row.year)
          : usedYear ?? "not reported";
    const areaName =
      (typeof data.area_name === "string" && data.area_name) ||
      (typeof data.metro_name === "string" && data.metro_name) ||
      null;

    return {
      status: "ok",
      year,
      geographyType: selected.geographyType,
      zip: selected.zip,
      areaName,
      entityId: HUD_PITTSBURGH_ENTITY_ID,
      rents: rentsFromRow(selected.row),
      provenance: "PUBLIC_DATA",
      source: hudSource(retrievedAt, usedYear),
    };
  } catch {
    return {
      status: "not_evaluated",
      message: failureMessage("network"),
      source,
    };
  }
}
