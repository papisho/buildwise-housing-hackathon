# BuildWise

BuildWise is a preliminary decision-support tool for **small and mid-sized housing developers** doing first-pass Pittsburgh site screening.

## Hackathon

- **Event:** AI Horizons 2026 AI for Housing Hackathon
- **Track:** Track 1 — Development Feasibility Navigator
- **Scope:** City of Pittsburgh preliminary decision-support only

## Disclaimer

This tool is **not** legal, zoning, engineering, environmental, or financial advice. Mapped GIS districts and hazard layers are factual evidence only. They do not mean a site is permitted, approved, buildable, or unbuildable. If zoning is disputed, the official zoning code and maps maintained by the Zoning Administrator prevail.

## Current working flow

1. Enter a Pittsburgh street address.
2. U.S. Census Geocoder matches the address to coordinates.
3. Allegheny County parcel polygons are queried from that point (with a 20-foot search when the point falls in the street). Special GIS PINs such as `COMMON GROUND` are ignored. If several valid PINs remain, assessment addresses are compared to the requested address; a parcel is selected only when exactly one matches.
4. Allegheny County Property Assessments are loaded by PARID.
5. City of Pittsburgh base zoning is intersected with the **parcel polygon**, not the Census point. Multiple districts are listed as split zoning.
6. City of Pittsburgh mapped ≥25% slope is intersected with the same parcel polygon. Overlap percent is calculated in EPSG:2272 when the clip succeeds.

## Data sources currently used

- U.S. Census Geocoder (`locations/onelineaddress`, `benchmark=Public_AR_Current`)
- Allegheny County parcels ArcGIS layer: `OPENDATA/Parcels/MapServer/0`
- WPRDC Allegheny County Property Assessments (resource `65855e14-549e-4992-b5be-d629afc676fa`)
- City of Pittsburgh / WPRDC zoning (`PGHWebZoning/FeatureServer/0`; GeoJSON resource `6127f35e-f36b-4a53-80b3-f4409609e9df`)
- City of Pittsburgh / WPRDC 25% or Greater Slope (`PGHWebSlope25/FeatureServer/0`; GeoJSON resource `5ce91a56-0799-46ea-9585-13fa8db5979e`)
- Official zoning references: [Zoning Code](https://ecode360.com/45474054), [City zoning map](https://pittsburghpa.maps.arcgis.com/apps/instant/sidebar/index.html?appid=4bb79ea64bf848b3a0560e3856efeccb), [City zoning page](https://www.pittsburghpa.gov/Business-Development/City-Planning/Zoning)

## Current limitations

- City of Pittsburgh parcels only.
- Census interpolates to the street centerline; some addresses stay ambiguous when several nearby parcels match.
- Assessment house numbers can differ from the entered address when one parcel covers a range of numbers.
- Base zoning is the mapped district only. Use permission (permitted / conditional / special exception) is not evaluated.
- Steep slope is the City ≥25% slope GIS layer only. Landslide, mine, and flood layers are not evaluated.
- Overlap percent is a planar GIS calculation in Pennsylvania State Plane South (US survey feet). It is not a field survey.
- Source or API failure for zoning or slope is shown as not evaluated. Missing data is not treated as a clean or favorable site.
- No Development Ease Score, no SQLite cache, and no AI narrative on the result.

## AI / tools used so far

- ChatGPT — research, planning, and project-document handoff
- Cursor — implementation in this repository

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- npm
