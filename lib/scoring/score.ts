import type { FloodLookupResult } from "@/lib/hazards/flood";
import type { LandslideLookupResult } from "@/lib/hazards/landslide";
import type { SteepSlopeLookupResult } from "@/lib/hazards/steep-slope";
import type { UnderminedLookupResult } from "@/lib/hazards/undermined";
import type {
  UseCompatibilityResult,
  UseTableStatus,
} from "@/lib/zoning/compatibility";
import type { ZoningLookupResult } from "@/lib/zoning/pittsburgh";
import {
  FLOOD_EASE_POINTS_WHEN_INTERSECT,
  LANDSLIDE_EASE_POINTS_WHEN_INTERSECT,
  MINE_EASE_POINTS_WHEN_INTERSECT,
  SCORE_WEIGHTS,
  SCORING_HEURISTIC_LABEL,
  SCORING_VERSION,
  ZONING_EASE_POINTS,
} from "@/lib/scoring/config";

export type ScoredZoningStatus = keyof typeof ZONING_EASE_POINTS;

export type FactorContribution = {
  id: "zoning" | "steepSlope" | "flood" | "mine" | "landslide";
  label: string;
  maxPoints: number;
  earnedPoints: number | null;
  state: "scored" | "not_evaluated";
  note: string;
};

export type ZoningScoreResolution =
  | {
      state: "scored";
      status: ScoredZoningStatus;
      points: number;
      parcelWideIncompatible: boolean;
      note: string;
    }
  | {
      state: "not_evaluated";
      reason: string;
      parcelWideIncompatible: false;
    };

