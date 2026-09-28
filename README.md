# BuildWise

BuildWise is a preliminary decision-support tool for **small and mid-sized housing developers** doing first-pass Pittsburgh site screening.

Enter a City of Pittsburgh address and a proposed housing type. BuildWise resolves one validated parcel, screens mapped public evidence, and returns a Development Ease snapshot, coverage, review flags, and a grounded explanation. It does not issue a permit, a zoning determination, or a financial opinion.

Click a topic heading to hide or show that section.

<details open>
<summary><h2>Hackathon</h2></summary>

- **Event:** AI Horizons 2026 AI for Housing Hackathon
- **Track:** Track 1 — Development Feasibility Navigator
- **Scope:** City of Pittsburgh preliminary decision-support only

</details>

<details open>
<summary><h2>Disclaimer</h2></summary>

This tool is **not** legal, zoning, engineering, environmental, or financial advice. Mapped GIS districts and hazard layers are factual evidence only. They do not mean a site is permitted, approved, buildable, or unbuildable. If zoning is disputed, the official zoning code and maps maintained by the Zoning Administrator prevail.

Missing data is **Not Evaluated**. A source failure is never treated as a clear or favorable finding.

</details>

<details open>
<summary><h2>Demo</h2></summary>

- **Live app:** [Open BuildWise](https://buildwise-amber-alpha.vercel.app/)
- **Walkthrough video:** [Watch the BuildWise walkthrough](https://youtu.be/mqRCC5VhnUA)

Suggested live sequence: use the **5061 Fifth Ave** scored example with Single-Unit Detached Residential to show a complete score and printable handoff; use the **436 Grant St** General screening example to show an incomplete score and historic review flag; then enter **414 Grant St, Pittsburgh, PA 15219** to show how an ambiguous parcel match stops the analysis instead of guessing. These are screening outcomes, not development approvals.

</details>

<details open>
<summary><h2>Current working flow</h2></summary>

1. Enter a Pittsburgh street address and a proposed housing type (general screening, single-unit detached, single-unit attached, two-unit, three-unit, or multi-unit 4+).
2. The U.S. Census Geocoder matches the address to coordinates. An ambiguous Census match stops the lookup. No nearby parcel is chosen silently.
3. Allegheny County parcel polygons are queried from that point (with a 20-foot search when the point falls in the street). Special GIS PINs such as `COMMON GROUND` are ignored. Assessment addresses are compared to the requested address. A parcel is selected only when exactly one match is validated. Otherwise the result is `PARCEL_IDENTITY_VERIFICATION_REQUIRED` and no score, map, or evidence card is produced.
4. That canonical PARID is the identity for every later step. Nothing downstream geocodes again or picks a different parcel.
5. Allegheny County Property Assessments are loaded by PARID.
6. City of Pittsburgh base zoning is intersected with the parcel polygon in EPSG:2272. Every intersecting district is kept, including split zoning. A first-pass use table reports how the proposed housing type sits in those districts. That status is an encoding of the published table, not a Zoning Administrator determination.
7. Steep slope (≥25%), landslide-prone area, undermined/mine area, and flood hazard are intersected independently with the same parcel polygon. Flood tries FEMA NFHL first, then the City/WPRDC 2014 FEMA extract, then a labeled secondary fallback.
8. PLI permits and PLI/DOMI/ES violations are looked up for the canonical PIN. Unresolved records raise review context. A source failure stays Not Evaluated.
9. City historic districts and individually designated historic sites are screened with the same parcel. Overlaps under 1% are ignored as geometry noise unless the site lotblock matches the canonical PIN.
10. Scoring v1 (`lib/scoring/`) computes the Development Ease Score, Evidence Coverage, and Critical Review Flags from the structured evidence. Unevaluated evidence is left unscored. Flags stay visible even when the numeric score is high or incomplete.
11. Deterministic verification steps are listed from the evidence and flags. Relevant steps link to the official City zoning map and code or the public OneStopPGH Insights record search. These are starting points for manual verification, not parcel-specific confirmations.
12. Claude writes a short explanation from the completed structured result, and a parcel-grounded chat can answer follow-up questions. If Claude is unavailable, the structured result still renders.
13. Preliminary Financial Context adds nearby County-coded valid sales and a HUD Fair Market Rent benchmark. It does not change the score, coverage, or flags, and it is not an appraisal.
14. A Parcel & Evidence Map draws the validated parcel plus the zoning, hazard, and historic geometry already used in the analysis. The map is display-only. It does not create findings or change any score.
15. The Quick Development Scenario lets users enter their own cost and rent assumptions for a rough sensitivity check. It is not a pro forma and does not change the Development Ease Score.
16. A compact parcel handoff previews the matched identity, score or incomplete status, coverage, flags, gaps, recommended checks, and source links. Users can print it or save it as a PDF; it is a summary, not the complete analysis.

</details>

<details open>
<summary><h2>Data sources currently used</h2></summary>

- U.S. Census Geocoder (`locations/onelineaddress`, `benchmark=Public_AR_Current`)
- Allegheny County parcels ArcGIS layer: `OPENDATA/Parcels/MapServer/0`
- WPRDC Allegheny County Property Assessments (resource `65855e14-549e-4992-b5be-d629afc676fa`)
- City of Pittsburgh / WPRDC zoning (`PGHWebZoning/FeatureServer/0`; GeoJSON resource `6127f35e-f36b-4a53-80b3-f4409609e9df`)
- City of Pittsburgh / WPRDC 25% or Greater Slope (`PGHWebSlope25/FeatureServer/0`; GeoJSON resource `5ce91a56-0799-46ea-9585-13fa8db5979e`)
- City of Pittsburgh / WPRDC Landslide-Prone Areas (`PGHWebLandslideProne/FeatureServer/0`; GeoJSON resource `b5b45ac6-f8ef-4805-b4e4-fc7c63fb4075`)
- City of Pittsburgh / WPRDC Undermined Areas (`PGHWebUndermined/FeatureServer/0`; GeoJSON resource `e1d96015-818f-46fb-88dd-85c20eacb96c`)
- FEMA National Flood Hazard Layer, Flood Hazard Zones (`public/NFHL/MapServer/28`) — authoritative primary source. If that host is unreachable, City of Pittsburgh / WPRDC 2014 FEMA Flood Zones (`PGHWebFEMA2014/FeatureServer/0`; GeoJSON resource `122717f9-f08a-4be1-82b9-c213cc069e8c`), a City-published extract of official FEMA data. Esri Living Atlas USA Flood Hazard Reduced Set is a secondary fallback only and is not presented as direct FEMA evidence.
- City of Pittsburgh / WPRDC PLI Permits
- City of Pittsburgh / WPRDC PLI/DOMI/ES Violations
- City of Pittsburgh / WPRDC City Designated Historic Districts (`PGHWebCHDHistoricDistricts/FeatureServer/0`)
- City of Pittsburgh / WPRDC City Designated Individual Historic Sites (`PGHWEBCHDIndividialProperties/FeatureServer/0`)
- Allegheny County / WPRDC Property Sale Transactions
- HUD Fair Market Rents / Small Area FMRs (Pittsburgh metro, `METRO38300M38300`)
- OpenStreetMap tiles for the evidence map basemap only. The basemap is geographic context, not a BuildWise evidence source.
- Official zoning references: [Zoning Code](https://ecode360.com/45474054), [City zoning map](https://pittsburghpa.maps.arcgis.com/apps/instant/sidebar/index.html?appid=4bb79ea64bf848b3a0560e3856efeccb), [City zoning page](https://www.pittsburghpa.gov/Business-Development/City-Planning/Zoning)

</details>

<details open>
<summary><h2>Current limitations</h2></summary>

- City of Pittsburgh parcels only.
- Census interpolates to the street centerline. Some addresses stay unresolved when several nearby parcels match, and analysis stops instead of guessing.
- Assessment house numbers can differ from the entered address when one parcel covers a range of numbers. Screening stays attached to the PARID.
- The use table is a first-pass encoding for the supported housing types. It is not a legal entitlement, and general screening does not apply a use status.
- Overlap percent is a planar GIS calculation in Pennsylvania State Plane South (US survey feet, EPSG:2272). It is not a field survey. The map reprojects a copy to latitude/longitude for display only.
- Historic overlaps under 1% are dropped as a BuildWise geometry-noise rule, not an official Historic Review Commission threshold. A site whose lotblock equals the canonical PIN still counts.
- Source or API failure is shown as Not Evaluated. Missing data is not treated as a clean or favorable site.
- Scoring v1 uses SME-informed heuristic weights. It is not an established industry standard. The score is incomplete when a scored evidence layer was not evaluated. A high score does not hide a Critical Review Flag.
- Regulatory records, historic screening, and financial context inform review and narrative. They are not extra score inputs.
- Nearby sales are County-coded valid sales near the parcel. They are not determined comparables, and the HUD rent figure is a benchmark, not project rent.
- The map shows only the subject parcel and evidence that already intersected it. It is not a survey, and a failed layer is Not Evaluated rather than drawn as clear.
- Not in this build: dimensional standards, other overlays, legal access, utilities, stormwater, title and easements, certificate of occupancy, and a full financial feasibility model.
- No SQLite cache. Each analysis calls the live public services.

</details>

<details open>
<summary><h2>Getting started</h2></summary>

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Optional, in `.env.local` (do not commit this file):

- `CLAUDE_API_KEY` — grounded explanation and parcel chat. Without it, the structured result still renders and the AI summary is unavailable.
- `CLAUDE_MODEL` — optional. Defaults to `claude-sonnet-4-5`.
- `HUD_USER_API_TOKEN` — HUD rent benchmark. Without it, that benchmark is Not Evaluated. Nearby sales do not depend on this token.

</details>

<details open>
<summary><h2>Stack</h2></summary>

- Next.js (App Router) and TypeScript
- Tailwind CSS
- Leaflet and OpenStreetMap for the evidence map
- proj4 for display-only reprojection from EPSG:2272 to EPSG:4326
- Claude API for the grounded explanation and follow-up chat
- npm

</details>

<details open>
<summary><h2>AI and development tools disclosure</h2></summary>

- ChatGPT — research, planning, and project-document handoff
- Cursor — implementation assistance in this repository
- Replit Agent — AI-assisted implementation, interface iteration, verification, and documentation
- Anthropic Claude API — optional runtime explanation and parcel-grounded follow-up chat based on structured results. It does not choose parcels or change facts, flags, score, or coverage. The deterministic result still works when the AI explanation is unavailable.

Replit Agent and Cursor are development tools, not runtime evidence sources or zoning authorities. BuildWise's core parcel selection, score, coverage, flags, and verification steps come from the application's code and cited public evidence, not generated text.

</details>
