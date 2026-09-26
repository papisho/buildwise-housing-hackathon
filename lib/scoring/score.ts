import type { SteepSlopeLookupResult } from "@/lib/hazards/steep-slope";
import { SCOREABLE_FACTORS } from "@/lib/scoring/config";

export type ProvisionalScore = {
  value: number | null;
  availableEvaluatedPoints: number;
  earnedEvaluatedPoints: number;
  scoredFactorCount: number;
  formula: string;
};

function clampPercent(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function computeProvisionalScore(
  steepSlope: SteepSlopeLookupResult,
): ProvisionalScore {
  let available = 0;
  let earned = 0;
  let scoredFactorCount = 0;
  const parts: string[] = [];

  if (
    steepSlope.status === "ok" &&
    steepSlope.overlapPercent !== null &&
    Number.isFinite(steepSlope.overlapPercent)
  ) {
    const overlap = clampPercent(steepSlope.overlapPercent);
    const max = SCOREABLE_FACTORS.steepSlope.maxContribution;
    const ease = 1 - overlap / 100;
    available += max;
    earned += max * ease;
    scoredFactorCount += 1;
    parts.push(
      `steepSlope: ${max} * (1 - ${overlap}/100) = ${roundOneDecimal(max * ease)}`,
    );
  }

  if (available <= 0) {
    return {
      value: null,
      availableEvaluatedPoints: 0,
      earnedEvaluatedPoints: 0,
      scoredFactorCount: 0,
      formula:
        "No scoreable constraint measurement was evaluated. Missing evidence is not treated as zero constraint.",
    };
  }

  const value = roundOneDecimal((earned / available) * 100);
  return {
    value,
    availableEvaluatedPoints: available,
    earnedEvaluatedPoints: roundOneDecimal(earned),
    scoredFactorCount,
    formula: `${parts.join("; ")}; normalized = earned/available * 100 = ${value}`,
  };
}
