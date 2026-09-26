import { Fragment } from "react";
import type { AssessmentLookupResult } from "@/lib/assessments/wprdc";
import {
  floodSourceLinkLabel,
  type FloodLookupResult,
} from "@/lib/hazards/flood";
import type { HazardSource } from "@/lib/hazards/arcgis";
import type { LandslideLookupResult } from "@/lib/hazards/landslide";
import type { SteepSlopeLookupResult } from "@/lib/hazards/steep-slope";
import type { UnderminedLookupResult } from "@/lib/hazards/undermined";
import type { AddressToParcelResult } from "@/lib/lookup/address-to-parcel";
import { proposedProjectTypeLabel } from "@/lib/project-type";
import { COVERAGE_THRESHOLDS } from "@/lib/scoring/config";
import type { DecisionSnapshot } from "@/lib/scoring";
import type {
  UseCompatibilityResult,
  UseTableStatus,
} from "@/lib/zoning/compatibility";
import type { ZoningLookupResult, ZoningSource } from "@/lib/zoning/pittsburgh";
import type { ClaudeExplanationResult } from "@/lib/claude/types";
import { FinancialFeasibilityNotAssessed } from "@/components/financial-feasibility";

type OkResult = Extract<AddressToParcelResult, { status: "ok" }>;

export function FeasibilitySnapshot({ result }: { result: OkResult }) {
  const displayAddress =
    result.assessment.status === "ok"
      ? (result.assessment.facts.propertyAddress ??
        result.census.matchedAddress)
      : result.census.matchedAddress;

  return (
    <div className="mt-8">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-600">
        Development Feasibility Snapshot
      </p>
      <h2 className="mt-1 text-xl font-semibold">{displayAddress}</h2>
      <p className="mt-1 text-sm text-neutral-600">
        PARID {result.parcel.pin}
        {result.parcel.mapBlockLot
          ? ` · MAPBLOCKLOT ${result.parcel.mapBlockLot}`
          : ""}{" "}
        · Proposed:{" "}
        {proposedProjectTypeLabel(result.request.proposedProjectType)}
      </p>
      <p className="mt-2 text-sm text-neutral-500">
        Scoring v{result.decision.scoringVersion} — Provisional. Decision
        support only; not legal, zoning, engineering, environmental, or
        financial advice.
      </p>

      <SnapshotMetrics decision={result.decision} />
      <CoverageWarning coveragePercent={result.decision.coverage.percent} />
      <ZoningEntitlement
        zoning={result.zoning}
        useCompatibility={result.useCompatibility}
      />
      <PhysicalSite
        steepSlope={result.steepSlope}
        landslide={result.landslide}
        undermined={result.undermined}
      />
      <EnvironmentalConditions flood={result.flood} />
      <RegulatoryContext />
      <CriticalFlagsCard decision={result.decision} />
      <RecommendedVerification steps={result.recommendedVerification} />
      <AiExplanation aiSummary={result.aiSummary} />
      <SourcesAndAssumptions result={result} />
      <FinancialFeasibilityNotAssessed />
      <ParcelFactsDetail
        pin={result.parcel.pin}
        assessment={result.assessment}
        censusMatchedAddress={result.census.matchedAddress}
        acreage={result.parcel.calculatedAcreage}
      />
    </div>
  );
}

function SnapshotMetrics({ decision }: { decision: DecisionSnapshot }) {
  const { presentation } = decision;

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <Metric
        label="Development Ease"
        value={presentation.valueLine}
        detail={
          presentation.mode === "incomplete"
            ? `${presentation.heading}. ${presentation.caveat} ${presentation.scoredFactorsLine}.`
            : presentation.heading
        }
      />
      <Metric
        label="Evidence Coverage"
        value={`${decision.coverage.percent}%`}
        detail={decision.coverage.label}
      />
      <Metric
        label="Review Flags"
        value={String(decision.flags.length)}
        detail={
          decision.flags.length === 0
            ? "No review flags from currently implemented evidence."
            : "Flags stay visible regardless of the numeric score."
        }
      />
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border border-neutral-300 p-4">
      <p className="text-sm text-neutral-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-sm">{detail}</p>
    </div>
  );
}

