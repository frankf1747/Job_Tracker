/**
 * Turning free-text location strings into map-plottable places.
 *
 * The coordinate table is hardcoded, so any city not listed here resolves to a
 * `city` with no lat/lng and is rendered in the table but omitted from the map.
 * Keeping the raw string in the database (rather than the normalized result)
 * means this table can grow without a migration.
 */

import type { Application, NormalizedLocation } from './schema';
import { isResponse } from './schema';

/** [lat, lng] and, for non-US places, an ISO country code. */
export const CITY_COORDS: Record<string, [number, number] | [number, number, 'CA']> = {
  'San Francisco, CA': [37.77, -122.42],
  'New York, NY': [40.71, -74.01],
  'Seattle, WA': [47.61, -122.33],
  'Austin, TX': [30.27, -97.74],
  'Boston, MA': [42.36, -71.06],
  'Chicago, IL': [41.88, -87.63],
  'Denver, CO': [39.74, -104.99],
  'Atlanta, GA': [33.75, -84.39],
  'Nashville, TN': [36.16, -86.78],
  'Los Angeles, CA': [34.05, -118.24],
  'Mountain View, CA': [37.39, -122.08],
  'San Jose, CA': [37.34, -121.89],
  'Palo Alto, CA': [37.44, -122.14],
  'Portland, OR': [45.52, -122.68],
  'Minneapolis, MN': [44.98, -93.27],
  'Dallas, TX': [32.78, -96.8],
  'Washington, DC': [38.9, -77.04],
  'Durham, NC': [35.99, -78.9],
  'Redwood City, CA': [37.49, -122.24],
  'Irving, TX': [32.81, -96.95],
  'Philadelphia, PA': [39.95, -75.17],
  'San Diego, CA': [32.72, -117.16],
  'Phoenix, AZ': [33.45, -112.07],
  'Salt Lake City, UT': [40.76, -111.89],
  'Miami, FL': [25.76, -80.19],
  'Toronto, ON': [43.65, -79.38, 'CA'],
  'Vancouver, BC': [49.28, -123.12, 'CA'],
  'Montreal, QC': [45.5, -73.57, 'CA'],
  'Ottawa, ON': [45.42, -75.7, 'CA'],
  'Waterloo, ON': [43.46, -80.52, 'CA'],
  'Calgary, AB': [51.05, -114.07, 'CA'],
};

export const CA_PROV = ['ON', 'BC', 'QC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE'];

/** Shorthand people actually type, mapped to canonical keys. */
export const BARE_CITY: Record<string, string> = {
  austin: 'Austin, TX',
  durham: 'Durham, NC',
  sf: 'San Francisco, CA',
  'san francisco': 'San Francisco, CA',
  nyc: 'New York, NY',
  'new york': 'New York, NY',
  seattle: 'Seattle, WA',
  denver: 'Denver, CO',
  chicago: 'Chicago, IL',
  boston: 'Boston, MA',
  toronto: 'Toronto, ON',
  vancouver: 'Vancouver, BC',
  montreal: 'Montreal, QC',
  ottawa: 'Ottawa, ON',
  remote: 'Remote',
};

export function titleCase(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizeLoc(raw: string | null | undefined): NormalizedLocation {
  const s = (raw || '').trim();
  if (!s) return { type: 'unknown', display: '—' };

  const low = s.toLowerCase();
  if (low === 'remote' || low.indexOf('remote') >= 0) return { type: 'remote', display: 'Remote' };

  // "San Francisco, CA" — an explicit city and two-letter state/province.
  const m = s.match(/^([a-zA-Z.\-' ]+),\s*([A-Za-z]{2})$/);
  if (m) {
    const key = titleCase(m[1]) + ', ' + m[2].toUpperCase();
    const st = m[2].toUpperCase();
    const co = CITY_COORDS[key];
    const country = co && co[2] ? co[2] : CA_PROV.indexOf(st) >= 0 ? 'CA' : 'US';
    return co
      ? { type: 'city', display: key, key, lat: co[0], lng: co[1], country }
      : { type: 'city', display: key, key, country };
  }

  // Bare shorthand: "sf", "nyc", "toronto".
  const bare = BARE_CITY[low];
  if (bare) {
    if (bare === 'Remote') return { type: 'remote', display: 'Remote' };
    const co = CITY_COORDS[bare];
    const country = co && co[2] ? co[2] : 'US';
    return { type: 'city', display: bare, key: bare, lat: co?.[0], lng: co?.[1], country };
  }

  // Unrecognised — displayable, but not plottable.
  return { type: 'city', display: titleCase(s) };
}

export type CityAggregate = {
  key: string;
  lat: number;
  lng: number;
  country: 'US' | 'CA';
  count: number;
  resp: number;
};

/** Collapse applications into one entry per plottable city, for the map pins. */
export function cityAgg(rows: Application[]): CityAggregate[] {
  const m: Record<string, CityAggregate> = {};
  for (const r of rows) {
    const l = r.loc;
    if (l && l.type === 'city' && l.lat != null && l.lng != null && l.key) {
      if (!m[l.key]) {
        m[l.key] = {
          key: l.key,
          lat: l.lat,
          lng: l.lng,
          country: l.country || 'US',
          count: 0,
          resp: 0,
        };
      }
      m[l.key].count++;
      if (isResponse(r)) m[l.key].resp++;
    }
  }
  return Object.values(m);
}
