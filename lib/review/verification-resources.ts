export type VerificationResource = {
  label: string;
  href: string;
};

// Public destinations, not parcel-specific results or evidence used in scoring.
export const ZONING_MAP: VerificationResource = {
  label: "Open City zoning map",
  href: "https://pittsburghpa.maps.arcgis.com/apps/instant/sidebar/index.html?appid=4bb79ea64bf848b3a0560e3856efeccb",
};
export const ZONING_CODE: VerificationResource = {
  label: "Read Pittsburgh zoning code",
  href: "https://ecode360.com/45474054",
};
export const CITY_RECORDS: VerificationResource = {
  label: "Search OneStopPGH Insights",
  href: "https://experience.arcgis.com/experience/89d500285ecd4804ae9945d93d424569",
};

export const VERIFICATION_PORTALS = [ZONING_MAP, ZONING_CODE, CITY_RECORDS];

const zoningStarts = [
  "Unsupported / unencoded mapped zoning district:",
  "Zoning-use compatibility requires review:",
  "Confirm the preliminary by-right use-table cell",
  "Proposed-use compatibility was not evaluated.",
  "Split zoning:",
];
const recordStarts = [
  "PLI permits were not evaluated.",
  "Verify unresolved permit status",
  "One or more queried permit statuses are ambiguous",
  "No unresolved permit statuses were identified",
  "PLI/DOMI/ES violations were not evaluated.",
  "Verify unresolved violations",
  "One or more queried violation statuses are ambiguous",
  "No unresolved violation statuses were identified",
];

export function resourcesForVerificationStep(step: string): VerificationResource[] {
  if (zoningStarts.some((prefix) => step.startsWith(prefix))) {
    return [ZONING_MAP, ZONING_CODE];
  }
  if (recordStarts.some((prefix) => step.startsWith(prefix))) {
    return [CITY_RECORDS];
  }
  if (step.startsWith("Confirm whether existing approvals or records affect")) {
    return VERIFICATION_PORTALS;
  }
  return [];
}