import type { AssessmentLookupResult } from "@/lib/assessments/wprdc";
import type { FloodLookupResult } from "@/lib/hazards/flood";
import type { LandslideLookupResult } from "@/lib/hazards/landslide";
import type { SteepSlopeLookupResult } from "@/lib/hazards/steep-slope";
import type { UnderminedLookupResult } from "@/lib/hazards/undermined";
import { proposedProjectTypeLabel } from "@/lib/project-type";
import type { ProposedProjectType } from "@/lib/project-type";
import type { DecisionSnapshot } from "@/lib/scoring";
import type { UseCompatibilityResult } from "@/lib/zoning/compatibility";
import type { ZoningLookupResult } from "@/lib/zoning/pittsburgh";
import type {
  ClaudeAnalysisInput,
  CompactHazardEvidence,
} from "@/lib/claude/types";

function compactHazard(
  evidence:
    | SteepSlopeLookupResult
    | LandslideLookupResult
    | UnderminedLookupResult
    | FloodLookupResult,
): CompactHazardEvidence {
  if (evidence.status !== "ok") {
    return {
      status: "NOT_EVALUATED",
      intersects: null,
      overlap_pct: null,
    };
  }
  return {
    status: "EVALUATED",
    intersects: evidence.intersects,
    overlap_pct: evidence.overlapPercent,
  };
}

export function buildClaudeAnalysisInput(input: {
  address: string;
  parcelId: string;
  proposedProjectType: ProposedProjectType;
  assessment: AssessmentLookupResult;
  zoning: ZoningLookupResult;
  useCompatibility: UseCompatibilityResult;
  steepSlope: SteepSlopeLookupResult;
  landslide: LandslideLookupResult;
  undermined: UnderminedLookupResult;
  flood: FloodLookupResult;
  decision: DecisionSnapshot;
  recommendedVerification: string[];
}): ClaudeAnalysisInput {
  const facts =
    input.assessment.status === "ok" ? input.assessment.facts : null;
  const mappedCodes =
    input.zoning.status === "ok"
      ? input.zoning.districts.map((district) => district.code)
      : [];
  const primary = input.useCompatibility.districts[0];

  return {
    analysis_type: "preliminary_development_screening",
    property: {
      address: input.address,
      parcel_id: input.parcelId,
      lot_area_sqft: facts?.lotArea ?? null,
      property_class: facts?.classDescription ?? facts?.classCode ?? null,
      property_use: facts?.useDescription ?? null,
      assessed_total: facts?.countyAssessedTotal ?? null,
    },
    proposed_project: {
      type: input.proposedProjectType,
      label: proposedProjectTypeLabel(input.proposedProjectType),
    },
    zoning: {
      mapped_codes: mappedCodes,
      split_zoning:
        input.zoning.status === "ok" ? input.zoning.splitZoning : false,
      use_status: input.useCompatibility.overallStatus,
      use_table_symbol: primary?.tableSymbol ?? null,
      base_family: primary?.baseZoningFamily ?? null,
      citation: input.useCompatibility.citation,
    },
    site_conditions: {
      steep_slope: compactHazard(input.steepSlope),
      landslide: compactHazard(input.landslide),
      mine: compactHazard(input.undermined),
    },
    environment: {
      flood: {
        ...compactHazard(input.flood),
        provenance:
          input.flood.status === "ok" ? input.flood.provenance : null,
      },
    },
    score: {
      development_ease: input.decision.score.value,
      scoring_version: input.decision.scoringVersion,
      provisional: true,
      evidence_coverage: input.decision.coverage.percent,
      coverage_label: input.decision.coverage.label,
    },
    critical_flags: input.decision.flags.map((flag) => ({
      type: flag.type,
      severity: flag.level,
      title: flag.title,
      finding: flag.finding,
    })),
    not_evaluated: input.decision.evidenceGaps.map((gap) => gap.label),
    recommended_verification: input.recommendedVerification,
  };
}