function CoverageWarning({ coveragePercent }: { coveragePercent: number }) {
  if (coveragePercent >= COVERAGE_THRESHOLDS.normalMin) {
    return null;
  }

  const insufficient =
    coveragePercent < COVERAGE_THRESHOLDS.preliminaryMin;

  return (
    <div className="mt-4 border border-neutral-800 p-4" role="alert">
      <h2 className="text-lg font-medium">Incomplete evidence</h2>
      <p className="mt-2 text-sm">
        {insufficient
          ? "Evidence Coverage is below 60%. A confident Development Ease Score is not shown as a complete result. Use available findings only, and do not treat missing layers as favorable."
          : "Evidence Coverage is below 80%. The numeric result is preliminary because some intended evidence was not evaluated."}
      </p>
    </div>
  );
}

function ZoningEntitlement({
  zoning,
  useCompatibility,
}: {
  zoning: ZoningLookupResult;
  useCompatibility: UseCompatibilityResult;
}) {
  if (zoning.status === "unavailable") {
    return (
      <section className="mt-6 border border-neutral-300 p-4" role="alert">
        <h2 className="text-lg font-medium">Zoning & Entitlement</h2>
        <p className="mt-2 text-sm">
          Base zoning — Not Evaluated / Source Unavailable. {zoning.message}
        </p>
        <UseCompatibilityBlock useCompatibility={useCompatibility} />
      </section>
    );
  }

  if (zoning.status === "no_district") {
    return (
      <section className="mt-6 border border-neutral-300 p-4" role="alert">
        <h2 className="text-lg font-medium">Zoning & Entitlement</h2>
        <p className="mt-2 text-sm">{zoning.message}</p>
        <UseCompatibilityBlock useCompatibility={useCompatibility} />
        <ZoningSource source={zoning.source} />
      </section>
    );
  }

  return (
    <section className="mt-6 border border-neutral-300 p-4">
      <h2 className="text-lg font-medium">Zoning & Entitlement</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Mapped GIS district only. This is not a determination that a use is
        permitted, approved, or buildable.
      </p>
      {zoning.splitZoning ? (
        <p className="mt-2 text-sm" role="status">
          Split zoning / review indicator: multiple mapped districts intersect
          this parcel. All are listed; none was selected as the sole district.
        </p>
      ) : (
        <p className="mt-2 text-sm">
          The parcel intersects one mapped zoning district.
        </p>
      )}
      <ul className="mt-3 list-disc pl-5 text-sm">
        {zoning.districts.map((district) => (
          <li key={district.code}>
            <span className="font-medium">{district.code}</span>
            {district.fullType ? ` — ${district.fullType}` : ""}
            {district.legendType ? ` (${district.legendType})` : ""}
            {district.status ? ` · ${district.status}` : ""}
          </li>
        ))}
      </ul>
      <UseCompatibilityBlock useCompatibility={useCompatibility} />
      <ZoningSource source={zoning.source} />
    </section>
  );
}

function useStatusLabel(status: UseTableStatus): string {
  switch (status) {
    case "PERMITTED_BY_RIGHT":
      return "PERMITTED_BY_RIGHT (P)";
    case "ADMINISTRATOR_EXCEPTION":
      return "ADMINISTRATOR_EXCEPTION (A)";
    case "SPECIAL_EXCEPTION":
      return "SPECIAL_EXCEPTION (S)";
    case "CONDITIONAL_USE":
      return "CONDITIONAL_USE (C)";
    case "NOT_COMPATIBLE":
      return "NOT_COMPATIBLE";
    case "NOT_IDENTIFIED":
      return "NOT_IDENTIFIED";
    case "NOT_EVALUATED":
      return "NOT_EVALUATED";
    case "REQUIRES_VERIFICATION":
      return "REQUIRES_VERIFICATION";
  }
}

