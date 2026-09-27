import type {
  FinancialContextStatus,
  HudRentLookupResult,
  NearbySalesLookupResult,
} from "@/lib/financial/types";

export const FINANCIAL_CONTEXT_LABELS: Record<FinancialContextStatus, string> =
  {
    FINANCIAL_CONTEXT_NOT_ASSESSED: "Financial context not assessed",
    PUBLIC_MARKET_CONTEXT_AVAILABLE: "Public market context available",
    SCENARIO_CALCULATED: "Scenario calculated",
    FINANCIAL_CONTEXT_PARTIAL: "Financial context partial",
    FINANCIAL_CONTEXT_NOT_EVALUATED: "Financial context not evaluated",
  };

export function resolveFinancialContextStatusFromFlags(input: {
  salesEvaluated: boolean;
  hudEvaluated: boolean;
  scenarioCalculated?: boolean;
}): FinancialContextStatus {
  if (input.scenarioCalculated) {
    return "SCENARIO_CALCULATED";
  }
  if (input.salesEvaluated && input.hudEvaluated) {
    return "PUBLIC_MARKET_CONTEXT_AVAILABLE";
  }
  if (input.salesEvaluated || input.hudEvaluated) {
    return "FINANCIAL_CONTEXT_PARTIAL";
  }
  return "FINANCIAL_CONTEXT_NOT_EVALUATED";
}

export function resolveFinancialContextStatus(input: {
  sales: NearbySalesLookupResult;
  hud: HudRentLookupResult;
  scenarioCalculated?: boolean;
}): FinancialContextStatus {
  return resolveFinancialContextStatusFromFlags({
    salesEvaluated: input.sales.status === "ok",
    hudEvaluated: input.hud.status === "ok",
    scenarioCalculated: input.scenarioCalculated,
  });
}
