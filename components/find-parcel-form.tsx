"use client";

import { useState, type FormEvent } from "react";
import type { AddressToParcelResult } from "@/lib/lookup/address-to-parcel";

export function FindParcelForm() {
  const [address, setAddress] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AddressToParcelResult | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setRequestError(null);
    setResult(null);

    try {
      const response = await fetch("/api/find-parcel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const payload = (await response.json()) as AddressToParcelResult;
      setResult(payload);
    } catch {
      setRequestError("The parcel lookup request failed. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-8">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label htmlFor="address" className="text-sm font-medium">
          Pittsburgh street address
        </label>
        <input
          id="address"
          name="address"
          type="text"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="414 Grant Street, Pittsburgh, PA 15219"
          autoComplete="street-address"
          className="border border-neutral-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-fit border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {pending ? "Finding parcel…" : "Find Parcel"}
        </button>
      </form>

      {requestError ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {requestError}
        </p>
      ) : null}

      {result ? <LookupResult result={result} /> : null}
    </section>
  );
}

function LookupResult({ result }: { result: AddressToParcelResult }) {
  if (result.status === "ok") {
    return (
      <div className="mt-6">
        <h2 className="text-lg font-medium">Matched parcel</h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-neutral-600">Census matched address</dt>
          <dd>{result.census.matchedAddress}</dd>
          <dt className="text-neutral-600">Latitude</dt>
          <dd>{result.census.latitude}</dd>
          <dt className="text-neutral-600">Longitude</dt>
          <dd>{result.census.longitude}</dd>
          <dt className="text-neutral-600">PIN</dt>
          <dd>{result.parcel.pin}</dd>
          <dt className="text-neutral-600">MAPBLOCKLOT</dt>
          <dd>{result.parcel.mapBlockLot ?? "—"}</dd>
          <dt className="text-neutral-600">Municipality code</dt>
          <dd>{result.parcel.municipalityCode ?? "—"}</dd>
          <dt className="text-neutral-600">Calculated acreage</dt>
          <dd>{result.parcel.calculatedAcreage ?? "—"}</dd>
        </dl>
      </div>
    );
  }

  return (
    <div className="mt-6" role="alert">
      <h2 className="text-lg font-medium">Parcel not resolved</h2>
      <p className="mt-2 text-sm">{result.message}</p>
      {"census" in result ? (
        <p className="mt-2 text-sm text-neutral-600">
          Census match: {result.census.matchedAddress} (
          {result.census.latitude}, {result.census.longitude})
        </p>
      ) : null}
      {result.status === "ambiguous_census_match" ? (
        <ul className="mt-2 list-disc pl-5 text-sm">
          {result.matches.map((match) => (
            <li key={`${match.matchedAddress}-${match.longitude}-${match.latitude}`}>
              {match.matchedAddress}
            </li>
          ))}
        </ul>
      ) : null}
      {result.status === "ambiguous_parcel_match" ? (
        <ul className="mt-2 list-disc pl-5 text-sm">
          {result.parcels.map((parcel) => (
            <li key={parcel.pin}>
              PIN {parcel.pin}
              {parcel.mapBlockLot ? ` (${parcel.mapBlockLot})` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
