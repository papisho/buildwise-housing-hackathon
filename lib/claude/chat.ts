import {
  CLAUDE_CHAT_UNAVAILABLE_MESSAGE,
  MAX_CHAT_HISTORY_MESSAGES,
  MAX_CHAT_TURN_CHARS,
  MAX_CHAT_USER_CHARS,
} from "@/lib/claude/chat-limits";
import { CLAUDE_CHAT_SYSTEM_PROMPT } from "@/lib/claude/payload";
import { readClaudeApiKey, readClaudeModel } from "@/lib/claude/env";
import type {
  ChatTurn,
  ClaudeAnalysisInput,
  CompactHazardEvidence,
  ParcelChatResult,
} from "@/lib/claude/types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const REQUEST_TIMEOUT_MS = 35_000;

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function asStringOrNull(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

function asNumberOrNull(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  if (!value.every((item) => typeof item === "string")) {
    return null;
  }
  return value;
}

function parseHazard(value: unknown): CompactHazardEvidence | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.status !== "EVALUATED" && value.status !== "NOT_EVALUATED") {
    return null;
  }
  if (value.intersects !== null && typeof value.intersects !== "boolean") {
    return null;
  }
  if (value.overlap_pct !== null && typeof value.overlap_pct !== "number") {
    return null;
  }
  return {
    status: value.status,
    intersects: value.intersects,
    overlap_pct: value.overlap_pct,
  };
}

function parseNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

function parseRegulatoryRecords(
  value: unknown,
): ClaudeAnalysisInput["regulatory_records"] | null {
  if (!isRecord(value)) {
    return null;
  }
  const overallStatus = asString(value.overall_status);
  const overallLabel = asString(value.overall_status_label);
  const regulatoryParcelId = asString(value.parcel_id);
  const permitCount = asNumberOrNull(value.permit_count);
  const unresolvedPermitCount = asNumberOrNull(value.unresolved_permit_count);
  const violationCount = asNumberOrNull(value.violation_count);
  const unresolvedViolationCount = asNumberOrNull(
    value.unresolved_violation_count,
  );
  if (
    !overallStatus ||
    !overallLabel ||
    !regulatoryParcelId ||
    permitCount === undefined ||
    permitCount === null ||
    unresolvedPermitCount === undefined ||
    unresolvedPermitCount === null ||
    violationCount === undefined ||
    violationCount === null ||
    unresolvedViolationCount === undefined ||
    unresolvedViolationCount === null
  ) {
    return null;
  }
  if (
    value.permits_source_status !== "EVALUATED" &&
    value.permits_source_status !== "NOT_EVALUATED"
  ) {
    return null;
  }
  if (
    value.violations_source_status !== "EVALUATED" &&
    value.violations_source_status !== "NOT_EVALUATED"
  ) {
    return null;
  }
  if (!Array.isArray(value.permits) || !Array.isArray(value.violations)) {
    return null;
  }
  const permits: ClaudeAnalysisInput["regulatory_records"]["permits"] = [];
  for (const item of value.permits) {
    if (!isRecord(item)) {
      return null;
    }
    const permitId = asString(item.permit_id);
    const reviewClass = asString(item.review_class);
    const permitType = parseNullableString(item.permit_type);
    const status = parseNullableString(item.status);
    const issueDate = parseNullableString(item.issue_date);
    const completionDate = parseNullableString(item.completion_date);
    const workType = parseNullableString(item.work_type);
    const workDescription = parseNullableString(item.work_description);
    if (
      !permitId ||
      !reviewClass ||
      permitType === undefined ||
      status === undefined ||
      issueDate === undefined ||
      completionDate === undefined ||
      workType === undefined ||
      workDescription === undefined
    ) {
      return null;
    }
    permits.push({
      permit_id: permitId,
      permit_type: permitType,
      status,
      issue_date: issueDate,
      completion_date: completionDate,
      work_type: workType,
      work_description: workDescription,
      review_class: reviewClass,
    });
  }
  const violations: ClaudeAnalysisInput["regulatory_records"]["violations"] =
    [];
  for (const item of value.violations) {
    if (!isRecord(item)) {
      return null;
    }
    const casefile = asString(item.casefile_number);
    const reviewClass = asString(item.review_class);
    const department = parseNullableString(item.department);
    const status = parseNullableString(item.status);
    const opened = parseNullableString(item.opened_date);
    const closed = parseNullableString(item.closed_date);
    const category = parseNullableString(item.category);
    const description = parseNullableString(item.description);
    if (
      !casefile ||
      !reviewClass ||
      department === undefined ||
      status === undefined ||
      opened === undefined ||
      closed === undefined ||
      category === undefined ||
      description === undefined
    ) {
      return null;
    }
    violations.push({
      casefile_number: casefile,
      department,
      status,
      opened_date: opened,
      closed_date: closed,
      category,
      description,
      review_class: reviewClass,
    });
  }
  const limitations = asStringArray(value.limitations);
  if (!limitations) {
    return null;
  }
  return {
    overall_status: overallStatus,
    overall_status_label: overallLabel,
    parcel_id: regulatoryParcelId,
    permit_count: permitCount,
    unresolved_permit_count: unresolvedPermitCount,
    violation_count: violationCount,
    unresolved_violation_count: unresolvedViolationCount,
    permits_source_status: value.permits_source_status,
    violations_source_status: value.violations_source_status,
    permits,
    violations,
    limitations,
  };
}

