"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { findParcelAction } from "@/app/find-parcel-action";
import {
  FeasibilitySnapshot,
  LookupError,
} from "@/components/feasibility-snapshot";
import { LoadingStages } from "@/components/loading-stages";
import {
  parseProposedProjectType,
  PROPOSED_PROJECT_TYPES,
  type ProposedProjectType,
} from "@/lib/project-type";

export function FindParcelForm() {
  const [address, setAddress] = useState("");
  const [proposedProjectType, setProposedProjectType] =
    useState<ProposedProjectType>("general_screening");
  const submittedAddress = useRef("");
  const submittedProjectType = useRef<ProposedProjectType>("general_screening");
  const [result, formAction, pending] = useActionState(
    findParcelAction,
    null,
  );

  useEffect(() => {
    if (pending) {
      return;
    }

    const restore = () => {
      if (result?.status === "ok") {
        setAddress(result.census.matchedAddress);
        setProposedProjectType(result.request.proposedProjectType);
        return;
      }
      if (result && "census" in result) {
        setAddress(result.census.matchedAddress);
        setProposedProjectType(submittedProjectType.current);
        return;
      }
      if (submittedAddress.current) {
        setAddress(submittedAddress.current);
        setProposedProjectType(submittedProjectType.current);
      }
    };

    restore();
    const immediate = window.setTimeout(restore, 0);
    const delayed = window.setTimeout(restore, 50);
    return () => {
      window.clearTimeout(immediate);
      window.clearTimeout(delayed);
    };
  }, [pending, result]);

  return (
    <section id="analyze" className="mt-10 scroll-mt-24">
      <div className="bw-card p-5 sm:p-6">
        <h2 className="text-xl font-semibold tracking-tight">Analyze a property</h2>
        <p className="mt-1 text-sm text-ink-muted">
          City of Pittsburgh parcels. Decision support only — not legal, zoning,
          engineering, environmental, or financial advice.
        </p>
        <form
          action={formAction}
          className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem_auto] lg:items-end"
          onSubmit={(event) => {
            const formData = new FormData(event.currentTarget);
            submittedAddress.current = String(formData.get("address") ?? "");
            submittedProjectType.current = parseProposedProjectType(
              formData.get("proposedProjectType"),
            );
          }}
        >
          <div>
            <label htmlFor="address" className="text-sm font-medium">
              Address
            </label>
            <input
              id="address"
              name="address"
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="414 Grant Street, Pittsburgh, PA 15219"
              autoComplete="street-address"
              required
              className="bw-input mt-1.5"
            />
          </div>
          <div>
            <label htmlFor="proposedProjectType" className="text-sm font-medium">
              Proposed housing
            </label>
            <select
              id="proposedProjectType"
              name="proposedProjectType"
              value={proposedProjectType}
              onChange={(event) =>
                setProposedProjectType(
                  event.target.value as ProposedProjectType,
                )
              }
              className="bw-input mt-1.5"
            >
              {PROPOSED_PROJECT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="bw-btn h-[2.625rem] w-full lg:w-auto"
          >
            {pending ? "Analyzing…" : "Analyze Property"}
          </button>
          <p className="text-xs leading-5 text-ink-muted lg:col-span-3">
            Enter a full Pittsburgh address for the most reliable parcel match.
          </p>
        </form>
      </div>

      <LoadingStages pending={pending} />

      {!pending && result?.status === "ok" ? (
        <FeasibilitySnapshot result={result} />
      ) : null}
      {!pending && result && result.status !== "ok" ? (
        <LookupError result={result} />
      ) : null}
    </section>
  );
}
