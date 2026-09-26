"use client";

import { useActionState, useEffect, useState } from "react";
import { findParcelAction } from "@/app/find-parcel-action";
import type { AssessmentLookupResult } from "@/lib/assessments/wprdc";
import {
  floodSourceLinkLabel,
  type FloodLookupResult,
} from "@/lib/hazards/flood";
import type { HazardSource } from "@/lib/hazards/arcgis";
import type { LandslideLookupResult } from "@/lib/hazards/landslide";
import type { SteepSlopeLookupResult } from "@/lib/hazards/steep-slope";
import type { UnderminedLookupResult } from "@/lib/hazards/undermined";
import type { DecisionSnapshot } from "@/lib/scoring";
import type { AddressToParcelResult } from "@/lib/lookup/address-to-parcel";
import type { ZoningLookupResult, ZoningSource } from "@/lib/zoning/pittsburgh";

export function FindParcelForm() {
  const [address, setAddress] = useState("");
  const [result, formAction, pending] = useActionState(
    findParcelAction,
    null,
  );

  useEffect(() => {
    if (result && "census" in result) {
      setAddress(result.census.matchedAddress);
    }
  }, [result]);

  return (
    <section className="mt-8">
      <form action={formAction} className="flex flex-col gap-3">
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
          required
          className="border border-neutral-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-fit cursor-pointer border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm text-white disabled:cursor-wait disabled:opacity-80"
        >
          {pending ? "Finding parcel…" : "Find Parcel"}
        </button>
      </form>
      {pending ? (
        <p className="mt-4 text-sm" role="status">
          Looking up parcel, zoning, and site conditions. This can take about 30
          seconds.
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
        <DecisionSnapshotCard decision={result.decision} />
        <h2 className="mt-8 text-lg font-medium">Matched parcel</h2>
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
        <SiteConditions
          steepSlope={result.steepSlope}
          landslide={result.landslide}
          undermined={result.undermined}
          flood={result.flood}
        />
        <EvidenceGaps decision={result.decision} />
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

function DecisionSnapshotCard({ decision }: { decision: DecisionSnapshot }) {
  const { presentation } = decision;

  return (
    <section className="border border-neutral-300 p-4">
      <h2 className="text-lg font-medium">Development feasibility snapshot</h2>
      <p className="mt-1 text-sm font-medium">
        Scoring v{decision.scoringVersion} — Provisional
      </p>
      <p className="mt-3 text-sm">
        This is a technical/provisional v0.1 score, not the final SME-validated
        model. Weights and penalties can change. It is not legal, zoning,
        engineering, environmental, or financial advice.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-lg font-medium">
            {presentation.heading}: {presentation.valueLine}
          </p>
          {presentation.mode === "incomplete" ? (
            <>
              <p className="mt-1 text-sm">{presentation.caveat}</p>
              <p className="mt-1 text-sm">{presentation.scoredFactorsLine}</p>
            </>
          ) : null}
        </div>
        <div>
          <p className="text-sm text-neutral-600">Core Evidence Coverage</p>
          <p className="text-lg font-medium">{decision.coverage.percent}%</p>
          <p className="mt-1 text-sm">{decision.coverage.label}</p>
        </div>
      </div>
      <p className="mt-4 text-sm">
        Critical Review Flags: {decision.flags.length}
      </p>
      {decision.flags.length > 0 ? (
        <ul className="mt-3 list-disc pl-5 text-sm">
          {decision.flags.map((flag) => (
            <li key={flag.type}>
              <span className="font-medium">
                {flag.level}: {flag.title}.
              </span>{" "}
              {flag.finding} {flag.verificationAction} A high numeric score does
              not hide this flag.
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-neutral-600">
          No critical review flags from currently implemented evidence.
        </p>
      )}
    </section>
  );
}

function EvidenceGaps({ decision }: { decision: DecisionSnapshot }) {
  return (
    <div className="mt-6">
      <h2 className="text-lg font-medium">Evidence gaps</h2>
      <ul className="mt-2 list-disc pl-5 text-sm">
        {decision.evidenceGaps.map((gap) => (
          <li key={gap.label}>
            {gap.label} — Not Evaluated
          </li>
        ))}
      </ul>
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

function HazardSourceLine({
  source,
  linkLabel,
}: {
  source: HazardSource;
  linkLabel: string;
}) {
  return (
    <p className="mt-2 text-sm text-neutral-600">
      Source: {source.name}.{" "}
      {source.mapVintage ? (
        <>
          Map vintage: {source.mapVintage} (not current FEMA NFHL). Dataset last
          modified: {source.sourceLastModified ?? "not reported"}.{" "}
        </>
      ) : (
        <>
          Dataset last modified: {source.sourceLastModified ?? "not reported"}.{" "}
        </>
      )}
      Retrieved {source.retrievedAt}. CRS: {source.crs}.{" "}
      <a href={source.datasetUrl} className="underline">
        {linkLabel}
      </a>
      .
    </p>
  );
}

function HazardOverlap({
  overlapPercent,
  overlapAreaSqFt,
  intersects,
  label,
}: {
  overlapPercent: number | null;
  overlapAreaSqFt: number | null;
  intersects: boolean;
  label: string;
}) {
  if (overlapPercent !== null) {
    return (
      <p className="mt-2 text-sm">
        Overlap with {label}: {formatOverlapPercent(overlapPercent)}
        {overlapAreaSqFt !== null
          ? ` (${new Intl.NumberFormat("en-US").format(Math.round(overlapAreaSqFt))} sq ft)`
          : ""}
        . Calculated in EPSG:2272, not latitude/longitude.
      </p>
    );
  }
  if (intersects) {
    return (
      <p className="mt-2 text-sm">
        Overlap percentage could not be calculated reliably.
      </p>
    );
  }
  return null;
}

function SiteConditions({
  steepSlope,
  landslide,
  undermined,
  flood,
}: {
  steepSlope: SteepSlopeLookupResult;
  landslide: LandslideLookupResult;
  undermined: UnderminedLookupResult;
  flood: FloodLookupResult;
}) {
  return (
    <div className="mt-6">
      <h2 className="text-lg font-medium">Site / environmental conditions</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Mapped GIS evidence only. Missing or failed sources are not treated as
        favorable. These findings do not mean a parcel is unsafe, prohibited, or
        unbuildable.
      </p>
      <SteepSlopeBlock steepSlope={steepSlope} />
      <LandslideBlock landslide={landslide} />
      <UnderminedBlock undermined={undermined} />
      <FloodBlock flood={flood} />
    </div>
  );
}

function SteepSlopeBlock({
  steepSlope,
}: {
  steepSlope: SteepSlopeLookupResult;
}) {
  if (steepSlope.status === "not_evaluated") {
    return (
      <div className="mt-4" role="alert">
        <h3 className="text-sm font-medium">Steep slope — Not Evaluated</h3>
        <p className="mt-2 text-sm">{steepSlope.message}</p>
        <p className="mt-2 text-sm text-neutral-600">
          Source failure is not treated as the absence of steep slope.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium">Steep slope — Evaluated</h3>
      <p className="mt-2 text-sm">{steepSlope.message}</p>
      <HazardOverlap
        overlapPercent={steepSlope.overlapPercent}
        overlapAreaSqFt={steepSlope.overlapAreaSqFt}
        intersects={steepSlope.intersects}
        label="mapped ≥25% slope"
      />
      <HazardSourceLine
        source={steepSlope.source}
        linkLabel="WPRDC 25% or Greater Slope"
      />
    </div>
  );
}

function LandslideBlock({
  landslide,
}: {
  landslide: LandslideLookupResult;
}) {
  if (landslide.status === "not_evaluated") {
    return (
      <div className="mt-4" role="alert">
        <h3 className="text-sm font-medium">Landslide — Not Evaluated</h3>
        <p className="mt-2 text-sm">{landslide.message}</p>
        <p className="mt-2 text-sm text-neutral-600">
          Source failure is not treated as the absence of landslide-prone area.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium">Landslide — Evaluated</h3>
      <p className="mt-2 text-sm">{landslide.message}</p>
      <HazardOverlap
        overlapPercent={landslide.overlapPercent}
        overlapAreaSqFt={landslide.overlapAreaSqFt}
        intersects={landslide.intersects}
        label="mapped landslide-prone area"
      />
      <HazardSourceLine
        source={landslide.source}
        linkLabel="WPRDC Landslide-Prone Areas"
      />
    </div>
  );
}

function UnderminedBlock({
  undermined,
}: {
  undermined: UnderminedLookupResult;
}) {
  if (undermined.status === "not_evaluated") {
    return (
      <div className="mt-4" role="alert">
        <h3 className="text-sm font-medium">Mine / undermined — Not Evaluated</h3>
        <p className="mt-2 text-sm">{undermined.message}</p>
        <p className="mt-2 text-sm text-neutral-600">
          Source failure is not treated as the absence of undermined/mine
          condition.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium">Mine / undermined — Evaluated</h3>
      <p className="mt-2 text-sm">{undermined.message}</p>
      {undermined.classifications.length > 0 ? (
        <p className="mt-2 text-sm">
          Source classification: {undermined.classifications.join(", ")}.
        </p>
      ) : null}
      <HazardOverlap
        overlapPercent={undermined.overlapPercent}
        overlapAreaSqFt={undermined.overlapAreaSqFt}
        intersects={undermined.intersects}
        label="mapped undermined area"
      />
      <HazardSourceLine
        source={undermined.source}
        linkLabel="WPRDC Undermined Areas"
      />
    </div>
  );
}

function FloodBlock({ flood }: { flood: FloodLookupResult }) {
  if (flood.status === "not_evaluated") {
    return (
      <div className="mt-4" role="alert">
        <h3 className="text-sm font-medium">Flood — Not Evaluated</h3>
        <p className="mt-2 text-sm">{flood.message}</p>
        <p className="mt-2 text-sm text-neutral-600">
          Source failure is not treated as the absence of flood hazard.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium">
        {flood.provenance === "wprdc_2014_extract"
          ? "Flood — Evaluated (2014 WPRDC FEMA extract)"
          : "Flood — Evaluated"}
      </h3>
      <p className="mt-2 text-sm">{flood.message}</p>
      {flood.zones.length > 0 ? (
        <ul className="mt-2 list-disc pl-5 text-sm">
          {flood.zones.map((zone) => (
            <li
              key={`${zone.fldZone ?? ""}-${zone.zoneSubtype ?? ""}-${zone.sfha ?? ""}`}
            >
              {zone.fldZone ? `Zone ${zone.fldZone}` : "Zone not reported"}
              {zone.zoneSubtype ? ` · ${zone.zoneSubtype}` : ""}
              {zone.sfha ? ` · SFHA ${zone.sfha}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      <HazardOverlap
        overlapPercent={flood.overlapPercent}
        overlapAreaSqFt={flood.overlapAreaSqFt}
        intersects={flood.intersects}
        label="mapped FEMA flood hazard"
      />
      {flood.provenance === "living_atlas_secondary" ? (
        <p className="mt-2 text-sm">
          Secondary flood-hazard fallback. This is not a direct FEMA NFHL query
          and is not presented as direct FEMA evidence.
        </p>
      ) : flood.provenance === "wprdc_2014_extract" ? (
        <p className="mt-2 text-sm">
          Map vintage: 2014. City-published extract of official FEMA data from
          that vintage. This is not current FEMA NFHL and is not a live NFHL
          query.
        </p>
      ) : (
        <p className="mt-2 text-sm">
          Authoritative primary source: FEMA National Flood Hazard Layer.
        </p>
      )}
      <HazardSourceLine
        source={flood.source}
        linkLabel={floodSourceLinkLabel(flood.provenance)}
      />
    </div>
  );
}