function parseHistoricDesignation(
  value: unknown,
): ClaudeAnalysisInput["historic_designation"] | null {
  if (!isRecord(value)) {
    return null;
  }
  const overallStatus = asString(value.overall_status);
  const overallLabel = asString(value.overall_status_label);
  const parcelId = asString(value.parcel_id);
  const message = asString(value.message);
  const districtNames = asStringArray(value.district_names);
  const siteNames = asStringArray(value.site_names);
  const limitations = asStringArray(value.limitations);
  const unevaluatedLayers = asStringArray(value.unevaluated_layers);
  const districtOverlap = asNumberOrNull(value.district_overlap_pct);
  const siteOverlap = asNumberOrNull(value.site_overlap_pct);
  if (
    !overallStatus ||
    !overallLabel ||
    !parcelId ||
    !message ||
    !districtNames ||
    !siteNames ||
    !limitations ||
    !unevaluatedLayers ||
    typeof value.partial_evidence !== "boolean" ||
    districtOverlap === undefined ||
    siteOverlap === undefined
  ) {
    return null;
  }
  if (
    value.districts_source_status !== "EVALUATED" &&
    value.districts_source_status !== "NOT_EVALUATED"
  ) {
    return null;
  }
  if (
    value.sites_source_status !== "EVALUATED" &&
    value.sites_source_status !== "NOT_EVALUATED"
  ) {
    return null;
  }
  if (
    value.district_intersects !== null &&
    typeof value.district_intersects !== "boolean"
  ) {
    return null;
  }
  if (
    value.site_intersects !== null &&
    typeof value.site_intersects !== "boolean"
  ) {
    return null;
  }
  return {
    overall_status: overallStatus,
    overall_status_label: overallLabel,
    parcel_id: parcelId,
    partial_evidence: value.partial_evidence,
    unevaluated_layers: unevaluatedLayers,
    districts_source_status: value.districts_source_status,
    sites_source_status: value.sites_source_status,
    district_intersects: value.district_intersects,
    district_names: districtNames,
    district_overlap_pct: districtOverlap,
    site_intersects: value.site_intersects,
    site_names: siteNames,
    site_overlap_pct: siteOverlap,
    message,
    limitations,
  };
}

