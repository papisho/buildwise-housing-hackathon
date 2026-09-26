export const SCORING_VERSION = "0.1";

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

export const SCOREABLE_FACTORS = {
  steepSlope: {
    maxContribution: 10,
  },
} as const;

export const FLAG_OVERLAP_THRESHOLD_PERCENT = 0;
