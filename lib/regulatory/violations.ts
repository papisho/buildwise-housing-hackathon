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
import { classifyCasefileStatuses } from "@/lib/regulatory/status";
import type {
  RegulatorySource,
  ViolationLookupResult,
  ViolationRecord,
} from "@/lib/regulatory/types";

export const PLI_VIOLATIONS_RESOURCE_ID =
  "70c06278-92c5-4040-ab28-17671866f81c";
export const PLI_VIOLATIONS_DATASET_URL =
  "https://data.wprdc.org/dataset/pittsburgh-pli-violations-report";
export const PLI_VIOLATIONS_QUERY_URL =
  "https://data.wprdc.org/api/3/action/datastore_search";

const VIOLATION_FIELDS = [
  "casefile_number",
  "address",
  "parcel_id",
  "status",
  "case_file_type",
  "investigation_date",
  "violation_description",
  "violation_code_section",
  "violation_code_section_title",
] as const;

function violationSource(
  sourceLastModified: string | null,
  retrievedAt: string,
): RegulatorySource {
  return {
    name: "City of Pittsburgh / WPRDC PLI/DOMI/ES Violations",
    datasetUrl: PLI_VIOLATIONS_DATASET_URL,
    resourceId: PLI_VIOLATIONS_RESOURCE_ID,
    queryUrl: PLI_VIOLATIONS_QUERY_URL,
    sourceLastModified,
    retrievedAt,
    temporalCoverage: "2020-06-01/present (current feed)",
  };
}

function unavailable(
  message: string,
  parcelIdQueried: string,
  sourceLastModified: string | null,
  retrievedAt: string,
): ViolationLookupResult {
  return {
    status: "unavailable",
    message,
    parcelIdQueried,
    source: violationSource(sourceLastModified, retrievedAt),
  };
}

