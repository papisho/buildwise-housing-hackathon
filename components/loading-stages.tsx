"use client";

export const LOADING_STAGES = [
  "Matching address",
  "Finding parcel",
  "Checking zoning",
  "Checking site conditions",
  "Checking mapped hazards",
  "Preparing feasibility snapshot",
] as const;

export function LoadingStages({ pending }: { pending: boolean }) {
  if (!pending) {
    return null;
  }

  return (
    <div
      id="analysis-progress"
      className="bw-card mt-5 flex gap-4 border-accent/25 bg-[#f8f7f0] p-5 sm:items-center sm:p-6"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent-soft text-accent">
        <span
          className="size-5 animate-spin rounded-full border-[2.5px] border-accent/20 border-t-accent"
          aria-hidden="true"
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm font-semibold">Building your parcel brief</p>
          <p className="font-mono text-xs text-ink-muted">LOOKUP IN PROGRESS</p>
        </div>
        <p className="mt-1 text-sm leading-5 text-ink-muted">
          Matching the address and checking available public records. A full
          analysis can take about 30 seconds.
        </p>
        <ul
          aria-label="Checks included in this screening"
          className="mt-4 grid gap-x-5 gap-y-2 border-t border-line pt-3 text-xs text-ink-muted sm:grid-cols-2 lg:grid-cols-3"
        >
          {LOADING_STAGES.map((stage) => (
            <li key={stage} className="flex items-center gap-2">
              <span className="size-1.5 shrink-0 rounded-full bg-[#98543f]" aria-hidden="true" />
              {stage}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}