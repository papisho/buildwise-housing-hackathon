import { lookupHudRentBenchmark } from "@/lib/financial/hud";
import { findNearbyValidatedSales } from "@/lib/financial/sales";
import {
  FINANCIAL_CONTEXT_LABELS,
  resolveFinancialContextStatus,
} from "@/lib/financial/status";
import type { FinancialContextResult } from "@/lib/financial/types";
import type { EsriPolygon } from "@/lib/parcels/allegheny";

export function composeFinancialContext(input: {
  pin: string;
  sales: FinancialContextResult["sales"];
  hud: FinancialContextResult["hud"];
}): FinancialContextResult {
  const overallStatus = resolveFinancialContextStatus({
    sales: input.sales,
    hud: input.hud,
  });
  return {
    overallStatus,
    overallStatusLabel: FINANCIAL_CONTEXT_LABELS[overallStatus],
    parcelId: input.pin,
    sales: input.sales,
    hud: input.hud,
    limitations: [
      "This is preliminary financial context only. It is not a pro forma, appraisal, broker opinion, or a determination that a project is financially feasible, profitable, bankable, or investment-worthy.",
      "Nearby Sales Context lists recent County-coded VALID SALE (SALECODE 0) transactions near the subject parcel. These properties have not been determined to be comparable to the subject property or proposed project, and they do not estimate the subject parcel’s market value.",
      "Search radius (0.25 mile, expanding to 0.5 mile if fewer than three validated sales) and a five-year lookback are BuildWise implementation choices, not County or HUD rules.",
      "HUD FMR/SAFMR values are regulatory benchmarks, not observed asking rents or guaranteed achievable project rents.",
      "Assessed value is not market value and is not used as an acquisition price.",
      "BuildWise does not know owner willingness to sell, site control, asking/acquisition price unless the user supplies it, contractor bids, financing terms, or actual achievable rents/sale prices.",
    ],
  };
}

export async function lookupFinancialContext(input: {
  pin: string;
  geometry: EsriPolygon | undefined;
  zip: string | null;
}): Promise<FinancialContextResult> {
  const [sales, hud] = await Promise.all([
    findNearbyValidatedSales({ pin: input.pin, geometry: input.geometry }),
    lookupHudRentBenchmark({ zip: input.zip }),
  ]);
  return composeFinancialContext({ pin: input.pin, sales, hud });
}

export function unevaluatedFinancialContext(
  pin: string,
  message: string,
): FinancialContextResult {
  const retrievedAt = new Date().toISOString();
  return {
    overallStatus: "FINANCIAL_CONTEXT_NOT_EVALUATED",
    overallStatusLabel: FINANCIAL_CONTEXT_LABELS.FINANCIAL_CONTEXT_NOT_EVALUATED,
    parcelId: pin,
    sales: {
      status: "not_evaluated",
      message,
      source: {
        name: "Allegheny County / WPRDC Property Sale Transactions",
        datasetUrl: "https://data.wprdc.org/dataset/real-estate-sales",
        queryUrl: "https://data.wprdc.org/api/3/action/datastore_search_sql",
        resourceId: "5bbe6c55-bce6-4edb-9d04-68edeb6bf7b1",
        sourceLastModified: null,
        retrievedAt,
      },
    },
    hud: {
      status: "not_evaluated",
      message,
      source: {
        name: "HUD Fair Market Rents / Small Area FMRs",
        datasetUrl: "https://www.huduser.gov/portal/datasets/fmr.html",
        queryUrl:
          "https://www.huduser.gov/hudapi/public/fmr/data/METRO38300M38300",
        resourceId: "METRO38300M38300",
        sourceLastModified: null,
        retrievedAt,
      },
    },
    limitations: [
      "Financial context was Not Evaluated because the lookup failed. Missing financial evidence is not treated as favorable.",
    ],
  };
}

export type { FinancialContextResult } from "@/lib/financial/types";
