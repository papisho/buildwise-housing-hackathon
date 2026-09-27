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
import { lookupHistoricDesignation } from "@/lib/historic";
import type { HistoricDesignationResult } from "@/lib/historic";
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
import { composeFinancialContext } from "@/lib/financial";
import type { FinancialContextResult } from "@/lib/financial";
import { findNearbyValidatedSales } from "@/lib/financial/sales";
import { lookupHudRentBenchmark } from "@/lib/financial/hud";

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
      historicDesignation: HistoricDesignationResult;
      financialContext: FinancialContextResult;
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
  historicDesignation: HistoricDesignationResult;
  financialContext: FinancialContextResult;
}> {
  const parcelGeometry = await findParcelEsriGeometryByPin(pin, 2272);
  const geometry =
    parcelGeometry.status === "ok" ? parcelGeometry.geometry : undefined;

  const salesPromise = findNearbyValidatedSales({ pin, geometry }).catch(
    (): Awaited<ReturnType<typeof findNearbyValidatedSales>> => ({
      status: "not_evaluated",
      message: "Nearby sales: Not Evaluated because the lookup failed.",
      source: {
        name: "Allegheny County / WPRDC Property Sale Transactions",
        datasetUrl: "https://data.wprdc.org/dataset/real-estate-sales",
        queryUrl: "https://data.wprdc.org/api/3/action/datastore_search_sql",
        resourceId: "5bbe6c55-bce6-4edb-9d04-68edeb6bf7b1",
        sourceLastModified: null,
        retrievedAt: new Date().toISOString(),
      },
    }),
  );

  const [assessment, zoning, steepSlope, landslide, undermined, flood, historicDesignation] =
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
      lookupHistoricDesignation({ pin, geometry }).catch(
        (): HistoricDesignationResult => ({
          overallStatus: "HISTORIC_STATUS_NOT_EVALUATED",
          overallStatusLabel: "Historic status not evaluated",
          parcelId: pin,
          message:
            "Historic designation was Not Evaluated. Missing historic evidence is not treated as the absence of designation.",
          partialEvidence: false,
          unevaluatedLayers: [
            "City historic districts",
            "City individual historic sites",
          ],
          districts: {
            status: "not_evaluated",
            message: "Historic districts: Not Evaluated",
            source: {
              name: "City of Pittsburgh / WPRDC City Designated Historic Districts",
              datasetUrl:
                "https://data.wprdc.org/dataset/city-designated-historic-districts",
              queryUrl:
                "https://services1.arcgis.com/YZCmUqbcsUpOKfj7/arcgis/rest/services/PGHWebCHDHistoricDistricts/FeatureServer/0/query",
              resourceId: "a7d619d1-b074-4f5b-959e-dc2389e85425",
              crs: "EPSG:2272",
              sourceLastModified: null,
              retrievedAt: new Date().toISOString(),
            },
          },
          sites: {
            status: "not_evaluated",
            message: "Individual historic sites: Not Evaluated",
            source: {
              name: "City of Pittsburgh / WPRDC City Designated Individual Historic Sites",
              datasetUrl:
                "https://data.wprdc.org/dataset/city-designated-individual-historic-sites",
              queryUrl:
                "https://services1.arcgis.com/YZCmUqbcsUpOKfj7/arcgis/rest/services/PGHWEBCHDIndividialProperties/FeatureServer/0/query",
              resourceId: "2a55085b-57e2-4b98-a784-a0ad7cbcc9fb",
              crs: "EPSG:2272",
              sourceLastModified: null,
              retrievedAt: new Date().toISOString(),
            },
          },
          limitations: [
            "Historic designation was Not Evaluated because the lookup failed. Missing historic evidence is not treated as clear/favorable.",
          ],
        }),
      ),
    ]);

  const zip =
    assessment.status === "ok" ? assessment.facts.propertyZip : null;
  const [regulatoryRecords, sales, hud] = await Promise.all([
    lookupRegulatoryRecords({
      // Canonical County PIN from address-to-parcel; not independently resolved.
      pin,
      assessment,
      censusMatchedAddress,
    }),
    salesPromise,
    lookupHudRentBenchmark({ zip }).catch(
      (): Awaited<ReturnType<typeof lookupHudRentBenchmark>> => ({
        status: "not_evaluated",
        message: "HUD rent benchmark: Not Evaluated because the lookup failed.",
        source: {
          name: "HUD Fair Market Rents / Small Area FMRs",
          datasetUrl: "https://www.huduser.gov/portal/datasets/fmr.html",
          queryUrl:
            "https://www.huduser.gov/hudapi/public/fmr/data/METRO38300M38300",
          resourceId: "METRO38300M38300",
          sourceLastModified: null,
          retrievedAt: new Date().toISOString(),
        },
      }),
    ),
  ]);

  const financialContext = composeFinancialContext({ pin, sales, hud });

  return {
    assessment,
    zoning,
    steepSlope,
    landslide,
    undermined,
    flood,
    regulatoryRecords,
    historicDesignation,
    financialContext,
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
    historicDesignation: HistoricDesignationResult;
    financialContext: FinancialContextResult;
  };
}): Promise<Extract<AddressToParcelResult, { status: "ok" }>> {
  const { financialContext, ...scoredEvidence } = input.evidence;
  const useCompatibility = evaluateUseCompatibility({
    proposedProjectType: input.request.proposedProjectType,
    zoning: input.evidence.zoning,
  });
  const decision = buildDecisionSnapshot({
    ...scoredEvidence,
    useCompatibility,
    regulatoryRecords: input.evidence.regulatoryRecords,
    historicDesignation: input.evidence.historicDesignation,
  });
  const recommendedVerification = buildRecommendedVerification({
    ...scoredEvidence,
    useCompatibility,
    decision,
    regulatoryRecords: input.evidence.regulatoryRecords,
    historicDesignation: input.evidence.historicDesignation,
    financialContext,
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
    historicDesignation: input.evidence.historicDesignation,
    financialContext,
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
