"use client";

import { useState, type ReactNode } from "react";
import { AskBuildWiseAI } from "@/components/ask-buildwise-ai";
import { SourceDisclosure } from "@/components/result-chrome";
import { StatusBadge } from "@/components/status-badge";
import { withFinancialScenario } from "@/lib/claude/payload";
import type { ClaudeAnalysisInput } from "@/lib/claude/types";
import {
  FINANCIAL_CONTEXT_LABELS,
  resolveFinancialContextStatusFromFlags,
} from "@/lib/financial/status";
import { tryCalculateDevelopmentScenario } from "@/lib/financial/scenario";
import type { FinancialContextResult } from "@/lib/financial";
import type {
  DevelopmentScenarioResult,
  FinancialSource,
  FinancialValueProvenance,
} from "@/lib/financial/types";

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function hudMoney(value: number | null): string {
  return value === null ? "Not reported" : money(value);
}

function formatSaleLotArea(value: number | null): string {
  if (value === null || value <= 0) {
    return "Not available";
  }
  return `${value.toLocaleString()} sf`;
}

function ProvenanceBadge({
  value,
}: {
  value: FinancialValueProvenance;
}) {
  const label =
    value === "USER_ASSUMPTION"
      ? "User Assumption"
      : value === "CALCULATED_FROM_USER_ASSUMPTIONS"
        ? "Calculated"
        : "Public Data";
  return (
    <span title={value} data-provenance={value} className="align-middle">
      <StatusBadge>{label}</StatusBadge>
    </span>
  );
}

