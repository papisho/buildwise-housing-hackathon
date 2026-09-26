import {
  findAssessmentByParid,
  type AssessmentLookupResult,
} from "@/lib/assessments/wprdc";
import {
  geocodeOneLineAddress,
  type CensusMatch,
} from "@/lib/geocoder/census";
import {
  findParcelByPoint,
  findParcelEsriGeometryByPin,
  findParcelGeometryByPin,
  type CountyParcel,
} from "@/lib/parcels/allegheny";
import {
  disambiguateParcelsByAssessmentAddress,
  type ParcelAddressCandidate,
} from "@/lib/parcels/disambiguate";
import {
  findFloodForPin,
  type FloodLookupResult,
} from "@/lib/hazards/flood";
import {
  findLandslideForPin,
  type LandslideLookupResult,
} from "@/lib/hazards/landslide";
import {
  findSteepSlopeForPin,
  type SteepSlopeLookupResult,
} from "@/lib/hazards/steep-slope";
import {
  findUnderminedForPin,
  type UnderminedLookupResult,
} from "@/lib/hazards/undermined";
import {
  buildDecisionSnapshot,
  type DecisionSnapshot,
} from "@/lib/scoring";
import {
  findZoningForParcelGeometry,
  type ZoningLookupResult,
} from "@/lib/zoning/pittsburgh";

export type AddressToParcelResult =
  | {
      status: "ok";
      census: CensusMatch;
      parcel: CountyParcel;
      assessment: AssessmentLookupResult;
      zoning: ZoningLookupResult;
      steepSlope: SteepSlopeLookupResult;
      landslide: LandslideLookupResult;
      undermined: UnderminedLookupResult;
      flood: FloodLookupResult;
      decision: DecisionSnapshot;
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
      parcels: ParcelAddressCandidate[];
    }
  | {
      status: "parcel_unavailable";
      message: string;
      census: CensusMatch;
    };

function isPittsburgh(match: CensusMatch): boolean {
  return match.city.toUpperCase() === "PITTSBURGH";
}

async function lookupZoningForPin(pin: string): Promise<ZoningLookupResult> {
  const geometry = await findParcelGeometryByPin(pin);
  if (geometry.status === "unavailable") {
    return { status: "unavailable", message: geometry.message };
  }
  if (geometry.status === "no_match") {
    return {
      status: "unavailable",
      message:
        "Zoning not evaluated / parcel geometry was not available for intersection.",
    };
  }
  return findZoningForParcelGeometry(geometry.geometry);
}

async function lookupSiteEvidence(pin: string): Promise<{
  assessment: AssessmentLookupResult;
  zoning: ZoningLookupResult;
  steepSlope: SteepSlopeLookupResult;
  landslide: LandslideLookupResult;
  undermined: UnderminedLookupResult;
  flood: FloodLookupResult;
}> {
  const parcelGeometry = await findParcelEsriGeometryByPin(pin, 2272);
  const geometry =
    parcelGeometry.status === "ok" ? parcelGeometry.geometry : undefined;

  const [assessment, zoning, steepSlope, landslide, undermined, flood] =
    await Promise.all([
      findAssessmentByParid(pin),
      lookupZoningForPin(pin),
      findSteepSlopeForPin(pin, geometry).catch(
        (): SteepSlopeLookupResult => ({
          status: "not_evaluated",
          message: "Steep slope: Not Evaluated",
        }),
      ),
      findLandslideForPin(pin, geometry).catch(
        (): LandslideLookupResult => ({
          status: "not_evaluated",
          message: "Landslide: Not Evaluated",
        }),
      ),
      findUnderminedForPin(pin, geometry).catch(
        (): UnderminedLookupResult => ({
          status: "not_evaluated",
          message: "Mine / undermined: Not Evaluated",
        }),
      ),
      findFloodForPin(pin, geometry).catch(
        (): FloodLookupResult => ({
          status: "not_evaluated",
          message: "Flood: Not Evaluated",
        }),
      ),
    ]);

  return { assessment, zoning, steepSlope, landslide, undermined, flood };
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
    const disambiguated = await disambiguateParcelsByAssessmentAddress(
      parcelLookup.parcels,
      address,
      census.matchedAddress,
    );

    if (disambiguated.status === "ok") {
      const evidence = await lookupSiteEvidence(disambiguated.parcel.pin);
      return {
        status: "ok",
        census,
        parcel: disambiguated.parcel,
        ...evidence,
        decision: buildDecisionSnapshot(evidence),
      };
    }

    return {
      status: "ambiguous_parcel_match",
      message:
        "More than one County parcel intersects this location, and assessment addresses did not identify a single match. A parcel was not selected.",
      census,
      parcels: disambiguated.candidates,
    };
  }

  const evidence = await lookupSiteEvidence(parcelLookup.parcel.pin);

  return {
    status: "ok",
    census,
    parcel: parcelLookup.parcel,
    ...evidence,
    decision: buildDecisionSnapshot(evidence),
  };
}
