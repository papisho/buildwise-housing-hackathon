import { findAssessmentByParid } from "@/lib/assessments/wprdc";
import { addressMatchesAssessment } from "@/lib/parcels/match-address";
import type { CountyParcel } from "@/lib/parcels/allegheny";

export type ParcelAddressCandidate = CountyParcel & {
  assessmentAddress: string | null;
  addressMatched: boolean;
};

export type DisambiguateResult =
  | { status: "ok"; parcel: CountyParcel }
  | { status: "ambiguous"; candidates: ParcelAddressCandidate[] };

export async function disambiguateParcelsByAssessmentAddress(
  parcels: CountyParcel[],
  requestedAddress: string,
  censusMatchedAddress: string,
): Promise<DisambiguateResult> {
  const candidates: ParcelAddressCandidate[] = await Promise.all(
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

  const matches = candidates.filter((candidate) => candidate.addressMatched);
  if (matches.length === 1) {
    return { status: "ok", parcel: matches[0] };
  }

  return { status: "ambiguous", candidates };
}
