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
import type { HistoricDesignationResult } from "@/lib/historic";
import type { RegulatoryRecordsResult } from "@/lib/regulatory";
import { streetLineKey } from "@/lib/regulatory/address";
import { COVERAGE_THRESHOLDS } from "@/lib/scoring/config";
import type { DecisionSnapshot } from "@/lib/scoring";
import type {
  UseCompatibilityResult,
  UseTableStatus,
} from "@/lib/zoning/compatibility";
import type { ZoningLookupResult, ZoningSource } from "@/lib/zoning/pittsburgh";
import { AiBrief } from "@/components/ai-brief";
import { FinancialContextWithChat } from "@/components/financial-feasibility";
import { ParcelEvidenceMap } from "@/components/parcel-evidence-map";
import {
  ResultJumpNav,
  SourceDisclosure,
  SourcesAssumptionsDisclosure,
} from "@/components/result-chrome";
import { StatusBadge } from "@/components/status-badge";

type OkResult = Extract<AddressToParcelResult, { status: "ok" }>;

function streetKeysDiffer(
  entered: string,
  geocoded: string,
  assessment: string | null,
): boolean {
  const keys = [streetLineKey(entered), streetLineKey(geocoded), streetLineKey(assessment)]
    .filter((key): key is string => Boolean(key));
  return new Set(keys).size > 1;
}

export function FeasibilitySnapshot({ result }: { result: OkResult }) {
  const assessmentAddress =
    result.assessment.status === "ok"
      ? result.assessment.facts.propertyAddress
      : null;
  const enteredAddress = result.request.inputAddress;
  const geocodedAddress = result.census.matchedAddress;
  const houseNumberZero =
    result.assessment.status === "ok" &&
    result.assessment.facts.houseNumber === "0";
  const addressesDiffer = streetKeysDiffer(
    enteredAddress,
    geocodedAddress,
    assessmentAddress,
  );
  const showMatchedLabel = addressesDiffer || houseNumberZero;

  return (
    <div id="results" className="mt-8 scroll-mt-24">
      <header className="relative overflow-hidden rounded-2xl border border-[#c7d3c7] bg-[#e8eee7] px-5 py-6 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-12 -top-14 size-56 rounded-full border border-accent/10 sm:size-72" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-4 -top-6 size-40 rounded-full border border-accent/10 sm:size-56" aria-hidden="true" />
        <div className="relative flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#a9c0ac] bg-[#f7faf4] px-2.5 py-1 text-xs font-semibold text-accent">
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5 fill-none stroke-current" strokeWidth="2">
              <path d="m3.2 8.2 3 3 6.6-6.6" />
            </svg>
            Lookup complete
          </span>
          <span className="font-mono text-[11px] tracking-wide text-ink-muted">
            PARCEL BRIEF / {result.parcel.pin}
          </span>
        </div>
        {showMatchedLabel ? (
          <p className="relative mt-4 text-sm font-medium text-ink-muted">
            Matched property address
          </p>
        ) : null}
        <h2 className="bw-serif relative mt-2 max-w-3xl text-3xl leading-tight sm:text-4xl">
          {geocodedAddress}
        </h2>
        <p className="relative mt-3 text-sm font-medium text-ink-muted">
          PARID {result.parcel.pin}
          <span className="mx-2 text-[#98543f]">/</span>
          Proposed {proposedProjectTypeLabel(result.request.proposedProjectType)}
        </p>
        <p className="relative mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
          We matched your address to County parcel ID (PARID) {result.parcel.pin}.
          The findings below are tied to this parcel, not to the address text alone.
        </p>
        {addressesDiffer ? (
          <p className="relative mt-3 max-w-3xl border-l-2 border-[#98543f] pl-3 text-sm leading-6 text-ink-muted">
            Address strings differ. Screening is attached to PARID {result.parcel.pin},
            not to the entered house number alone.
          </p>
        ) : null}
        {houseNumberZero ? (
          <p className="relative mt-3 max-w-3xl border-l-2 border-[#98543f] pl-3 text-sm leading-6 text-ink-muted">
            County house number is 0 for this PARID; the assessment record is not
            the entered address.
          </p>
        ) : null}
      </header>
      <details className="mt-3">
        <summary className="inline-flex min-h-9 cursor-pointer items-center text-sm font-semibold text-accent underline decoration-accent/40 underline-offset-4">
          Parcel identity details
        </summary>
        <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-ink-muted">Entered address</dt>
          <dd>{enteredAddress}</dd>
          <dt className="text-ink-muted">Census geocoded address</dt>
          <dd>{geocodedAddress}</dd>
          <dt className="text-ink-muted">County assessment address</dt>
          <dd>
            {assessmentAddress ?? "Not reported for this PARID"}
            {houseNumberZero
              ? " (County house number is 0 for this PARID; this is the assessment record, not the entered address)"
              : ""}
          </dd>
          {result.parcel.mapBlockLot ? (
            <>
              <dt className="text-ink-muted">MAPBLOCKLOT</dt>
              <dd>{result.parcel.mapBlockLot}</dd>
            </>
          ) : null}
        </dl>
      </details>
      <p className="mt-2 text-sm text-ink-muted">
        Decision support only — not legal, zoning, engineering, environmental,
        or financial advice.{" "}
        <a href="#result-scoring" className="text-accent underline">
          How scoring works
        </a>
      </p>
      <p className="mt-3 text-sm text-ink-muted">
        Want a quick cost and rent estimate?{" "}
        <a href="#result-scenario" className="font-semibold text-accent underline">
          Open the Quick Development Scenario
        </a>{" "}
        using your own assumptions. It is not a pro forma.
      </p>

      <section aria-labelledby="first-look-heading" className="mt-7">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="bw-kicker">Read these first</p>
            <h2 id="first-look-heading" className="mt-1 text-xl font-semibold tracking-tight">
              Zoning &amp; historic review
            </h2>
          </div>
          <p className="max-w-sm text-xs leading-5 text-ink-muted">
            Mapped evidence only. These are screening findings, not approvals.
          </p>
        </div>
        <FirstLookFindings
          zoning={result.zoning}
          useCompatibility={result.useCompatibility}
          historicDesignation={result.historicDesignation}
        />
      </section>

      <ResultJumpNav />

      <div id="result-snapshot" className="scroll-mt-24">
        <SnapshotMetrics decision={result.decision} />
        <CoverageWarning coveragePercent={result.decision.coverage.percent} />
      </div>
      <CriticalFlagsCard decision={result.decision} />
      <RecommendedVerification steps={result.recommendedVerification} />
      <div id="result-map" className="scroll-mt-24">
        <ParcelEvidenceMap data={result.evidenceMap} />
      </div>

      <section className="mt-10" aria-labelledby="regulatory-fit-heading">
        <h2
          id="regulatory-fit-heading"
          className="text-xl font-semibold tracking-tight"
        >
          Regulatory Fit
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">
          Mapped zoning and historic context, followed by permits and
          violations joined to the canonical parcel identity.
        </p>
        <ZoningEntitlement
          zoning={result.zoning}
          useCompatibility={result.useCompatibility}
        />
        <HistoricDesignReview
          historicDesignation={result.historicDesignation}
        />
        <div id="result-regulatory" className="scroll-mt-24">
          <RegulatoryContext regulatoryRecords={result.regulatoryRecords} />
        </div>
      </section>

      <section id="result-site" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold tracking-tight">Physical Site</h2>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">
          Mapped steep slope, landslide, mine, and flood evidence. A missing
          layer is not a clear site. No mapped intersection describes the queried
          layer only; it is not a site investigation or a guarantee of absence.
        </p>
        <PhysicalSite
          steepSlope={result.steepSlope}
          landslide={result.landslide}
          undermined={result.undermined}
        />
        <EnvironmentalConditions flood={result.flood} />
      </section>

      <FinancialContextWithChat
        financial={result.financialContext}
        claudeContext={result.claudeContext}
        sessionKey={`${result.parcel.pin}:${result.request.proposedProjectType}`}
        interpretation={<AiBrief result={result} />}
      />
      <HowScoringWorks decision={result.decision} />
      <SourcesAndAssumptions result={result} />
      <EvidenceGapsCard gaps={result.decision.evidenceGaps} />
      <ParcelFactsDetail
        pin={result.parcel.pin}
        assessment={result.assessment}
        censusMatchedAddress={result.census.matchedAddress}
        acreage={result.parcel.calculatedAcreage}
      />
    </div>
  );
}