export function PreliminaryFinancialContext({
  financial,
  onScenarioChange,
}: {
  financial: FinancialContextResult;
  onScenarioChange?: (scenario: DevelopmentScenarioResult | null) => void;
}) {
  const [scenario, setScenario] = useState<DevelopmentScenarioResult | null>(
    null,
  );

  function updateScenarioFromForm(root: HTMLElement) {
    const read = (name: string) => {
      const field = root.querySelector(`input[name="${name}"]`);
      return field instanceof HTMLInputElement ? field.value : "";
    };
    const next = tryCalculateDevelopmentScenario({
      acquisitionPrice: read("acquisitionPrice"),
      units: read("units"),
      monthlyRentPerUnit: read("monthlyRentPerUnit"),
      hardConstructionCost: read("hardConstructionCost"),
      softCosts: read("softCosts"),
      contingency: read("contingency"),
      otherCosts: read("otherCosts"),
    });
    setScenario(next);
    onScenarioChange?.(next);
  }

  const overallStatus = resolveFinancialContextStatusFromFlags({
    salesEvaluated: financial.sales.status === "ok",
    hudEvaluated: financial.hud.status === "ok",
    scenarioCalculated: Boolean(scenario),
  });
  const hudTwoBed =
    financial.hud.status === "ok" ? financial.hud.rents.twoBedroom : null;

  return (
    <section id="result-financial" className="bw-card mt-10 scroll-mt-24 p-5">
      <h2 className="text-lg font-semibold">Preliminary Financial Context</h2>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        {FINANCIAL_CONTEXT_LABELS[overallStatus]}{" "}
        {overallStatus === "FINANCIAL_CONTEXT_NOT_EVALUATED" ? (
          <StatusBadge>Not Evaluated</StatusBadge>
        ) : null}
        {overallStatus === "FINANCIAL_CONTEXT_PARTIAL" ? (
          <StatusBadge tone="review">Review required</StatusBadge>
        ) : null}
      </p>
      <p className="mt-2 text-sm">
        This is not a full pro forma and not a financial-feasibility
        determination. Public values are context only.
      </p>

      <h3 className="mt-5 text-sm font-semibold">Nearby Sales Context</h3>
      <p className="mt-1 text-sm text-ink-muted">
        Recent validated transactions near the subject parcel. These properties
        have not been determined to be comparable to the subject property or
        proposed project. They are market context only, not an appraisal or
        broker opinion.
      </p>
      {financial.sales.status !== "ok" ? (
        <>
          <p className="mt-2 text-sm">
            Not Evaluated. {financial.sales.message}
          </p>
          <FinancialSourceLine source={financial.sales.source} linkLabel="View source" />
        </>
      ) : financial.sales.records.length === 0 ? (
        <>
          <p className="mt-2 text-sm">
            No County-coded VALID SALE (SALECODE 0) records were identified
            within the {financial.sales.searchRadiusFeet.toLocaleString()} ft
            search among {financial.sales.neighborParcelCount} nearby parcels.
          </p>
          <FinancialSourceLine
            source={financial.sales.source}
            linkLabel="View source"
          />
        </>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-ink-muted">
                <th className="py-1 pr-3 font-medium">Sale date</th>
                <th className="py-1 pr-3 font-medium">Recorded price</th>
                <th className="py-1 pr-3 font-medium">Distance</th>
                <th className="py-1 pr-3 font-medium">Use</th>
                <th className="py-1 pr-3 font-medium">Lot size</th>
                <th className="py-1 font-medium">Year built</th>
              </tr>
            </thead>
            <tbody>
              {financial.sales.records.map((sale) => (
                <tr key={`${sale.parid}-${sale.saleDate}-${sale.price}`} className="border-b border-line/70">
                  <td className="py-2 pr-3">{sale.saleDate ?? "Not reported"}</td>
                  <td className="py-2 pr-3">{money(sale.price)}</td>
                  <td className="py-2 pr-3">
                    {Math.round(sale.distanceFeet).toLocaleString()} ft (
                    {(sale.distanceFeet / 5280).toFixed(2)} mi)
                  </td>
                  <td className="py-2 pr-3">
                    {sale.useDescription ?? sale.classDescription ?? "Not reported"}
                  </td>
                  <td className="py-2 pr-3">
                    {formatSaleLotArea(sale.lotAreaSqFt)}
                  </td>
                  <td className="py-2">{sale.yearBuilt ?? "Not reported"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-ink-muted">
            Filter: {financial.sales.validatedFilter}. Radius used:{" "}
            {financial.sales.searchRadiusFeet.toLocaleString()} ft.{" "}
            <ProvenanceBadge value="PUBLIC_DATA" />
          </p>
          <FinancialSourceLine
            source={financial.sales.source}
            linkLabel="View source"
          />
        </div>
      )}

      <h3 className="mt-5 text-sm font-semibold">HUD Rent Benchmark</h3>
      <p className="mt-1 text-sm text-ink-muted">
        HUD FMR/SAFMR values are regulatory benchmarks, not observed asking
        rents or guaranteed achievable project rents. They are not market rent.
      </p>
      {financial.hud.status !== "ok" ? (
        <>
          <p className="mt-2 text-sm">Not Evaluated. {financial.hud.message}</p>
          <FinancialSourceLine source={financial.hud.source} linkLabel="View source" />
        </>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-ink-muted">
                <th className="py-1 pr-3 font-medium">0-BR</th>
                <th className="py-1 pr-3 font-medium">1-BR</th>
                <th className="py-1 pr-3 font-medium">2-BR</th>
                <th className="py-1 pr-3 font-medium">3-BR</th>
                <th className="py-1 font-medium">4-BR</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2 pr-3">{hudMoney(financial.hud.rents.efficiency)}</td>
                <td className="py-2 pr-3">{hudMoney(financial.hud.rents.oneBedroom)}</td>
                <td className="py-2 pr-3">{hudMoney(financial.hud.rents.twoBedroom)}</td>
                <td className="py-2 pr-3">{hudMoney(financial.hud.rents.threeBedroom)}</td>
                <td className="py-2">{hudMoney(financial.hud.rents.fourBedroom)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-ink-muted">
            FY {financial.hud.year} ·{" "}
            {financial.hud.geographyType === "ZIP_SAFMR"
              ? `ZIP ${financial.hud.zip} Small Area FMR (SAFMR)`
              : "Metro-area FMR (ZIP SAFMR row was not available)"}
            {financial.hud.areaName ? ` · ${financial.hud.areaName}` : ""}{" "}
            <ProvenanceBadge value="PUBLIC_DATA" />
          </p>
          <FinancialSourceLine
            source={financial.hud.source}
            linkLabel="View source"
            extra={`Entity ${financial.hud.entityId}.`}
          />
        </div>
      )}

      <details className="mt-5 rounded-lg border border-line bg-paper p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Quick Development Scenario
        </summary>
        <p className="mt-3 rounded-md border border-review bg-review-soft px-3 py-2 text-sm font-semibold">
          User-supplied scenario — not validated by BuildWise
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          Enter your own assumptions to see basic project-cost and gross-rent
          metrics update instantly. This is not a pro forma or
          financial-feasibility determination.
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1">
            Nearby sales / HUD <ProvenanceBadge value="PUBLIC_DATA" />
          </span>
          <span className="inline-flex items-center gap-1">
            Inputs <ProvenanceBadge value="USER_ASSUMPTION" />
          </span>
          <span className="inline-flex items-center gap-1">
            Results <ProvenanceBadge value="CALCULATED_FROM_USER_ASSUMPTIONS" />
          </span>
        </p>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
          }}
          onChange={(event) => updateScenarioFromForm(event.currentTarget)}
          onInput={(event) => updateScenarioFromForm(event.currentTarget)}
        >
          <label className="text-sm">
            Acquisition price (USD)
            <input
              className="bw-input mt-1"
              name="acquisitionPrice"
              inputMode="decimal"
            />
          </label>
          <label className="text-sm">
            Number of units
            <input className="bw-input mt-1" name="units" inputMode="numeric" />
          </label>
          <label className="text-sm">
            Expected monthly rent per unit (USD)
            <input
              className="bw-input mt-1"
              name="monthlyRentPerUnit"
              inputMode="decimal"
            />
            {hudTwoBed !== null ? (
              <span className="mt-1 block text-xs text-ink-muted">
                HUD 2-BR benchmark for context: {money(hudTwoBed)} / month. Not
                assumed rent.
              </span>
            ) : null}
          </label>
          <label className="text-sm">
            Estimated hard construction cost (USD)
            <input
              className="bw-input mt-1"
              name="hardConstructionCost"
              inputMode="decimal"
            />
          </label>
          <label className="text-sm">
            Estimated soft costs (USD)
            <input
              className="bw-input mt-1"
              name="softCosts"
              inputMode="decimal"
            />
          </label>
          <label className="text-sm">
            Contingency (USD)
            <input
              className="bw-input mt-1"
              name="contingency"
              inputMode="decimal"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Other known project costs (USD, optional)
            <input
              className="bw-input mt-1"
              name="otherCosts"
              inputMode="decimal"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-paper"
              type="button"
              onClick={(event) => {
                const form = event.currentTarget.form;
                if (!form) {
                  return;
                }
                form.reset();
                setScenario(null);
                onScenarioChange?.(null);
              }}
            >
              Reset scenario
            </button>
          </div>
        </form>
        {scenario ? (
          <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-muted">Acquisition cost</dt>
              <dd>
                {money(scenario.acquisitionCost)}{" "}
                <span className="text-xs text-ink-muted">
                  = acquisition price
                </span>{" "}
                <ProvenanceBadge value="USER_ASSUMPTION" />
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">Total hard cost</dt>
              <dd>
                {money(scenario.totalHardCost)}{" "}
                <span className="text-xs text-ink-muted">
                  = estimated hard construction cost
                </span>{" "}
                <ProvenanceBadge value="USER_ASSUMPTION" />
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">Total soft cost</dt>
              <dd>
                {money(scenario.totalSoftCost)}{" "}
                <span className="text-xs text-ink-muted">= estimated soft costs</span>{" "}
                <ProvenanceBadge value="USER_ASSUMPTION" />
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">Contingency</dt>
              <dd>
                {money(scenario.contingency)}{" "}
                <span className="text-xs text-ink-muted">= contingency input</span>{" "}
                <ProvenanceBadge value="USER_ASSUMPTION" />
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">Estimated total project cost</dt>
              <dd>
                {money(scenario.estimatedTotalProjectCost)}{" "}
                <span className="text-xs text-ink-muted">
                  = acquisition + hard + soft + contingency + other
                </span>{" "}
                <ProvenanceBadge value="CALCULATED_FROM_USER_ASSUMPTIONS" />
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">Annual gross scheduled rent</dt>
              <dd>
                {money(scenario.annualGrossScheduledRent)}{" "}
                <span className="text-xs text-ink-muted">
                  = units × monthly rent × 12
                </span>{" "}
                <ProvenanceBadge value="CALCULATED_FROM_USER_ASSUMPTIONS" />
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">Project cost per unit</dt>
              <dd>
                {scenario.projectCostPerUnit === null
                  ? "n/a"
                  : money(scenario.projectCostPerUnit)}{" "}
                <span className="text-xs text-ink-muted">
                  = total project cost / units
                </span>{" "}
                <ProvenanceBadge value="CALCULATED_FROM_USER_ASSUMPTIONS" />
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">Annual gross rent / total cost</dt>
              <dd>
                {scenario.annualGrossRentToCostRatio === null
                  ? "n/a"
                  : scenario.annualGrossRentToCostRatio.toFixed(3)}{" "}
                <span className="text-xs text-ink-muted">
                  = annual gross scheduled rent / estimated total project cost
                </span>{" "}
                <ProvenanceBadge value="CALCULATED_FROM_USER_ASSUMPTIONS" />
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">
            Enter the required fields above to see project-cost and gross-rent
            arithmetic. No IRR, NPV, cap rate, profit, ROI, or feasibility
            conclusion is produced.
          </p>
        )}
      </details>

      <h3 className="mt-5 text-sm font-semibold">
        Limitations / developer inputs still required
      </h3>
      <ul className="mt-2 list-disc pl-5 text-sm leading-6">
        {financial.limitations.map((limitation) => (
          <li key={limitation}>{limitation}</li>
        ))}
        <li>owner willingness to sell</li>
        <li>actual site control</li>
        <li>asking / acquisition price unless supplied above</li>
        <li>project-specific contractor bids</li>
        <li>financing terms</li>
        <li>actual achievable rents / sale prices</li>
      </ul>
    </section>
  );
}

function FinancialSourceLine({
  source,
  linkLabel,
  extra,
}: {
  source: FinancialSource;
  linkLabel: string;
  extra?: string;
}) {
  return (
    <SourceDisclosure
      name={source.name}
      lastModified={source.sourceLastModified}
      href={source.datasetUrl}
      linkLabel={linkLabel}
      details={
        <>
          <p>Retrieved {source.retrievedAt}.</p>
          {extra ? <p>{extra}</p> : null}
          <p className="break-all">Query: {source.queryUrl}</p>
        </>
      }
    />
  );
}

export function FinancialContextWithChat({
  financial,
  claudeContext,
  sessionKey,
  interpretation,
}: {
  financial: FinancialContextResult;
  claudeContext: ClaudeAnalysisInput;
  sessionKey: string;
  interpretation: ReactNode;
}) {
  const [scenario, setScenario] = useState<DevelopmentScenarioResult | null>(
    null,
  );
  const context = withFinancialScenario(claudeContext, scenario);
  return (
    <>
      <PreliminaryFinancialContext
        financial={financial}
        onScenarioChange={setScenario}
      />
      <div id="result-ai" className="scroll-mt-24">
        <div className="mt-8">
          <h2 className="text-xl font-semibold tracking-tight">
            AI interpretation
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">
            Grounded in the structured evidence above. AI does not calculate the
            score or override source records.
          </p>
        </div>
        {interpretation}
        <AskBuildWiseAI
          key={sessionKey}
          context={context}
          sessionKey={sessionKey}
        />
      </div>
    </>
  );
}