export type DevelopmentEaseScore = {
  complete: boolean;
  value: number | null;
  formula: string;
  heuristicLabel: typeof SCORING_HEURISTIC_LABEL;
  scoringVersion: typeof SCORING_VERSION;
  regulatoryFit: {
    state: "scored" | "not_evaluated";
    earned: number | null;
    max: number;
    display: string;
  };
  physicalSite: {
    complete: boolean;
    earned: number | null;
    max: number;
    evaluatedEarned: number;
    evaluatedMax: number;
    display: string;
  };
  contributions: FactorContribution[];
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

export function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function isScoredZoningStatus(status: UseTableStatus): status is ScoredZoningStatus {
  return status in ZONING_EASE_POINTS;
}

export function resolveZoningScore(input: {
  zoning: ZoningLookupResult;
  useCompatibility?: UseCompatibilityResult;
}): ZoningScoreResolution {
  const use = input.useCompatibility;
  if (!use || use.overallStatus === "NOT_EVALUATED" || use.districts.length === 0) {
    return {
      state: "not_evaluated",
      reason:
        "Regulatory Fit is Not Evaluated because mapped zoning or proposed-use lookup was not available.",
      parcelWideIncompatible: false,
    };
  }

  const statuses = use.districts.map((district) => district.status);
  const split = input.zoning.status === "ok" && input.zoning.splitZoning;

  if (statuses.every((status) => status === "NOT_COMPATIBLE")) {
    return {
      state: "scored",
      status: "NOT_COMPATIBLE",
      points: ZONING_EASE_POINTS.NOT_COMPATIBLE,
      parcelWideIncompatible: true,
      note: split
        ? "Every intersecting district is NOT_COMPATIBLE in the encoded use table."
        : "Preliminary use-table cell is NOT_COMPATIBLE.",
    };
  }

  if (split) {
    const unique = new Set(statuses);
    const only = statuses[0];
    if (unique.size === 1 && only && isScoredZoningStatus(only)) {
      return {
        state: "scored",
        status: only,
        points: ZONING_EASE_POINTS[only],
        parcelWideIncompatible: false,
        note: "All intersecting districts share this scored status; controlling district still requires verification.",
      };
    }
    return {
      state: "not_evaluated",
      reason:
        "Split zoning: controlling district depends on the proposed development envelope. Regulatory Fit is not scored.",
      parcelWideIncompatible: false,
    };
  }

  const only = statuses[0];
  if (!only || only === "NOT_IDENTIFIED" || only === "NOT_EVALUATED") {
    return {
      state: "not_evaluated",
      reason:
        only === "NOT_IDENTIFIED"
          ? "Mapped district is not in the encoded use table. Regulatory Fit is Not Evaluated / interpretation required."
          : "Regulatory Fit is Not Evaluated.",
      parcelWideIncompatible: false,
    };
  }

  if (isScoredZoningStatus(only)) {
    return {
      state: "scored",
      status: only,
      points: ZONING_EASE_POINTS[only],
      parcelWideIncompatible: only === "NOT_COMPATIBLE",
      note: "Preliminary § 911.02 use-table result only.",
    };
  }

  return {
    state: "not_evaluated",
    reason: "Regulatory Fit could not be scored from the preliminary use-table result.",
    parcelWideIncompatible: false,
  };
}

function scoreSteepSlope(steepSlope: SteepSlopeLookupResult): FactorContribution {
  const maxPoints = SCORE_WEIGHTS.steepSlope;
  if (steepSlope.status !== "ok") {
    return {
      id: "steepSlope",
      label: "Steep slope",
      maxPoints,
      earnedPoints: null,
      state: "not_evaluated",
      note: "Steep slope source was not evaluated. Missing evidence is not a known slope penalty.",
    };
  }
  if (!steepSlope.intersects) {
    return {
      id: "steepSlope",
      label: "Steep slope",
      maxPoints,
      earnedPoints: maxPoints,
      state: "scored",
      note: "No mapped ≥25% slope intersection.",
    };
  }
  if (
    steepSlope.overlapPercent === null ||
    !Number.isFinite(steepSlope.overlapPercent)
  ) {
    return {
      id: "steepSlope",
      label: "Steep slope",
      maxPoints,
      earnedPoints: null,
      state: "not_evaluated",
      note: "Slope intersects but overlap percent is unknown, so the numeric slope factor is unscored.",
    };
  }
  const overlap = clampPercent(steepSlope.overlapPercent);
  const earned = roundOneDecimal(maxPoints * (1 - overlap / 100));
  return {
    id: "steepSlope",
    label: "Steep slope",
    maxPoints,
    earnedPoints: earned,
    state: "scored",
    note: `${maxPoints} × (1 − ${overlap}/100) = ${earned}. Overlap is evidence; penalty scales with affected area.`,
  };
}

function scoreBinaryHazard(input: {
  id: FactorContribution["id"];
  label: string;
  maxPoints: number;
  earnedWhenIntersect: number;
  evidence:
    | LandslideLookupResult
    | UnderminedLookupResult
    | FloodLookupResult;
  overlapNote: string;
}): FactorContribution {
  if (input.evidence.status !== "ok") {
    return {
      id: input.id,
      label: input.label,
      maxPoints: input.maxPoints,
      earnedPoints: null,
      state: "not_evaluated",
      note: `${input.label} source was not evaluated. Missing evidence is not a known development penalty.`,
    };
  }
  if (!input.evidence.intersects) {
    return {
      id: input.id,
      label: input.label,
      maxPoints: input.maxPoints,
      earnedPoints: input.maxPoints,
      state: "scored",
      note: `No mapped ${input.label.toLowerCase()} intersection.`,
    };
  }
  const overlap =
    input.evidence.overlapPercent !== null
      ? ` Overlap ${input.evidence.overlapPercent.toFixed(1)}% is shown as evidence and is not used in a continuous formula.`
      : "";
  return {
    id: input.id,
    label: input.label,
    maxPoints: input.maxPoints,
    earnedPoints: input.earnedWhenIntersect,
    state: "scored",
    note: `${input.overlapNote}${overlap}`,
  };
}

export function computeDevelopmentEaseScore(input: {
  zoning: ZoningLookupResult;
  useCompatibility?: UseCompatibilityResult;
  steepSlope: SteepSlopeLookupResult;
  landslide: LandslideLookupResult;
  undermined: UnderminedLookupResult;
  flood: FloodLookupResult;
}): DevelopmentEaseScore {
  const zoningResolution = resolveZoningScore(input);
  const zoningContribution: FactorContribution =
    zoningResolution.state === "scored"
      ? {
          id: "zoning",
          label: "Base zoning + proposed use",
          maxPoints: SCORE_WEIGHTS.zoning,
          earnedPoints: zoningResolution.points,
          state: "scored",
          note: zoningResolution.note,
        }
      : {
          id: "zoning",
          label: "Base zoning + proposed use",
          maxPoints: SCORE_WEIGHTS.zoning,
          earnedPoints: null,
          state: "not_evaluated",
          note: zoningResolution.reason,
        };

  const contributions: FactorContribution[] = [
    zoningContribution,
    scoreSteepSlope(input.steepSlope),
    scoreBinaryHazard({
      id: "flood",
      label: "Flood",
      maxPoints: SCORE_WEIGHTS.flood,
      earnedWhenIntersect: FLOOD_EASE_POINTS_WHEN_INTERSECT,
      evidence: input.flood,
      overlapNote:
        "Mapped flood-hazard intersection: strong fixed penalty (0/18 earned).",
    }),
    scoreBinaryHazard({
      id: "mine",
      label: "Mine / undermined",
      maxPoints: SCORE_WEIGHTS.mine,
      earnedWhenIntersect: MINE_EASE_POINTS_WHEN_INTERSECT,
      evidence: input.undermined,
      overlapNote:
        "Mapped mine/undermined intersection: fixed 4-point penalty (4/8 earned).",
    }),
    scoreBinaryHazard({
      id: "landslide",
      label: "Landslide-prone",
      maxPoints: SCORE_WEIGHTS.landslide,
      earnedWhenIntersect: LANDSLIDE_EASE_POINTS_WHEN_INTERSECT,
      evidence: input.landslide,
      overlapNote:
        "Mapped landslide-prone intersection: small fixed penalty (0/4 earned).",
    }),
  ];

  const regulatory = contributions[0];
  const physical = contributions.slice(1);
  const physicalScored = physical.filter((item) => item.state === "scored");
  const physicalComplete = physicalScored.length === physical.length;
  const evaluatedEarned = roundOneDecimal(
    physicalScored.reduce((sum, item) => sum + (item.earnedPoints ?? 0), 0),
  );
  const evaluatedMax = physicalScored.reduce((sum, item) => sum + item.maxPoints, 0);
  const complete =
    regulatory.state === "scored" &&
    physicalComplete &&
    contributions.every((item) => item.state === "scored");

  const totalEarned = complete
    ? roundOneDecimal(
        contributions.reduce((sum, item) => sum + (item.earnedPoints ?? 0), 0),
      )
    : null;

  const formulaParts = contributions.map((item) =>
    item.state === "scored"
      ? `${item.id}=${item.earnedPoints}/${item.maxPoints}`
      : `${item.id}=unscored/${item.maxPoints}`,
  );

  const formula = complete
    ? `${SCORING_HEURISTIC_LABEL} Score = ${formulaParts.join(" + ")} = ${totalEarned}.`
    : `${SCORING_HEURISTIC_LABEL} Development Ease Score is Incomplete. Evaluated factors: ${formulaParts.join("; ")}. Missing evidence is not treated as a known penalty or as favorable.`;

  return {
    complete,
    value: totalEarned,
    formula,
    heuristicLabel: SCORING_HEURISTIC_LABEL,
    scoringVersion: SCORING_VERSION,
    regulatoryFit: {
      state: regulatory.state,
      earned: regulatory.earnedPoints,
      max: SCORE_WEIGHTS.zoning,
      display:
        regulatory.state === "scored"
          ? `${regulatory.earnedPoints}/${SCORE_WEIGHTS.zoning}`
          : "Not Evaluated / interpretation required",
    },
    physicalSite: {
      complete: physicalComplete,
      earned: physicalComplete ? evaluatedEarned : null,
      max: SCORE_WEIGHTS.steepSlope + SCORE_WEIGHTS.flood + SCORE_WEIGHTS.mine + SCORE_WEIGHTS.landslide,
      evaluatedEarned,
      evaluatedMax,
      display: physicalComplete
        ? `${evaluatedEarned}/${SCORE_WEIGHTS.steepSlope + SCORE_WEIGHTS.flood + SCORE_WEIGHTS.mine + SCORE_WEIGHTS.landslide} evaluated`
        : `Incomplete (${evaluatedEarned}/${evaluatedMax} from evaluated physical factors)`,
    },
    contributions,
  };
}
