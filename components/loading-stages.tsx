"use client";

import { useEffect, useState } from "react";

export const LOADING_STAGES = [
  "Matching address",
  "Finding parcel",
  "Checking zoning",
  "Checking site conditions",
  "Checking mapped hazards",
  "Preparing feasibility snapshot",
] as const;

const STAGE_MS = 4_500;

export function LoadingStages({ pending }: { pending: boolean }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!pending) {
      setIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) =>
        Math.min(current + 1, LOADING_STAGES.length - 1),
      );
    }, STAGE_MS);

    return () => window.clearInterval(timer);
  }, [pending]);

  if (!pending) {
    return null;
  }

  return (
    <div className="bw-card mt-6 p-5" role="status">
      <p className="text-sm font-semibold">{LOADING_STAGES[index]}</p>
      <ol className="mt-3 space-y-1 text-sm text-ink-muted">
        {LOADING_STAGES.map((stage, stageIndex) => (
          <li key={stage}>
            {stageIndex < index ? "Done — " : stageIndex === index ? "Now — " : ""}
            {stage}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-ink-muted">
        These stages follow the live lookup. A full analysis can take about 30
        seconds.
      </p>
    </div>
  );
}