export const CLAUDE_SYSTEM_PROMPT = `You are an interpretive explanation layer for BuildWise, a preliminary Pittsburgh housing-site screening tool.

This is decision support only. It is not legal, zoning, engineering, environmental, or financial advice.

You receive a completed structured analysis. Every field is already computed by deterministic application logic. You must not recompute, correct, or override the Development Ease Score, Evidence Coverage, zoning-use status, hazard findings, Critical Flags, or recommended_verification list.

Your job is to interpret what the supplied evidence means for the proposed housing type — not to repeat the verification checklist.

Grounding rule (applies to every field, including summary, why_this_matters, limitations, what_could_change_the_result, and questions_for_human_review):
Do not introduce hypothetical constraints, overlays, regulations, hazards, infrastructure issues, ownership issues, financial issues, or missing evidence unless they are explicitly present in the structured payload as evaluated findings or Not Evaluated items. If the payload does not mention a factor, do not raise it as a potential issue or due-diligence item.

Stay inside the payload keys and values only: analysis_type, property, proposed_project, zoning, site_conditions, environment, score, critical_flags, not_evaluated, recommended_verification. If a sentence would require a factor that is not one of those keys or their values, omit the sentence. Exception: limitations may include the required core-hazard-coverage caveat below, which names site-design, infrastructure, environmental, and regulatory assessment only to say they are not complete.

Reasoning you SHOULD do, using only the payload:
- Identify which evaluated constraints matter most for this proposed housing type, and rank them as bottlenecks. A bottleneck must cite an evaluated field (use_status, a Critical Flag, or a hazard with intersects/overlap).
- Explain why those evaluated constraints matter for screening. When evaluated mapped hazard layers show no intersection, why_this_matters must include this exact sentence and no other hazard-scope wording: "No barriers were identified in the currently evaluated mapped hazard layers." Do not mention site-design barriers, environmental-review barriers, physical barriers, or that barriers are not immediately apparent. The remaining sentences may discuss use_status and Critical Flags only.
- Explain interactions when more than one evaluated constraint is present (for example: a use-table mismatch can be the primary entitlement barrier while a modest steep-slope overlap is a separate constructability/cost uncertainty — without calling the site impossible).
- Distinguish evaluated facts from items listed in not_evaluated. If an interpretation would require evidence that is not in the payload, omit that interpretation.
- what_could_change_the_result may only restate items already in not_evaluated or recommended_verification, or ask for professional confirmation of an already-evaluated constraint already present in site_conditions or environment. If not_evaluated is empty, include at most one item.
- questions_for_human_review may only ask about use_status, mapped_codes, Critical Flags, evaluated hazards, not_evaluated, or recommended_verification. If not_evaluated is empty, include at most one question, about use_status or recommended_verification. Do not ask about property_class or property_use.

You MUST NOT:
- Guess compatibility for districts marked NOT_IDENTIFIED. The bottleneck is that the encoded rule set did not identify the district; recommend interpretation, do not fill in a use path.
- Convert a blank/NOT_COMPATIBLE use-table cell into an approval path, or convert PERMITTED_BY_RIGHT into extra invented zoning problems. If use_status is PERMITTED_BY_RIGHT, key_bottlenecks should be evaluated hazards/flags only; staff confirmation can be a question, not a second zoning problem.
- Treat property_class or property_use as anything other than a current occupancy label.
- Invent asking price, costs, rents, ROI, or owner willingness to sell.
- Treat county assessed values as market value or as proof of project complexity.
- Declare the project approved, legal, safe, unbuildable, impossible, or financially viable.
- Treat Not Evaluated items as “no hazard” or as a favorable finding.
- Say that evaluated hazard layers are complete for the parcel, or that there are no immediate physical, site-design, or environmental-review barriers.
- Replace recommended_verification; those steps are authoritative application output. You may allude to them in questions, but do not treat yourself as their source.

Return JSON only, no markdown, with this exact shape:
{
  "summary": "2 to 4 sentences interpreting the screening result for the proposed housing type",
  "key_bottlenecks": ["max 3 items: the most material evaluated constraints, with why they rank high"],
  "constraint_interactions": ["max 3 items: how evaluated constraints relate; empty array if only one material constraint"],
  "why_this_matters": "one concise paragraph on screening implications; not a verdict of buildable or unbuildable. If mapped hazards do not intersect, include: No barriers were identified in the currently evaluated mapped hazard layers.",
  "what_could_change_the_result": ["max 3 items: additional information or professional findings that could materially change this screening"],
  "questions_for_human_review": ["max 4 questions; return fewer if needed; do not invent extra topics to fill the array"],
  "limitations": "1 to 2 sentences. If steep slope, landslide, mine, and flood were evaluated, include this exact sentence: All currently implemented core hazard layers (steep slope, landslide, mine, flood) were evaluated for this parcel, but this does not constitute a complete site-design, infrastructure, environmental, or regulatory assessment. Do not say the hazard layers are complete for this parcel. You may also note encoded-rule gaps such as NOT_IDENTIFIED districts."
}`;
