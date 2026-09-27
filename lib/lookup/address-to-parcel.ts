import {
  findAssessmentByParid,
  type AssessmentLookupResult,
} from "@/lib/assessments/wprdc";
import {
  geocodeOneLineAddress,
  type CensusMatch,
} from "@/lib/geocoder/census";
import {
  findParcelEsriGeometryByPin,
  findParcelGeometryByPin,
  type CountyParcel,
} from "@/lib/parcels/allegheny";
import { type ParcelAddressCandidate } from "@/lib/parcels/disambiguate";
import { resolveValidatedParcel } from "@/lib/parcels/resolve-identity";
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
import { lookupRegulatoryRecords } from "@/lib/regulatory";
import type { RegulatoryRecordsResult } from "@/lib/regulatory";
import {
  parseProposedProjectType,
  type ProposedProjectType,
} from "@/lib/project-type";
import { buildRecommendedVerification } from "@/lib/review/next-steps";
import {
  buildDecisionSnapshot,
  type DecisionSnapshot,
} from "@/lib/scoring";
import {
  explainAnalysis,
  buildClaudeAnalysisInput,
} from "@/lib/claude/client";
import type {
  ClaudeAnalysisInput,
  ClaudeExplanationResult,
} from "@/lib/claude/types";
import {
  evaluateUseCompatibility,
  type UseCompatibilityResult,
} from "@/lib/zoning/compatibility";
import {
  findZoningForParcelEsri,
  findZoningForParcelGeometry,
  type ZoningLookupResult,
} from "@/lib/zoning/pittsburgh";

export type AnalysisRequest = {
  inputAddress: string;
  proposedProjectType: ProposedProjectType;
};

export type AddressToParcelResult =
  | {
      status: "ok";
      request: AnalysisRequest;
      census: CensusMatch;
      parcel: CountyParcel;
      assessment: AssessmentLookupResult;
      zoning: ZoningLookupResult;
      useCompatibility: UseCompatibilityResult;
      steepSlope: SteepSlopeLookupResult;
      landslide: LandslideLookupResult;
      undermined: UnderminedLookupResult;
      flood: FloodLookupResult;
      regulatoryRecords: RegulatoryRecordsResult;
      decision: DecisionSnapshot;
      recommendedVerification: string[];
      aiSummary: ClaudeExplanationResult;
      claudeContext: ClaudeAnalysisInput;
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
      status: "parcel_identity_verification_required";
      message: string;
      census: CensusMatch;
      parcels: ParcelAddressCandidate[];
      directHitPin: string | null;
    }
  | {
      status: "parcel_unavailable";
      message: string;
      census: CensusMatch;
    };

function isPittsburgh(match: CensusMatch): boolean {
  return match.city.toUpperCase() === "PITTSBURGH";
}

async function lookupZoningForPin(
  pin: string,
  parcelEsri2272?: Awaited<ReturnType<typeof findParcelEsriGeometryByPin>>,
): Promise<ZoningLookupResult> {
  if (parcelEsri2272?.status === "ok") {
    return findZoningForParcelEsri(parcelEsri2272.geometry);
  }

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

async function lookupSiteEvidence(
  pin: string,
  censusMatchedAddress: string,
): Promise<{
  assessment: AssessmentLookupResult;
  zoning: ZoningLookupResult;
  steepSlope: SteepSlopeLookupResult;
  landslide: LandslideLookupResult;
  undermined: UnderminedLookupResult;
  flood: FloodLookupResult;
  regulatoryRecords: RegulatoryRecordsResult;
}> {
  const parcelGeometry = await findParcelEsriGeometryByPin(pin, 2272);
  const geometry =
    parcelGeometry.status === "ok" ? parcelGeometry.geometry : undefined;

  const [assessment, zoning, steepSlope, landslide, undermined, flood] =
    await Promise.all([
      findAssessmentByParid(pin),
      lookupZoningForPin(pin, parcelGeometry),
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

  const regulatoryRecords = await lookupRegulatoryRecords({
    // Canonical County PIN from address-to-parcel; not independently resolved.
    pin,
    assessment,
    censusMatchedAddress,
  });

  return {
    assessment,
    zoning,
    steepSlope,
    landslide,
    undermined,
    flood,
    regulatoryRecords,
  };
}

export async function findParcelForAddress(
  rawAddress: string,
  proposedProjectType: ProposedProjectType = "general_screening",
): Promise<AddressToParcelResult> {
  const address = rawAddress.trim();
  const request: AnalysisRequest = {
    inputAddress: address,
    proposedProjectType: parseProposedProjectType(proposedProjectType),
  };
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

  const identity = await resolveValidatedParcel({
    longitude: census.longitude,
    latitude: census.latitude,
    requestedAddress: address,
    censusMatchedAddress: census.matchedAddress,
  });

  if (identity.status === "unavailable") {
    return {
      status: "parcel_unavailable",
      message: identity.message,
      census,
    };
  }

  if (identity.status === "no_match") {
    return {
      status: "no_parcel_match",
      message:
        "The geocoded point did not identify an Allegheny County parcel whose assessment address matches the entered address. No parcel was selected.",
      census,
    };
  }

  if (identity.status === "verification_required") {
    return {
      status: "parcel_identity_verification_required",
      message: identity.message,
      census,
      parcels: identity.candidates,
      directHitPin: identity.directHitPin,
    };
  }

  const evidence = await lookupSiteEvidence(
    identity.parcel.pin,
    census.matchedAddress,
  );
  return completeOkResult({
    request,
    census,
    parcel: identity.parcel,
    evidence,
  });
}

async function completeOkResult(input: {
  request: AnalysisRequest;
  census: CensusMatch;
  parcel: CountyParcel;
  evidence: {
    assessment: AssessmentLookupResult;
    zoning: ZoningLookupResult;
    steepSlope: SteepSlopeLookupResult;
    landslide: LandslideLookupResult;
    undermined: UnderminedLookupResult;
    flood: FloodLookupResult;
    regulatoryRecords: RegulatoryRecordsResult;
  };
}): Promise<Extract<AddressToParcelResult, { status: "ok" }>> {
  const useCompatibility = evaluateUseCompatibility({
    proposedProjectType: input.request.proposedProjectType,
    zoning: input.evidence.zoning,
  });
  const decision = buildDecisionSnapshot({
    ...input.evidence,
    useCompatibility,
    regulatoryRecords: input.evidence.regulatoryRecords,
  });
  const recommendedVerification = buildRecommendedVerification({
    ...input.evidence,
    useCompatibility,
    decision,
    regulatoryRecords: input.evidence.regulatoryRecords,
  });
  const claudeContext = buildClaudeAnalysisInput({
    address: input.census.matchedAddress,
    parcelId: input.parcel.pin,
    proposedProjectType: input.request.proposedProjectType,
    assessment: input.evidence.assessment,
    zoning: input.evidence.zoning,
    useCompatibility,
    steepSlope: input.evidence.steepSlope,
    landslide: input.evidence.landslide,
    undermined: input.evidence.undermined,
    flood: input.evidence.flood,
    decision,
    recommendedVerification,
    regulatoryRecords: input.evidence.regulatoryRecords,
  });
  const aiSummary = await explainAnalysis(claudeContext);

  return {
    status: "ok",
    request: input.request,
    census: input.census,
    parcel: input.parcel,
    ...input.evidence,
    useCompatibility,
    decision,
    recommendedVerification,
    aiSummary,
    claudeContext,
  };
}
