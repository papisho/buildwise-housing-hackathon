import type { AssessmentLookupResult } from "@/lib/assessments/wprdc";
import type { FloodLookupResult } from "@/lib/hazards/flood";
import type { LandslideLookupResult } from "@/lib/hazards/landslide";
import type { SteepSlopeLookupResult } from "@/lib/hazards/steep-slope";
import type { UnderminedLookupResult } from "@/lib/hazards/undermined";
import type { HistoricDesignationResult } from "@/lib/historic";
import type { RegulatoryRecordsResult } from "@/lib/regulatory";
import type { UseCompatibilityResult } from "@/lib/zoning/compatibility";
import type { ZoningLookupResult } from "@/lib/zoning/pittsburgh";
import {
  SCORING_HEURISTIC_LABEL,
  SCORING_VERSION,
  UNIMPLEMENTED_DUE_DILIGENCE_ITEMS,
} from "@/lib/scoring/config";
import {
  computeEvidenceCoverage,
  type CoverageResult,
} from "@/lib/scoring/coverage";
import {
  buildCriticalFlags,
  type CriticalFlag,
} from "@/lib/scoring/flags";
import {
  computeDevelopmentEaseScore,
  resolveZoningScore,
  type DevelopmentEaseScore,
} from "@/lib/scoring/score";
import {
  computeScreeningStatus,
  SCREENING_STATUS_LABELS,
  type ScreeningStatus,
} from "@/lib/scoring/status";

export type EvidenceGap = {
  label: string;
  state: "NOT_EVALUATED" | "REQUIRES_FURTHER_DUE_DILIGENCE";
  category: "core_source" | "unimplemented" | "regulatory_source" | "historic_source";
};

export type ScorePresentation =
  | {
      mode: "incomplete";
      heading: "Development Ease Score — Incomplete";
      valueLine: "Incomplete";
      caveat: string;
    }
  | {
      mode: "complete";
      heading: "Development Ease Score";
      valueLine: string;
    };

export type DecisionSnapshot = {
  scoringVersion: typeof SCORING_VERSION;
  heuristicLabel: typeof SCORING_HEURISTIC_LABEL;
  score: DevelopmentEaseScore;
  presentation: ScorePresentation;
  screeningStatus: ScreeningStatus;
  screeningStatusLabel: string;
  coverage: CoverageResult;
  flags: CriticalFlag[];
  evidenceGaps: EvidenceGap[];
};

function buildScorePresentation(score: DevelopmentEaseScore): ScorePresentation {
  if (score.complete && score.value !== null) {
    return {
      mode: "complete",
      heading: "Development Ease Score",
      valueLine: String(score.value),
    };
  }

  return {
    mode: "incomplete",
    heading: "Development Ease Score — Incomplete",
    valueLine: "Incomplete",
    caveat:
      score.regulatoryFit.state === "not_evaluated"
        ? "Score unavailable because Regulatory Fit could not be evaluated. Missing evidence is not treated as favorable or as a known penalty."
        : "Score unavailable because one or more physical factors could not be evaluated. Missing evidence is not treated as favorable or as a known penalty.",
  };
}