function parseFinancialContext(
  value: unknown,
): ClaudeAnalysisInput["financial_context"] | null {
  if (!isRecord(value)) {
    return null;
  }
  const overallStatus = asString(value.overall_status);
  const overallLabel = asString(value.overall_status_label);
  const parcelId = asString(value.parcel_id);
  const limitations = asStringArray(value.limitations);
  if (
    !overallStatus ||
    !overallLabel ||
    !parcelId ||
    !limitations ||
    (value.sales_source_status !== "EVALUATED" &&
      value.sales_source_status !== "NOT_EVALUATED") ||
    (value.hud_source_status !== "EVALUATED" &&
      value.hud_source_status !== "NOT_EVALUATED") ||
    !Array.isArray(value.nearby_sales)
  ) {
    return null;
  }
  const nearbySales: ClaudeAnalysisInput["financial_context"]["nearby_sales"] =
    [];
  for (const item of value.nearby_sales) {
    if (!isRecord(item) || item.provenance !== "PUBLIC_DATA") {
      return null;
    }
    const parid = asString(item.parid);
    const saleCode = asString(item.sale_code);
    const saleDescription = asString(item.sale_description);
    const price = asNumberOrNull(item.price);
    const distance = asNumberOrNull(item.distance_ft);
    if (
      !parid ||
      !saleCode ||
      !saleDescription ||
      price === undefined ||
      price === null ||
      distance === undefined ||
      distance === null
    ) {
      return null;
    }
    const address = asStringOrNull(item.address);
    const saleDate = asStringOrNull(item.sale_date);
    const useDescription = asStringOrNull(item.use_description);
    const lotArea = asNumberOrNull(item.lot_area_sqft);
    const yearBuilt = asNumberOrNull(item.year_built);
    if (
      address === undefined ||
      saleDate === undefined ||
      useDescription === undefined ||
      lotArea === undefined ||
      yearBuilt === undefined
    ) {
      return null;
    }
    nearbySales.push({
      parid,
      address,
      sale_date: saleDate,
      price,
      distance_ft: distance,
      use_description: useDescription,
      lot_area_sqft: lotArea,
      year_built: yearBuilt,
      sale_code: saleCode,
      sale_description: saleDescription,
      provenance: "PUBLIC_DATA",
    });
  }

  let hud: ClaudeAnalysisInput["financial_context"]["hud"] = null;
  if (value.hud !== null && value.hud !== undefined) {
    if (!isRecord(value.hud) || value.hud.provenance !== "PUBLIC_DATA") {
      return null;
    }
    if (!isRecord(value.hud.rents)) {
      return null;
    }
    const year = asString(value.hud.year);
    const geographyType = asString(value.hud.geography_type);
    const zip = asStringOrNull(value.hud.zip);
    const areaName = asStringOrNull(value.hud.area_name);
    const efficiency = asNumberOrNull(value.hud.rents.efficiency);
    const oneBedroom = asNumberOrNull(value.hud.rents.one_bedroom);
    const twoBedroom = asNumberOrNull(value.hud.rents.two_bedroom);
    const threeBedroom = asNumberOrNull(value.hud.rents.three_bedroom);
    const fourBedroom = asNumberOrNull(value.hud.rents.four_bedroom);
    if (
      !year ||
      !geographyType ||
      zip === undefined ||
      areaName === undefined ||
      efficiency === undefined ||
      oneBedroom === undefined ||
      twoBedroom === undefined ||
      threeBedroom === undefined ||
      fourBedroom === undefined
    ) {
      return null;
    }
    hud = {
      year,
      geography_type: geographyType,
      zip,
      area_name: areaName,
      rents: {
        efficiency,
        one_bedroom: oneBedroom,
        two_bedroom: twoBedroom,
        three_bedroom: threeBedroom,
        four_bedroom: fourBedroom,
      },
      provenance: "PUBLIC_DATA",
    };
  }

  let scenario: ClaudeAnalysisInput["financial_context"]["scenario"] = null;
  if (value.scenario !== null && value.scenario !== undefined) {
    if (
      !isRecord(value.scenario) ||
      value.scenario.provenance_inputs !== "USER_ASSUMPTION" ||
      value.scenario.provenance_results !== "CALCULATED_FROM_USER_ASSUMPTIONS"
    ) {
      return null;
    }
    const acquisition = asNumberOrNull(value.scenario.acquisition_cost);
    const units = asNumberOrNull(value.scenario.units);
    const monthlyRent = asNumberOrNull(value.scenario.monthly_rent_per_unit);
    const hard = asNumberOrNull(value.scenario.total_hard_cost);
    const soft = asNumberOrNull(value.scenario.total_soft_cost);
    const contingency = asNumberOrNull(value.scenario.contingency);
    const other = asNumberOrNull(value.scenario.other_costs);
    const total = asNumberOrNull(value.scenario.estimated_total_project_cost);
    const annual = asNumberOrNull(value.scenario.annual_gross_scheduled_rent);
    const perUnit = asNumberOrNull(value.scenario.project_cost_per_unit);
    const ratio = asNumberOrNull(value.scenario.annual_gross_rent_to_cost_ratio);
    if (
      acquisition === undefined ||
      acquisition === null ||
      units === undefined ||
      units === null ||
      monthlyRent === undefined ||
      monthlyRent === null ||
      hard === undefined ||
      hard === null ||
      soft === undefined ||
      soft === null ||
      contingency === undefined ||
      contingency === null ||
      other === undefined ||
      other === null ||
      total === undefined ||
      total === null ||
      annual === undefined ||
      annual === null ||
      perUnit === undefined ||
      ratio === undefined
    ) {
      return null;
    }
    scenario = {
      provenance_inputs: "USER_ASSUMPTION",
      provenance_results: "CALCULATED_FROM_USER_ASSUMPTIONS",
      acquisition_cost: acquisition,
      units,
      monthly_rent_per_unit: monthlyRent,
      total_hard_cost: hard,
      total_soft_cost: soft,
      contingency,
      other_costs: other,
      estimated_total_project_cost: total,
      annual_gross_scheduled_rent: annual,
      project_cost_per_unit: perUnit,
      annual_gross_rent_to_cost_ratio: ratio,
    };
  }

  return {
    overall_status: overallStatus,
    overall_status_label: overallLabel,
    parcel_id: parcelId,
    sales_source_status: value.sales_source_status,
    hud_source_status: value.hud_source_status,
    nearby_sales: nearbySales,
    hud,
    scenario,
    limitations,
  };
}