function departmentFromCasefile(casefileNumber: string): string | null {
  const match = casefileNumber.toUpperCase().match(/^CF-([A-Z]+)-/);
  if (match?.[1]) {
    if (match[1] === "PLI") {
      return "PLI";
    }
    if (match[1] === "DOMI") {
      return "DOMI";
    }
    if (match[1] === "ES") {
      return "Environmental Services";
    }
    return match[1];
  }
  if (casefileNumber.toUpperCase().startsWith("O-")) {
    return "PLI (legacy ticketing)";
  }
  return null;
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

type RawRow = {
  casefileNumber: string;
  status: string | null;
  investigationDate: string | null;
  caseFileType: string | null;
  description: string | null;
  codeSection: string | null;
  codeTitle: string | null;
  address: string | null;
  parcelId: string | null;
  joinMethod: ViolationRecord["joinMethod"];
};

function readRow(
  record: Record<string, unknown>,
  joinMethod: ViolationRecord["joinMethod"],
): RawRow | null {
  const casefileNumber = readText(record.casefile_number);
  if (!casefileNumber) {
    return null;
  }
  return {
    casefileNumber,
    status: readText(record.status),
    investigationDate: readText(record.investigation_date),
    caseFileType: readText(record.case_file_type),
    description: readText(record.violation_description),
    codeSection: readText(record.violation_code_section),
    codeTitle: readText(record.violation_code_section_title),
    address: readText(record.address),
    parcelId: readText(record.parcel_id),
    joinMethod,
  };
}

function collapseCasefiles(rows: RawRow[]): ViolationRecord[] {
  const groups = new Map<string, RawRow[]>();
  for (const row of rows) {
    const existing = groups.get(row.casefileNumber) ?? [];
    existing.push(row);
    groups.set(row.casefileNumber, existing);
  }

  const records: ViolationRecord[] = [];
  for (const [casefileNumber, group] of groups) {
    const statusesObserved = [
      ...new Set(
        group
          .map((row) => row.status)
          .filter((status): status is string => Boolean(status)),
      ),
    ];
    const dates = group
      .map((row) => row.investigationDate)
      .filter((date): date is string => Boolean(date))
      .sort();
    const description =
      group.find((row) => row.description)?.description ??
      group.find((row) => row.codeTitle)?.codeTitle ??
      null;
    const category =
      group.find((row) => row.caseFileType)?.caseFileType ??
      group.find((row) => row.codeSection)?.codeSection ??
      null;
    const first = group[0];
    records.push({
      casefileNumber,
      department: departmentFromCasefile(casefileNumber),
      status: statusesObserved.length === 1 ? statusesObserved[0] : statusesObserved.join(" | ") || null,
      statusesObserved,
      openedDate: dates[0] ?? null,
      closedDate: null,
      category,
      description,
      address: first?.address ?? null,
      parcelId: first?.parcelId ?? null,
      joinMethod: group.some((row) => row.joinMethod === "parcel_id")
        ? "parcel_id"
        : "normalized_address",
      reviewClass: classifyCasefileStatuses(group.map((row) => row.status)),
      rowCount: group.length,
    });
  }

  return records.sort((left, right) => {
    const dateCmp = (right.openedDate ?? "").localeCompare(
      left.openedDate ?? "",
    );
    if (dateCmp !== 0) {
      return dateCmp;
    }
    return left.casefileNumber.localeCompare(right.casefileNumber);
  });
}

async function queryByParcel(pin: string): Promise<{
  records: Record<string, unknown>[];
  total: number | null;
}> {
  const fieldList = VIOLATION_FIELDS.map((field) => `"${field}"`).join(", ");
  try {
    const records = await datastoreSql(
      `SELECT ${fieldList} FROM "${PLI_VIOLATIONS_RESOURCE_ID}" WHERE "parcel_id" = '${pin}' LIMIT ${REGULATORY_RECORD_LIMIT}`,
    );
    return { records, total: records.length };
  } catch {
    return datastoreSearch({
      resourceId: PLI_VIOLATIONS_RESOURCE_ID,
      filters: { parcel_id: pin },
      limit: REGULATORY_RECORD_LIMIT,
    });
  }
}

export async function findViolationsForParcel(input: {
  pin: string;
  assessment: AssessmentLookupResult;
  censusMatchedAddress: string;
}): Promise<ViolationLookupResult> {
  const retrievedAt = new Date().toISOString();
  const vintage = await readResourceLastModified(PLI_VIOLATIONS_RESOURCE_ID);

  if (!SAFE_PARID.test(input.pin)) {
    return unavailable(
      "The parcel ID is not valid for violation lookup.",
      input.pin,
      vintage,
      retrievedAt,
    );
  }

  try {
    const parcelQuery = await queryByParcel(input.pin);
    const parcelRows = parcelQuery.records
      .map((record) => readRow(record, "parcel_id"))
      .filter((row): row is RawRow => row !== null);

    const seenKeys = new Set(
      parcelRows.map(
        (row) =>
          `${row.casefileNumber}|${row.status ?? ""}|${row.investigationDate ?? ""}|${row.description ?? ""}`,
      ),
    );

    let joinMethod: "parcel_id" | "normalized_address" | "none" =
      parcelRows.length ? "parcel_id" : "none";
    const addressRows: RawRow[] = [];

    if (parcelRows.length === 0) {
      const keys = candidateAddressKeys(input);
      for (const key of keys) {
        const extras = await datastoreSearchQ({
          resourceId: PLI_VIOLATIONS_RESOURCE_ID,
          q: key,
          limit: REGULATORY_RECORD_LIMIT,
        });
        for (const record of extras) {
          const parcelId = readText(record.parcel_id);
          if (parcelId && parcelId !== input.pin) {
            continue;
          }
          if (!addressesMatch(readText(record.address), key)) {
            continue;
          }
          const row = readRow(record, "normalized_address");
          if (!row) {
            continue;
          }
          const dedupeKey = `${row.casefileNumber}|${row.status ?? ""}|${row.investigationDate ?? ""}|${row.description ?? ""}`;
          if (seenKeys.has(dedupeKey)) {
            continue;
          }
          seenKeys.add(dedupeKey);
          addressRows.push(row);
        }
      }
      if (addressRows.length > 0) {
        joinMethod = "normalized_address";
      }
    }

    const records = collapseCasefiles([...parcelRows, ...addressRows]);
    const truncated =
      (parcelQuery.total !== null &&
        parcelQuery.total > REGULATORY_RECORD_LIMIT) ||
      parcelQuery.records.length >= REGULATORY_RECORD_LIMIT;

    return {
      status: "ok",
      records,
      totalMatchedRows: parcelRows.length + addressRows.length,
      truncated,
      joinMethod,
      parcelIdQueried: input.pin,
      source: violationSource(vintage, retrievedAt),
    };
  } catch (error) {
    const message =
      error instanceof CkanLookupError
        ? error.message
        : "Violations were not evaluated because the source could not be queried.";
    return unavailable(message, input.pin, vintage, retrievedAt);
  }
}
