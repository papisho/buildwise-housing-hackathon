import type { ReactNode } from "react";

const JUMP_LINKS = [
  ["#result-snapshot", "Snapshot"],
  ["#result-map", "Map"],
  ["#result-zoning", "Zoning"],
  ["#result-site", "Site Conditions"],
  ["#result-regulatory", "Regulatory"],
  ["#result-financial", "Financial"],
  ["#result-ai", "AI"],
  ["#result-scoring", "Scoring"],
  ["#result-gaps", "Gaps"],
  ["#results-sources", "Sources"],
] as const;

export function ResultJumpNav() {
  return (
    <nav
      aria-label="On this result"
      className="mt-4 max-w-full overflow-x-auto"
    >
      <ul className="flex w-max gap-2 pb-1">
        {JUMP_LINKS.map(([href, label]) => (
          <li key={href}>
            <a
              href={href}
              className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-3 text-sm text-ink"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SourceDisclosure({
  name,
  lastModified,
  href,
  linkLabel,
  details,
}: {
  name: string;
  lastModified: string | null;
  href: string;
  linkLabel: string;
  details: ReactNode;
}) {
  return (
    <div className="mt-3 border-t border-line pt-3 text-sm text-ink-muted">
      <p>
        Source: {name}
        {" · "}
        Dataset last modified: {lastModified ?? "not reported"}
        {" · "}
        <a href={href} className="text-accent underline">
          {linkLabel}
        </a>
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer text-sm font-medium text-accent">
          Source details
        </summary>
        <div className="mt-2 space-y-1 text-xs leading-5">{details}</div>
      </details>
    </div>
  );
}
