/**
 * Live WPRDC dump 2026-09-27 of DISTINCT SALECODE, SALEDESC on
 * resource 5bbe6c55-bce6-4edb-9d04-68edeb6bf7b1.
 *
 * The only pair whose County description is exactly "VALID SALE" is SALECODE 0.
 * WPRDC dataset notes also name SALECODE H as invalid (multi-parcel deed price).
 * Preferential / unanalyzed / sheriff / treasurer / love-and-affection codes
 * are excluded. PA DCED STEB "00" is a different coding system and is not used.
 */
export const VALIDATED_SALE_CODE = "0";
export const VALIDATED_SALE_DESCRIPTION = "VALID SALE";

export function isCountyCodedValidSale(input: {
  saleCode: string | null;
  saleDescription: string | null;
}): boolean {
  return (
    input.saleCode === VALIDATED_SALE_CODE &&
    (input.saleDescription ?? "").trim().toUpperCase() ===
      VALIDATED_SALE_DESCRIPTION
  );
}