function parseFactorContributions(
  value: unknown,
): ClaudeAnalysisInput["score"]["factor_contributions"] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const contributions: ClaudeAnalysisInput["score"]["factor_contributions"] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }
    const id = asString(item.id);
    const label = asString(item.label);
    const maxPoints = asNumberOrNull(item.max_points);
    const earnedPoints = asNumberOrNull(item.earned_points);
    const state = asString(item.state);
    const note = asString(item.note);
    if (
      !id ||
      !label ||
      maxPoints === undefined ||
      maxPoints === null ||
      earnedPoints === undefined ||
      !state ||
      !note
    ) {
      return null;
    }
    contributions.push({
      id,
      label,
      max_points: maxPoints,
      earned_points: earnedPoints,
      state,
      note,
    });
  }
  return contributions;
}

function parseZoningDistricts(
  value: unknown,
): ClaudeAnalysisInput["zoning"]["districts"] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const districts: ClaudeAnalysisInput["zoning"]["districts"] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }
    const code = asString(item.code);
    const area = asNumberOrNull(item.intersection_area_sqft);
    const percent = asNumberOrNull(item.intersection_percent);
    if (!code || area === undefined || percent === undefined) {
      return null;
    }
    districts.push({
      code,
      intersection_area_sqft: area,
      intersection_percent: percent,
    });
  }
  return districts;
}

