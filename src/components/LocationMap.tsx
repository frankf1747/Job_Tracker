import { useEffect, useMemo, useRef, useState } from 'react';
import { geoConicConformal, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import naGeo from '../assets/north-america-110m.json';
import type { CityAggregate } from '../lib/locations';
import { SANS, bareButton } from './styles';

export type MapScope = 'all' | 'us' | 'ca';

const COUNTRY_IDS: Record<MapScope, string[]> = {
  all: ['840', '124'],
  us: ['840'],
  ca: ['124'],
};

const MAP_HEIGHT = 230;

const FEATURES = (naGeo as FeatureCollection<Geometry>).features;

/** Track the rendered width so the projection can be fitted to it. */
function useElementWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.max(240, entry.contentRect.width || 300));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width] as const;
}

function ScopeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        border: 'none',
        background: active ? '#fbfaf7' : 'transparent',
        color: active ? '#2c3640' : '#8b939e',
        fontSize: 10,
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: 4,
        fontFamily: SANS,
      }}
    >
      {label}
    </button>
  );
}

export function LocationMap({
  cities,
  scope,
  onScope,
  selectedLocations,
  onPick,
  picked,
  onClearPick,
  caption,
}: {
  cities: CityAggregate[];
  scope: MapScope;
  onScope: (s: MapScope) => void;
  selectedLocations: string[];
  onPick: (city: CityAggregate) => void;
  picked: { key: string; count: number } | null;
  onClearPick: () => void;
  caption: string;
}) {
  const [ref, width] = useElementWidth();

  const { outlines, pins } = useMemo(() => {
    const ids = COUNTRY_IDS[scope];
    const feats = FEATURES.filter((f) => ids.indexOf(String(f.id)) >= 0);
    const agg =
      scope === 'all' ? cities : cities.filter((c) => c.country === (scope === 'us' ? 'US' : 'CA'));

    const proj = geoConicConformal().rotate([96, 0]).parallels([33, 55]);

    // Frame the pins when there are enough to define an extent; otherwise frame
    // the country outlines, so a single city doesn't zoom to street level.
    const fitTo: FeatureCollection<Geometry> =
      agg.length >= 2
        ? {
            type: 'FeatureCollection',
            features: agg.map((a) => ({
              type: 'Feature',
              properties: {},
              geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
            })) as Feature<Geometry>[],
          }
        : { type: 'FeatureCollection', features: feats };

    try {
      proj.fitExtent(
        [
          [26, 22],
          [width - 26, MAP_HEIGHT - 22],
        ],
        fitTo,
      );
    } catch {
      proj.fitSize([width, MAP_HEIGHT], { type: 'FeatureCollection', features: feats });
    }
    if (agg.length < 2 && proj.scale() > 1600) proj.scale(1600);

    const path = geoPath(proj);
    const maxC = Math.max(1, ...agg.map((a) => a.count));

    return {
      outlines: feats.map((f) => ({ id: String(f.id), d: path(f) || '' })),
      pins: agg.flatMap((a) => {
        const p = proj([a.lng, a.lat]);
        if (!p) return [];
        const active = !selectedLocations.length || selectedLocations.indexOf(a.key) >= 0;
        return [
          {
            city: a,
            cx: p[0],
            cy: p[1],
            // Area-proportional, so a city with 4x the applications reads as 4x.
            r: 4 + Math.sqrt(a.count / maxC) * 13,
            active,
          },
        ];
      }),
    };
  }, [cities, scope, width, selectedLocations]);

  return (
    <div
      style={{
        borderTop: '1px solid #d8d1c2',
        padding: '18px 4px 0',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <span style={{ fontFamily: SANS, fontSize: 11, color: '#8b939e', letterSpacing: '.05em' }}>
          BY LOCATION
        </span>
        <div style={{ display: 'flex', background: '#e9e4d8', borderRadius: 5, padding: 2 }}>
          <ScopeButton label="ALL" active={scope === 'all'} onClick={() => onScope('all')} />
          <ScopeButton label="US" active={scope === 'us'} onClick={() => onScope('us')} />
          <ScopeButton label="CA" active={scope === 'ca'} onClick={() => onScope('ca')} />
        </div>
      </div>

      <div
        ref={ref}
        style={{
          flex: 1,
          minHeight: 210,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${MAP_HEIGHT}`}
          width="100%"
          height={MAP_HEIGHT}
          style={{ display: 'block', overflow: 'hidden' }}
        >
          {outlines.map((o) => (
            <path key={o.id} d={o.d} fill="#e2dccd" stroke="#cfc8b9" strokeWidth="0.6" />
          ))}
          {pins.map((p) => (
            <g key={p.city.key} onClick={() => onPick(p.city)} style={{ cursor: 'pointer' }}>
              <title>
                {p.city.key} · {p.city.count} apps
              </title>
              <circle
                cx={p.cx}
                cy={p.cy}
                r={p.r}
                fill="#41678a"
                fillOpacity={p.active ? 0.2 : 0.05}
                stroke="#41678a"
                strokeOpacity={p.active ? 0.85 : 0.22}
                strokeWidth="1.2"
              />
              <circle
                cx={p.cx}
                cy={p.cy}
                r="2.1"
                fill="#41678a"
                fillOpacity={p.active ? 1 : 0.28}
              />
            </g>
          ))}
        </svg>
      </div>

      {picked && (
        <button
          onClick={onClearPick}
          title="Clear"
          style={{
            ...bareButton,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginTop: 8,
            padding: '8px 11px',
            background: '#eef2f6',
            border: '1px solid #d3dee7',
            borderRadius: 7,
          }}
        >
          <span
            style={{
              fontFamily: "'Source Serif 4', 'Noto Serif JP', Georgia, serif",
              fontSize: 13.5,
              color: '#2c3640',
            }}
          >
            {picked.key} · {picked.count} application{picked.count === 1 ? '' : 's'}
          </span>
          <span style={{ fontSize: 11, color: '#9aa3ad' }}>✕</span>
        </button>
      )}

      <div
        style={{
          fontFamily: SANS,
          fontSize: 10,
          color: '#9aa3ad',
          marginTop: 8,
          lineHeight: 1.5,
        }}
      >
        {caption}
      </div>
    </div>
  );
}
