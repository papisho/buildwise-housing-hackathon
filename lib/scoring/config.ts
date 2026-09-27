export const SCORING_VERSION = "1.0";

/** Visible in code and UI. Hackathon heuristic from SME relative guidance, not an industry standard. */
export const SCORING_HEURISTIC_LABEL =
  "SME-informed heuristic weights (BuildWise Scoring v1). Not an established industry standard.";

export const COVERAGE_WEIGHTS = {
  parcelIdentity: 15,
  propertyFacts: 10,
  baseZoning: 25,
  steepSlope: 10,
  landslide: 10,
  mine: 15,
  flood: 15,
} as const;

export const COVERAGE_THRESHOLDS = {
  normalMin: 80,
  preliminaryMin: 60,
} as const;

/**
 * Maximum ease points for evaluated evidence only.
 * Missing/unsupported evidence is unscored, not a 0-point penalty.
 */
export const SCORE_WEIGHTS = {
  zoning: 50,
  steepSlope: 20,
  flood: 18,
  mine: 8,
  landslide: 4,
} as const;

export const ZONING_EASE_POINTS = {
  PERMITTED_BY_RIGHT: 50,
  ADMINISTRATOR_EXCEPTION: 36,
  SPECIAL_EXCEPTION: 24,
  CONDITIONAL_USE: 18,
  REQUIRES_VERIFICATION: 20,
  NOT_COMPATIBLE: 0,
} as const;

/** Earned mine points when an evaluated intersection is present (fixed 4-point penalty). */
export const MINE_EASE_POINTS_WHEN_INTERSECT = 4;

/** Earned flood points when an evaluated intersection is present (strong fixed penalty). */
export const FLOOD_EASE_POINTS_WHEN_INTERSECT = 0;

/** Earned landslide points when an evaluated intersection is present. */
export const LANDSLIDE_EASE_POINTS_WHEN_INTERSECT = 0;

export const FLAG_OVERLAP_THRESHOLD_PERCENT = 0;

export const UNIMPLEMENTED_DUE_DILIGENCE_ITEMS = [
  "Dimensional standards",
  "Overlays not separately evaluated",
  "Legal access / frontage",
  "Utilities / service capacity",
  "Stormwater / drainage",
  "Legal lot / title / easements",
  "Certificate of Occupancy / existing legal use",
  "Historic / design review",
  "Financial feasibility",
] as const;

export const SCREENING_STATUS_PRECEDENCE = [
  "MAJOR_REGULATORY_BARRIER_IDENTIFIED",
  "DATA_VERIFICATION_REQUIRED",
  "REVIEW_REQUIRED",
  "NO_MAJOR_CORE_BARRIER_IDENTIFIED",
] as const;
