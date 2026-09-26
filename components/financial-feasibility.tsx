export function FinancialFeasibilityNotAssessed() {
  return (
    <section className="mt-6 border border-dashed border-neutral-400 bg-neutral-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-600">
        Future due diligence · informational only
      </p>
      <h2 className="mt-1 text-lg font-medium">
        Financial Feasibility — Not Assessed
      </h2>
      <p className="mt-2 text-sm">
        This BuildWise MVP evaluates zoning and mapped site constraints. It does
        not determine whether a project will financially “pencil,” and it does
        not calculate ROI, IRR, profit, project value, or financial
        feasibility.
      </p>
      <h3 className="mt-4 text-sm font-medium">
        Future free public-data inputs (not used in this analysis)
      </h3>
      <ul className="mt-2 list-disc pl-5 text-sm">
        <li>
          Allegheny County Property Sale Transactions — validated nearby sale
          comps (filter validation codes; recorded price is not automatically
          market value).{" "}
          <a
            className="underline"
            href="https://data.wprdc.org/dataset/allegheny-county-property-sale-transactions"
          >
            WPRDC sales
          </a>
        </li>
        <li>
          HUD Fair Market Rents / Small Area FMRs — rent benchmarks, not asking
          or contract rents.{" "}
          <a
            className="underline"
            href="https://www.huduser.gov/portal/datasets/fmr.html"
          >
            HUD FMR
          </a>
        </li>
        <li>
          BLS Producer Price Index — construction-cost escalation context only,
          not Pittsburgh bid levels.{" "}
          <a className="underline" href="https://www.bls.gov/ppi/data.htm">
            BLS PPI
          </a>
        </li>
        <li>
          County assessment values — assessment context already shown above, not
          market value or an acquisition price.
        </li>
      </ul>
      <h3 className="mt-4 text-sm font-medium">
        Still requires developer / project-specific input
      </h3>
      <ul className="mt-2 list-disc pl-5 text-sm">
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
