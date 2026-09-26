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
    <section className="mt-8">
      <form
        action={formAction}
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          const formData = new FormData(event.currentTarget);
          submittedAddress.current = String(formData.get("address") ?? "");
          submittedProjectType.current = parseProposedProjectType(
            formData.get("proposedProjectType"),
          );
        }}
      >
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
          className="border border-neutral-300 px-3 py-2"
        />
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
          className="border border-neutral-300 bg-white px-3 py-2"
        >
          {PROPOSED_PROJECT_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="w-fit cursor-pointer border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm text-white disabled:cursor-wait disabled:opacity-80"
        >
          {pending ? "Analyzing…" : "Analyze Property"}
        </button>
      </form>

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
