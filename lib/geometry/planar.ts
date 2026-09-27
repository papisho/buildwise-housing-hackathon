import polygonClipping, { type Geom, type Pair } from "polygon-clipping";

type Ring = Pair[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

function xyRing(ring: number[][]): Ring {
  const xy: Ring = ring.map((point) => [point[0], point[1]] as Pair);
  if (xy.length === 0) {
    return xy;
  }
  const first = xy[0];
  const last = xy[xy.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    xy.push([first[0], first[1]]);
  }
  return xy;
}

function signedArea(ring: Ring): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return area / 2;
}

export function esriRingsToMultiPolygon(rings: number[][][]): MultiPolygon {
  const polygons: MultiPolygon = [];
  let current: Polygon | null = null;

  for (const raw of rings) {
    const ring = xyRing(raw);
    if (ring.length < 4) {
      continue;
    }
    // Esri: clockwise (negative signed area) = exterior. GeoJSON/clipping
    // wants the opposite winding, so reverse each ring.
    const esriSigned = signedArea(ring);
    const geoRing = [...ring].reverse();
    if (current === null || esriSigned < 0) {
      current = [geoRing];
      polygons.push(current);
    } else {
      current.push(geoRing);
    }
  }

  return polygons;
}

export function planarAreaSqFt(multiPolygon: MultiPolygon): number {
  let area = 0;
  for (const polygon of multiPolygon) {
    polygon.forEach((ring, index) => {
      const ringArea = Math.abs(signedArea(ring));
      area += index === 0 ? ringArea : -ringArea;
    });
  }
  return Math.max(0, area);
}

export function intersectionAreaSqFt(
  parcelRings: number[][][],
  slopeRings: number[][][],
): number | null {
  const parcel = esriRingsToMultiPolygon(parcelRings);
  const slope = esriRingsToMultiPolygon(slopeRings);
  if (parcel.length === 0 || slope.length === 0) {
    return 0;
  }

  try {
    const clipped = polygonClipping.intersection(
      parcel as Geom,
      slope as Geom,
    );
    return planarAreaSqFt(clipped);
  } catch {
    return null;
  }
}

export function esriPolygonAreaSqFt(rings: number[][][]): number {
  return planarAreaSqFt(esriRingsToMultiPolygon(rings));
}

export function esriRingsCentroid(
  rings: number[][][],
): { x: number; y: number } | null {
  let best: Ring | null = null;
  let bestAbs = 0;
  for (const raw of rings) {
    const ring = xyRing(raw);
    if (ring.length < 4) {
      continue;
    }
    const area = Math.abs(signedArea(ring));
    if (area > bestAbs) {
      bestAbs = area;
      best = ring;
    }
  }
  if (!best) {
    return null;
  }

  let cx = 0;
  let cy = 0;
  let twiceArea = 0;
  for (let i = 0; i < best.length - 1; i += 1) {
    const x0 = best[i][0];
    const y0 = best[i][1];
    const x1 = best[i + 1][0];
    const y1 = best[i + 1][1];
    const cross = x0 * y1 - x1 * y0;
    twiceArea += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (twiceArea === 0) {
    return { x: best[0][0], y: best[0][1] };
  }
  return {
    x: cx / (3 * twiceArea),
    y: cy / (3 * twiceArea),
  };
}

export function planarDistanceFeet(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
