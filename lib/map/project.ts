import proj4 from "proj4";
import polygonClipping, { type Geom, type Pair } from "polygon-clipping";
import { esriRingsToMultiPolygon } from "@/lib/geometry/planar";
import type { DisplayMultiPolygon } from "@/lib/map/types";

/**
 * NAD83 / Pennsylvania South (ftUS). Same CRS the authoritative overlap
 * calculations run in; this module only converts a copy for display.
 */
const EPSG_2272 =
  "+proj=lcc +lat_1=40.96666666666667 +lat_2=39.93333333333333 " +
  "+lat_0=39.33333333333333 +lon_0=-77.75 +x_0=600000.0000000001 +y_0=0 " +
  "+ellps=GRS80 +datum=NAD83 +to_meter=0.3048006096012192 +no_defs";

proj4.defs("EPSG:2272", EPSG_2272);

const toWgs84 = proj4("EPSG:2272", "EPSG:4326");

/** ~0.1 m at this latitude, well below the precision of the source data. */
const COORDINATE_DECIMALS = 6;

export type PlanarBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function round(value: number): number {
  const factor = 10 ** COORDINATE_DECIMALS;
  return Math.round(value * factor) / factor;
}

export function boundingBox(rings: number[][][]): PlanarBox | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const ring of rings) {
    for (const point of ring) {
      const [x, y] = point;
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null;
  }
  return { minX, minY, maxX, maxY };
}

export function expandBox(box: PlanarBox, feet: number): PlanarBox {
  return {
    minX: box.minX - feet,
    minY: box.minY - feet,
    maxX: box.maxX + feet,
    maxY: box.maxY + feet,
  };
}

/**
 * Trims evidence geometry to the parcel vicinity so a citywide hazard polygon
 * never reaches the browser. Runs in EPSG:2272 on a copy; the scored overlap
 * was already computed from the untrimmed rings.
 */
export function clipRingsToBox(
  rings: number[][][],
  box: PlanarBox,
): number[][][][] {
  const subject = esriRingsToMultiPolygon(rings);
  if (subject.length === 0) {
    return [];
  }

  const window: Pair[][][] = [
    [
      [
        [box.minX, box.minY],
        [box.maxX, box.minY],
        [box.maxX, box.maxY],
        [box.minX, box.maxY],
        [box.minX, box.minY],
      ],
    ],
  ];

  try {
    return polygonClipping.intersection(subject as Geom, window as Geom);
  } catch {
    return [];
  }
}

export function projectMultiPolygonTo4326(
  multiPolygon: number[][][][],
): DisplayMultiPolygon {
  const projected: DisplayMultiPolygon = [];

  for (const polygon of multiPolygon) {
    const rings: number[][][] = [];
    for (const ring of polygon) {
      const vertices: number[][] = [];
      for (const point of ring) {
        const [lon, lat] = toWgs84.forward([point[0], point[1]]);
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
          return [];
        }
        vertices.push([round(lon), round(lat)]);
      }
      if (vertices.length >= 4) {
        rings.push(vertices);
      }
    }
    if (rings.length > 0) {
      projected.push(rings);
    }
  }

  return projected;
}

export function projectBoxTo4326(
  box: PlanarBox,
): [[number, number], [number, number]] | null {
  const southWest = toWgs84.forward([box.minX, box.minY]);
  const northEast = toWgs84.forward([box.maxX, box.maxY]);
  const values = [...southWest, ...northEast];
  if (values.some((value) => !Number.isFinite(value))) {
    return null;
  }
  return [
    [round(southWest[1]), round(southWest[0])],
    [round(northEast[1]), round(northEast[0])],
  ];
}
