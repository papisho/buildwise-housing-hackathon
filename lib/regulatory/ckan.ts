const DATASTORE_SQL_URL =
  "https://data.wprdc.org/api/3/action/datastore_search_sql";
const DATASTORE_SEARCH_URL =
  "https://data.wprdc.org/api/3/action/datastore_search";
const RESOURCE_SHOW_URL =
  "https://data.wprdc.org/api/3/action/resource_show";

export const REGULATORY_REQUEST_TIMEOUT_MS = 15_000;
export const REGULATORY_RECORD_LIMIT = 500;
export const SAFE_PARID = /^[A-Za-z0-9]+$/;

type CkanSqlResponse = {
  success?: boolean;
  error?: { message?: string; query?: string[] };
  result?: {
    records?: Record<string, unknown>[];
  };
};

type CkanSearchResponse = {
  success?: boolean;
  error?: { message?: string };
  result?: {
    records?: Record<string, unknown>[];
    total?: number;
  };
};

export class CkanLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CkanLookupError";
  }
}

async function fetchJson(
  url: URL,
  timeoutMs = REGULATORY_REQUEST_TIMEOUT_MS,
): Promise<{ ok: boolean; status: number; json: unknown; contentType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const contentType = response.headers.get("content-type") ?? "";
    let json: unknown = null;
    if (contentType.includes("application/json")) {
      json = await response.json();
    }
    return {
      ok: response.ok,
      status: response.status,
      json,
      contentType,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function readText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function datastoreSql(
  sql: string,
): Promise<Record<string, unknown>[]> {
  const url = new URL(DATASTORE_SQL_URL);
  url.searchParams.set("sql", sql);
  let payload: CkanSqlResponse;
  try {
    const response = await fetchJson(url);
    if (!response.ok || !response.contentType.includes("application/json")) {
      throw new CkanLookupError(
        `WPRDC SQL query returned HTTP ${response.status}.`,
      );
    }
    payload = response.json as CkanSqlResponse;
  } catch (error) {
    if (error instanceof CkanLookupError) {
      throw error;
    }
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("abort"));
    throw new CkanLookupError(
      aborted
        ? "WPRDC regulatory query timed out."
        : "WPRDC regulatory query could not be reached.",
    );
  }

  if (!payload.success) {
    throw new CkanLookupError(
      payload.error?.message ??
        payload.error?.query?.[0] ??
        "WPRDC regulatory SQL query failed.",
    );
  }
  const records = payload.result?.records;
  if (!Array.isArray(records)) {
    throw new CkanLookupError(
      "WPRDC regulatory SQL response was missing a records array.",
    );
  }
  return records;
}

export async function datastoreSearch(input: {
  resourceId: string;
  filters: Record<string, string>;
  limit?: number;
}): Promise<{ records: Record<string, unknown>[]; total: number | null }> {
  const url = new URL(DATASTORE_SEARCH_URL);
  url.searchParams.set("resource_id", input.resourceId);
  url.searchParams.set("filters", JSON.stringify(input.filters));
  url.searchParams.set(
    "limit",
    String(input.limit ?? REGULATORY_RECORD_LIMIT),
  );

  let payload: CkanSearchResponse;
  try {
    const response = await fetchJson(url);
    if (!response.ok || !response.contentType.includes("application/json")) {
      throw new CkanLookupError(
        `WPRDC datastore search returned HTTP ${response.status}.`,
      );
    }
    payload = response.json as CkanSearchResponse;
  } catch (error) {
    if (error instanceof CkanLookupError) {
      throw error;
    }
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("abort"));
    throw new CkanLookupError(
      aborted
        ? "WPRDC datastore search timed out."
        : "WPRDC datastore search could not be reached.",
    );
  }

  if (payload.success === false) {
    throw new CkanLookupError(
      payload.error?.message ?? "WPRDC datastore search failed.",
    );
  }
  const records = payload.result?.records;
  if (!Array.isArray(records)) {
    throw new CkanLookupError(
      "WPRDC datastore search was missing a records array.",
    );
  }
  return {
    records,
    total:
      typeof payload.result?.total === "number" ? payload.result.total : null,
  };
}

export async function datastoreSearchQ(input: {
  resourceId: string;
  q: string;
  limit?: number;
}): Promise<Record<string, unknown>[]> {
  const url = new URL(DATASTORE_SEARCH_URL);
  url.searchParams.set("resource_id", input.resourceId);
  url.searchParams.set("q", input.q);
  url.searchParams.set(
    "limit",
    String(input.limit ?? REGULATORY_RECORD_LIMIT),
  );

  try {
    const response = await fetchJson(url);
    if (!response.ok || !response.contentType.includes("application/json")) {
      return [];
    }
    const payload = response.json as CkanSearchResponse;
    const records = payload.result?.records;
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

export async function readResourceLastModified(
  resourceId: string,
): Promise<string | null> {
  const url = new URL(RESOURCE_SHOW_URL);
  url.searchParams.set("id", resourceId);
  try {
    const response = await fetchJson(url);
    if (!response.ok) {
      return null;
    }
    const payload = response.json as {
      success?: boolean;
      result?: { last_modified?: string };
    };
    return payload.success ? (payload.result?.last_modified ?? null) : null;
  } catch {
    return null;
  }
}
