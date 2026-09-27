import type { AddressToParcelResult } from "@/lib/lookup/address-to-parcel";

type OkResult = Extract<AddressToParcelResult, { status: "ok" }>;

function firstPriorityActions(result: OkResult): string[] {
  const flagActions = result.decision.flags.map((flag) => flag.verificationAction);
  if (flagActions.length >= 2) return flagActions.slice(0, 2);

  const relevant = result.recommendedVerification.filter((step) =>
    /ambiguous|violation|historic|zoning staff|proposed.use compatibility/i.test(step),
  );
  return [...new Set([...flagActions, ...relevant])].slice(0, 2);
}

function evidenceTakeaway(result: OkResult): string {
  const { zoning, proposed_project, site_conditions, environment } =
    result.claudeContext;
  const codes = zoning.mapped_codes.join(", ");
  const place = codes ? ` in ${codes}` : "";
  const use =
    zoning.use_status === "PERMITTED_BY_RIGHT"
      ? `The preliminary use table marks ${proposed_project.label} as permitted by right${place}.`
      : zoning.use_status === "NOT_IDENTIFIED"
        ? `The current encoded use table cannot determine whether ${proposed_project.label} is permitted${place}.`
        : zoning.use_status === "NOT_EVALUATED"
          ? `The proposed housing use has not been evaluated against the mapped zoning${place}.`
          : `The preliminary use-table finding for ${proposed_project.label}${place} requires review.`;

  const historic = result.decision.flags.find(
    (flag) =>
      flag.type === "HISTORIC_SITE_REVIEW" ||
      flag.type === "HISTORIC_DISTRICT_REVIEW",
  );
  if (historic) {
    const names = [
      ...result.claudeContext.historic_designation.site_names,
      ...result.claudeContext.historic_designation.district_names,
    ];
    return `${use} Mapped historic designation${names.length ? ` (${names.join(", ")})` : ""} may require review.`;
  }

  const hazards = [
    site_conditions.steep_slope,
    site_conditions.landslide,
    site_conditions.mine,
    environment.flood,
  ];
  if (hazards.every((hazard) => hazard.status === "EVALUATED" && !hazard.intersects)) {
    return `${use} The evaluated core hazard layers show no mapped intersection.`;
  }
  return use;
}

export function AiBrief({ result }: { result: OkResult }) {
  const aiSummary = result.aiSummary;
  const actions = firstPriorityActions(result);

  return (
    <section className="bw-card mt-6 overflow-hidden">
      <div className="border-b border-line bg-accent-soft px-5 py-4 sm:px-6">
        <p className="text-xs font-semibold tracking-[0.16em] text-accent uppercase">
          At a glance
        </p>
        <h3 className="mt-1 text-lg font-semibold">Feasibility interpretation</h3>
      </div>
      <div className="p-5 sm:p-6">
        {aiSummary.status !== "ok" && (
          <p className="mb-3 text-xs font-medium text-review">
            AI explanation temporarily unavailable — these points come from the
            structured screening evidence.
          </p>
        )}
        <p className="max-w-3xl text-base leading-7">{evidenceTakeaway(result)}</p>
        {actions.length > 0 && (
          <div className="mt-5">
            <h4 className="text-sm font-semibold">Verify next</h4>
            <ul className="mt-2 space-y-2">
              {actions.map((action) => (
                <li key={action} className="flex gap-2 text-sm leading-6 text-ink-muted">
                  <span aria-hidden="true" className="font-semibold text-accent">→</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {aiSummary.status === "ok" && (
          <details className="mt-5 border-t border-line pt-4">
            <summary className="cursor-pointer font-medium text-accent">
              Read full AI interpretation
            </summary>
            <div className="mt-4 space-y-4 text-sm leading-6 text-ink-muted">
              <p>{aiSummary.narrative.summary}</p>
              {aiSummary.narrative.key_bottlenecks.length > 0 && (
                <div>
                  <h4 className="font-semibold text-ink">Material findings</h4>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {aiSummary.narrative.key_bottlenecks.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p>{aiSummary.narrative.why_this_matters}</p>
              <p>{aiSummary.narrative.limitations}</p>
            </div>
          </details>
        )}
        <p className="mt-4 text-xs leading-5 text-ink-muted">
          Preliminary screening only. Confirm consequential findings with
          qualified professionals; this is not a determination of entitlement
          or financial feasibility.
        </p>
      </div>
    </section>
  );
}