function UseCompatibilityBlock({
  useCompatibility,
}: {
  useCompatibility: UseCompatibilityResult;
}) {
  return (
    <div className="mt-4 border border-neutral-200 p-3">
      <h3 className="text-sm font-medium">Preliminary use-table status</h3>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-neutral-600">Proposed use</dt>
        <dd>{useCompatibility.proposedUseLabel}</dd>
        {useCompatibility.districts.length === 0 ? (
          <>
            <dt className="text-neutral-600">Mapped zoning code</dt>
            <dd>Not available for lookup</dd>
            <dt className="text-neutral-600">Base zoning family</dt>
            <dd>Not applied</dd>
          </>
        ) : (
          useCompatibility.districts.map((district) => (
            <Fragment key={district.mappedZoningCode}>
              <dt className="text-neutral-600">Mapped zoning code</dt>
              <dd>{district.mappedZoningCode}</dd>
              <dt className="text-neutral-600">Base zoning family used for lookup</dt>
              <dd>{district.baseZoningFamily ?? "Not identified / unsupported"}</dd>
              <dt className="text-neutral-600">Use-table cell</dt>
              <dd>
                {district.status === "NOT_IDENTIFIED"
                  ? "Not encoded for this district"
                  : (district.tableSymbol ?? "blank")}
              </dd>
              <dt className="text-neutral-600">Preliminary use-table status</dt>
              <dd>{useStatusLabel(district.status)}</dd>
              {district.conditionNote ? (
                <>
                  <dt className="text-neutral-600">Qualified cell</dt>
                  <dd>{district.conditionNote}</dd>
                </>
              ) : null}
            </Fragment>
          ))
        )}
        <dt className="text-neutral-600">Code citation</dt>
        <dd>
          <a className="underline" href={useCompatibility.citationUrl}>
            {useCompatibility.citation}
          </a>
          {useCompatibility.standardsCitation
            ? ` · Use standards ${useCompatibility.standardsCitation}`
            : ""}
        </dd>
      </dl>
      <p className="mt-3 text-sm">
        Verification required. {useCompatibility.message}
      </p>
    </div>
  );
}

function PhysicalSite({
  steepSlope,
  landslide,
  undermined,
}: {
  steepSlope: SteepSlopeLookupResult;
  landslide: LandslideLookupResult;
  undermined: UnderminedLookupResult;
}) {
  return (
    <section className="mt-6 border border-neutral-300 p-4">
      <h2 className="text-lg font-medium">Physical Site Conditions</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Mapped GIS evidence only. Missing or failed sources are not treated as
        favorable. These findings do not mean a parcel is prohibited or
        unbuildable.
      </p>
      <SteepSlopeBlock steepSlope={steepSlope} />
      <LandslideBlock landslide={landslide} />
      <UnderminedBlock undermined={undermined} />
    </section>
  );
}

function EnvironmentalConditions({ flood }: { flood: FloodLookupResult }) {
  return (
    <section className="mt-6 border border-neutral-300 p-4">
      <h2 className="text-lg font-medium">Environmental Conditions</h2>
      <FloodBlock flood={flood} />
    </section>
  );
}

function RegulatoryContext() {
  return (
    <section className="mt-6 border border-neutral-300 p-4">
      <h2 className="text-lg font-medium">Regulatory Context</h2>
      <p className="mt-2 text-sm">
        Historic designation — Not Evaluated. This MVP does not yet load City
        historic district or landmark layers.
      </p>
      <p className="mt-2 text-sm">
        Permits and violations — Not Evaluated.
      </p>
      <p className="mt-2 text-sm text-neutral-600">
        Unimplemented layers are not treated as the absence of a regulatory
        constraint.
      </p>
    </section>
  );
}

