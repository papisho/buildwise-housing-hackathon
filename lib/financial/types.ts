export type FinancialValueProvenance =
  | "PUBLIC_DATA"
  | "USER_ASSUMPTION"
  | "CALCULATED_FROM_USER_ASSUMPTIONS";

export type FinancialContextStatus =
  | "FINANCIAL_CONTEXT_NOT_ASSESSED"
  | "PUBLIC_MARKET_CONTEXT_AVAILABLE"
  | "SCENARIO_CALCULATED"
  | "FINANCIAL_CONTEXT_PARTIAL"
  | "FINANCIAL_CONTEXT_NOT_EVALUATED";

export type FinancialSource = {
  name: string;
  datasetUrl: string;
  queryUrl: string;
  resourceId: string | null;
  sourceLastModified: string | null;
  retrievedAt: string;
};

export type NearbySaleCandidate = {
  parid: string;
  address: string | null;
  saleDate: string | null;
  price: number;
  saleCode: string;
  saleDescription: string;
  instrumentDescription: string | null;
  distanceFeet: number;
  useDescription: string | null;
  classDescription: string | null;
  lotAreaSqFt: number | null;
  yearBuilt: number | null;
  provenance: "PUBLIC_DATA";
};

export type NearbySalesLookupResult =
  | {
      status: "ok";
      records: NearbySaleCandidate[];
      searchRadiusFeet: number;
      neighborParcelCount: number;
      validatedFilter: string;
      source: FinancialSource;
    }
  | {
      status: "not_evaluated";
      message: string;
      source: FinancialSource;
    };

export type HudBedroomRents = {
  efficiency: number | null;
  oneBedroom: number | null;
  twoBedroom: number | null;
  threeBedroom: number | null;
  fourBedroom: number | null;
};

export type HudRentLookupResult =
  | {
      status: "ok";
      year: string;
      geographyType: "ZIP_SAFMR" | "MSA_FMR";
      zip: string | null;
      areaName: string | null;
      entityId: string;
      rents: HudBedroomRents;
      provenance: "PUBLIC_DATA";
      source: FinancialSource;
    }
  | {
      status: "not_evaluated";
      message: string;
      source: FinancialSource;
    };

export type DevelopmentScenarioInputs = {
  acquisitionPrice: number;
  units: number;
  monthlyRentPerUnit: number;
  hardConstructionCost: number;
  softCosts: number;
  contingency: number;
  otherCosts: number;
};

export type DevelopmentScenarioResult = {
  inputs: DevelopmentScenarioInputs;
  acquisitionCost: number;
  totalHardCost: number;
  totalSoftCost: number;
  contingency: number;
  otherCosts: number;
  estimatedTotalProjectCost: number;
  annualGrossScheduledRent: number;
  projectCostPerUnit: number | null;
  annualGrossRentToCostRatio: number | null;
};

export type FinancialContextResult = {
  overallStatus: FinancialContextStatus;
  overallStatusLabel: string;
  parcelId: string;
  sales: NearbySalesLookupResult;
  hud: HudRentLookupResult;
  limitations: string[];
};
