import type { AssessmentLookupResult } from "@/lib/assessments/wprdc";
import {
  addressesMatch,
  streetLineFromParts,
  streetLineKey,
} from "@/lib/regulatory/address";
import {
  CkanLookupError,
  REGULATORY_RECORD_LIMIT,
  SAFE_PARID,
  datastoreSearch,
  datastoreSearchQ,
  datastoreSql,
  readResourceLastModified,
  readText,
} from "@/lib/regulatory/ckan";
import { classifyPermitStatus } from "@/lib/regulatory/status";
import type {
  PermitLookupResult,
  PermitRecord,
  RegulatorySource,
} from "@/lib/regulatory/types";

export const PLI_PERMITS_RESOURCE_ID =
  "f4d1177a-f597-4c32-8cbf-7885f56253f6";
export const PLI_PERMITS_DATASET_URL =
  "https://data.wprdc.org/dataset/pli-permits";
export const PLI_PERMITS_QUERY_URL =
  "https://data.wprdc.org/api/3/action/datastore_search";

const PERMIT_FIELDS = [
  "permit_id",
  "permit_type",
  "status",
  "issue_date",
  "work_description",
  "work_type",
  "parcel_num",
  "address",
] as const;

function permitSource(
  sourceLastModified: string | null,
  retrievedAt: string,
): RegulatorySource {
  return {
    name: "City of Pittsburgh / WPRDC PLI Permits",
    datasetUrl: PLI_PERMITS_DATASET_URL,
    resourceId: PLI_PERMITS_RESOURCE_ID,
    queryUrl: PLI_PERMITS_QUERY_URL,
    sourceLastModified,
    retrievedAt,
    temporalCoverage: "2019-06-01/present (current feed)",
  };
}

function unavailable(
  message: string,
  parcelIdQueried: string,
  sourceLastModified: string | null,
  retrievedAt: string,
): PermitLookupResult {
  return {
    status: "unavailable",
    message,
    parcelIdQueried,
    source: permitSource(sourceLastModified, retrievedAt),
  };
}

function mapRecord(
  record: Record<string, unknown>,
  joinMethod: PermitRecord["joinMethod"],
): PermitRecord | null {
  const permitId = readText(record.permit_id);
  if (!permitId) {
    return null;
  }
  const status = readText(record.status);
  return {
    permitId,
    permitType: readText(record.permit_type),
    status,
    issueDate: readText(record.issue_date),
    completionDate: null,
    workDescription: readText(record.work_description),
    workType: readText(record.work_type),
    address: readText(record.address),
    parcelNum: readText(record.parcel_num),
    joinMethod,
    reviewClass: classifyPermitStatus(status),
  };
}

function sortPermits(records: PermitRecord[]): PermitRecord[] {
  return [...records].sort((left, right) => {
    const dateCmp = (right.issueDate ?? "").localeCompare(left.issueDate ?? "");
    if (dateCmp !== 0) {
      return dateCmp;
    }
    return left.permitId.localeCompare(right.permitId);
  });
}

function candidateAddressKeys(input: {
  assessment: AssessmentLookupResult;
  censusMatchedAddress: string;
}): string[] {
  const keys = new Set<string>();
  const census = streetLineKey(input.censusMatchedAddress);
  if (census) {
    keys.add(census);
  }
  if (input.assessment.status === "ok") {
    const fromParts = streetLineFromParts(
      input.assessment.facts.houseNumber,
      input.assessment.facts.streetName,
    );
    if (fromParts) {
      keys.add(fromParts);
    }
    const fromFull = streetLineKey(input.assessment.facts.propertyAddress);
    if (fromFull) {
      keys.add(fromFull);
    }
  }
  return [...keys].filter((key) => !/^0\s/.test(key));
}

async function queryByParcel(pin: string): Promise<{
  records: Record<string, unknown>[];
  total: number | null;
}> {
  const fieldList = PERMIT_FIELDS.map((field) => `"${field}"`).join(", ");
  try {
    const records = await datastoreSql(
      `SELECT ${fieldList} FROM "${PLI_PERMITS_RESOURCE_ID}" WHERE "parcel_num" = '${pin}' LIMIT ${REGULATORY_RECORD_LIMIT}`,
    );
    return { records, total: records.length };
  } catch {
    return datastoreSearch({
      resourceId: PLI_PERMITS_RESOURCE_ID,
      filters: { parcel_num: pin },
      limit: REGULATORY_RECORD_LIMIT,
    });
  }
}

export async function findPermitsForParcel(input: {
  pin: string;
  assessment: AssessmentLookupResult;
  censusMatchedAddress: string;
}): Promise<PermitLookupResult> {
  const retrievedAt = new Date().toISOString();
  const vintage = await readResourceLastModified(PLI_PERMITS_RESOURCE_ID);

  if (!SAFE_PARID.test(input.pin)) {
    return unavailable(
      "The parcel ID is not valid for PLI permit lookup.",
      input.pin,
      vintage,
      retrievedAt,
    );
  }

  try {
    const parcelQuery = await queryByParcel(input.pin);
    const parcelMapped = parcelQuery.records
      .map((record) => mapRecord(record, "parcel_id"))
      .filter((record): record is PermitRecord => record !== null);
    const seen = new Set(parcelMapped.map((record) => record.permitId));

    let joinMethod: "parcel_id" | "normalized_address" | "none" =
      parcelMapped.length ? "parcel_id" : "none";

    const addressMapped: PermitRecord[] = [];
    if (parcelMapped.length === 0) {
      const keys = candidateAddressKeys(input);
      for (const key of keys) {
        const extras = await datastoreSearchQ({
          resourceId: PLI_PERMITS_RESOURCE_ID,
          q: key,
          limit: REGULATORY_RECORD_LIMIT,
        });
        for (const record of extras) {
          const parcelNum = readText(record.parcel_num);
          if (parcelNum && parcelNum !== input.pin) {
            continue;
          }
          if (!addressesMatch(readText(record.address), key)) {
            continue;
          }
          const mapped = mapRecord(record, "normalized_address");
          if (!mapped || seen.has(mapped.permitId)) {
            continue;
          }
          seen.add(mapped.permitId);
          addressMapped.push(mapped);
        }
      }
      if (addressMapped.length > 0) {
        joinMethod = "normalized_address";
      }
    }

    const records = sortPermits([...parcelMapped, ...addressMapped]);
    const truncated =
      (parcelQuery.total !== null &&
        parcelQuery.total > REGULATORY_RECORD_LIMIT) ||
      parcelQuery.records.length >= REGULATORY_RECORD_LIMIT;

    return {
      status: "ok",
      records,
      totalMatched: records.length,
      truncated,
      joinMethod,
      parcelIdQueried: input.pin,
      source: permitSource(vintage, retrievedAt),
    };
  } catch (error) {
    const message =
      error instanceof CkanLookupError
        ? error.message
        : "PLI permits were not evaluated because the source could not be queried.";
    return unavailable(message, input.pin, vintage, retrievedAt);
  }
}