function buildEvidenceGaps(input: {
  steepSlope: SteepSlopeLookupResult;
  landslide: LandslideLookupResult;
  undermined: UnderminedLookupResult;
  flood: FloodLookupResult;
  useCompatibility?: UseCompatibilityResult;
  zoningResolutionState: "scored" | "not_evaluated";
  regulatoryRecords?: RegulatoryRecordsResult;
  historicDesignation?: HistoricDesignationResult;
}): EvidenceGap[] {
  const evidenceGaps: EvidenceGap[] = [];

  if (input.steepSlope.status !== "ok") {
    evidenceGaps.push({
      label: "Steep slope",
      state: "NOT_EVALUATED",
      category: "core_source",
    });
  }
  if (input.landslide.status !== "ok") {
    evidenceGaps.push({
      label: "Landslide",
      state: "NOT_EVALUATED",
      category: "core_source",
    });
  }
  if (input.undermined.status !== "ok") {
    evidenceGaps.push({
      label: "Mine / undermined",
      state: "NOT_EVALUATED",
      category: "core_source",
    });
  }
  if (input.flood.status !== "ok") {
    evidenceGaps.push({
      label: "Flood",
      state: "NOT_EVALUATED",
      category: "core_source",
    });
  }
  if (
    input.zoningResolutionState === "not_evaluated" ||
    !input.useCompatibility ||
    input.useCompatibility.overallStatus === "NOT_EVALUATED" ||
    input.useCompatibility.overallStatus === "NOT_IDENTIFIED"
  ) {
    evidenceGaps.push({
      label: "Base zoning / proposed-use interpretation",
      state: "NOT_EVALUATED",
      category: "core_source",
    });
  }

  if (input.regulatoryRecords?.permits.status !== "ok") {
    evidenceGaps.push({
      label: "PLI permits",
      state: "NOT_EVALUATED",
      category: "regulatory_source",
    });
  }
  if (input.regulatoryRecords?.violations.status !== "ok") {
    evidenceGaps.push({
      label: "PLI/DOMI/ES violations",
      state: "NOT_EVALUATED",
      category: "regulatory_source",
    });
  }

  if (
    input.historicDesignation &&
    input.historicDesignation.districts.status !== "ok"
  ) {
    evidenceGaps.push({
      label: "City historic districts",
      state: "NOT_EVALUATED",
      category: "historic_source",
    });
  }
  if (
    input.historicDesignation &&
    input.historicDesignation.sites.status !== "ok"
  ) {
    evidenceGaps.push({
      label: "City individual historic sites",
      state: "NOT_EVALUATED",
      category: "historic_source",
    });
  }

  for (const label of UNIMPLEMENTED_DUE_DILIGENCE_ITEMS) {
    evidenceGaps.push({
      label,
      state: "REQUIRES_FURTHER_DUE_DILIGENCE",
      category: "unimplemented",
    });
  }

  return evidenceGaps;
}

export function buildDecisionSnapshot(input: {
  assessment: AssessmentLookupResult;
  zoning: ZoningLookupResult;
  steepSlope: SteepSlopeLookupResult;
  landslide: LandslideLookupResult;
  undermined: UnderminedLookupResult;
  flood: FloodLookupResult;
  useCompatibility?: UseCompatibilityResult;
  regulatoryRecords?: RegulatoryRecordsResult;
  historicDesignation?: HistoricDesignationResult;
}): DecisionSnapshot {
  const coverage = computeEvidenceCoverage(input);
  const zoningResolution = resolveZoningScore({
    zoning: input.zoning,
    useCompatibility: input.useCompatibility,
  });
  const score = computeDevelopmentEaseScore(input);
  const screeningStatus = computeScreeningStatus({
    zoning: input.zoning,
    useCompatibility: input.useCompatibility,
    zoningResolution,
    steepSlope: input.steepSlope,
    landslide: input.landslide,
    undermined: input.undermined,
    flood: input.flood,
  });
  const flags = buildCriticalFlags({
    zoning: input.zoning,
    steepSlope: input.steepSlope,
    landslide: input.landslide,
    undermined: input.undermined,
    flood: input.flood,
    useCompatibility: input.useCompatibility,
    regulatoryRecords: input.regulatoryRecords,
    historicDesignation: input.historicDesignation,
  });

  return {
    scoringVersion: SCORING_VERSION,
    heuristicLabel: SCORING_HEURISTIC_LABEL,
    score,
    presentation: buildScorePresentation(score),
    screeningStatus,
    screeningStatusLabel: SCREENING_STATUS_LABELS[screeningStatus],
    coverage,
    flags,
    evidenceGaps: buildEvidenceGaps({
      steepSlope: input.steepSlope,
      landslide: input.landslide,
      undermined: input.undermined,
      flood: input.flood,
      useCompatibility: input.useCompatibility,
      zoningResolutionState: zoningResolution.state,
      regulatoryRecords: input.regulatoryRecords,
      historicDesignation: input.historicDesignation,
    }),
  };
}
