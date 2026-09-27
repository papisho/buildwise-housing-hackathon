"use client";

import { useEffect, useRef, type ReactNode } from "react";

const JUMP_LINKS = [
  ["#result-snapshot", "Snapshot"],
  ["#result-map", "Map"],
  ["#result-zoning", "Zoning"],
  ["#result-site", "Site conditions"],
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
      className="mt-6 border-y border-line py-2"
    >
      <ul className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
        {JUMP_LINKS.map(([href, label], index) => (
          <li key={href} className="shrink-0">
            <a
              href={href}
              className={`inline-flex min-h-10 items-center rounded-full px-3 text-sm font-medium transition-colors hover:bg-accent-soft hover:text-accent focus-visible:outline-offset-1 ${
                index === 0
                  ? "bg-accent text-[#fffefa] hover:bg-accent-hover hover:text-[#fffefa]"
                  : "text-ink-muted"
              }`}
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
      <p className="leading-6">
        <span className="font-medium text-ink">Source:</span> {name}
        {" · "}
        Dataset last modified: {lastModified ?? "not reported"}
        {" · "}
        <a href={href} className="font-medium text-accent underline">
          {linkLabel}
        </a>
      </p>
      <details className="bw-source-disclosure mt-2">
        <summary className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md text-sm font-semibold text-accent underline decoration-accent/40 underline-offset-4">
          Source details
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5 fill-none stroke-current" strokeWidth="1.8">
            <path d="m3.5 6 4.5 4 4.5-4" />
          </svg>
        </summary>
        <div className="mt-2 space-y-1 break-words rounded-lg bg-[#efede5] p-3 text-xs leading-5">
          {details}
        </div>
      </details>
    </div>
  );
}

export function SourcesAssumptionsDisclosure({
  children,
}: {
  children: ReactNode;
}) {
  const disclosure = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const openWhenLinked = () => {
      if (window.location.hash === "#results-sources" && disclosure.current) {
        disclosure.current.open = true;
      }
    };
    const openWhenClicked = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('a[href="#results-sources"]') &&
        disclosure.current
      ) {
        disclosure.current.open = true;
      }
    };

    openWhenLinked();
    window.addEventListener("hashchange", openWhenLinked);
    document.addEventListener("click", openWhenClicked);
    return () => {
      window.removeEventListener("hashchange", openWhenLinked);
      document.removeEventListener("click", openWhenClicked);
    };
  }, []);

  return (
    <details
      id="results-sources"
      ref={disclosure}
      className="bw-card bw-source-disclosure mt-10 scroll-mt-24 overflow-hidden"
    >
      <summary className="flex min-h-[4.5rem] cursor-pointer items-center justify-between gap-4 px-5 py-4 sm:px-6">
        <span>
          <span className="block text-lg font-semibold tracking-tight text-ink">
            Sources &amp; Assumptions
          </span>
          <span className="mt-0.5 block text-sm text-ink-muted">
            Source vintage, join method, and limitations
          </span>
        </span>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-paper text-accent">
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-none stroke-current" strokeWidth="1.8">
            <path d="m3.5 6 4.5 4 4.5-4" />
          </svg>
        </span>
      </summary>
      <div className="border-t border-line px-5 pb-5 pt-4 sm:px-6">
        {children}
      </div>
    </details>
  );
}