function FirstLookFindings({
  zoning,
  useCompatibility,
  historicDesignation,
}: {
  zoning: ZoningLookupResult;
  useCompatibility: UseCompatibilityResult;
  historicDesignation: HistoricDesignationResult;
}) {
  const historicBadge =
    historicDesignation.partialEvidence
      ? "Partial / Not Evaluated"
      : historicDesignation.overallStatus === "HISTORIC_STATUS_NOT_EVALUATED"
        ? "Not Evaluated"
        : historicDesignation.overallStatus ===
            "NO_HISTORIC_DESIGNATION_IDENTIFIED"
          ? "No mapped intersection"
          : "Review required";
  const historicTone =
    historicDesignation.partialEvidence ||
    (historicDesignation.overallStatus !==
      "HISTORIC_STATUS_NOT_EVALUATED" &&
      historicDesignation.overallStatus !==
        "NO_HISTORIC_DESIGNATION_IDENTIFIED")
      ? "review"
      : historicDesignation.overallStatus === "HISTORIC_STATUS_NOT_EVALUATED"
        ? "neutral"
        : "accent";

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <article className="bw-card overflow-hidden border-l-4 border-l-accent p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Zoning &amp; base use table</h3>
          {zoning.status === "ok" ? (
            <StatusBadge>Mapped</StatusBadge>
          ) : zoning.status === "no_district" ? (
            <StatusBadge tone="review">Requires Review</StatusBadge>
          ) : (
            <StatusBadge>Not Evaluated</StatusBadge>
          )}
        </div>
        {zoning.status === "ok" ? (
          <>
            <p className="mt-3 text-lg font-semibold tracking-tight">
              {zoning.districts.map((district) => district.code).join(" + ")}
            </p>
            <ul className="mt-2 space-y-1 text-sm leading-5 text-ink-muted">
              {useCompatibility.districts.map((district) => (
                <li key={district.mappedZoningCode}>
                  <span className="font-medium text-ink">
                    {district.mappedZoningCode}
                  </span>
                  {" · "}
                  {formatUseTableStatus(district.status)}
                </li>
              ))}
            </ul>
            {zoning.splitZoning ? (
              <p className="mt-2 text-xs leading-5 text-ink-muted">
                Split zoning: all mapped districts are shown; no controlling
                district was selected.
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            {zoning.message}
          </p>
        )}
        <p className="mt-3 border-t border-line pt-2 text-xs leading-5 text-ink-muted">
          Mapped district and preliminary use-table encoding only—not a permit
          or entitlement determination.
        </p>
        <p className="mt-2 text-xs leading-5 text-ink-muted">
          Table key: P = permitted by right; A = administrator exception;
          S = special exception; C = conditional use. A use not identified in
          our encoded table is <strong>not</strong> a finding that it is prohibited.
        </p>
      </article>

      <article className="bw-card overflow-hidden border-l-4 border-l-[#98543f] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Historic / design review</h3>
          <StatusBadge tone={historicTone === "accent" ? "neutral" : historicTone}>
            {historicBadge}
          </StatusBadge>
        </div>
        <p className="mt-3 text-lg font-semibold tracking-tight">
          {historicDesignation.overallStatusLabel}
        </p>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          {historicDesignation.message}
        </p>
        {historicDesignation.partialEvidence ? (
          <p className="mt-2 text-xs leading-5 text-review">
            Partial source coverage: {historicDesignation.unevaluatedLayers.join(" and ")}{" "}
            not evaluated.
          </p>
        ) : null}
        <p className="mt-3 border-t border-line pt-2 text-xs leading-5 text-ink-muted">
          Queried historic layers only. A mapped non-intersection is not a
          complete historic review.
        </p>
      </article>
    </div>
  );
}

function SnapshotMetrics({ decision }: { decision: DecisionSnapshot }) {
  const { presentation } = decision;

  return (
    <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.15fr_1fr_1fr_1fr]">
        <Metric
          featured
          label="Development Ease Score"
          value={
            presentation.mode === "incomplete"
              ? presentation.heading
              : presentation.valueLine
          }
          detail={
            presentation.mode === "incomplete"
              ? presentation.caveat
              : "100/100 means no deductions in evaluated factors, not complete feasibility or approval."
          }
        />
        <Metric
          label="Overall Screening Status"
          value={decision.screeningStatusLabel}
          detail="Independent of the numeric score."
        />
        <Metric
          label="Core Evidence Coverage"
          value={`${decision.coverage.percent}%`}
          detail={`${decision.coverage.label}. Even 100% means only the implemented core layers were checked, not that all due diligence is complete.`}
        />
        <Metric
          label="Critical Review Flags"
          value={String(decision.flags.length)}
          detail={
            decision.flags.length === 0
              ? "No review flags from currently implemented evidence."
              : "Flags stay visible regardless of the numeric score."
          }
        />
      </div>
      <div className="bw-card mt-3 p-4">
        <p className="text-sm font-medium">Score breakdown</p>
        <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-muted">Regulatory Fit</dt>
            <dd>{decision.score.regulatoryFit.display}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Physical Site</dt>
            <dd>{decision.score.physicalSite.display}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-ink-muted">
          Missing evidence is not treated as favorable.{" "}
          <a href="#result-scoring" className="text-accent underline">
            How scoring works
          </a>
        </p>
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  detail,
  featured = false,
}: {
  label: string;
  value: string;
  detail: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`bw-card p-4 sm:p-5 ${
        featured
          ? "bw-card--featured shadow-[0_8px_22px_rgba(40,86,75,0.12)]"
          : ""
      }`}
    >
      <p className={`text-sm ${featured ? "text-[#dbe6dc]" : "text-ink-muted"}`}>
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${featured ? "sm:text-3xl" : ""}`}>
        {value}
      </p>
      <p className={`mt-2 text-sm leading-6 ${featured ? "text-[#e2ebe2]" : ""}`}>
        {detail}
      </p>
    </div>
  );
}

function HowScoringWorks({ decision }: { decision: DecisionSnapshot }) {
  return (
    <section id="result-scoring" className="bw-card mt-10 scroll-mt-24 p-5">
      <h2 className="text-lg font-semibold">How scoring works</h2>
      <p className="mt-2 text-sm leading-6">
        Scoring v{decision.scoringVersion}. {decision.heuristicLabel}
      </p>
      <p className="mt-2 text-sm leading-6">
        A 0–100 Development Ease Score is published only when Regulatory Fit and
        all four physical factors were successfully evaluated. Missing or
        unsupported evidence is not scored as a known penalty and is not treated
        as favorable. Critical review flags and overall screening status stay
        independent of the number.
      </p>
      <p className="mt-2 text-sm leading-6">
        Evaluated weights: zoning/use 50, steep slope 20, flood 18, mine 8,
        landslide 4. Slope penalty scales with overlap. Flood, mine, and
        landslide use fixed penalties when they intersect.
      </p>
      <p className="mt-2 text-sm text-ink-muted leading-6">
        {decision.score.formula}
      </p>
    </section>
  );
}

function CoverageWarning({ coveragePercent }: { coveragePercent: number }) {
  if (coveragePercent >= COVERAGE_THRESHOLDS.normalMin) {
    return null;
  }

  const insufficient =
    coveragePercent < COVERAGE_THRESHOLDS.preliminaryMin;

  return (
    <div className="bw-card mt-4 border-alert/30 bg-alert-soft p-4" role="alert">
      <h2 className="text-lg font-semibold">Incomplete evidence</h2>
      <p className="mt-2 text-sm leading-6">
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
      <section id="result-zoning" className="bw-card mt-6 scroll-mt-24 p-5" role="alert">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">Zoning & Entitlement</h3>
          <StatusBadge>Not Evaluated</StatusBadge>
        </div>
        <p className="mt-2 text-sm leading-6">
          Base zoning — Not Evaluated / Source Unavailable. {zoning.message}
        </p>
        <UseCompatibilityBlock useCompatibility={useCompatibility} />
      </section>
    );
  }

  if (zoning.status === "no_district") {
    return (
      <section id="result-zoning" className="bw-card mt-6 scroll-mt-24 p-5" role="alert">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">Zoning & Entitlement</h3>
          <StatusBadge tone="review">Requires Review</StatusBadge>
        </div>
        <p className="mt-2 text-sm leading-6">{zoning.message}</p>
        <UseCompatibilityBlock useCompatibility={useCompatibility} />
        <ZoningSource source={zoning.source} />
      </section>
    );
  }

  return (
    <section id="result-zoning" className="bw-card mt-6 scroll-mt-24 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold">Zoning & Entitlement</h3>
        <StatusBadge>Evaluated</StatusBadge>
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        Mapped GIS district only. This is not a determination that a use is
        permitted, approved, or buildable.
      </p>
      {zoning.splitZoning ? (
        <p className="mt-2 text-sm" role="status">
          Split zoning: multiple mapped districts intersect this parcel. All
          intersecting districts and their area shares are listed. A controlling
          district was not selected because a project/building envelope is not
          available. Data verification is required.
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
            {district.intersectionPercent !== null
              ? ` · ${district.intersectionPercent.toFixed(1)}% of parcel`
              : " · intersection percent not calculated"}
            {district.intersectionAreaSqFt !== null
              ? ` (${new Intl.NumberFormat("en-US").format(Math.round(district.intersectionAreaSqFt))} sq ft)`
              : ""}
          </li>
        ))}
      </ul>
      <UseCompatibilityBlock useCompatibility={useCompatibility} />
      <ZoningSource source={zoning.source} />
    </section>
  );
}

function formatUseTableStatus(status: UseTableStatus): string {
  switch (status) {
    case "PERMITTED_BY_RIGHT":
      return "Table symbol P";
    case "ADMINISTRATOR_EXCEPTION":
      return "Administrator exception (A)";
    case "SPECIAL_EXCEPTION":
      return "Special exception (S)";
    case "CONDITIONAL_USE":
      return "Conditional use (C)";
    case "NOT_COMPATIBLE":
      return "Not compatible in the encoded use table";
    case "NOT_IDENTIFIED":
      return "Not identified";
    case "NOT_EVALUATED":
      return "Not Evaluated";
    case "REQUIRES_VERIFICATION":
      return "Requires verification";
  }
}

function UseTableStatusBadge({ status }: { status: UseTableStatus }) {
  switch (status) {
    case "PERMITTED_BY_RIGHT":
      return <StatusBadge>Permitted by Right</StatusBadge>;
    case "NOT_IDENTIFIED":
      return <StatusBadge>Not Identified</StatusBadge>;
    case "NOT_EVALUATED":
      return <StatusBadge>Not Evaluated</StatusBadge>;
    case "NOT_COMPATIBLE":
    case "REQUIRES_VERIFICATION":
    case "ADMINISTRATOR_EXCEPTION":
    case "SPECIAL_EXCEPTION":
    case "CONDITIONAL_USE":
      return <StatusBadge tone="review">Requires Review</StatusBadge>;
  }
}

function UseCompatibilityBlock({
  useCompatibility,
}: {
  useCompatibility: UseCompatibilityResult;
}) {
  return (
    <div className="mt-4 rounded-lg border border-line bg-paper p-4">
      <h4 className="text-sm font-semibold">
        Preliminary base-zoning use-table result
      </h4>
      <p className="mt-1 text-sm text-ink-muted">
        This is a first-pass encoding of Pittsburgh Zoning Code § 911.02. It is
        subject to use classification verification, dimensional standards,
        overlays, legal lot status, and applicable staff or professional review.
        It is not a legal entitlement determination.
      </p>
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-ink-muted">Proposed use</dt>
        <dd>{useCompatibility.proposedUseLabel}</dd>
        {useCompatibility.districts.length === 0 ? (
          <>
            <dt className="text-ink-muted">Mapped zoning code</dt>
            <dd>Not available for lookup</dd>
            <dt className="text-ink-muted">Base zoning family</dt>
            <dd>Not applied</dd>
          </>
        ) : (
          useCompatibility.districts.map((district) => (
            <Fragment key={district.mappedZoningCode}>
              <dt className="text-ink-muted">Mapped zoning code</dt>
              <dd>{district.mappedZoningCode}</dd>
              <dt className="text-ink-muted">Base zoning family used for lookup</dt>
              <dd>{district.baseZoningFamily ?? "Not identified / unsupported"}</dd>
              <dt className="text-ink-muted">Use-table cell</dt>
              <dd>
                {district.status === "NOT_IDENTIFIED"
                  ? "Not encoded for this district"
                  : (district.tableSymbol ?? "blank")}
              </dd>
              <dt className="text-ink-muted">
                Preliminary base-zoning use-table result
              </dt>
              <dd className="flex flex-wrap items-center gap-2">
                <UseTableStatusBadge status={district.status} />
                <span>{formatUseTableStatus(district.status)}</span>
              </dd>
              {district.conditionNote ? (
                <>
                  <dt className="text-ink-muted">Qualified cell</dt>
                  <dd>{district.conditionNote}</dd>
                </>
              ) : null}
            </Fragment>
          ))
        )}
        <dt className="text-ink-muted">Code citation</dt>
        <dd>
          <a className="text-accent underline" href={useCompatibility.citationUrl}>
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
    <section className="bw-card mt-6 p-5">
      <h3 className="text-lg font-semibold">Physical Site Conditions</h3>
      <p className="mt-2 text-sm text-ink-muted">
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
    <section className="bw-card mt-6 p-5">
      <h3 className="text-lg font-semibold">Environmental Conditions</h3>
      <p className="mt-1 text-sm leading-5 text-ink-muted">
        Mapped flood-layer evidence only. No mapped intersection is not a
        guarantee of no flood exposure.
      </p>
      <FloodBlock flood={flood} />
    </section>
  );
}

function HistoricDesignReview({
  historicDesignation,
}: {
  historicDesignation: HistoricDesignationResult;
}) {
  const tone = historicDesignation.partialEvidence
    ? "review"
    : historicDesignation.overallStatus === "HISTORIC_STATUS_NOT_EVALUATED"
      ? "neutral"
      : historicDesignation.overallStatus ===
          "NO_HISTORIC_DESIGNATION_IDENTIFIED"
        ? "accent"
        : "review";
  const districtNames =
    historicDesignation.districts.status === "ok"
      ? historicDesignation.districts.districts.map((district) => district.name)
      : [];
  const siteNames =
    historicDesignation.sites.status === "ok"
      ? historicDesignation.sites.sites.map((site) => site.name)
      : [];
  const districtOverlap =
    historicDesignation.districts.status === "ok"
      ? historicDesignation.districts.overlapPercent
      : null;
  const siteOverlap =
    historicDesignation.sites.status === "ok"
      ? historicDesignation.sites.overlapPercent
      : null;
  const reviewFlags = [
    historicDesignation.districts.status === "ok" &&
    historicDesignation.districts.intersects
      ? "Historic district review"
      : null,
    historicDesignation.sites.status === "ok" &&
    historicDesignation.sites.intersects
      ? "Historic site review"
      : null,
  ].filter((flag): flag is string => Boolean(flag));

  return (
    <section className="bw-card mt-6 p-5">
      <h3 className="text-lg font-semibold">Historic / Design Review</h3>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        {historicDesignation.overallStatusLabel}{" "}
        <StatusBadge tone={tone === "accent" ? "neutral" : tone}>
          {historicDesignation.overallStatus === "HISTORIC_STATUS_NOT_EVALUATED"
            ? "Not Evaluated"
            : historicDesignation.overallStatus ===
                "NO_HISTORIC_DESIGNATION_IDENTIFIED"
              ? "No mapped intersection"
              : "Review required"}
        </StatusBadge>
        {historicDesignation.partialEvidence ? (
          <StatusBadge>Partial / Not Evaluated</StatusBadge>
        ) : null}
      </p>
      {historicDesignation.partialEvidence ? (
        <p className="mt-2 text-sm">
          Partial historic evidence.{" "}
          {historicDesignation.unevaluatedLayers.join(" and ")}{" "}
          {historicDesignation.unevaluatedLayers.length === 1 ? "was" : "were"}{" "}
          Not Evaluated. The review flag below is based only on the successful
          historic sublayer. This card is not a complete historic screening.
        </p>
      ) : null}
      <p className="mt-2 text-sm">{historicDesignation.message}</p>
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink-muted">Historic district</dt>
          <dd>
            {historicDesignation.districts.status !== "ok"
              ? "Not Evaluated"
              : historicDesignation.districts.intersects
                ? districtNames.join("; ") || "Intersection identified"
                : "No intersection identified"}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">District overlap</dt>
          <dd>
            {historicDesignation.districts.status !== "ok"
              ? "Not Evaluated"
              : districtOverlap === null
                ? "Not calculated"
                : `${districtOverlap.toFixed(1)}%`}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Individual designation</dt>
          <dd>
            {historicDesignation.sites.status !== "ok"
              ? "Not Evaluated"
              : historicDesignation.sites.intersects
                ? siteNames.join("; ") || "Intersection identified"
                : "No intersection identified"}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Site overlap</dt>
          <dd>
            {historicDesignation.sites.status !== "ok"
              ? "Not Evaluated"
              : siteOverlap === null
                ? "Not calculated"
                : `${siteOverlap.toFixed(1)}%`}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Review flags</dt>
          <dd>{reviewFlags.length > 0 ? reviewFlags.join(", ") : "None"}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Canonical PIN</dt>
          <dd>{historicDesignation.parcelId}</dd>
        </div>
      </dl>
      <SourceDisclosure
        name={historicDesignation.districts.source.name}
        lastModified={historicDesignation.districts.source.sourceLastModified}
        href={historicDesignation.districts.source.datasetUrl}
        linkLabel="Historic districts"
        details={
          <>
            <p>
              Retrieved {historicDesignation.districts.source.retrievedAt}.
            </p>
            <p>CRS: {historicDesignation.districts.source.crs}.</p>
            <p>Query: {historicDesignation.districts.source.queryUrl}</p>
          </>
        }
      />
      <SourceDisclosure
        name={historicDesignation.sites.source.name}
        lastModified={historicDesignation.sites.source.sourceLastModified}
        href={historicDesignation.sites.source.datasetUrl}
        linkLabel="Historic sites"
        details={
          <>
            <p>Retrieved {historicDesignation.sites.source.retrievedAt}.</p>
            <p>CRS: {historicDesignation.sites.source.crs}.</p>
            <p>Query: {historicDesignation.sites.source.queryUrl}</p>
          </>
        }
      />
      <p className="mt-3 text-sm font-medium">Limitations</p>
      <ul className="mt-1 list-disc pl-5 text-sm text-ink-muted">
        {historicDesignation.limitations.map((limitation) => (
          <li key={limitation}>{limitation}</li>
        ))}
      </ul>
    </section>
  );
}

function RegulatoryContext({
  regulatoryRecords,
}: {
  regulatoryRecords: RegulatoryRecordsResult;
}) {
  const permitTone =
    regulatoryRecords.permits.status !== "ok"
      ? "neutral"
      : regulatoryRecords.unresolvedPermitCount > 0 ||
          (regulatoryRecords.permits.status === "ok" &&
            regulatoryRecords.permits.records.some(
              (record) => record.reviewClass === "REQUIRES_VERIFICATION",
            ))
        ? "review"
        : "accent";
  const violationTone =
    regulatoryRecords.violations.status !== "ok"
      ? "neutral"
      : regulatoryRecords.unresolvedViolationCount > 0 ||
          (regulatoryRecords.violations.status === "ok" &&
            regulatoryRecords.violations.records.some(
              (record) => record.reviewClass === "REQUIRES_VERIFICATION",
            ))
        ? "review"
        : "accent";
  const overallTone =
    regulatoryRecords.overallStatus === "REGULATORY_RECORDS_NOT_EVALUATED"
      ? "neutral"
      : regulatoryRecords.overallStatus === "NO_UNRESOLVED_RECORDS_IDENTIFIED"
        ? "accent"
        : "review";

  return (
    <section className="bw-card mt-6 p-5">
      <h3 className="text-lg font-semibold">Regulatory Context</h3>
      <div className="mt-5">
        <h4 className="text-base font-semibold">Regulatory Records</h4>
        <p className="mt-1 text-sm text-ink-muted">
          Separate from Core Evidence Coverage. Missing data is Not Evaluated,
          never favorable. No record found is not proof that no regulatory issue
          exists.
        </p>
        <p className="mt-3 text-xs text-ink-muted">
          Permit/violation join uses canonical PARID {regulatoryRecords.parcelId}{" "}
          from parcel analysis (not an independent address match).
        </p>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          Regulatory Records Status: {regulatoryRecords.overallStatusLabel}{" "}
          <StatusBadge tone={overallTone === "accent" ? "neutral" : overallTone}>
            {regulatoryRecords.overallStatus ===
            "REGULATORY_RECORDS_NOT_EVALUATED"
              ? "Not Evaluated"
              : regulatoryRecords.overallStatus ===
                  "NO_UNRESOLVED_RECORDS_IDENTIFIED"
                ? "Evaluated"
                : "Review required"}
          </StatusBadge>
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-ink-muted">Permits</dt>
            <dd>{regulatoryRecords.permitCount}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Unresolved permits</dt>
            <dd>{regulatoryRecords.unresolvedPermitCount}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Violation casefiles</dt>
            <dd>{regulatoryRecords.violationCount}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Unresolved violations</dt>
            <dd>{regulatoryRecords.unresolvedViolationCount}</dd>
          </div>
        </dl>

        <PermitRecordsBlock
          permits={regulatoryRecords.permits}
          tone={permitTone}
        />
        <ViolationRecordsBlock
          violations={regulatoryRecords.violations}
          tone={violationTone}
        />

        <p className="mt-3 text-sm font-medium">Limitations</p>
        <ul className="mt-1 list-disc pl-5 text-sm text-ink-muted">
          {regulatoryRecords.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PermitRecordsBlock({
  permits,
  tone,
}: {
  permits: RegulatoryRecordsResult["permits"];
  tone: "neutral" | "accent" | "review";
}) {
  if (permits.status !== "ok") {
    return (
      <div className="mt-4">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          Permits — Not Evaluated. <StatusBadge>Not Evaluated</StatusBadge>
        </p>
        <p className="mt-1 text-sm text-ink-muted">{permits.message}</p>
        <RegulatorySourceLine
          source={permits.source}
          linkLabel="WPRDC PLI Permits"
        />
      </div>
    );
  }

  const { preview, extra } = partitionReviewRecords(permits.records);

  return (
    <div className="mt-4">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        Permits — {permits.records.length} record(s) in the queried feed.{" "}
        <StatusBadge tone={tone === "accent" ? "neutral" : tone}>
          {tone === "review" ? "Review required" : "Evaluated"}
        </StatusBadge>
      </p>
      <RegulatorySourceLine
        source={permits.source}
        linkLabel="WPRDC PLI Permits"
        joinMethod={permits.joinMethod}
      />
      {preview.length === 0 ? (
        <p className="mt-2 text-sm">
          No permit records identified in the queried dataset for this parcel.
        </p>
      ) : (
        <RecordTable
          headers={[
            "Permit ID",
            "Type",
            "Status",
            "Issued",
            "Completed",
            "Work",
          ]}
          rows={preview.map((record) => [
            record.permitId,
            record.permitType ?? "—",
            reviewStatusLabel(record.status, record.reviewClass),
            record.issueDate ?? "—",
            record.completionDate ?? "not in source",
            record.workType ?? record.workDescription ?? "—",
          ])}
        />
      )}
      {extra.length > 0 ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-accent">
            Show {extra.length} additional permit record(s)
          </summary>
          <RecordTable
            headers={[
              "Permit ID",
              "Type",
              "Status",
              "Issued",
              "Completed",
              "Work",
            ]}
            rows={extra.map((record) => [
              record.permitId,
              record.permitType ?? "—",
              reviewStatusLabel(record.status, record.reviewClass),
              record.issueDate ?? "—",
              record.completionDate ?? "not in source",
              record.workType ?? record.workDescription ?? "—",
            ])}
          />
        </details>
      ) : null}
    </div>
  );
}

function ViolationRecordsBlock({
  violations,
  tone,
}: {
  violations: RegulatoryRecordsResult["violations"];
  tone: "neutral" | "accent" | "review";
}) {
  if (violations.status !== "ok") {
    return (
      <div className="mt-4">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          Violations — Not Evaluated. <StatusBadge>Not Evaluated</StatusBadge>
        </p>
        <p className="mt-1 text-sm text-ink-muted">{violations.message}</p>
        <RegulatorySourceLine
          source={violations.source}
          linkLabel="WPRDC violations"
        />
      </div>
    );
  }

  const { preview, extra } = partitionReviewRecords(violations.records);

  return (
    <div className="mt-4">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        Violations — {violations.records.length} casefile(s) in the queried
        feed.{" "}
        <StatusBadge tone={tone === "accent" ? "neutral" : tone}>
          {tone === "review" ? "Review required" : "Evaluated"}
        </StatusBadge>
      </p>
      <RegulatorySourceLine
        source={violations.source}
        linkLabel="WPRDC violations"
        joinMethod={violations.joinMethod}
      />
      {preview.length === 0 ? (
        <p className="mt-2 text-sm">
          No violation casefiles identified in the queried dataset for this
          parcel.
        </p>
      ) : (
        <RecordTable
          headers={[
            "Casefile",
            "Department",
            "Status",
            "Opened",
            "Closed",
            "Description",
          ]}
          rows={preview.map((record) => [
            record.casefileNumber,
            record.department ?? "—",
            reviewStatusLabel(record.status, record.reviewClass),
            record.openedDate ?? "—",
            record.closedDate ?? "not in source",
            record.description ?? record.category ?? "—",
          ])}
        />
      )}
      {extra.length > 0 ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-accent">
            Show {extra.length} additional casefile(s)
          </summary>
          <RecordTable
            headers={[
              "Casefile",
              "Department",
              "Status",
              "Opened",
              "Closed",
              "Description",
            ]}
            rows={extra.map((record) => [
              record.casefileNumber,
              record.department ?? "—",
              reviewStatusLabel(record.status, record.reviewClass),
              record.openedDate ?? "—",
              record.closedDate ?? "not in source",
              record.description ?? record.category ?? "—",
            ])}
          />
        </details>
      ) : null}
    </div>
  );
}

function gapStateLabel(state: string): string {
  if (state === "NOT_EVALUATED") {
    return "Not Evaluated";
  }
  if (state === "REQUIRES_FURTHER_DUE_DILIGENCE") {
    return "Requires further due diligence";
  }
  return state.replaceAll("_", " ");
}

function reviewStatusLabel(
  status: string | null,
  reviewClass: string,
): string {
  const review =
    reviewClass === "UNRESOLVED"
      ? "Unresolved"
      : reviewClass === "REQUIRES_VERIFICATION"
        ? "Requires verification"
        : reviewClass === "NOT_UNRESOLVED"
          ? "Not unresolved"
          : reviewClass;
  return `${status ?? "not reported"} · ${review}`;
}

function partitionReviewRecords<T extends { reviewClass: string }>(records: T[]) {
  const priority = records.filter(
    (record) =>
      record.reviewClass === "UNRESOLVED" ||
      record.reviewClass === "REQUIRES_VERIFICATION",
  );
  const rest = records.filter(
    (record) =>
      record.reviewClass !== "UNRESOLVED" &&
      record.reviewClass !== "REQUIRES_VERIFICATION",
  );
  const ordered = [...priority, ...rest];
  const visibleCount = Math.max(5, priority.length);
  return {
    preview: ordered.slice(0, visibleCount),
    extra: ordered.slice(visibleCount),
  };
}

function RegulatorySourceLine({
  source,
  linkLabel,
  joinMethod,
}: {
  source: RegulatoryRecordsResult["permits"]["source"];
  linkLabel: string;
  joinMethod?: string;
}) {
  return (
    <SourceDisclosure
      name={source.name}
      lastModified={source.sourceLastModified}
      href={source.datasetUrl}
      linkLabel={linkLabel}
      details={
        <>
          <p>Temporal coverage: {source.temporalCoverage}.</p>
          <p>Retrieved {source.retrievedAt}.</p>
          {joinMethod ? <p>Join: {joinMethod}.</p> : null}
          <p className="break-all">Query: {source.queryUrl}</p>
        </>
      }
    />
  );
}

function RecordTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-line">
            {headers.map((header) => (
              <th key={header} className="py-1 pr-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("|")} className="border-b border-line align-top">
              {row.map((cell, index) => (
                <td key={`${headers[index]}-${cell}`} className="py-1 pr-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EvidenceGapsCard({
  gaps,
}: {
  gaps: DecisionSnapshot["evidenceGaps"];
}) {
  const core = gaps.filter((gap) => gap.category === "core_source");
  const regulatory = gaps.filter((gap) => gap.category === "regulatory_source");
  const unimplemented = gaps.filter((gap) => gap.category === "unimplemented");

  return (
    <section id="result-gaps" className="bw-card mt-6 scroll-mt-24 p-5">
      <h2 className="text-lg font-semibold">Not Evaluated / Further Due Diligence</h2>
      <p className="mt-1 text-sm text-ink-muted">
        These items are not scored. Missing evidence is not treated as favorable.
      </p>
      {core.length > 0 ? (
        <>
          <h3 className="mt-3 text-sm font-semibold">Core evidence gaps</h3>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {core.map((gap) => (
              <li key={gap.label}>
                {gap.label} — {gapStateLabel(gap.state)}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {regulatory.length > 0 ? (
        <>
          <h3 className="mt-3 text-sm font-semibold">Regulatory records gaps</h3>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {regulatory.map((gap) => (
              <li key={gap.label}>
                {gap.label} — {gapStateLabel(gap.state)}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <h3 className="mt-3 text-sm font-semibold">
        Requires further due diligence
      </h3>
      <ul className="mt-2 list-disc pl-5 text-sm">
        {unimplemented.map((gap) => (
          <li key={gap.label}>
            {gap.label} — Not Evaluated
          </li>
        ))}
      </ul>
    </section>
  );
}

function CriticalFlagsCard({ decision }: { decision: DecisionSnapshot }) {
  return (
    <section className="bw-card mt-6 border-review/30 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Critical Flags</h2>
        {decision.flags.length > 0 ? (
          <StatusBadge tone="review">Requires Review</StatusBadge>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-ink-muted">
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
            <li key={flag.type} className="rounded-lg border border-line bg-paper p-4">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                <StatusBadge tone="review">Review required</StatusBadge>
                {flag.title}
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
    <section className="bw-card mt-6 p-5">
      <h2 className="text-lg font-semibold">Recommended Verification</h2>
      <p className="mt-1 text-sm text-ink-muted">
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

function SourcesAndAssumptions({ result }: { result: OkResult }) {
  const rows = buildSourceRows(result);

  return (
    <SourcesAssumptionsDisclosure>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="py-2 pr-3 font-medium">Source / steward</th>
              <th className="py-2 pr-3 font-medium">Finding</th>
              <th className="py-2 pr-3 font-medium">Join / method</th>
              <th className="py-2 pr-3 font-medium">Vintage / retrieved</th>
              <th className="py-2 font-medium">Limitation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-line align-top">
                <td className="py-2 pr-3">
                  {row.href ? (
                    <a className="text-accent underline" href={row.href}>
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
    </SourcesAssumptionsDisclosure>
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
      <section id="result-facts" className="bw-card mt-6 scroll-mt-24 p-5" role="alert">
        <h2 className="text-lg font-semibold">Property facts</h2>
        <p className="mt-2 text-sm">{assessment.message}</p>
        <p className="mt-2 text-sm text-ink-muted">
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
    <section id="result-facts" className="bw-card mt-6 scroll-mt-24 p-5">
      <h2 className="text-lg font-semibold">Property facts</h2>
      <p className="mt-1 text-sm text-ink-muted">
        County assessed values are not market values.
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-ink-muted">Census geocoded address</dt>
        <dd>{censusMatchedAddress}</dd>
        <dt className="text-ink-muted">Parcel ID</dt>
        <dd>{facts.parid}</dd>
        <dt className="text-ink-muted">PIN / PARID match</dt>
        <dd>
          {facts.parid === pin
            ? "PIN matches assessment PARID"
            : "Mismatch"}
        </dd>
        <dt className="text-ink-muted">County assessment address</dt>
        <dd>{facts.propertyAddress ?? "Not reported"}</dd>
        <dt className="text-ink-muted">Municipality</dt>
        <dd>{facts.municipality ?? facts.municipalityCode ?? "Not reported"}</dd>
        <dt className="text-ink-muted">Class</dt>
        <dd>{classLabel || "Not reported"}</dd>
        <dt className="text-ink-muted">Current land use</dt>
        <dd>{facts.useDescription ?? "Not reported"}</dd>
        <dt className="text-ink-muted">Lot area</dt>
        <dd>{formatLotArea(facts.lotArea)}</dd>
        <dt className="text-ink-muted">Calculated acreage (GIS)</dt>
        <dd>{acreage ?? "—"}</dd>
        <dt className="text-ink-muted">County assessed land value</dt>
        <dd>{formatCountyAssessedValue(facts.countyAssessedLandValue)}</dd>
        <dt className="text-ink-muted">County assessed building value</dt>
        <dd>{formatCountyAssessedValue(facts.countyAssessedBuildingValue)}</dd>
        <dt className="text-ink-muted">County assessed total</dt>
        <dd>{formatCountyAssessedValue(facts.countyAssessedTotal)}</dd>
        {facts.yearBuilt !== null ? (
          <>
            <dt className="text-ink-muted">Year built</dt>
            <dd>{facts.yearBuilt}</dd>
          </>
        ) : null}
        {facts.stories !== null ? (
          <>
            <dt className="text-ink-muted">Stories</dt>
            <dd>{facts.stories}</dd>
          </>
        ) : null}
        {facts.finishedLivingArea !== null ? (
          <>
            <dt className="text-ink-muted">Finished living area</dt>
            <dd>
              {new Intl.NumberFormat("en-US").format(facts.finishedLivingArea)} sq
              ft
            </dd>
          </>
        ) : null}
        {sourceDate ? (
          <>
            <dt className="text-ink-muted">Assessment / source date</dt>
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
    <div className="bw-card mt-5 border-alert/30 bg-alert-soft p-5 sm:p-6" role="alert" aria-labelledby="lookup-error-heading">
      <div className="flex gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-alert/25 bg-[#fbf4ef] font-semibold text-alert" aria-hidden="true">
          !
        </span>
        <div className="min-w-0">
          <p className="bw-kicker">Lookup needs attention</p>
          <h2 id="lookup-error-heading" className="mt-1 text-lg font-semibold">{title}</h2>
          <p className="mt-2 text-sm leading-6">{result.message}</p>
        </div>
      </div>
      {"census" in result ? (
        <p className="mt-3 pl-12 text-sm text-ink-muted">
          Census match: {result.census.matchedAddress} (
          {result.census.latitude}, {result.census.longitude})
        </p>
      ) : null}
      {result.status === "ambiguous_census_match" ? (
        <ul className="mt-3 list-disc pl-16 text-sm">
          {result.matches.map((match) => (
            <li key={`${match.matchedAddress}-${match.longitude}-${match.latitude}`}>
              {match.matchedAddress}
            </li>
          ))}
        </ul>
      ) : null}
      {result.status === "ambiguous_parcel_match" ||
      result.status === "parcel_identity_verification_required" ? (
        <ul className="mt-3 list-disc pl-16 text-sm">
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
      <p className="mt-4 pl-12 text-sm text-ink-muted">
        Review the address and housing type above, then submit again when ready.
      </p>
    </div>
  );
}

function errorTitle(status: Exclude<AddressToParcelResult["status"], "ok">) {
  switch (status) {
    case "outside_pittsburgh":
      return "Outside current MVP scope";
    case "no_parcel_match":
    case "ambiguous_parcel_match":
    case "parcel_identity_verification_required":
    case "parcel_unavailable":
      return "Parcel identity requires verification";
    default:
      return "Verify the address";
  }
}

function ZoningSource({ source }: { source: ZoningSource }) {
  return (
    <SourceDisclosure
      name={source.name}
      lastModified={source.sourceLastModified}
      href={source.datasetUrl}
      linkLabel="WPRDC zoning"
      details={
        <>
          <p>Retrieved {source.retrievedAt}.</p>
          <p className="break-all">Query: {source.queryUrl}</p>
          <p>
            <a href={source.zoningCodeUrl} className="text-accent underline">
              Zoning Code
            </a>
            {" · "}
            <a href={source.zoningMapUrl} className="text-accent underline">
              City zoning map
            </a>
            {" · "}
            <a href={source.cityZoningPageUrl} className="text-accent underline">
              City zoning page
            </a>
          </p>
        </>
      }
    />
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
    <div>
      {source.mapVintage ? (
        <p className="mt-2 text-sm text-ink-muted">
          Map vintage: {source.mapVintage} (not current FEMA NFHL).
        </p>
      ) : null}
      <SourceDisclosure
        name={source.name}
        lastModified={source.sourceLastModified}
        href={source.datasetUrl}
        linkLabel={linkLabel}
        details={
          <>
            <p>Retrieved {source.retrievedAt}.</p>
            <p>CRS: {source.crs}.</p>
            <p className="break-all">Query: {source.queryUrl}</p>
          </>
        }
      />
    </div>
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
      <div className="mt-4 rounded-lg border border-line bg-paper p-4" role="alert">
        <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          Steep slope
          <StatusBadge>Not Evaluated</StatusBadge>
        </h4>
        <p className="mt-2 text-sm">{steepSlope.message}</p>
        <p className="mt-2 text-sm text-ink-muted">
          Source failure is not treated as the absence of steep slope.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-line bg-paper p-4">
      <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        Steep slope
        <StatusBadge>Evaluated</StatusBadge>
      </h4>
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
      <div className="mt-4 rounded-lg border border-line bg-paper p-4" role="alert">
        <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          Landslide
          <StatusBadge>Not Evaluated</StatusBadge>
        </h4>
        <p className="mt-2 text-sm">{landslide.message}</p>
        <p className="mt-2 text-sm text-ink-muted">
          Source failure is not treated as the absence of landslide-prone area.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-line bg-paper p-4">
      <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        Landslide
        <StatusBadge>Evaluated</StatusBadge>
      </h4>
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
      <div className="mt-4 rounded-lg border border-line bg-paper p-4" role="alert">
        <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          Mine / undermined
          <StatusBadge>Not Evaluated</StatusBadge>
        </h4>
        <p className="mt-2 text-sm">{undermined.message}</p>
        <p className="mt-2 text-sm text-ink-muted">
          Source failure is not treated as the absence of undermined/mine
          condition.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-line bg-paper p-4">
      <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        Mine / undermined
        <StatusBadge>Evaluated</StatusBadge>
      </h4>
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
      <div className="mt-2 rounded-lg border border-line bg-paper p-4" role="alert">
        <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          Flood hazard
          <StatusBadge>Not Evaluated</StatusBadge>
        </h4>
        <p className="mt-2 text-sm">{flood.message}</p>
        <p className="mt-2 text-sm text-ink-muted">
          Source failure is not treated as the absence of flood hazard. This is
          not a “no flood risk” finding.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-line bg-paper p-4">
      <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        {flood.provenance === "wprdc_2014_extract"
          ? "Flood hazard (2014 WPRDC FEMA extract)"
          : "Flood hazard"}
        <StatusBadge>Evaluated</StatusBadge>
      </h4>
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
        ? result.zoning.districts
            .map((district) => {
              const share =
                district.intersectionPercent !== null
                  ? `${district.intersectionPercent.toFixed(1)}%`
                  : "share not calculated";
              return `${district.code} (${share})`;
            })
            .join("; ")
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
    key: "historic-districts",
    source: result.historicDesignation.districts.source.name,
    href: result.historicDesignation.districts.source.datasetUrl,
    finding:
      result.historicDesignation.districts.status === "ok"
        ? result.historicDesignation.districts.intersects
          ? result.historicDesignation.districts.districts
              .map((district) => district.name)
              .join("; ")
          : "No mapped City historic district intersection"
        : "Not Evaluated",
    method: `Full parcel polygon intersection using canonical PIN ${result.historicDesignation.parcelId}`,
    vintage: `${result.historicDesignation.districts.source.sourceLastModified ?? "not reported"} · retrieved ${result.historicDesignation.districts.source.retrievedAt}`,
    limitation:
      "GIS screening only. Not a Historic Review Commission determination. Overlaps under 1% are ignored as a BuildWise geometry-noise heuristic unless lotblock matches the canonical PIN; 1% is not an official City threshold.",
  });
  rows.push({
    key: "historic-sites",
    source: result.historicDesignation.sites.source.name,
    href: result.historicDesignation.sites.source.datasetUrl,
    finding:
      result.historicDesignation.sites.status === "ok"
        ? result.historicDesignation.sites.intersects
          ? result.historicDesignation.sites.sites.map((site) => site.name).join("; ")
          : "No mapped individually designated historic site intersection"
        : "Not Evaluated",
    method: `Full parcel polygon intersection using canonical PIN ${result.historicDesignation.parcelId}`,
    vintage: `${result.historicDesignation.sites.source.sourceLastModified ?? "not reported"} · retrieved ${result.historicDesignation.sites.source.retrievedAt}`,
    limitation:
      "Designated-site polygons may not match County parcel boundaries exactly. Overlaps under 1% are ignored as a BuildWise geometry-noise heuristic unless lotblock matches the canonical PIN.",
  });
  rows.push(regulatorySourceRow("permits", result.regulatoryRecords.permits));
  rows.push(
    regulatorySourceRow("violations", result.regulatoryRecords.violations),
  );
  rows.push({
    key: "nearby-sales",
    source: result.financialContext.sales.status === "ok"
      ? result.financialContext.sales.source.name
      : "Allegheny County / WPRDC Property Sale Transactions",
    href: "https://data.wprdc.org/dataset/real-estate-sales",
    finding:
      result.financialContext.sales.status === "ok"
        ? result.financialContext.sales.records.length > 0
          ? `${result.financialContext.sales.records.length} County-coded VALID SALE (SALECODE 0) nearby sale record(s)`
          : "No validated nearby sales in search radius"
        : "Not Evaluated",
    method: `Parcel-geometry proximity in EPSG:2272, then PARID join; filter ${
      result.financialContext.sales.status === "ok"
        ? result.financialContext.sales.validatedFilter
        : "SALECODE 0 / VALID SALE"
    }`,
    vintage:
      result.financialContext.sales.status === "ok"
        ? `${result.financialContext.sales.source.sourceLastModified ?? "not reported"} · retrieved ${result.financialContext.sales.source.retrievedAt}`
        : result.financialContext.sales.source.retrievedAt,
    limitation:
      "Nearby Sales Context only. These properties have not been determined to be comparable. Radius and 5-year lookback are BuildWise heuristics. Assessed characteristics of sold parcels are not market value.",
  });
  rows.push({
    key: "hud-fmr",
    source: result.financialContext.hud.status === "ok"
      ? result.financialContext.hud.source.name
      : "HUD Fair Market Rents / Small Area FMRs",
    href: "https://www.huduser.gov/portal/datasets/fmr.html",
    finding:
      result.financialContext.hud.status === "ok"
        ? `FY ${result.financialContext.hud.year} ${
            result.financialContext.hud.geographyType === "ZIP_SAFMR"
              ? `ZIP ${result.financialContext.hud.zip} SAFMR`
              : "metro-area FMR"
          }`
        : "Not Evaluated",
    method: "HUD User FMR API for METRO38300M38300 using assessment PROPERTYZIP",
    vintage:
      result.financialContext.hud.status === "ok"
        ? `FY ${result.financialContext.hud.year} · retrieved ${result.financialContext.hud.source.retrievedAt}`
        : result.financialContext.hud.source.retrievedAt,
    limitation:
      "Regulatory FMR/SAFMR benchmark, not market rent or assumed project rent.",
  });

  rows.push({
    key: "score",
    source: "BuildWise scoring module",
    finding: `Scoring v${result.decision.scoringVersion}`,
    method: result.decision.score.formula,
    vintage: result.decision.scoringVersion,
    limitation: result.decision.heuristicLabel,
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

function regulatorySourceRow(
  key: "permits" | "violations",
  evidence:
    | RegulatoryRecordsResult["permits"]
    | RegulatoryRecordsResult["violations"],
) {
  const method =
    key === "permits"
      ? "Exact parcel_num / PARID join; address fallback only if parcel join is empty and street line matches exactly"
      : "Exact parcel_id / PARID join; address fallback only if parcel join is empty and street line matches exactly";

  if (evidence.status !== "ok") {
    return {
      key,
      source: evidence.source.name,
      href: evidence.source.datasetUrl,
      finding: "Not Evaluated",
      method,
      vintage: "—",
      limitation: evidence.message,
    };
  }

  const finding =
    key === "permits"
      ? `${evidence.records.length} permit record(s); join ${evidence.joinMethod}`
      : `${evidence.records.length} violation casefile(s); join ${evidence.joinMethod}`;

  return {
    key,
    source: evidence.source.name,
    href: evidence.source.datasetUrl,
    finding,
    method,
    vintage: `${evidence.source.sourceLastModified ?? "not reported"} · retrieved ${evidence.source.retrievedAt} · ${evidence.source.temporalCoverage}`,
    limitation:
      "Current WPRDC feed only. No record found is not proof that no regulatory issue exists.",
  };
}
