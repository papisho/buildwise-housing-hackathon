export function HeroSection() {
  return (
    <section id="home" className="scroll-mt-24">
      <p className="text-sm font-medium tracking-wide text-accent uppercase">
        Pittsburgh housing sites
      </p>
      <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
        Know the barriers before you build.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-ink-muted sm:text-lg">
        Preliminary development screening for Pittsburgh housing sites —
        combining parcel, zoning, mapped constraints, regulatory records,
        market context, and grounded AI.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <a href="#analyze" className="bw-btn px-5 py-3 text-base">
          Analyze a Property
        </a>
        <p className="max-w-md text-sm text-ink-muted">
          Preliminary decision support only — not legal, zoning, engineering,
          environmental, or financial advice.
        </p>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  const steps = [
    {
      n: "1",
      title: "Enter a Pittsburgh property",
      body: "Provide an address and the proposed housing type you want to screen.",
    },
    {
      n: "2",
      title: "Resolve parcel and authoritative evidence",
      body: "BuildWise matches the parcel and pulls county, city, and mapped public-data layers already in this MVP.",
    },
    {
      n: "3",
      title: "Screen zoning and mapped constraints",
      body: "Review mapped zoning, preliminary use-table status, and evaluated hazard overlays.",
    },
    {
      n: "4",
      title: "Review score, flags, evidence, and grounded AI guidance",
      body: "Use the snapshot, coverage, flags, and parcel-grounded AI as a first-pass brief — then verify with professionals.",
    },
  ];

  return (
    <section id="how-it-works" className="scroll-mt-24">
      <h2 className="text-2xl font-semibold tracking-tight">How It Works</h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        A short path from address to a structured screening brief. Consequential
        findings still require human verification.
      </p>
      <ol className="mt-6 grid gap-4 sm:grid-cols-2">
        {steps.map((step) => (
          <li key={step.n} className="bw-card p-5">
            <p className="text-xs font-semibold tracking-wide text-accent uppercase">
              Step {step.n}
            </p>
            <h3 className="mt-2 text-base font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function AboutSection() {
  return (
    <section id="about" className="scroll-mt-24">
      <h2 className="text-2xl font-semibold tracking-tight">About</h2>
      <div className="bw-card mt-4 max-w-3xl p-6">
        <p className="text-sm leading-7 text-ink">
          BuildWise helps small and mid-sized housing developers perform
          preliminary site screening before committing significant time or money
          to due diligence.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-ink-muted">
          <li>
            Pittsburgh-first MVP focused on parcels inside the City of
            Pittsburgh.
          </li>
          <li>
            Evidence-based screening: mapped public data, explicit coverage, and
            named gaps.
          </li>
          <li>
            Human verification is required for consequential findings. BuildWise
            does not determine legal entitlement or financial feasibility.
          </li>
        </ul>
      </div>
    </section>
  );
}

export function TrustSourcesSection() {
  return (
    <section id="sources" className="scroll-mt-24">
      <h2 className="text-2xl font-semibold tracking-tight">Sources</h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        This MVP uses public records already wired into the analysis. Vintage,
        join method, and limitations appear in the detailed table after a
        screening.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          "Allegheny County parcel and assessment data",
          "City of Pittsburgh zoning",
          "City/WPRDC mapped site constraints",
          "FEMA / mapped flood evidence",
        ].map((item) => (
          <li key={item} className="bw-card p-4 text-sm">
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm">
        <a href="#results-sources" className="font-medium text-accent underline">
          Open the detailed Sources &amp; Assumptions table
        </a>{" "}
        after you analyze a property.
      </p>
    </section>
  );
}
