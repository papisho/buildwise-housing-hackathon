export function HeroSection() {
  return (
    <section
      id="home"
      className="relative isolate scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-[#f8f5ed] px-6 py-8 sm:px-10 sm:py-11 lg:px-14 lg:py-14"
    >
      <div className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden w-[48%] lg:block" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-r from-[#f8f5ed] via-[#f8f5ed]/35 to-transparent" />
        <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(#536a5d12_1px,transparent_1px),linear-gradient(90deg,#536a5d12_1px,transparent_1px)] [background-size:38px_38px]" />
        <svg viewBox="0 0 580 360" className="absolute inset-0 h-full w-full" fill="none">
          <path d="M28 72h524M28 148h524M28 228h524M28 300h524M88 25v310M178 25v310M298 25v310M406 25v310M505 25v310" stroke="#526c5e" strokeOpacity=".28" strokeWidth="1.4" />
          <path d="M60 195c60-100 119-100 178 0s119 100 178 0 94-82 128-38" stroke="#98543f" strokeWidth="3" />
          <path d="M60 202c60-100 119-100 178 0s119 100 178 0 94-82 128-38" stroke="#98543f" strokeOpacity=".32" strokeWidth="1" />
          <path d="M82 180v36m19-58v69m19-76v82m19-82v82m19-71v66m19-45v26m100-35v44m19-65v84m19-91v98m19-91v98m19-81v67m20-44v24m95-54v48m18-56v60m18-55v54m18-39v23" stroke="#98543f" strokeOpacity=".72" strokeWidth="1" />
          <circle cx="298" cy="148" r="5" fill="#28564b" />
          <circle cx="298" cy="148" r="12" stroke="#28564b" strokeOpacity=".35" />
        </svg>
        <span className="absolute bottom-5 right-8 font-mono text-[10px] tracking-[0.18em] text-ink-muted">PITTSBURGH · PARCEL / STREET STUDY</span>
      </div>

      <div className="max-w-2xl">
        <p className="bw-kicker">A first look at a Pittsburgh site</p>
        <h1 className="bw-serif mt-4 max-w-xl text-[2.7rem] leading-[1.02] text-ink sm:text-6xl">
          Read the ground<br className="hidden sm:block" /> before you build.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-ink-muted sm:text-lg">
          A parcel-level housing brief for the early questions that matter:
          what the map says, what it does not, and what deserves a closer look.
        </p>
        <div className="mt-7 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <a href="#analyze" className="bw-btn px-5 py-3 text-base">
            Screen a property
            <span aria-hidden="true" className="ml-3 text-[#d6dfd5]">↘</span>
          </a>
          <p className="max-w-sm text-sm leading-5 text-ink-muted">
            City of Pittsburgh parcels · preliminary decision support, not a
            determination of buildability.
          </p>
        </div>
      </div>
      <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 border-t border-line/80 pt-4 text-xs font-medium tracking-wide text-ink-muted sm:mt-11">
        <span>COUNTY PARCEL RECORDS</span>
        <span>CITY ZONING MAP</span>
        <span>MAPPED SITE CONDITIONS</span>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  const steps = [
    {
      n: "01",
      title: "Start with an address",
      body: "Name the Pittsburgh property and the kind of housing you are considering.",
    },
    {
      n: "02",
      title: "Resolve the parcel",
      body: "BuildWise matches an address to a county parcel before tying findings to a PIN.",
    },
    {
      n: "03",
      title: "Read mapped evidence",
      body: "Review zoning, preliminary use-table encoding, and evaluated site overlays.",
    },
    {
      n: "04",
      title: "Plan the next call",
      body: "Use flags, evidence gaps, and verification steps to guide human due diligence.",
    },
  ];

  return (
    <section id="how-it-works" className="scroll-mt-24">
      <div className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="bw-kicker">From address to first brief</p>
          <h2 className="bw-serif mt-2 text-3xl sm:text-4xl">A useful first pass.</h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-ink-muted">
          Consequential findings stay attached to their source and still need
          human verification.
        </p>
      </div>
      <ol className="mt-6 grid gap-3 sm:grid-cols-2">
        {steps.map((step) => (
          <li key={step.n} className="group flex gap-4 rounded-xl border border-line bg-surface/70 p-5 transition-colors hover:bg-surface">
            <span className="font-mono text-sm text-[#98543f]">{step.n}</span>
            <div>
              <h3 className="text-base font-semibold">{step.title}</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-ink-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function AboutSection() {
  return (
    <section id="about" className="scroll-mt-24">
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="bw-kicker">Why BuildWise</p>
          <h2 className="bw-serif mt-2 max-w-sm text-3xl leading-tight sm:text-4xl">
            Better questions, earlier in the process.
          </h2>
        </div>
        <div className="border-l-2 border-[#98543f] pl-5 sm:pl-7">
          <p className="max-w-2xl text-base leading-7 text-ink">
            BuildWise helps small and mid-sized housing developers get oriented
            before committing significant time or money to due diligence. It is
            a working brief built from mapped public evidence—not a verdict.
          </p>
          <ul className="mt-5 grid gap-3 text-sm leading-6 text-ink-muted sm:grid-cols-2">
            <li><span className="font-semibold text-ink">Pittsburgh-first.</span> Focused on parcels inside the city.</li>
            <li><span className="font-semibold text-ink">Evidence-led.</span> Coverage and limitations remain visible.</li>
            <li><span className="font-semibold text-ink">Human-reviewed.</span> Verify consequential findings with the right professionals.</li>
            <li><span className="font-semibold text-ink">Early-stage only.</span> No legal entitlement or financial feasibility determination.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export function TrustSourcesSection() {
  const sources = [
    ["01", "Allegheny County", "Parcel geometry & assessment"],
    ["02", "City of Pittsburgh", "Zoning and mapped constraints"],
    ["03", "WPRDC", "Published municipal and regional layers"],
    ["04", "FEMA / mapped extracts", "Flood evidence, with vintage stated"],
  ];

  return (
    <section id="sources" className="scroll-mt-24 rounded-2xl bg-[#e6e2d6] px-5 py-7 sm:px-8 sm:py-9">
      <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <div>
          <p className="bw-kicker">Traceable by design</p>
          <h2 className="bw-serif mt-2 text-3xl sm:text-4xl">Know what the map knows.</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-ink-muted">
            Each result carries source, join method, vintage, and limitation.
            Missing evidence is called out—not quietly treated as clear.
          </p>
        </div>
        <ul className="divide-y divide-line border-y border-line">
          {sources.map(([number, name, detail]) => (
            <li key={name} className="flex items-center gap-4 py-3">
              <span className="font-mono text-xs text-[#98543f]">{number}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{name}</span>
                <span className="text-sm text-ink-muted">{detail}</span>
              </span>
              <span aria-hidden="true" className="text-accent">↗</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-5 text-sm">
        <a href="#results-sources" className="font-semibold text-accent underline">
          Open a property’s Sources &amp; Assumptions
        </a>{" "}
        after analysis.
      </p>
    </section>
  );
}