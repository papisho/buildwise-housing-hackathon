"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { findParcelAction } from "@/app/find-parcel-action";
import { AddressAutocomplete } from "@/components/address-autocomplete";
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
      <div className="bw-card overflow-hidden shadow-[0_12px_32px_rgba(38,54,47,0.06)]">
        <div className="flex flex-col gap-4 border-b border-line bg-[#e9e5d9] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>
            <p className="bw-kicker">Start a parcel brief</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
              Analyze a property
            </h2>
          </div>
          <p className="max-w-md text-sm leading-5 text-ink-muted">
            Pittsburgh parcels only. Preliminary screening—not legal, zoning,
            engineering, environmental, or financial advice.
          </p>
        </div>
        <form
          action={formAction}
          className="grid gap-4 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_16rem_auto] lg:items-end"
          onSubmit={(event) => {
            const formData = new FormData(event.currentTarget);
            submittedAddress.current = String(formData.get("address") ?? "");
            submittedProjectType.current = parseProposedProjectType(
              formData.get("proposedProjectType"),
            );
          }}
        >
          <AddressAutocomplete address={address} onChange={setAddress} pending={pending} />
          <div>
            <label htmlFor="proposedProjectType" className="text-sm font-semibold">
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
            aria-describedby={pending ? "analysis-progress" : undefined}
            className="bw-btn w-full lg:min-w-44 lg:w-auto"
          >
            {pending ? (
              <>
                <span className="mr-2 inline-block size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                Looking up…
              </>
            ) : (
              <>Build site brief <span aria-hidden="true" className="ml-2">→</span></>
            )}
          </button>
          <p id="address-guidance" className="text-xs leading-5 text-ink-muted lg:col-span-3">
            Start typing a street number and name, then choose a Pittsburgh address. You can also enter the full address yourself. Suggestions do not verify a parcel.
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