export function parseClaudeAnalysisInput(
  value: unknown,
): ClaudeAnalysisInput | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.analysis_type !== "preliminary_development_screening") {
    return null;
  }
  if (!isRecord(value.property) || !isRecord(value.proposed_project)) {
    return null;
  }
  if (!isRecord(value.zoning) || !isRecord(value.site_conditions)) {
    return null;
  }
  if (!isRecord(value.environment) || !isRecord(value.score)) {
    return null;
  }

  const address = asString(value.property.address);
  const parcelId = asString(value.property.parcel_id);
  const projectType = asString(value.proposed_project.type);
  const projectLabel = asString(value.proposed_project.label);
  const mappedCodes = asStringArray(value.zoning.mapped_codes);
  const useStatus = asString(value.zoning.use_status);
  const citation = asString(value.zoning.citation);
  const steepSlope = parseHazard(value.site_conditions.steep_slope);
  const landslide = parseHazard(value.site_conditions.landslide);
  const mine = parseHazard(value.site_conditions.mine);
  if (
    !address ||
    !parcelId ||
    !projectType ||
    !projectLabel ||
    !mappedCodes ||
    !useStatus ||
    !citation ||
    !steepSlope ||
    !landslide ||
    !mine
  ) {
    return null;
  }
  if (typeof value.zoning.split_zoning !== "boolean") {
    return null;
  }
  const zoningDistricts = parseZoningDistricts(value.zoning.districts);
  if (!zoningDistricts) {
    return null;
  }
  const tableSymbol = asStringOrNull(value.zoning.use_table_symbol);
  const baseFamily = asStringOrNull(value.zoning.base_family);
  const lotArea = asNumberOrNull(value.property.lot_area_sqft);
  const propertyClass = asStringOrNull(value.property.property_class);
  const propertyUse = asStringOrNull(value.property.property_use);
  const assessedTotal = asNumberOrNull(value.property.assessed_total);
  if (
    tableSymbol === undefined ||
    baseFamily === undefined ||
    lotArea === undefined ||
    propertyClass === undefined ||
    propertyUse === undefined ||
    assessedTotal === undefined
  ) {
    return null;
  }
  if (!isRecord(value.environment.flood)) {
    return null;
  }
  const floodBase = parseHazard(value.environment.flood);
  const floodProvenance = asStringOrNull(value.environment.flood.provenance);
  if (!floodBase || floodProvenance === undefined) {
    return null;
  }
  if (typeof value.score.provisional !== "boolean" || !value.score.provisional) {
    return null;
  }
  if (typeof value.score.score_complete !== "boolean") {
    return null;
  }
  const developmentEase = asNumberOrNull(value.score.development_ease);
  const scoringVersion = asString(value.score.scoring_version);
  const heuristicLabel = asString(value.score.heuristic_label);
  const screeningStatus =
    asString(value.overall_screening_status) ??
    asString(value.score.screening_status);
  const coverage = asNumberOrNull(value.score.evidence_coverage);
  const coverageLabel = asString(value.score.coverage_label);
  const factorContributions = parseFactorContributions(
    value.score.factor_contributions,
  );
  if (
    developmentEase === undefined ||
    !scoringVersion ||
    !heuristicLabel ||
    !screeningStatus ||
    coverage === undefined ||
    coverage === null ||
    !coverageLabel ||
    !factorContributions
  ) {
    return null;
  }
  if (!isRecord(value.score.regulatory_fit) || !isRecord(value.score.physical_site)) {
    return null;
  }
  const regulatoryState = asString(value.score.regulatory_fit.state);
  const regulatoryEarned = asNumberOrNull(value.score.regulatory_fit.earned);
  const regulatoryMax = asNumberOrNull(value.score.regulatory_fit.max);
  const regulatoryDisplay = asString(value.score.regulatory_fit.display);
  const physicalComplete = value.score.physical_site.complete;
  const physicalEarned = asNumberOrNull(value.score.physical_site.earned);
  const physicalMax = asNumberOrNull(value.score.physical_site.max);
  const physicalDisplay = asString(value.score.physical_site.display);
  if (
    !regulatoryState ||
    regulatoryEarned === undefined ||
    regulatoryMax === undefined ||
    regulatoryMax === null ||
    !regulatoryDisplay ||
    typeof physicalComplete !== "boolean" ||
    physicalEarned === undefined ||
    physicalMax === undefined ||
    physicalMax === null ||
    !physicalDisplay
  ) {
    return null;
  }
  if (!Array.isArray(value.critical_flags)) {
    return null;
  }
  const criticalFlags: ClaudeAnalysisInput["critical_flags"] = [];
  for (const flag of value.critical_flags) {
    if (!isRecord(flag)) {
      return null;
    }
    const type = asString(flag.type);
    const severity = asString(flag.severity);
    const title = asString(flag.title);
    const finding = asString(flag.finding);
    if (!type || !severity || !title || !finding) {
      return null;
    }
    criticalFlags.push({ type, severity, title, finding });
  }
  const notEvaluated = asStringArray(value.not_evaluated);
  const recommended = asStringArray(value.recommended_verification);
  const regulatoryRecords = parseRegulatoryRecords(value.regulatory_records);
  const historicDesignation = parseHistoricDesignation(
    value.historic_designation,
  );
  const financialContext = parseFinancialContext(value.financial_context);
  if (
    !notEvaluated ||
    !recommended ||
    !regulatoryRecords ||
    !historicDesignation ||
    !financialContext
  ) {
    return null;
  }

  return {
    analysis_type: "preliminary_development_screening",
    property: {
      address,
      parcel_id: parcelId,
      lot_area_sqft: lotArea,
      property_class: propertyClass,
      property_use: propertyUse,
      assessed_total: assessedTotal,
    },
    proposed_project: { type: projectType, label: projectLabel },
    zoning: {
      mapped_codes: mappedCodes,
      split_zoning: value.zoning.split_zoning,
      districts: zoningDistricts,
      use_status: useStatus,
      use_table_symbol: tableSymbol,
      base_family: baseFamily,
      citation,
    },
    site_conditions: {
      steep_slope: steepSlope,
      landslide,
      mine,
    },
    environment: {
      flood: { ...floodBase, provenance: floodProvenance },
    },
    regulatory_records: regulatoryRecords,
    historic_designation: historicDesignation,
    financial_context: financialContext,
    overall_screening_status: screeningStatus,
    score: {
      development_ease: developmentEase,
      score_complete: value.score.score_complete,
      scoring_version: scoringVersion,
      heuristic_label: heuristicLabel,
      screening_status: screeningStatus,
      provisional: true,
      evidence_coverage: coverage,
      coverage_label: coverageLabel,
      regulatory_fit: {
        state: regulatoryState,
        earned: regulatoryEarned,
        max: regulatoryMax,
        display: regulatoryDisplay,
      },
      physical_site: {
        complete: physicalComplete,
        earned: physicalEarned,
        max: physicalMax,
        display: physicalDisplay,
      },
      factor_contributions: factorContributions,
    },
    critical_flags: criticalFlags,
    not_evaluated: notEvaluated,
    recommended_verification: recommended,
  };
}

