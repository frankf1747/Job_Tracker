/**
 * Turning free-text location strings into map-plottable places.
 *
 * The coordinate table is hardcoded, so any city not listed here resolves to a
 * `city` with no lat/lng and is rendered in the table but omitted from the map.
 * Keeping the raw string in the database (rather than the normalized result)
 * means this table can grow without a migration.
 */

import { canonicalPlace } from './places';
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

  // Added after an audit of the tracker's own rows: 55 of 108 applications
  // named a real city that was not in this table and so vanished from the map.
  // The pharma and biotech corridors were missing entirely, which is most of
  // where this search actually goes.
  'North Chicago, IL': [42.32, -87.84],
  'South San Francisco, CA': [37.65, -122.41],
  'Upper Gwynedd, PA': [40.21, -75.26],
  'Swiftwater, PA': [41.08, -75.3],
  'Raritan, NJ': [40.57, -74.63],
  'Bridgewater, NJ': [40.59, -74.61],
  'Raynham, MA': [41.95, -71.06],
  'Tarrytown, NY': [41.08, -73.86],
  'Framingham, MA': [42.28, -71.42],
  'Morristown, NJ': [40.8, -74.48],
  'Hampton, NJ': [40.7, -74.95],
  'Melville, NY': [40.79, -73.41],
  'Webster, NY': [43.21, -77.43],
  'Vacaville, CA': [38.36, -121.99],

  // Cities in the tracker that any table would be expected to have.
  'Cambridge, MA': [42.37, -71.11],
  'Bellevue, WA': [47.61, -122.2],
  'Columbus, OH': [39.96, -83.0],
  'Beaverton, OR': [45.49, -122.8],
  'Centennial, CO': [39.58, -104.88],
  'Broomfield, CO': [39.92, -105.09],
  'Ventura, CA': [34.27, -119.29],
  'San Ramon, CA': [37.78, -121.98],
  'Alameda, CA': [37.77, -122.24],
  'Carlsbad, CA': [33.16, -117.35],
  'Newport Beach, CA': [33.62, -117.93],
  'Long Beach, CA': [33.77, -118.19],
  'Huntington Beach, CA': [33.66, -118.0],
  'Fremont, CA': [37.55, -121.99],
  'Menlo Park, CA': [37.45, -122.18],
  'Sacramento, CA': [38.58, -121.49],
  'Greenwich, CT': [41.03, -73.63],
  'Portsmouth, NH': [43.07, -70.76],
  'Trenton, NJ': [40.22, -74.74],
  'Raleigh, NC': [35.78, -78.64],
  'Palm Beach Gardens, FL': [26.82, -80.14],
  'Brookhaven, GA': [33.86, -84.34],
  'Detroit, MI': [42.33, -83.05],
  'Markham, ON': [43.86, -79.34, 'CA'],
  'Vaughan, ON': [43.84, -79.5, 'CA'],

  // Metros not yet applied to, so the next paste lands on the map rather than
  // waiting for another audit.
  'Houston, TX': [29.76, -95.37],
  'San Antonio, TX': [29.42, -98.49],
  'Fort Worth, TX': [32.76, -97.33],
  'Pasadena, CA': [34.15, -118.14],
  'Santa Clara, CA': [37.35, -121.96],
  'Sunnyvale, CA': [37.37, -122.04],
  'San Mateo, CA': [37.56, -122.32],
  'Irvine, CA': [33.68, -117.83],
  'Charlotte, NC': [35.23, -80.84],
  'Pittsburgh, PA': [40.44, -79.996],
  'Princeton, NJ': [40.35, -74.66],
  'Newark, NJ': [40.74, -74.17],
  'Jersey City, NJ': [40.73, -74.06],
  'Wilmington, DE': [39.74, -75.55],
  'Baltimore, MD': [39.29, -76.61],
  'Richmond, VA': [37.54, -77.44],
  'Indianapolis, IN': [39.77, -86.16],
  'Cincinnati, OH': [39.1, -84.51],
  'Cleveland, OH': [41.5, -81.69],
  'Milwaukee, WI': [43.04, -87.91],
  'Madison, WI': [43.07, -89.4],
  'St. Louis, MO': [38.63, -90.2],
  'Kansas City, MO': [39.1, -94.58],
  'Omaha, NE': [41.26, -95.93],
  'Tampa, FL': [27.95, -82.46],
  'Orlando, FL': [28.54, -81.38],
  'Jacksonville, FL': [30.33, -81.66],
  'Memphis, TN': [35.15, -90.05],
  'Louisville, KY': [38.25, -85.76],
  'Birmingham, AL': [33.52, -86.8],
  'New Orleans, LA': [29.95, -90.07],
  'Oklahoma City, OK': [35.47, -97.52],
  'Tucson, AZ': [32.22, -110.97],
  'Albuquerque, NM': [35.08, -106.65],
  'Las Vegas, NV': [36.17, -115.14],
  'Reno, NV': [39.53, -119.81],
  'Boise, ID': [43.62, -116.2],
  'Spokane, WA': [47.66, -117.43],
  'Eugene, OR': [44.05, -123.09],
  'Buffalo, NY': [42.89, -78.88],
  'Rochester, NY': [43.16, -77.61],
  'Albany, NY': [42.65, -73.76],
  'Hartford, CT': [41.76, -72.69],
  'Providence, RI': [41.82, -71.41],
  'Allentown, PA': [40.6, -75.47],
  'Harrisburg, PA': [40.27, -76.88],
  'Norfolk, VA': [36.85, -76.29],
  'Greensboro, NC': [36.07, -79.79],
  'Charleston, SC': [32.78, -79.93],
  'Honolulu, HI': [21.31, -157.86],
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

  // Shorthand people actually type. Checked first because "sf" and "nyc" are
  // not places any grammar would recognise.
  const bare = BARE_CITY[low];
  if (bare) {
    if (bare === 'Remote') return { type: 'remote', display: 'Remote' };
    return place(bare);
  }

  // Everything else goes through the same rules the posting parser uses, so a
  // value typed by hand, pasted from a posting, or written by an older version
  // of the parser all resolve identically. This is what makes "Boston,
  // Massachusetts, 02199-7" and "South San Francisco, California" plottable
  // without touching what is stored.
  const canonical = canonicalPlace(s);
  if (canonical) return place(canonical);

  // A place this table does not know — a foreign city, or a string the old
  // parser wrote. Displayable so nothing disappears from the table, but with no
  // coordinates it is never plotted.
  return { type: 'city', display: titleCase(s) };
}

/** A canonical "City, ST" turned into a location, with coordinates if known. */
function place(key: string): NormalizedLocation {
  const st = key.slice(-2).toUpperCase();
  const co = CITY_COORDS[key];
  const country = co && co[2] ? co[2] : CA_PROV.indexOf(st) >= 0 ? 'CA' : 'US';
  return co
    ? { type: 'city', display: key, key, lat: co[0], lng: co[1], country }
    : { type: 'city', display: key, key, country };
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
