const CENSUS_GEOCODER_URL =
  "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const BENCHMARK = "Public_AR_Current";
const REQUEST_TIMEOUT_MS = 15_000;

export type CensusMatch = {
  matchedAddress: string;
  longitude: number;
  latitude: number;
  city: string;
  state: string;
};

export type CensusGeocodeResult =
  | { status: "ok"; match: CensusMatch }
  | { status: "no_match" }
  | { status: "ambiguous"; matches: CensusMatch[] }
  | { status: "unavailable"; message: string };

type CensusCoordinate = {
  x?: number;
  y?: number;
};

type CensusAddressMatch = {
  matchedAddress?: string;
  coordinates?: CensusCoordinate;
  addressComponents?: {
    city?: string;
    state?: string;
  };
};

type CensusResponse = {
  result?: {
    addressMatches?: CensusAddressMatch[];
  };
};

function parseMatch(raw: CensusAddressMatch): CensusMatch | null {
  const longitude = raw.coordinates?.x;
  const latitude = raw.coordinates?.y;
  const matchedAddress = raw.matchedAddress?.trim();

  if (
    typeof longitude !== "number" ||
    typeof latitude !== "number" ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    !matchedAddress
  ) {
    return null;
  }

  return {
    matchedAddress,
    longitude,
    latitude,
    city: raw.addressComponents?.city?.trim() ?? "",
    state: raw.addressComponents?.state?.trim() ?? "",
  };
}

export async function geocodeOneLineAddress(
  address: string,
): Promise<CensusGeocodeResult> {
  const url = new URL(CENSUS_GEOCODER_URL);
  url.searchParams.set("address", address);
  url.searchParams.set("benchmark", BENCHMARK);
  url.searchParams.set("format", "json");

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
        message: `Census Geocoder returned HTTP ${response.status}.`,
      };
    }

    const payload = (await response.json()) as CensusResponse;
    const matches = (payload.result?.addressMatches ?? [])
      .map(parseMatch)
      .filter((match): match is CensusMatch => match !== null);

    if (matches.length === 0) {
      return { status: "no_match" };
    }

    if (matches.length > 1) {
      return { status: "ambiguous", matches };
    }

    return { status: "ok", match: matches[0] };
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("abort"));

    return {
      status: "unavailable",
      message: aborted
        ? "Census Geocoder timed out."
        : "Census Geocoder could not be reached.",
    };
  } finally {
    clearTimeout(timer);
  }
}