export function parseChatTurns(value: unknown): ChatTurn[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const turns: ChatTurn[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }
    if (item.role !== "user" && item.role !== "assistant") {
      return null;
    }
    if (typeof item.content !== "string") {
      return null;
    }
    const content = item.content.trim();
    if (content.length === 0 || content.length > MAX_CHAT_TURN_CHARS) {
      return null;
    }
    turns.push({ role: item.role, content });
  }
  return turns
    .slice(-MAX_CHAT_HISTORY_MESSAGES)
    .reduce<ChatTurn[]>((acc, turn) => {
      if (acc.length === 0 && turn.role !== "user") {
        return acc;
      }
      acc.push(turn);
      return acc;
    }, []);
}

export function parseUserMessage(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const content = value.trim();
  if (content.length === 0 || content.length > MAX_CHAT_USER_CHARS) {
    return null;
  }
  return content;
}

export function chatUnavailable(): ParcelChatResult {
  return {
    status: "unavailable",
    message: CLAUDE_CHAT_UNAVAILABLE_MESSAGE,
  };
}

export async function chatAboutParcel(input: {
  context: ClaudeAnalysisInput;
  history: ChatTurn[];
  message: string;
}): Promise<ParcelChatResult> {
  const apiKey = readClaudeApiKey();
  if (!apiKey) {
    return chatUnavailable();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const messages = [
    ...input.history.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: "user" as const, content: input.message },
  ];

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: readClaudeModel(),
        max_tokens: 800,
        system: `${CLAUDE_CHAT_SYSTEM_PROMPT}

AUTHORITATIVE PARCEL EVIDENCE (JSON):
${JSON.stringify(input.context)}`,
        messages,
      }),
    });

    if (!response.ok) {
      return chatUnavailable();
    }

    const body = (await response.json()) as AnthropicResponse;
    const text = body.content
      ?.filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text ?? "")
      .join("\n")
      .trim();
    if (!text) {
      return chatUnavailable();
    }

    return { status: "ok", reply: text };
  } catch {
    return chatUnavailable();
  } finally {
    clearTimeout(timer);
  }
}
