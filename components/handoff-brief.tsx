"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { AddressToParcelResult } from "@/lib/lookup/address-to-parcel";
import { proposedProjectTypeLabel } from "@/lib/project-type";

type OkResult = Extract<AddressToParcelResult, { status: "ok" }>;

function HandoffContent({ result }: { result: OkResult }) {
  const { decision } = result;
  const unevaluated = decision.evidenceGaps.filter(
    (gap) => gap.state === "NOT_EVALUATED",
  );
  const missingEvidence = [
    ...unevaluated.map((gap) => gap.label),
    ...(result.financialContext.sales.status !== "ok"
      ? ["Nearby sales context (not part of score)"]
      : []),
    ...(result.financialContext.hud.status !== "ok"
      ? ["HUD rent benchmark (not part of score)"]
      : []),
  ];
  const furtherReview = decision.evidenceGaps.filter(
    (gap) => gap.state === "REQUIRES_FURTHER_DUE_DILIGENCE",
  );
  const score =
    decision.presentation.mode === "complete"
      ? `${decision.presentation.valueLine}/100`
      : "Incomplete";
  const zoning =
    result.zoning.status === "ok"
      ? result.zoning.districts.map((district) => district.code).join(", ")
      : "Not Evaluated";
  const retrievedAt =
    result.zoning.status !== "unavailable"
      ? result.zoning.source.retrievedAt
      : null;
  const sourceLinks = [
    {
      label: "County assessments",
      href: "https://data.wprdc.org/dataset/property-assessments",
    },
    {
      label: "City zoning",
      href: result.zoning.status !== "unavailable"
        ? result.zoning.source.datasetUrl
        : "https://data.wprdc.org/dataset/zoning",
    },
    { label: "Zoning code", href: result.useCompatibility.citationUrl },
    ...(result.steepSlope.status === "ok"
      ? [{ label: "Steep slope", href: result.steepSlope.source.datasetUrl }]
      : []),
    ...(result.landslide.status === "ok"
      ? [{ label: "Landslide", href: result.landslide.source.datasetUrl }]
      : []),
    ...(result.undermined.status === "ok"
      ? [{ label: "Undermined", href: result.undermined.source.datasetUrl }]
      : []),
    ...(result.flood.status === "ok"
      ? [{ label: "Flood", href: result.flood.source.datasetUrl }]
      : []),
    ...(result.regulatoryRecords.permits.status === "ok"
      ? [{ label: "Permits", href: result.regulatoryRecords.permits.source.datasetUrl }]
      : []),
    ...(result.regulatoryRecords.violations.status === "ok"
      ? [{ label: "Violations", href: result.regulatoryRecords.violations.source.datasetUrl }]
      : []),
  ];

  return (
    <article className="handoff-page" aria-label="BuildWise parcel handoff brief">
      <div className="handoff-header">
        <div>
          <p className="handoff-eyebrow">BUILDWISE / PARCEL HANDOFF</p>
          <h2>{result.census.matchedAddress}</h2>
          <p>
            County PARID {result.parcel.pin} · Proposed{" "}
            {proposedProjectTypeLabel(result.request.proposedProjectType)}
          </p>
          {result.request.inputAddress !== result.census.matchedAddress ? (
            <p>Entered address: {result.request.inputAddress}</p>
          ) : null}
        </div>
        <p className="handoff-stamp">
          Preliminary screening
          <br />
          {retrievedAt
            ? `Zoning retrieved ${new Date(retrievedAt).toLocaleDateString("en-US", { timeZone: "UTC" })}`
            : "Zoning retrieval unavailable"}
        </p>
      </div>

      <div className="handoff-metrics">
        <div><span>Development Ease Score</span><strong>{score}</strong></div>
        <div><span>Core evidence coverage</span><strong>{decision.coverage.percent}%</strong></div>
        <div><span>Screening status</span><strong>{decision.screeningStatusLabel}</strong></div>
        <div><span>Mapped zoning</span><strong>{zoning}</strong></div>
      </div>
      <p className="handoff-caveat">
        The Development Ease Score covers zoning/use and four mapped physical
        factors only.{" "}
        {decision.presentation.mode === "complete"
          ? "Even 100/100 is not a determination of buildability, entitlement, safety, or financial feasibility."
          : "Incomplete means at least one scored factor could not be evaluated; it is not a zero or a favorable finding."}{" "}
        Missing evidence is never treated as favorable.
      </p>

      <div className="handoff-columns">
        <section>
          <h3>Critical review flags ({decision.flags.length})</h3>
          {decision.flags.length ? (
            <ul>
              {decision.flags.map((flag) => (
                <li key={flag.type}>
                  <strong>{flag.title}.</strong> {flag.finding}{" "}
                  <em>{flag.verificationAction}</em>
                </li>
              ))}
            </ul>
          ) : (
            <p>No flags from implemented evidence—not a finding that the site is clear.</p>
          )}
          <h3>Evidence not evaluated</h3>
          <p>
            {missingEvidence.length
              ? missingEvidence.join(" · ")
              : "No tracked source gaps in this brief; further due diligence still applies."}
          </p>
          <h3>Still requires due diligence</h3>
          <p>{furtherReview.map((gap) => gap.label).join(" · ") || "See full analysis."}</p>
        </section>
        <section>
          <h3>Recommended next checks</h3>
          <ol>
            {result.recommendedVerification.slice(0, 4).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {result.recommendedVerification.length > 4 ? (
            <p className="handoff-note">
              {result.recommendedVerification.length - 4} more verification
              step(s) in the full BuildWise analysis. This handoff is a summary,
              not the complete record.
            </p>
          ) : null}
        </section>
      </div>

      <footer className="handoff-footer">
        <strong>Source references</strong>
        <span>
          {" "}
          {sourceLinks.map((source, index) => (
            <span key={source.label}>
              {index > 0 ? " · " : ""}
              <a href={source.href}>{source.label}</a>
            </span>
          ))}
        </span>
        <p>
          Sources have different vintages and limitations; consult the full
          Sources &amp; Assumptions section before relying on a finding. Rerun this
          address and housing type for a current screening. Decision support
          only—not legal, zoning, engineering, environmental, or financial advice.
        </p>
      </footer>
    </article>
  );
}

export function HandoffBrief({ result }: { result: OkResult }) {
  const [printReady, setPrintReady] = useState(false);

  useEffect(() => {
    if (!printReady) return;
    const timer = window.setTimeout(() => window.print(), 0);
    return () => window.clearTimeout(timer);
  }, [printReady]);

  return (
    <>
      <section className="bw-card mt-4 p-5" aria-labelledby="handoff-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="handoff-heading" className="text-lg font-semibold">
              Take this brief to the next conversation
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Print or save a compact, source-linked summary as a PDF. No account
              or upload required.
            </p>
          </div>
          <button
            type="button"
            className="bw-btn shrink-0"
            onClick={() => {
              if (printReady) window.print();
              else setPrintReady(true);
            }}
          >
            Print / Save brief
          </button>
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-accent underline">
            Preview the handoff
          </summary>
          <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-white p-4">
            <HandoffContent result={result} />
          </div>
        </details>
      </section>
      {printReady
        ? createPortal(
            <div id="buildwise-handoff-print-root" aria-hidden="true">
              <HandoffContent result={result} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}