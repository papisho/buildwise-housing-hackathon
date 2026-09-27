export type HistoricSource = {
  name: string;
  datasetUrl: string;
  queryUrl: string;
  resourceId: string;
  crs: string;
  sourceLastModified: string | null;
  retrievedAt: string;
};

export type HistoricDistrictHit = {
  name: string;
  districtType: string | null;
  guidelineLink: string | null;
  overlapAreaSqFt: number | null;
  overlapPercent: number | null;
};

export type HistoricSiteHit = {
  name: string;
  address: string | null;
  lotblock: string | null;
  overlapAreaSqFt: number | null;
  overlapPercent: number | null;
};

export type HistoricLayerResult =
  | {
      status: "ok";
      intersects: boolean;
      features: HistoricDistrictHit[] | HistoricSiteHit[];
      overlapAreaSqFt: number | null;
      overlapPercent: number | null;
      message: string;
      source: HistoricSource;
    }
  | {
      status: "not_evaluated";
      message: string;
      source: HistoricSource;
    };

export type HistoricDistrictLookupResult =
  | {
      status: "ok";
      intersects: boolean;
      districts: HistoricDistrictHit[];
      overlapAreaSqFt: number | null;
      overlapPercent: number | null;
      message: string;
      source: HistoricSource;
    }
  | {
      status: "not_evaluated";
      message: string;
      source: HistoricSource;
    };

export type HistoricSiteLookupResult =
  | {
      status: "ok";
      intersects: boolean;
      sites: HistoricSiteHit[];
      overlapAreaSqFt: number | null;
      overlapPercent: number | null;
      message: string;
      source: HistoricSource;
    }
  | {
      status: "not_evaluated";
      message: string;
      source: HistoricSource;
    };

export type HistoricScreeningStatus =
  | "NO_HISTORIC_DESIGNATION_IDENTIFIED"
  | "HISTORIC_DISTRICT_REVIEW"
  | "INDIVIDUAL_HISTORIC_DESIGNATION_REVIEW"
  | "MULTIPLE_HISTORIC_REVIEW"
  | "HISTORIC_STATUS_NOT_EVALUATED";

export type HistoricDesignationResult = {
  overallStatus: HistoricScreeningStatus;
  overallStatusLabel: string;
  parcelId: string;
  message: string;
  partialEvidence: boolean;
  unevaluatedLayers: string[];
  districts: HistoricDistrictLookupResult;
  sites: HistoricSiteLookupResult;
  limitations: string[];
};
