import {
  FEMA_REQUEST_TIMEOUT_MS,
  overlapFromRings,
  queryIntersectingFeatures,
  readText,
  readWprdcVintage,
  resolveParcelPolygon,
  ringsFromFeatures,
  type ArcGisFeature,
  type EsriPolygon,
  type HazardSource,
} from "@/lib/hazards/arcgis";

export type FloodProvenance =
  | "fema_nfhl"
  | "wprdc_2014_extract"
  | "living_atlas_secondary";

type FloodEndpoint = {
  provenance: FloodProvenance;
  queryUrl: string;
  datasetUrl: string;
  name: string;
  linkLabel: string;
  timeoutMs: number;
  outFields: string;
  resourceId: string | null;
};

const FEMA_PRIMARY: FloodEndpoint = {
  provenance: "fema_nfhl",
  queryUrl:
    "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query",
  datasetUrl:
    "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28",
  name: "FEMA National Flood Hazard Layer — Flood Hazard Zones (authoritative primary source)",
  linkLabel: "FEMA NFHL (authoritative primary)",
  timeoutMs: 8_000,
  outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE,DFIRM_ID",
  resourceId: null,
};

const WPRDC_CITY_EXTRACT: FloodEndpoint = {
  provenance: "wprdc_2014_extract",
  queryUrl:
    "https://services1.arcgis.com/YZCmUqbcsUpOKfj7/arcgis/rest/services/PGHWebFEMA2014/FeatureServer/0/query",
  datasetUrl: "https://data.wprdc.org/dataset/2014-fema-flood-zones",
  name: "City of Pittsburgh / WPRDC 2014 FEMA Flood Zones (2014-vintage City-published extract of official FEMA data; not current FEMA NFHL)",
  linkLabel: "WPRDC 2014 FEMA Flood Zones (2014 vintage)",
  timeoutMs: FEMA_REQUEST_TIMEOUT_MS,
  outFields: "fld_zone,floodway,sfha_tf,static_bfe",
  resourceId: "122717f9-f08a-4be1-82b9-c213cc069e8c",
};

const LIVING_ATLAS_SECONDARY: FloodEndpoint = {
  provenance: "living_atlas_secondary",
  queryUrl:
    "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Flood_Hazard_Reduced_Set_gdb/FeatureServer/0/query",
  datasetUrl:
    "https://www.arcgis.com/home/item.html?id=2b245b7f816044d7a779a61a5844be23",
  name: "Secondary flood-hazard fallback — Esri Living Atlas USA Flood Hazard Reduced Set. Not direct FEMA NFHL evidence.",
  linkLabel: "Esri Living Atlas reduced flood hazard (secondary fallback)",
  timeoutMs: FEMA_REQUEST_TIMEOUT_MS,
  outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE,DFIRM_ID",
  resourceId: null,
};

const FLOOD_ENDPOINTS: FloodEndpoint[] = [
  FEMA_PRIMARY,
  WPRDC_CITY_EXTRACT,
  LIVING_ATLAS_SECONDARY,
];

export type FloodZone = {
  fldZone: string | null;
  zoneSubtype: string | null;
  sfha: string | null;
};

export type FloodLookupResult =
  | {
      status: "ok";
      intersects: boolean;
      overlapAreaSqFt: number | null;
      overlapPercent: number | null;
      zones: FloodZone[];
      message: string;
      provenance: FloodProvenance;
      source: HazardSource;
    }
  | {
      status: "not_evaluated";
      message: string;
    };

function floodMessage(intersects: boolean): string {
  return intersects
    ? "Mapped FEMA flood hazard intersects this parcel. Floodplain review may be required."
    : "No mapped FEMA flood-hazard intersection detected in the source used.";
}

export function isMappedFloodHazard(zone: FloodZone): boolean {
  const sfha = (zone.sfha ?? "").toUpperCase();
  if (sfha === "T") {
    return true;
  }

  const fldZone = (zone.fldZone ?? "").toUpperCase();
  const subtype = (zone.zoneSubtype ?? "").toUpperCase();

  if (fldZone === "D") {
    return true;
  }
  if (fldZone === "X" && subtype.includes("0.2")) {
    return true;
  }
  if (
    fldZone.length > 0 &&
    fldZone !== "X" &&
    fldZone !== "AREA NOT INCLUDED" &&
    fldZone !== "OPEN WATER"
  ) {
    return true;
  }

  return false;
}

