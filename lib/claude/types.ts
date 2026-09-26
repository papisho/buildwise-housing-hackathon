export type CompactHazardEvidence = {
  status: "EVALUATED" | "NOT_EVALUATED";
  intersects: boolean | null;
  overlap_pct: number | null;
};

export type ClaudeAnalysisInput = {
  analysis_type: "preliminary_development_screening";
  property: {
    address: string;
    parcel_id: string;
    lot_area_sqft: number | null;
    property_class: string | null;
    property_use: string | null;
    assessed_total: number | null;
  };
  proposed_project: {
    type: string;
    label: string;
  };
  zoning: {
    mapped_codes: string[];
    split_zoning: boolean;
    use_status: string;
    use_table_symbol: string | null;
    base_family: string | null;
    citation: string;
  };
  site_conditions: {
    steep_slope: CompactHazardEvidence;
    landslide: CompactHazardEvidence;
    mine: CompactHazardEvidence;
  };
  environment: {
    flood: CompactHazardEvidence & { provenance: string | null };
  };
  score: {
    development_ease: number | null;
    scoring_version: string;
    provisional: true;
    evidence_coverage: number;
    coverage_label: string;
  };
  critical_flags: Array<{
    type: string;
    severity: string;
    title: string;
    finding: string;
  }>;
  not_evaluated: string[];
  recommended_verification: string[];
};

export type ClaudeNarrative = {
  summary: string;
  key_bottlenecks: string[];
  constraint_interactions: string[];
  why_this_matters: string;
  what_could_change_the_result: string[];
  questions_for_human_review: string[];
  limitations: string;
};

export type ClaudeExplanationResult =
  | { status: "ok"; narrative: ClaudeNarrative }
  | { status: "unavailable"; message: string };
