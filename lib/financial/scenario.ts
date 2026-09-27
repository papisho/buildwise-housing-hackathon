import type {
  DevelopmentScenarioInputs,
  DevelopmentScenarioResult,
} from "@/lib/financial/types";

export function parseOptionalMoney(value: string): number | null {
  const trimmed = value.trim().replaceAll(",", "");
  if (trimmed === "") {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

export function parseOptionalCount(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function calculateDevelopmentScenario(
  inputs: DevelopmentScenarioInputs,
): DevelopmentScenarioResult {
  const otherCosts = inputs.otherCosts;
  const estimatedTotalProjectCost =
    inputs.acquisitionPrice +
    inputs.hardConstructionCost +
    inputs.softCosts +
    inputs.contingency +
    otherCosts;
  const annualGrossScheduledRent =
    inputs.units * inputs.monthlyRentPerUnit * 12;
  return {
    inputs,
    acquisitionCost: inputs.acquisitionPrice,
    totalHardCost: inputs.hardConstructionCost,
    totalSoftCost: inputs.softCosts,
    contingency: inputs.contingency,
    otherCosts,
    estimatedTotalProjectCost,
    annualGrossScheduledRent,
    projectCostPerUnit:
      inputs.units > 0 ? estimatedTotalProjectCost / inputs.units : null,
    annualGrossRentToCostRatio:
      estimatedTotalProjectCost > 0
        ? annualGrossScheduledRent / estimatedTotalProjectCost
        : null,
  };
}

export function tryCalculateDevelopmentScenario(input: {
  acquisitionPrice: string;
  units: string;
  monthlyRentPerUnit: string;
  hardConstructionCost: string;
  softCosts: string;
  contingency: string;
  otherCosts: string;
}): DevelopmentScenarioResult | null {
  const acquisitionPrice = parseOptionalMoney(input.acquisitionPrice);
  const units = parseOptionalCount(input.units);
  const monthlyRentPerUnit = parseOptionalMoney(input.monthlyRentPerUnit);
  const hardConstructionCost = parseOptionalMoney(input.hardConstructionCost);
  const softCosts = parseOptionalMoney(input.softCosts);
  const contingency = parseOptionalMoney(input.contingency);
  const otherRaw = input.otherCosts.trim();
  const otherCosts =
    otherRaw === "" ? 0 : parseOptionalMoney(input.otherCosts);
  if (
    acquisitionPrice === null ||
    units === null ||
    monthlyRentPerUnit === null ||
    hardConstructionCost === null ||
    softCosts === null ||
    contingency === null ||
    otherCosts === null
  ) {
    return null;
  }
  return calculateDevelopmentScenario({
    acquisitionPrice,
    units,
    monthlyRentPerUnit,
    hardConstructionCost,
    softCosts,
    contingency,
    otherCosts,
  });
}