function zoneFromFeature(feature: ArcGisFeature): FloodZone {
  const attributes = feature.attributes ?? {};
  return {
    fldZone: readText(attributes.FLD_ZONE) ?? readText(attributes.fld_zone),
    zoneSubtype:
      readText(attributes.ZONE_SUBTY) ??
      readText(attributes.floodway) ??
      readText(attributes.FLOODWAY),
    sfha: readText(attributes.SFHA_TF) ?? readText(attributes.sfha_tf),
  };
}

function uniqueZones(zones: FloodZone[]): FloodZone[] {
  const seen = new Set<string>();
  const unique: FloodZone[] = [];
  for (const zone of zones) {
    const key = `${zone.fldZone ?? ""}|${zone.zoneSubtype ?? ""}|${zone.sfha ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(zone);
  }
  return unique;
}

async function floodSource(endpoint: FloodEndpoint): Promise<HazardSource> {
  const is2014Extract = endpoint.provenance === "wprdc_2014_extract";
  return {
    name: endpoint.name,
    datasetUrl: endpoint.datasetUrl,
    queryUrl: endpoint.queryUrl,
    resourceId: endpoint.resourceId,
    crs: "EPSG:2272 (NAD83 Pennsylvania State Plane South, US survey feet)",
    mapVintage: is2014Extract ? "2014" : null,
    sourceLastModified: is2014Extract
      ? "2014 extract vintage (not current FEMA NFHL)"
      : endpoint.resourceId
        ? await readWprdcVintage(endpoint.resourceId)
        : null,
    retrievedAt: new Date().toISOString(),
  };
}

async function queryFloodEndpoint(
  endpoint: FloodEndpoint,
  parcel: EsriPolygon,
) {
  return queryIntersectingFeatures({
    queryUrl: endpoint.queryUrl,
    parcel,
    outFields: endpoint.outFields,
    timeoutMs: endpoint.timeoutMs,
    extraParams: { where: "1=1" },
  });
}

export async function findFloodForPin(
  pin: string,
  parcelGeometry?: EsriPolygon,
): Promise<FloodLookupResult> {
  try {
    const parcel = await resolveParcelPolygon(pin, parcelGeometry);
    if (parcel.status === "unavailable") {
      return { status: "not_evaluated", message: "Flood: Not Evaluated" };
    }

    let used: FloodEndpoint | null = null;
    let features: ArcGisFeature[] = [];
    for (const endpoint of FLOOD_ENDPOINTS) {
      const query = await queryFloodEndpoint(endpoint, parcel.geometry);
      if (query.status === "ok") {
        used = endpoint;
        features = query.features;
        break;
      }
    }
    if (!used) {
      return { status: "not_evaluated", message: "Flood: Not Evaluated" };
    }

    const hazardFeatures = features.filter((feature) =>
      isMappedFloodHazard(zoneFromFeature(feature)),
    );
    const zones = uniqueZones(hazardFeatures.map(zoneFromFeature));
    const rings = ringsFromFeatures(hazardFeatures);
    const intersects = rings.length > 0;
    const overlap = overlapFromRings(parcel.geometry.rings, rings);

    return {
      status: "ok",
      intersects,
      overlapAreaSqFt: overlap.overlapAreaSqFt,
      overlapPercent: overlap.overlapPercent,
      zones,
      message: floodMessage(intersects),
      provenance: used.provenance,
      source: await floodSource(used),
    };
  } catch {
    return { status: "not_evaluated", message: "Flood: Not Evaluated" };
  }
}

export function floodSourceLinkLabel(provenance: FloodProvenance): string {
  if (provenance === "fema_nfhl") {
    return FEMA_PRIMARY.linkLabel;
  }
  if (provenance === "wprdc_2014_extract") {
    return WPRDC_CITY_EXTRACT.linkLabel;
  }
  return LIVING_ATLAS_SECONDARY.linkLabel;
}
