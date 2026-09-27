import { findAssessmentByParid } from "@/lib/assessments/wprdc";
import {
  ADDRESS_VALIDATION_SEARCH_FEET,
  findParcelByPoint,
  findParcelsNearPoint,
  type CountyParcel,
} from "@/lib/parcels/allegheny";
import { addressMatchesAssessment } from "@/lib/parcels/match-address";
import type { ParcelAddressCandidate } from "@/lib/parcels/disambiguate";

export type ParcelIdentityResult =
  | { status: "ok"; parcel: CountyParcel }
  | {
      status: "verification_required";
      message: string;
      candidates: ParcelAddressCandidate[];
      directHitPin: string | null;
    }
  | { status: "no_match" }
  | { status: "unavailable"; message: string };

async function annotateParcels(
  parcels: CountyParcel[],
  requestedAddress: string,
  censusMatchedAddress: string,
): Promise<ParcelAddressCandidate[]> {
  return Promise.all(
    parcels.map(async (parcel) => {
      const assessment = await findAssessmentByParid(parcel.pin);
      if (assessment.status !== "ok") {
        return {
          ...parcel,
          assessmentAddress: null,
          addressMatched: false,
        };
      }

      return {
        ...parcel,
        assessmentAddress: assessment.facts.propertyAddress,
        addressMatched: addressMatchesAssessment(
          requestedAddress,
          censusMatchedAddress,
          assessment.facts.houseNumber,
          assessment.facts.streetName,
          assessment.facts.houseNumberFraction,
        ),
      };
    }),
  );
}

export async function resolveValidatedParcel(input: {
  longitude: number;
  latitude: number;
  requestedAddress: string;
  censusMatchedAddress: string;
}): Promise<ParcelIdentityResult> {
  const direct = await findParcelByPoint(input.longitude, input.latitude);
  if (direct.status === "unavailable") {
    return direct;
  }

  const seedParcels: CountyParcel[] =
    direct.status === "ok"
      ? [direct.parcel]
      : direct.status === "ambiguous"
        ? direct.parcels
        : [];

  const seedAnnotated = await annotateParcels(
    seedParcels,
    input.requestedAddress,
    input.censusMatchedAddress,
  );
  const seedMatches = seedAnnotated.filter((candidate) => candidate.addressMatched);
  if (seedMatches.length === 1) {
    return { status: "ok", parcel: seedMatches[0] };
  }
  if (seedMatches.length > 1) {
    return {
      status: "verification_required",
      message:
        "PARCEL_IDENTITY_VERIFICATION_REQUIRED. More than one nearby parcel assessment address matches this input. A parcel was not selected.",
      candidates: seedAnnotated,
      directHitPin: seedParcels[0]?.pin ?? null,
    };
  }

  const nearby = await findParcelsNearPoint(
    input.longitude,
    input.latitude,
    ADDRESS_VALIDATION_SEARCH_FEET,
  );
  if (nearby.status === "unavailable") {
    return {
      status: "verification_required",
      message:
        "PARCEL_IDENTITY_VERIFICATION_REQUIRED. The Census point parcel assessment address does not match the entered address, and nearby parcels could not be searched. A parcel was not selected.",
      candidates: seedAnnotated,
      directHitPin: seedParcels[0]?.pin ?? null,
    };
  }

  const known = new Set(seedParcels.map((parcel) => parcel.pin));
  const extra = nearby.parcels.filter((parcel) => !known.has(parcel.pin));
  const extraAnnotated = await annotateParcels(
    extra,
    input.requestedAddress,
    input.censusMatchedAddress,
  );
  const allCandidates = [...seedAnnotated, ...extraAnnotated];

  const matches = allCandidates.filter((candidate) => candidate.addressMatched);
  if (matches.length === 1) {
    return { status: "ok", parcel: matches[0] };
  }

  if (seedParcels.length === 0 && nearby.parcels.length === 0) {
    return { status: "no_match" };
  }

  return {
    status: "verification_required",
    message:
      matches.length === 0
        ? `PARCEL_IDENTITY_VERIFICATION_REQUIRED. The Census geocoder point did not identify a parcel whose County assessment house number and street match the entered address. Nearby parcels within ${ADDRESS_VALIDATION_SEARCH_FEET} feet were checked. A parcel was not selected.`
        : "PARCEL_IDENTITY_VERIFICATION_REQUIRED. More than one nearby parcel assessment address matches this input. A parcel was not selected.",
    candidates: allCandidates,
    directHitPin: seedParcels[0]?.pin ?? null,
  };
}
