import type { AssessmentLookupResult } from "@/lib/assessments/wprdc";
import type { SteepSlopeLookupResult } from "@/lib/hazards/steep-slope";
import type { ZoningLookupResult } from "@/lib/zoning/pittsburgh";
import { COVERAGE_THRESHOLDS, SCORING_VERSION } from "@/lib/scoring/config";
import {
  computeEvidenceCoverage,
  type CoverageResult,
} from "@/lib/scoring/coverage";
import {
  buildCriticalFlags,
  type CriticalFlag,
} from "@/lib/scoring/flags";
import {
  computeProvisionalScore,
  type ProvisionalScore,
} from "@/lib/scoring/score";

export type EvidenceGap = {
  label: string;
  state: "NOT_EVALUATED";
};

export type ScorePresentation =
  | {
      mode: "incomplete";
      heading: "Provisional Ease Score";
      valueLine: string;
      caveat: "Not a complete Development Ease Score — only currently evaluated/scored constraints are included.";
      scoredFactorsLine: string;
    }
  | {
      mode: "complete";
      heading: "Development Ease Score";
      valueLine: string;
    };

export type DecisionSnapshot = {
  scoringVersion: typeof SCORING_VERSION;
  score: ProvisionalScore;
  presentation: ScorePresentation;
  coverage: CoverageResult;
  flags: CriticalFlag[];
  evidenceGaps: EvidenceGap[];
};

function buildScorePresentation(
  coveragePercent: number,
  score: ProvisionalScore,
): ScorePresentation {
  const complete =
    coveragePercent >= COVERAGE_THRESHOLDS.normalMin &&
    score.scoredFactorCount >= 2 &&
    score.value !== null;

  if (complete) {
    return {
      mode: "complete",
      heading: "Development Ease Score",
      valueLine: String(score.value),
    };
  }

  const valueLine =
    score.value === null
      ? "not available / 100 of currently scored evidence"
      : `${score.value} / 100 of currently scored evidence`;

  return {
    mode: "incomplete",
    heading: "Provisional Ease Score",
    valueLine,
    caveat:
      "Not a complete Development Ease Score — only currently evaluated/scored constraints are included.",
    scoredFactorsLine: `Scored factors: ${score.scoredFactorCount}`,
  };
}

export function buildDecisionSnapshot(input: {
  assessment: AssessmentLookupResult;
  zoning: ZoningLookupResult;
  steepSlope: SteepSlopeLookupResult;
}): DecisionSnapshot {
  const coverage = computeEvidenceCoverage(input);
  const score = computeProvisionalScore(input.steepSlope);
  const flags = buildCriticalFlags(input.steepSlope);

  return {
    scoringVersion: SCORING_VERSION,
    score,
    presentation: buildScorePresentation(coverage.percent, score),
    coverage,
    flags,
    evidenceGaps: [
      { label: "Landslide", state: "NOT_EVALUATED" },
      { label: "Mine / undermined", state: "NOT_EVALUATED" },
      { label: "Flood", state: "NOT_EVALUATED" },
      { label: "Detailed zoning/use compatibility", state: "NOT_EVALUATED" },
    ],
  };
}
