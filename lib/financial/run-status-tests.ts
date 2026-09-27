import { calculateDevelopmentScenario } from "@/lib/financial/scenario";
import { meaningfulLotAreaSqFt } from "@/lib/financial/sales";
import { selectHudGeography } from "@/lib/financial/hud";
import {
  resolveFinancialContextStatus,
  resolveFinancialContextStatusFromFlags,
} from "@/lib/financial/status";
import { isCountyCodedValidSale } from "@/lib/financial/validation";
import type {
  FinancialSource,
  HudRentLookupResult,
  NearbySalesLookupResult,
} from "@/lib/financial/types";

const source: FinancialSource = {
  name: "test",
  datasetUrl: "https://example.com",
  queryUrl: "https://example.com",
  resourceId: "test",
  sourceLastModified: null,
  retrievedAt: "2026-09-27T00:00:00.000Z",
};

const salesOk: NearbySalesLookupResult = {
  status: "ok",
  records: [],
  searchRadiusFeet: 1320,
  neighborParcelCount: 10,
  validatedFilter: "SALECODE 0 / SALEDESC VALID SALE",
  source,
};

const hudOk: HudRentLookupResult = {
  status: "ok",
  year: "2026",
  geographyType: "ZIP_SAFMR",
  zip: "15232",
  areaName: "Pittsburgh, PA HUD Metro FMR Area",
  entityId: "METRO38300M38300",
  rents: {
    efficiency: 1,
    oneBedroom: 2,
    twoBedroom: 3,
    threeBedroom: 4,
    fourBedroom: 5,
  },
  provenance: "PUBLIC_DATA",
  source,
};

const notEvaluatedSales: NearbySalesLookupResult = {
  status: "not_evaluated",
  message: "fail",
  source,
};

const notEvaluatedHud: HudRentLookupResult = {
  status: "not_evaluated",
  message: "fail",
  source,
};

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

export function runFinancialStatusTests() {
  assert(
    resolveFinancialContextStatus({ sales: salesOk, hud: hudOk }) ===
      "PUBLIC_MARKET_CONTEXT_AVAILABLE",
    "sales+HUD without scenario is public market context",
  );
  assert(
    resolveFinancialContextStatus({
      sales: salesOk,
      hud: notEvaluatedHud,
    }) === "FINANCIAL_CONTEXT_PARTIAL",
    "one public source is partial",
  );
  assert(
    resolveFinancialContextStatus({
      sales: notEvaluatedSales,
      hud: notEvaluatedHud,
    }) === "FINANCIAL_CONTEXT_NOT_EVALUATED",
    "both public failures are not evaluated",
  );
  assert(
    resolveFinancialContextStatus({
      sales: notEvaluatedSales,
      hud: hudOk,
      scenarioCalculated: true,
    }) === "SCENARIO_CALCULATED",
    "complete scenario is SCENARIO_CALCULATED even if a public source failed",
  );
  assert(
    resolveFinancialContextStatusFromFlags({
      salesEvaluated: true,
      hudEvaluated: true,
    }) === "PUBLIC_MARKET_CONTEXT_AVAILABLE",
    "flag helper matches public market",
  );
  assert(
    isCountyCodedValidSale({
      saleCode: "0",
      saleDescription: "VALID SALE",
    }),
    "SALECODE 0 / VALID SALE is accepted",
  );
  assert(
    !isCountyCodedValidSale({
      saleCode: "H",
      saleDescription: "MULTI-PARCEL SALE",
    }),
    "SALECODE H is not accepted",
  );
  assert(
    !isCountyCodedValidSale({
      saleCode: "AA",
      saleDescription: "SALE NOT ANALYZED",
    }),
    "unanalyzed sales are not accepted",
  );
  assert(
    meaningfulLotAreaSqFt(null) === null && meaningfulLotAreaSqFt(0) === null,
    "missing or zero lot area is not treated as a meaningful 0 sf",
  );
  assert(
    meaningfulLotAreaSqFt(5898) === 5898,
    "positive assessment lot area is preserved",
  );

  const zipRow = {
    zip_code: "15219",
    Efficiency: 900,
    "One-Bedroom": 1000,
    "Two-Bedroom": 1200,
    "Three-Bedroom": 1400,
    "Four-Bedroom": 1600,
  };
  const msaRow = {
    zip_code: "MSA level",
    Efficiency: 800,
    "One-Bedroom": 900,
    "Two-Bedroom": 1100,
    "Three-Bedroom": 1300,
    "Four-Bedroom": 1500,
  };
  const zipPick = selectHudGeography({
    zip: "15219",
    smallareaStatus: "1",
    rows: [msaRow, zipRow],
  });
  assert(
    zipPick.ok &&
      zipPick.geographyType === "ZIP_SAFMR" &&
      zipPick.zip === "15219",
    "HUD prefers subject ZIP SAFMR when present",
  );
  const msaPick = selectHudGeography({
    zip: "15999",
    smallareaStatus: "1",
    rows: [msaRow, zipRow],
  });
  assert(
    msaPick.ok && msaPick.geographyType === "MSA_FMR" && msaPick.zip === null,
    "HUD falls back to MSA-level FMR for the same metro, not another ZIP",
  );
  const unmapped = selectHudGeography({
    zip: "15999",
    smallareaStatus: "1",
    rows: [zipRow],
  });
  assert(!unmapped.ok, "HUD does not substitute a different ZIP");

  const scenario = calculateDevelopmentScenario({
    acquisitionPrice: 200_000,
    units: 4,
    monthlyRentPerUnit: 1_200,
    hardConstructionCost: 400_000,
    softCosts: 50_000,
    contingency: 25_000,
    otherCosts: 5_000,
  });
  assert(scenario.estimatedTotalProjectCost === 680_000, "total cost arithmetic");
  assert(scenario.annualGrossScheduledRent === 57_600, "annual rent arithmetic");
  assert(scenario.projectCostPerUnit === 170_000, "cost per unit arithmetic");
  assert(
    Math.abs(scenario.annualGrossRentToCostRatio! - 57600 / 680000) < 1e-12,
    "rent/cost ratio arithmetic",
  );
  console.log("financial status tests passed");
  console.log("sample arithmetic", {
    estimatedTotalProjectCost: scenario.estimatedTotalProjectCost,
    annualGrossScheduledRent: scenario.annualGrossScheduledRent,
    projectCostPerUnit: scenario.projectCostPerUnit,
    annualGrossRentToCostRatio: scenario.annualGrossRentToCostRatio,
  });
}

if (process.argv[1]?.includes("run-status-tests")) {
  runFinancialStatusTests();
}
