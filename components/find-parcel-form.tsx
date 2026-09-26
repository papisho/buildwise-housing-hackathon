"use client";

import { useState, type FormEvent } from "react";
import type { AssessmentLookupResult } from "@/lib/assessments/wprdc";
import type { SteepSlopeLookupResult } from "@/lib/hazards/steep-slope";
import type { AddressToParcelResult } from "@/lib/lookup/address-to-parcel";
import type { ZoningLookupResult, ZoningSource } from "@/lib/zoning/pittsburgh";

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
        <AssessmentFacts
          pin={result.parcel.pin}
          assessment={result.assessment}
        />
        <ZoningFacts zoning={result.zoning} />
        <SiteConditions steepSlope={result.steepSlope} />
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
              {parcel.assessmentAddress
                ? ` — ${parcel.assessmentAddress}`
                : " — no assessment address"}
              {parcel.addressMatched ? " [address match]" : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function formatCountyAssessedValue(value: number | null): string {
  if (value === null) {
    return "Not reported";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatLotArea(value: number | null): string {
  if (value === null) {
    return "Not reported";
  }
  return `${new Intl.NumberFormat("en-US").format(value)} sq ft`;
}

function AssessmentFacts({
  pin,
  assessment,
}: {
  pin: string;
  assessment: AssessmentLookupResult;
}) {
  if (assessment.status !== "ok") {
    return (
      <div className="mt-6" role="alert">
        <h2 className="text-lg font-medium">Parcel facts</h2>
        <p className="mt-2 text-sm">{assessment.message}</p>
      </div>
    );
  }

  const facts = assessment.facts;
  const classLabel = [facts.classDescription, facts.classCode]
    .filter(Boolean)
    .join(" / ");
  const sourceDate = [
    facts.asOfDate,
    facts.taxYear ? `tax year ${facts.taxYear}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mt-6">
      <h2 className="text-lg font-medium">Parcel facts</h2>
      <p className="mt-1 text-sm text-neutral-600">
        County assessed values are not market values.
      </p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-neutral-600">Parcel ID</dt>
        <dd>{facts.parid}</dd>
        <dt className="text-neutral-600">PIN / PARID match</dt>
        <dd>
          {facts.parid === pin
            ? "PIN matches assessment PARID"
            : "Mismatch"}
        </dd>
        <dt className="text-neutral-600">Property address</dt>
        <dd>{facts.propertyAddress ?? "Not reported"}</dd>
        <dt className="text-neutral-600">Municipality</dt>
        <dd>{facts.municipality ?? facts.municipalityCode ?? "Not reported"}</dd>
        <dt className="text-neutral-600">Class</dt>
        <dd>{classLabel || "Not reported"}</dd>
        <dt className="text-neutral-600">Current land use</dt>
        <dd>{facts.useDescription ?? "Not reported"}</dd>
        <dt className="text-neutral-600">Lot area</dt>
        <dd>{formatLotArea(facts.lotArea)}</dd>
        <dt className="text-neutral-600">County assessed land value</dt>
        <dd>{formatCountyAssessedValue(facts.countyAssessedLandValue)}</dd>
        <dt className="text-neutral-600">County assessed building value</dt>
        <dd>{formatCountyAssessedValue(facts.countyAssessedBuildingValue)}</dd>
        <dt className="text-neutral-600">County assessed total</dt>
        <dd>{formatCountyAssessedValue(facts.countyAssessedTotal)}</dd>
        {facts.yearBuilt !== null ? (
          <>
            <dt className="text-neutral-600">Year built</dt>
            <dd>{facts.yearBuilt}</dd>
          </>
        ) : null}
        {facts.stories !== null ? (
          <>
            <dt className="text-neutral-600">Stories</dt>
            <dd>{facts.stories}</dd>
          </>
        ) : null}
        {facts.finishedLivingArea !== null ? (
          <>
            <dt className="text-neutral-600">Finished living area</dt>
            <dd>
              {new Intl.NumberFormat("en-US").format(facts.finishedLivingArea)} sq
              ft
            </dd>
          </>
        ) : null}
        {sourceDate ? (
          <>
            <dt className="text-neutral-600">Assessment / source date</dt>
            <dd>{sourceDate}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}

function ZoningFacts({ zoning }: { zoning: ZoningLookupResult }) {
  if (zoning.status === "unavailable") {
    return (
      <div className="mt-6" role="alert">
        <h2 className="text-lg font-medium">Base zoning</h2>
        <p className="mt-2 text-sm">Zoning not evaluated. {zoning.message}</p>
      </div>
    );
  }

  if (zoning.status === "no_district") {
    return (
      <div className="mt-6" role="alert">
        <h2 className="text-lg font-medium">Base zoning</h2>
        <p className="mt-2 text-sm">{zoning.message}</p>
        <ZoningSource source={zoning.source} />
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h2 className="text-lg font-medium">Base zoning</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Mapped GIS district only. This is not a determination that a use is
        permitted, approved, or buildable. If there is a dispute, the official
        zoning code and maps maintained by the Zoning Administrator prevail.
      </p>
      {zoning.splitZoning ? (
        <p className="mt-2 text-sm" role="status">
          Split zoning / multiple mapped districts. All intersecting districts
          are listed; none was selected as the sole district.
        </p>
      ) : (
        <p className="mt-2 text-sm">
          The parcel intersects one mapped zoning district.
        </p>
      )}
      <ul className="mt-3 list-disc pl-5 text-sm">
        {zoning.districts.map((district) => (
          <li key={district.code}>
            <span className="font-medium">{district.code}</span>
            {district.fullType ? ` — ${district.fullType}` : ""}
            {district.legendType ? ` (${district.legendType})` : ""}
            {district.status ? ` · ${district.status}` : ""}
          </li>
        ))}
      </ul>
      <ZoningSource source={zoning.source} />
    </div>
  );
}

function ZoningSource({ source }: { source: ZoningSource }) {
  return (
    <p className="mt-3 text-sm text-neutral-600">
      Source: {source.name}. Dataset last modified:{" "}
      {source.sourceLastModified ?? "not reported"}. Retrieved{" "}
      {source.retrievedAt}.{" "}
      <a href={source.datasetUrl} className="underline">
        WPRDC zoning
      </a>
      {" · "}
      <a href={source.zoningCodeUrl} className="underline">
        Zoning Code
      </a>
      {" · "}
      <a href={source.zoningMapUrl} className="underline">
        City zoning map
      </a>
      {" · "}
      <a href={source.cityZoningPageUrl} className="underline">
        City zoning page
      </a>
      .
    </p>
  );
}

function formatOverlapPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function SiteConditions({
  steepSlope,
}: {
  steepSlope: SteepSlopeLookupResult;
}) {
  if (steepSlope.status === "not_evaluated") {
    return (
      <div className="mt-6" role="alert">
        <h2 className="text-lg font-medium">Site conditions</h2>
        <p className="mt-2 text-sm">{steepSlope.message}</p>
        <p className="mt-2 text-sm text-neutral-600">
          Source failure is not treated as the absence of steep slope.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h2 className="text-lg font-medium">Site conditions</h2>
      <p className="mt-2 text-sm">{steepSlope.message}</p>
      {steepSlope.overlapPercent !== null ? (
        <p className="mt-2 text-sm">
          Overlap with mapped ≥25% slope:{" "}
          {formatOverlapPercent(steepSlope.overlapPercent)}
          {steepSlope.overlapAreaSqFt !== null
            ? ` (${new Intl.NumberFormat("en-US").format(Math.round(steepSlope.overlapAreaSqFt))} sq ft)`
            : ""}
          . Calculated in EPSG:2272, not latitude/longitude.
        </p>
      ) : steepSlope.intersects ? (
        <p className="mt-2 text-sm">
          Overlap percentage could not be calculated reliably.
        </p>
      ) : null}
      <p className="mt-2 text-sm text-neutral-600">
        This is mapped GIS evidence only. It does not mean the parcel is unsafe,
        prohibited, or unbuildable. Site-specific review may still be needed.
      </p>
      <p className="mt-3 text-sm text-neutral-600">
        Source: {steepSlope.source.name}. Dataset last modified:{" "}
        {steepSlope.source.sourceLastModified ?? "not reported"}. Retrieved{" "}
        {steepSlope.source.retrievedAt}. CRS: {steepSlope.source.crs}.{" "}
        <a href={steepSlope.source.datasetUrl} className="underline">
          WPRDC 25% or Greater Slope
        </a>
        .
      </p>
    </div>
  );
}

