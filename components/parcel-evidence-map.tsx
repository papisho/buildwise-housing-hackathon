"use client";

import dynamic from "next/dynamic";
import { Component, useState, type ReactNode } from "react";
import { EVIDENCE_LAYER_STYLES } from "@/components/evidence-map-style";
import { StatusBadge } from "@/components/status-badge";
import type {
  EvidenceMapData,
  EvidenceMapLayer,
  EvidenceMapLayerId,
} from "@/lib/map/types";

const UNAVAILABLE_MESSAGE =
  "Map visualization unavailable. Structured evidence remains available below.";

const SCREENING_NOTE =
  "Map visualization is for screening context. Parcel boundaries and mapped evidence are GIS records, not a legal survey or site-specific professional determination.";

// Leaflet touches `window` at module scope, so the canvas loads client-side only.
const EvidenceMapCanvas = dynamic(
  () => import("@/components/evidence-map-canvas"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[20rem] w-full items-center justify-center rounded-lg border border-line bg-paper text-sm text-ink-muted sm:h-[26rem]">
        Loading map…
      </div>
    ),
  },
);

class MapErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function UnavailableNotice() {
  return (
    <p className="mt-3 rounded-lg border border-line bg-paper p-4 text-sm text-ink-muted">
      {UNAVAILABLE_MESSAGE}
    </p>
  );
}

function LegendRow({
  layer,
  checked,
  onToggle,
}: {
  layer: EvidenceMapLayer;
  checked: boolean;
  onToggle: () => void;
}) {
  const style = EVIDENCE_LAYER_STYLES[layer.id];
  const swatch = (
    <span
      aria-hidden
      className="mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded-[3px]"
      style={{
        border: `2px ${style.dashArray ? "dashed" : "solid"} ${style.color}`,
        backgroundColor: style.color,
        opacity: layer.state === "mapped" ? 1 : 0.35,
      }}
    />
  );

  if (layer.state !== "mapped") {
    return (
      <li className="flex items-start gap-2 text-sm">
        {swatch}
        <span className="min-w-0">
          <span className="text-ink-muted">{layer.name}</span>{" "}
          {layer.state === "not_evaluated" ? (
            <StatusBadge tone="review">Not Evaluated</StatusBadge>
          ) : (
            <StatusBadge>No mapped intersection</StatusBadge>
          )}
          {layer.note ? (
            <span className="mt-0.5 block text-xs text-ink-muted">
              {layer.note}
            </span>
          ) : null}
        </span>
      </li>
    );
  }

  return (
    <li className="text-sm">
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          disabled={layer.features.length === 0}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-accent"
        />
        {swatch}
        <span className="min-w-0">
          <span className="font-medium">{layer.name}</span>
          {layer.features.length > 0 ? (
            <span className="mt-0.5 block text-xs text-ink-muted">
              {layer.features.map((feature) => feature.label).join(" · ")}
            </span>
          ) : null}
          {layer.note ? (
            <span className="mt-0.5 block text-xs text-ink-muted">
              {layer.note}
            </span>
          ) : null}
        </span>
      </label>
    </li>
  );
}

export function ParcelEvidenceMap({ data }: { data: EvidenceMapData | null }) {
  const [overrides, setOverrides] = useState<
    Partial<Record<EvidenceMapLayerId, boolean>>
  >({});
  const [resetCount, setResetCount] = useState(0);
  const [tilesFailed, setTilesFailed] = useState(false);

  const isVisible = (layer: EvidenceMapLayer) =>
    layer.features.length > 0 && (overrides[layer.id] ?? layer.defaultVisible);

  const visibleLayerIds = (data?.layers ?? [])
    .filter(isVisible)
    .map((layer) => layer.id);

  return (
    <section className="bw-card mt-6 p-5">
      <h3 className="text-lg font-semibold">Parcel &amp; Evidence Map</h3>
      <p className="mt-1 text-sm text-ink-muted">{SCREENING_NOTE}</p>

      {data === null ? (
        <UnavailableNotice />
      ) : (
        <MapErrorBoundary fallback={<UnavailableNotice />}>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="min-w-0">
              <EvidenceMapCanvas
                data={data}
                visibleLayerIds={visibleLayerIds}
                resetCount={resetCount}
                onTileError={() => setTilesFailed(true)}
              />
              {tilesFailed ? (
                <p className="mt-2 text-xs text-ink-muted">
                  Some OpenStreetMap basemap tiles did not load. Mapped evidence
                  geometry is still drawn.
                </p>
              ) : null}
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-sm font-semibold">Layers</h4>
                <button
                  type="button"
                  onClick={() => setResetCount((count) => count + 1)}
                  className="text-xs font-medium text-accent underline underline-offset-2"
                >
                  Reset to parcel
                </button>
              </div>
              <ul className="mt-2 space-y-2">
                {data.layers.map((layer) => (
                  <LegendRow
                    key={layer.id}
                    layer={layer}
                    checked={isVisible(layer)}
                    onToggle={() =>
                      setOverrides((current) => ({
                        ...current,
                        [layer.id]: !isVisible(layer),
                      }))
                    }
                  />
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Evidence geometry is trimmed to the parcel vicinity for performance,
            so layers may end at the edge of the surrounding context. Base map
            imagery is contextual only and is not a BuildWise evidence source.
          </p>
        </MapErrorBoundary>
      )}
    </section>
  );
}