function CriticalFlagsCard({ decision }: { decision: DecisionSnapshot }) {
  return (
    <section className="mt-6 border border-neutral-800 p-4">
      <h2 className="text-lg font-medium">Critical Flags</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Independent of the numeric score. A higher Development Ease value does
        not hide these items.
      </p>
      {decision.flags.length === 0 ? (
        <p className="mt-3 text-sm">
          No review flags from currently implemented evidence.
        </p>
      ) : (
        <ul className="mt-3 space-y-4">
          {decision.flags.map((flag) => (
            <li key={flag.type} className="border border-neutral-300 p-3">
              <p className="text-sm font-medium">
                {flag.level}: {flag.title}
              </p>
              <p className="mt-2 text-sm">
                <span className="font-medium">Finding. </span>
                {flag.finding}
              </p>
              <p className="mt-2 text-sm">
                <span className="font-medium">Why it matters. </span>
                {flag.whyItMatters}
              </p>
              <p className="mt-2 text-sm">
                <span className="font-medium">Verification. </span>
                {flag.verificationAction}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecommendedVerification({ steps }: { steps: string[] }) {
  return (
    <section className="mt-6 border border-neutral-300 p-4">
      <h2 className="text-lg font-medium">Recommended Verification</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Deterministic next steps from this evidence. They are not generated by
        the AI explanation and are not a substitute for professional review.
      </p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
}

function AiExplanation({
  aiSummary,
}: {
  aiSummary: ClaudeExplanationResult;
}) {
  if (aiSummary.status !== "ok") {
    return (
      <section className="mt-6 border border-neutral-300 p-4">
        <h2 className="text-lg font-medium">AI Feasibility Summary</h2>
        <p className="mt-2 text-sm">{aiSummary.message}</p>
      </section>
    );
  }

  const { narrative } = aiSummary;

  return (
    <section className="mt-6 border border-neutral-300 p-4">
      <h2 className="text-lg font-medium">AI Feasibility Summary</h2>
      <p className="mt-2 text-sm">{narrative.summary}</p>
      <NarrativeList
        title="Key Bottlenecks"
        items={narrative.key_bottlenecks}
        empty="No evaluated bottlenecks were listed."
      />
      <NarrativeList
        title="Constraint Interactions"
        items={narrative.constraint_interactions}
        empty="No interaction among evaluated constraints was described."
      />
      <h3 className="mt-4 text-sm font-medium">Why This Matters</h3>
      <p className="mt-2 text-sm">{narrative.why_this_matters}</p>
      <NarrativeList
        title="What Could Change the Result"
        items={narrative.what_could_change_the_result}
        empty="No additional information items were listed."
      />
      <NarrativeList
        title="Questions for Human Review"
        items={narrative.questions_for_human_review}
        empty="No review questions were listed."
      />
      <h3 className="mt-4 text-sm font-medium">Limitations</h3>
      <p className="mt-2 text-sm">{narrative.limitations}</p>
    </section>
  );
}

function NarrativeList({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <>
      <h3 className="mt-4 text-sm font-medium">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm">{empty}</p>
      ) : (
        <ul className="mt-2 list-disc pl-5 text-sm">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </>
  );
}

function SourcesAndAssumptions({ result }: { result: OkResult }) {
  const rows = buildSourceRows(result);

  return (
    <section className="mt-6 border border-neutral-300 p-4">
      <h2 className="text-lg font-medium">Sources & Assumptions</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-300">
              <th className="py-2 pr-3 font-medium">Source / steward</th>
              <th className="py-2 pr-3 font-medium">Finding</th>
              <th className="py-2 pr-3 font-medium">Join / method</th>
              <th className="py-2 pr-3 font-medium">Vintage / retrieved</th>
              <th className="py-2 font-medium">Limitation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-neutral-200 align-top">
                <td className="py-2 pr-3">
                  {row.href ? (
                    <a className="underline" href={row.href}>
                      {row.source}
                    </a>
                  ) : (
                    row.source
                  )}
                </td>
                <td className="py-2 pr-3">{row.finding}</td>
                <td className="py-2 pr-3">{row.method}</td>
                <td className="py-2 pr-3">{row.vintage}</td>
                <td className="py-2">{row.limitation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ParcelFactsDetail({
  pin,
  assessment,
  censusMatchedAddress,
  acreage,
}: {
  pin: string;
  assessment: AssessmentLookupResult;
  censusMatchedAddress: string;
  acreage: string | number | null | undefined;
}) {
  if (assessment.status !== "ok") {
    return (
      <section className="mt-6 border border-neutral-300 p-4" role="alert">
        <h2 className="text-lg font-medium">Property facts</h2>
        <p className="mt-2 text-sm">{assessment.message}</p>
        <p className="mt-2 text-sm text-neutral-600">
          Census matched address: {censusMatchedAddress}
        </p>
      </section>
    );
  }

  const facts = assessment.facts;
  const classLabel = [facts.classDescription, facts.classCode]
    .filter(Boolean)
    .join(" / ");
  const sourceDate = [
    facts.asOfDate,
    facts.taxYear ? `tax year ${facts.taxYear}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="mt-6 border border-neutral-300 p-4">
      <h2 className="text-lg font-medium">Property facts</h2>
      <p className="mt-1 text-sm text-neutral-600">
        County assessed values are not market values.
      </p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-neutral-600">Census matched address</dt>
        <dd>{censusMatchedAddress}</dd>
        <dt className="text-neutral-600">Parcel ID</dt>
        <dd>{facts.parid}</dd>
        <dt className="text-neutral-600">PIN / PARID match</dt>
        <dd>
          {facts.parid === pin
            ? "PIN matches assessment PARID"
            : "Mismatch"}
        </dd>
        <dt className="text-neutral-600">Property address</dt>
        <dd>{facts.propertyAddress ?? "Not reported"}</dd>
        <dt className="text-neutral-600">Municipality</dt>
        <dd>{facts.municipality ?? facts.municipalityCode ?? "Not reported"}</dd>
        <dt className="text-neutral-600">Class</dt>
        <dd>{classLabel || "Not reported"}</dd>
        <dt className="text-neutral-600">Current land use</dt>
        <dd>{facts.useDescription ?? "Not reported"}</dd>
        <dt className="text-neutral-600">Lot area</dt>
        <dd>{formatLotArea(facts.lotArea)}</dd>
        <dt className="text-neutral-600">Calculated acreage (GIS)</dt>
        <dd>{acreage ?? "—"}</dd>
        <dt className="text-neutral-600">County assessed land value</dt>
        <dd>{formatCountyAssessedValue(facts.countyAssessedLandValue)}</dd>
        <dt className="text-neutral-600">County assessed building value</dt>
        <dd>{formatCountyAssessedValue(facts.countyAssessedBuildingValue)}</dd>
        <dt className="text-neutral-600">County assessed total</dt>
        <dd>{formatCountyAssessedValue(facts.countyAssessedTotal)}</dd>
        {facts.yearBuilt !== null ? (
          <>
            <dt className="text-neutral-600">Year built</dt>
            <dd>{facts.yearBuilt}</dd>
          </>
        ) : null}
        {facts.stories !== null ? (
          <>
            <dt className="text-neutral-600">Stories</dt>
            <dd>{facts.stories}</dd>
          </>
        ) : null}
        {facts.finishedLivingArea !== null ? (
          <>
            <dt className="text-neutral-600">Finished living area</dt>
            <dd>
              {new Intl.NumberFormat("en-US").format(facts.finishedLivingArea)} sq
              ft
            </dd>
          </>
        ) : null}
        {sourceDate ? (
          <>
            <dt className="text-neutral-600">Assessment / source date</dt>
            <dd>{sourceDate}</dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}

export function LookupError({ result }: { result: AddressToParcelResult }) {
  if (result.status === "ok") {
    return null;
  }

  const title = errorTitle(result.status);

  return (
    <div className="mt-6 border border-neutral-800 p-4" role="alert">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="mt-2 text-sm">{result.message}</p>
      {"census" in result ? (
        <p className="mt-2 text-sm text-neutral-600">
          Census match: {result.census.matchedAddress} (
          {result.census.latitude}, {result.census.longitude})
        </p>
      ) : null}
      {result.status === "ambiguous_census_match" ? (
        <ul className="mt-2 list-disc pl-5 text-sm">
          {result.matches.map((match) => (
            <li key={`${match.matchedAddress}-${match.longitude}-${match.latitude}`}>
              {match.matchedAddress}
            </li>
          ))}
        </ul>
      ) : null}
      {result.status === "ambiguous_parcel_match" ? (
        <ul className="mt-2 list-disc pl-5 text-sm">
          {result.parcels.map((parcel) => (
            <li key={parcel.pin}>
              PIN {parcel.pin}
              {parcel.mapBlockLot ? ` (${parcel.mapBlockLot})` : ""}
              {parcel.assessmentAddress
                ? ` — ${parcel.assessmentAddress}`
                : " — no assessment address"}
              {parcel.addressMatched ? " [address match]" : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function errorTitle(status: Exclude<AddressToParcelResult["status"], "ok">) {
  switch (status) {
    case "outside_pittsburgh":
      return "Outside current MVP scope";
    case "no_parcel_match":
    case "ambiguous_parcel_match":
    case "parcel_unavailable":
      return "Parcel could not be resolved";
    default:
      return "Verify the address";
  }
}

function ZoningSource({ source }: { source: ZoningSource }) {
  return (
    <p className="mt-3 text-sm text-neutral-600">
      Source: {source.name}. Dataset last modified:{" "}
      {source.sourceLastModified ?? "not reported"}. Retrieved{" "}
      {source.retrievedAt}.{" "}
      <a href={source.datasetUrl} className="underline">
        WPRDC zoning
      </a>
      {" · "}
      <a href={source.zoningCodeUrl} className="underline">
        Zoning Code
      </a>
      {" · "}
      <a href={source.zoningMapUrl} className="underline">
        City zoning map
      </a>
      {" · "}
      <a href={source.cityZoningPageUrl} className="underline">
        City zoning page
      </a>
      .
    </p>
  );
}

function formatOverlapPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function HazardSourceLine({
  source,
  linkLabel,
}: {
  source: HazardSource;
  linkLabel: string;
}) {
  return (
    <p className="mt-2 text-sm text-neutral-600">
      Source: {source.name}.{" "}
      {source.mapVintage ? (
        <>
          Map vintage: {source.mapVintage} (not current FEMA NFHL). Dataset last
          modified: {source.sourceLastModified ?? "not reported"}.{" "}
        </>
      ) : (
        <>
          Dataset last modified: {source.sourceLastModified ?? "not reported"}.{" "}
        </>
      )}
      Retrieved {source.retrievedAt}. CRS: {source.crs}.{" "}
      <a href={source.datasetUrl} className="underline">
        {linkLabel}
      </a>
      .
    </p>
  );
}

function HazardOverlap({
  overlapPercent,
  overlapAreaSqFt,
  intersects,
  label,
}: {
  overlapPercent: number | null;
  overlapAreaSqFt: number | null;
  intersects: boolean;
  label: string;
}) {
  if (overlapPercent !== null) {
    return (
      <p className="mt-2 text-sm">
        Overlap with {label}: {formatOverlapPercent(overlapPercent)}
        {overlapAreaSqFt !== null
          ? ` (${new Intl.NumberFormat("en-US").format(Math.round(overlapAreaSqFt))} sq ft)`
          : ""}
        . Calculated in EPSG:2272, not latitude/longitude.
      </p>
    );
  }
  if (intersects) {
    return (
      <p className="mt-2 text-sm">
        Overlap percentage could not be calculated reliably.
      </p>
    );
  }
  return null;
}

function SteepSlopeBlock({
  steepSlope,
}: {
  steepSlope: SteepSlopeLookupResult;
}) {
  if (steepSlope.status === "not_evaluated") {
    return (
      <div className="mt-4" role="alert">
        <h3 className="text-sm font-medium">Steep slope — Not Evaluated</h3>
        <p className="mt-2 text-sm">{steepSlope.message}</p>
        <p className="mt-2 text-sm text-neutral-600">
          Source failure is not treated as the absence of steep slope.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium">Steep slope — Evaluated</h3>
      <p className="mt-2 text-sm">{steepSlope.message}</p>
      <HazardOverlap
        overlapPercent={steepSlope.overlapPercent}
        overlapAreaSqFt={steepSlope.overlapAreaSqFt}
        intersects={steepSlope.intersects}
        label="mapped ≥25% slope"
      />
      <HazardSourceLine
        source={steepSlope.source}
        linkLabel="WPRDC 25% or Greater Slope"
      />
    </div>
  );
}

function LandslideBlock({
  landslide,
}: {
  landslide: LandslideLookupResult;
}) {
  if (landslide.status === "not_evaluated") {
    return (
      <div className="mt-4" role="alert">
        <h3 className="text-sm font-medium">Landslide — Not Evaluated</h3>
        <p className="mt-2 text-sm">{landslide.message}</p>
        <p className="mt-2 text-sm text-neutral-600">
          Source failure is not treated as the absence of landslide-prone area.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium">Landslide — Evaluated</h3>
      <p className="mt-2 text-sm">{landslide.message}</p>
      <HazardOverlap
        overlapPercent={landslide.overlapPercent}
        overlapAreaSqFt={landslide.overlapAreaSqFt}
        intersects={landslide.intersects}
        label="mapped landslide-prone area"
      />
      <HazardSourceLine
        source={landslide.source}
        linkLabel="WPRDC Landslide-Prone Areas"
      />
    </div>
  );
}

function UnderminedBlock({
  undermined,
}: {
  undermined: UnderminedLookupResult;
}) {
  if (undermined.status === "not_evaluated") {
    return (
      <div className="mt-4" role="alert">
        <h3 className="text-sm font-medium">Mine / undermined — Not Evaluated</h3>
        <p className="mt-2 text-sm">{undermined.message}</p>
        <p className="mt-2 text-sm text-neutral-600">
          Source failure is not treated as the absence of undermined/mine
          condition.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium">Mine / undermined — Evaluated</h3>
      <p className="mt-2 text-sm">{undermined.message}</p>
      {undermined.classifications.length > 0 ? (
        <p className="mt-2 text-sm">
          Source classification: {undermined.classifications.join(", ")}.
        </p>
      ) : null}
      <HazardOverlap
        overlapPercent={undermined.overlapPercent}
        overlapAreaSqFt={undermined.overlapAreaSqFt}
        intersects={undermined.intersects}
        label="mapped undermined area"
      />
      <HazardSourceLine
        source={undermined.source}
        linkLabel="WPRDC Undermined Areas"
      />
    </div>
  );
}

function FloodBlock({ flood }: { flood: FloodLookupResult }) {
  if (flood.status === "not_evaluated") {
    return (
      <div className="mt-2" role="alert">
        <h3 className="text-sm font-medium">Flood hazard — Not Evaluated</h3>
        <p className="mt-2 text-sm">{flood.message}</p>
        <p className="mt-2 text-sm text-neutral-600">
          Source failure is not treated as the absence of flood hazard. This is
          not a “no flood risk” finding.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <h3 className="text-sm font-medium">
        {flood.provenance === "wprdc_2014_extract"
          ? "Flood hazard — Evaluated (2014 WPRDC FEMA extract)"
          : "Flood hazard — Evaluated"}
      </h3>
      <p className="mt-2 text-sm">{flood.message}</p>
      {flood.zones.length > 0 ? (
        <ul className="mt-2 list-disc pl-5 text-sm">
          {flood.zones.map((zone) => (
            <li
              key={`${zone.fldZone ?? ""}-${zone.zoneSubtype ?? ""}-${zone.sfha ?? ""}`}
            >
              {zone.fldZone ? `Zone ${zone.fldZone}` : "Zone not reported"}
              {zone.zoneSubtype ? ` · ${zone.zoneSubtype}` : ""}
              {zone.sfha ? ` · SFHA ${zone.sfha}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      <HazardOverlap
        overlapPercent={flood.overlapPercent}
        overlapAreaSqFt={flood.overlapAreaSqFt}
        intersects={flood.intersects}
        label="mapped FEMA flood hazard"
      />
      {flood.provenance === "living_atlas_secondary" ? (
        <p className="mt-2 text-sm">
          Secondary flood-hazard fallback. This is not a direct FEMA NFHL query
          and is not presented as direct FEMA evidence.
        </p>
      ) : flood.provenance === "wprdc_2014_extract" ? (
        <p className="mt-2 text-sm">
          Map vintage: 2014. City-published extract of official FEMA data from
          that vintage. This is not current FEMA NFHL and is not a live NFHL
          query.
        </p>
      ) : (
        <p className="mt-2 text-sm">
          Authoritative primary source: FEMA National Flood Hazard Layer.
        </p>
      )}
      <HazardSourceLine
        source={flood.source}
        linkLabel={floodSourceLinkLabel(flood.provenance)}
      />
    </div>
  );
}

function formatCountyAssessedValue(value: number | null): string {
  if (value === null) {
    return "Not reported";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatLotArea(value: number | null): string {
  if (value === null) {
    return "Not reported";
  }
  return `${new Intl.NumberFormat("en-US").format(value)} sq ft`;
}

function buildSourceRows(result: OkResult) {
  const rows: {
    key: string;
    source: string;
    href?: string;
    finding: string;
    method: string;
    vintage: string;
    limitation: string;
  }[] = [
    {
      key: "census",
      source: "U.S. Census Geocoder",
      href: "https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html",
      finding: result.census.matchedAddress,
      method: "One-line address match to coordinates",
      vintage: "Public_AR_Current",
      limitation:
        "Interpolated street location. Ambiguous matches are not auto-resolved.",
    },
    {
      key: "parcel",
      source: "Allegheny County Parcels (ArcGIS REST)",
      href: "https://gisdata.alleghenycounty.us/arcgis/rest/services/OPENDATA/Parcels/MapServer/0",
      finding: `PIN ${result.parcel.pin}`,
      method: "Point-in-polygon (EPSG:2272), then PARID identity",
      vintage: "Live County service",
      limitation: "County geometry may differ from assessment update timing.",
    },
  ];

  if (result.assessment.status === "ok") {
    rows.push({
      key: "assessment",
      source: "WPRDC Allegheny County Property Assessments",
      href: "https://data.wprdc.org/dataset/property-assessments",
      finding: result.assessment.facts.propertyAddress ?? result.assessment.facts.parid,
      method: "PARID join",
      vintage: [
        result.assessment.facts.asOfDate,
        result.assessment.facts.taxYear
          ? `tax year ${result.assessment.facts.taxYear}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ") || "not reported",
      limitation: "Assessed value is not market value.",
    });
  } else {
    rows.push({
      key: "assessment",
      source: "WPRDC Allegheny County Property Assessments",
      href: "https://data.wprdc.org/dataset/property-assessments",
      finding: "Not Evaluated",
      method: "PARID join",
      vintage: "—",
      limitation: result.assessment.message,
    });
  }

  if (result.zoning.status === "unavailable") {
    rows.push({
      key: "zoning",
      source: "City of Pittsburgh / WPRDC Zoning",
      href: "https://data.wprdc.org/dataset/zoning",
      finding: "Not Evaluated / Source Unavailable",
      method: "Parcel-polygon spatial intersection",
      vintage: "—",
      limitation: result.zoning.message,
    });
  } else {
    const finding =
      result.zoning.status === "ok"
        ? result.zoning.districts.map((district) => district.code).join(", ")
        : result.zoning.message;
    rows.push({
      key: "zoning",
      source: result.zoning.source.name,
      href: result.zoning.source.datasetUrl,
      finding,
      method: "Parcel-polygon spatial intersection",
      vintage: `${result.zoning.source.sourceLastModified ?? "not reported"} · retrieved ${result.zoning.source.retrievedAt}`,
      limitation:
        "Mapped district only. Official code and Zoning Administrator control.",
    });
  }

  rows.push({
    key: "use-table",
    source: result.useCompatibility.citation,
    href: result.useCompatibility.citationUrl,
    finding: `${result.useCompatibility.proposedUseLabel}: ${result.useCompatibility.overallStatus}`,
    method:
      "Encoded § 911.02 cells for R1D / R1A / R2 / R3 / RM after stripping density suffixes from the mapped code",
    vintage: "ecode360 Chapter 911 as retrieved 2026-09-26",
    limitation:
      "Preliminary lookup only. Overlays, use standards, and Zoning Administrator interpretation are not applied. Unsupported districts are Not Identified, not guessed.",
  });

  rows.push(hazardSourceRow("slope", "Steep slope", result.steepSlope));
  rows.push(hazardSourceRow("landslide", "Landslide", result.landslide));
  rows.push(hazardSourceRow("mine", "Mine / undermined", result.undermined));
  rows.push(hazardSourceRow("flood", "Flood", result.flood));

  rows.push({
    key: "score",
    source: "BuildWise scoring module",
    finding: `Scoring v${result.decision.scoringVersion} provisional`,
    method: result.decision.score.formula,
    vintage: result.decision.scoringVersion,
    limitation:
      "Currently scores steep-slope overlap only. Weights pending SME review. Missing data is not favorable.",
  });

  return rows;
}

function hazardSourceRow(
  key: string,
  label: string,
  evidence:
    | SteepSlopeLookupResult
    | LandslideLookupResult
    | UnderminedLookupResult
    | FloodLookupResult,
) {
  if (evidence.status !== "ok") {
    return {
      key,
      source: label,
      finding: "Not Evaluated",
      method: "Parcel-polygon spatial intersection in EPSG:2272",
      vintage: "—",
      limitation: evidence.message,
    };
  }

  return {
    key,
    source: evidence.source.name,
    href: evidence.source.datasetUrl,
    finding:
      evidence.overlapPercent !== null
        ? `${label}: ${evidence.overlapPercent.toFixed(1)}% overlap`
        : evidence.message,
    method: "Parcel-polygon spatial intersection in EPSG:2272",
    vintage: `${evidence.source.sourceLastModified ?? "not reported"} · retrieved ${evidence.source.retrievedAt}`,
    limitation: "Mapped GIS evidence, not a field survey or engineering opinion.",
  };
}
