import {
  geocodeOneLineAddress,
  type CensusMatch,
} from "@/lib/geocoder/census";
import {
  findParcelByPoint,
  type CountyParcel,
} from "@/lib/parcels/allegheny";

export type AddressToParcelResult =
  | {
      status: "ok";
      census: CensusMatch;
      parcel: CountyParcel;
    }
  | {
      status: "invalid_input";
      message: string;
    }
  | {
      status: "no_census_match";
      message: string;
    }
  | {
      status: "ambiguous_census_match";
      message: string;
      matches: CensusMatch[];
    }
  | {
      status: "outside_pittsburgh";
      message: string;
      census: CensusMatch;
    }
  | {
      status: "census_unavailable";
      message: string;
    }
  | {
      status: "no_parcel_match";
      message: string;
      census: CensusMatch;
    }
  | {
      status: "ambiguous_parcel_match";
      message: string;
      census: CensusMatch;
      parcels: CountyParcel[];
    }
  | {
      status: "parcel_unavailable";
      message: string;
      census: CensusMatch;
    };

function isPittsburgh(match: CensusMatch): boolean {
  return match.city.toUpperCase() === "PITTSBURGH";
}

export async function findParcelForAddress(
  rawAddress: string,
): Promise<AddressToParcelResult> {
  const address = rawAddress.trim();
  if (!address) {
    return {
      status: "invalid_input",
      message: "Enter a Pittsburgh street address.",
    };
  }

  const geocode = await geocodeOneLineAddress(address);

  if (geocode.status === "unavailable") {
    return { status: "census_unavailable", message: geocode.message };
  }

  if (geocode.status === "no_match") {
    return {
      status: "no_census_match",
      message:
        "No Census address match was found. Check the street address and try again. No parcel was selected.",
    };
  }

  if (geocode.status === "ambiguous") {
    return {
      status: "ambiguous_census_match",
      message:
        "The Census Geocoder returned more than one address match. Verify the address; a parcel was not selected.",
      matches: geocode.matches,
    };
  }

  const census = geocode.match;

  if (!isPittsburgh(census)) {
    return {
      status: "outside_pittsburgh",
      message:
        "This hackathon MVP currently supports City of Pittsburgh parcels only. A County parcel was not queried.",
      census,
    };
  }

  const parcelLookup = await findParcelByPoint(
    census.longitude,
    census.latitude,
  );

  if (parcelLookup.status === "unavailable") {
    return {
      status: "parcel_unavailable",
      message: parcelLookup.message,
      census,
    };
  }

  if (parcelLookup.status === "no_match") {
    return {
      status: "no_parcel_match",
      message:
        "The geocoded point did not intersect an Allegheny County parcel. No parcel was selected.",
      census,
    };
  }

  if (parcelLookup.status === "ambiguous") {
    return {
      status: "ambiguous_parcel_match",
      message:
        "More than one County parcel intersects this location. A parcel was not selected.",
      census,
      parcels: parcelLookup.parcels,
    };
  }

  return {
    status: "ok",
    census,
    parcel: parcelLookup.parcel,
  };
}
