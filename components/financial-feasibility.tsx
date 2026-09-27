export function FinancialFeasibilityNotAssessed() {
  return (
    <section className="bw-card mt-6 border-dashed bg-paper p-5">
      <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
        Future due diligence · informational only
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">
          Financial Feasibility — Not Assessed
        </h2>
        <span className="inline-flex items-center rounded-full border border-line bg-surface px-2 py-0.5 text-xs font-medium text-ink-muted">
          Not Evaluated
        </span>
      </div>
      <p className="mt-2 text-sm leading-6">
        This BuildWise MVP evaluates zoning and mapped site constraints. It does
        not determine whether a project will financially “pencil,” and it does
        not calculate ROI, IRR, profit, project value, or financial
        feasibility.
      </p>
      <h3 className="mt-4 text-sm font-semibold">
        Future free public-data inputs (not used in this analysis)
      </h3>
      <ul className="mt-2 list-disc pl-5 text-sm leading-6">
        <li>
          Allegheny County Property Sale Transactions — validated nearby sale
          comps (filter validation codes; recorded price is not automatically
          market value).{" "}
          <a
            className="text-accent underline"
            href="https://data.wprdc.org/dataset/allegheny-county-property-sale-transactions"
          >
            WPRDC sales
          </a>
        </li>
        <li>
          HUD Fair Market Rents / Small Area FMRs — rent benchmarks, not asking
          or contract rents.{" "}
          <a
            className="text-accent underline"
            href="https://www.huduser.gov/portal/datasets/fmr.html"
          >
            HUD FMR
          </a>
        </li>
        <li>
          BLS Producer Price Index — construction-cost escalation context only,
          not Pittsburgh bid levels.{" "}
          <a className="text-accent underline" href="https://www.bls.gov/ppi/data.htm">
            BLS PPI
          </a>
        </li>
        <li>
          County assessment values — assessment context already shown above, not
          market value or an acquisition price.
        </li>
      </ul>
      <h3 className="mt-4 text-sm font-semibold">
        Still requires developer / project-specific input
      </h3>
      <ul className="mt-2 list-disc pl-5 text-sm leading-6">
        <li>owner willingness to sell</li>
        <li>site control</li>
        <li>asking / land acquisition price</li>
        <li>project-specific construction hard costs</li>
        <li>soft costs</li>
        <li>financing terms</li>
        <li>actual achievable rents / sale prices</li>
      </ul>
    </section>
  );
}
