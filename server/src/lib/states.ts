/**
 * US state helpers. The database has both 2-letter codes and full names mixed
 * into the `state` column (historical import issue), so queries need to match
 * either form. Until the column is normalized with a migration, keep the two-
 * value match logic in one place.
 *
 * Also provides a per-state bounding box table used as a coord-sanity guard:
 * if a row's lat/lng falls outside the state's bbox, it's almost certainly a
 * geocoder misfire (e.g. "San Juan Batista, CA" geocoded to Puerto Rico) and
 * should not be returned from state-filtered map queries.
 */

export const STATE_NAME_TO_CODE: Record<string, string> = {
  maine: "ME", alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maryland: "MD", massachusetts: "MA", michigan: "MI",
  minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE",
  nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

export const STATE_CODE_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_NAME_TO_CODE).map(([name, code]) => [
    code,
    name.replace(/(^|\s)\S/g, (s) => s.toUpperCase()),
  ])
);

/** Normalize a user-supplied state param to a 2-letter uppercase code, or undefined. */
export function normalizeStateCode(state: string | undefined | null): string | undefined {
  if (!state || !state.trim()) return undefined;
  const s = state.trim();
  if (s.length === 2) return s.toUpperCase();
  const code = STATE_NAME_TO_CODE[s.toLowerCase()];
  return code ?? (s.length >= 2 ? s.slice(0, 2).toUpperCase() : undefined);
}

/**
 * Prisma `where` fragment matching both "CA" and "California" for a state code.
 * Replaces the previously duplicated if/else-if chain scattered across handlers.
 */
export function stateFilter(code: string): { in: string[] } | string {
  const fullName = STATE_CODE_TO_NAME[code];
  return fullName ? { in: [code, fullName] } : code;
}

/**
 * Rough per-state bounding box: [southLat, westLng, northLat, eastLng].
 * Used server-side to drop geocoder-misfire pins (the map view only).
 * Wider than strict state polygons on purpose — real attractions near borders
 * shouldn't be filtered, but something on another continent absolutely will be.
 */
export const STATE_BBOX: Record<string, [number, number, number, number]> = {
  AL: [30.14, -88.47, 35.00, -84.89],
  AK: [51.21, -179.15, 71.44, -129.98],
  AZ: [31.33, -114.82, 37.00, -109.05],
  AR: [33.00, -94.62, 36.50, -89.64],
  CA: [32.53, -124.48, 42.01, -114.13],
  CO: [36.99, -109.06, 41.00, -102.04],
  CT: [40.98, -73.73, 42.05, -71.79],
  DE: [38.45, -75.79, 39.84, -75.05],
  FL: [24.52, -87.63, 31.00, -80.03],
  GA: [30.36, -85.61, 35.00, -80.84],
  HI: [18.91, -160.25, 22.24, -154.81],
  ID: [41.99, -117.24, 49.00, -111.04],
  IL: [36.97, -91.51, 42.51, -87.02],
  IN: [37.77, -88.10, 41.76, -84.78],
  IA: [40.38, -96.64, 43.50, -90.14],
  KS: [36.99, -102.05, 40.00, -94.59],
  KY: [36.50, -89.57, 39.15, -81.96],
  LA: [28.93, -94.04, 33.02, -88.82],
  ME: [42.98, -71.08, 47.46, -66.95],
  MD: [37.89, -79.49, 39.72, -75.05],
  MA: [41.24, -73.50, 42.89, -69.93],
  MI: [41.70, -90.42, 48.30, -82.12],
  MN: [43.50, -97.24, 49.38, -89.49],
  MS: [30.17, -91.66, 35.00, -88.10],
  MO: [35.99, -95.77, 40.61, -89.10],
  MT: [44.36, -116.05, 49.00, -104.04],
  NE: [39.99, -104.05, 43.00, -95.31],
  NV: [35.00, -120.01, 42.00, -114.04],
  NH: [42.70, -72.56, 45.31, -70.61],
  NJ: [38.93, -75.56, 41.36, -73.90],
  NM: [31.33, -109.05, 37.00, -103.00],
  NY: [40.50, -79.76, 45.02, -71.86],
  NC: [33.75, -84.32, 36.59, -75.40],
  ND: [45.94, -104.05, 49.00, -96.55],
  OH: [38.40, -84.82, 42.00, -80.52],
  OK: [33.62, -103.00, 37.00, -94.43],
  OR: [41.99, -124.57, 46.30, -116.46],
  PA: [39.72, -80.52, 42.52, -74.69],
  RI: [41.15, -71.86, 42.02, -71.12],
  SC: [32.03, -83.35, 35.22, -78.54],
  SD: [42.48, -104.06, 45.95, -96.44],
  TN: [34.98, -90.31, 36.68, -81.65],
  TX: [25.84, -106.65, 36.50, -93.51],
  UT: [36.99, -114.05, 42.00, -109.04],
  VT: [42.73, -73.43, 45.02, -71.46],
  VA: [36.54, -83.68, 39.47, -75.24],
  WA: [45.54, -124.77, 49.00, -116.92],
  WV: [37.20, -82.64, 40.64, -77.72],
  WI: [42.49, -92.89, 47.08, -86.25],
  WY: [40.99, -111.06, 45.01, -104.05],
};
