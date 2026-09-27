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
    districts: Array<{
      code: string;
      intersection_area_sqft: number | null;
      intersection_percent: number | null;
    }>;
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
  regulatory_records: {
    overall_status: string;
    overall_status_label: string;
    parcel_id: string;
    permit_count: number;
    unresolved_permit_count: number;
    violation_count: number;
    unresolved_violation_count: number;
    permits_source_status: "EVALUATED" | "NOT_EVALUATED";
    violations_source_status: "EVALUATED" | "NOT_EVALUATED";
    permits: Array<{
      permit_id: string;
      permit_type: string | null;
      status: string | null;
      issue_date: string | null;
      completion_date: string | null;
      work_type: string | null;
      work_description: string | null;
      review_class: string;
    }>;
    violations: Array<{
      casefile_number: string;
      department: string | null;
      status: string | null;
      opened_date: string | null;
      closed_date: string | null;
      category: string | null;
      description: string | null;
      review_class: string;
    }>;
    limitations: string[];
  };
  historic_designation: {
    overall_status: string;
    overall_status_label: string;
    parcel_id: string;
    partial_evidence: boolean;
    unevaluated_layers: string[];
    districts_source_status: "EVALUATED" | "NOT_EVALUATED";
    sites_source_status: "EVALUATED" | "NOT_EVALUATED";
    district_intersects: boolean | null;
    district_names: string[];
    district_overlap_pct: number | null;
    site_intersects: boolean | null;
    site_names: string[];
    site_overlap_pct: number | null;
    message: string;
    limitations: string[];
  };
  overall_screening_status: string;
  score: {
    development_ease: number | null;
    score_complete: boolean;
    scoring_version: string;
    heuristic_label: string;
    screening_status: string;
    provisional: true;
    evidence_coverage: number;
    coverage_label: string;
    regulatory_fit: {
      state: string;
      earned: number | null;
      max: number;
      display: string;
    };
    physical_site: {
      complete: boolean;
      earned: number | null;
      max: number;
      display: string;
    };
    factor_contributions: Array<{
      id: string;
      label: string;
      max_points: number;
      earned_points: number | null;
      state: string;
      note: string;
    }>;
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

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type ParcelChatResult =
  | { status: "ok"; reply: string }
  | { status: "unavailable"; message: string };
