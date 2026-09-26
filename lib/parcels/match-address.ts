const STREET_SUFFIXES: Record<string, string> = {
  AVENUE: "AVE",
  STREET: "ST",
  ROAD: "RD",
  DRIVE: "DR",
  BOULEVARD: "BLVD",
  LANE: "LN",
  COURT: "CT",
  PLACE: "PL",
  TERRACE: "TER",
  CIRCLE: "CIR",
  PARKWAY: "PKWY",
  HIGHWAY: "HWY",
};

const STREET_DIRECTIONS: Record<string, string> = {
  NORTH: "N",
  SOUTH: "S",
  EAST: "E",
  WEST: "W",
};

const STREET_ORDINALS: Record<string, string> = {
  FIRST: "1ST",
  SECOND: "2ND",
  THIRD: "3RD",
  FOURTH: "4TH",
  FIFTH: "5TH",
  SIXTH: "6TH",
  SEVENTH: "7TH",
  EIGHTH: "8TH",
  NINTH: "9TH",
  TENTH: "10TH",
};

export type HouseAndStreet = {
  houseNumber: string | null;
  streetName: string | null;
};

function normalizeHouseNumber(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const match = value.trim().match(/(\d+)/);
  if (!match) {
    return null;
  }
  return String(Number(match[1]));
}

export function normalizeStreetName(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const tokens = value
    .toUpperCase()
    .replace(/[.,#]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => STREET_ORDINALS[token] ?? token);

  if (tokens.length === 0) {
    return null;
  }

  if (STREET_DIRECTIONS[tokens[0]]) {
    tokens[0] = STREET_DIRECTIONS[tokens[0]];
  }

  const lastIndex = tokens.length - 1;
  if (STREET_SUFFIXES[tokens[lastIndex]]) {
    tokens[lastIndex] = STREET_SUFFIXES[tokens[lastIndex]];
  }

  return tokens.join(" ");
}

export function parseHouseAndStreet(address: string): HouseAndStreet {
  const line = address.split(",")[0]?.trim() ?? "";
  const cleaned = line.replace(/[.,#]/g, " ").replace(/\s+/g, " ").trim();
  const match = cleaned.match(/^(\d+)\s+(.+)$/);
  if (!match) {
    return {
      houseNumber: normalizeHouseNumber(cleaned),
      streetName: normalizeStreetName(cleaned),
    };
  }

  return {
    houseNumber: normalizeHouseNumber(match[1]),
    streetName: normalizeStreetName(match[2]),
  };
}

function assessmentHouseNumbers(
  houseNumber: string | null,
  fraction: string | null,
): string[] {
  const numbers = new Set<string>();
  const start = normalizeHouseNumber(houseNumber);
  if (start) {
    numbers.add(start);
  }
  for (const extra of fraction?.match(/\d+/g) ?? []) {
    numbers.add(String(Number(extra)));
  }
  return [...numbers];
}

export function houseAndStreetMatch(
  requested: HouseAndStreet,
  assessmentHouseNumber: string | null,
  assessmentStreetName: string | null,
  assessmentFraction: string | null,
): boolean {
  if (!requested.houseNumber || !requested.streetName) {
    return false;
  }

  const street = normalizeStreetName(assessmentStreetName);
  if (!street || street !== requested.streetName) {
    return false;
  }

  return assessmentHouseNumbers(
    assessmentHouseNumber,
    assessmentFraction,
  ).includes(requested.houseNumber);
}

export function addressMatchesAssessment(
  requestedAddress: string,
  censusMatchedAddress: string,
  assessmentHouseNumber: string | null,
  assessmentStreetName: string | null,
  assessmentFraction: string | null,
): boolean {
  const requested = parseHouseAndStreet(requestedAddress);
  const census = parseHouseAndStreet(censusMatchedAddress);

  return (
    houseAndStreetMatch(
      requested,
      assessmentHouseNumber,
      assessmentStreetName,
      assessmentFraction,
    ) ||
    houseAndStreetMatch(
      census,
      assessmentHouseNumber,
      assessmentStreetName,
      assessmentFraction,
    )
  );
}
