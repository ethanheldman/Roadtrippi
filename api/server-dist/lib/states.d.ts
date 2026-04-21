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
export declare const STATE_NAME_TO_CODE: Record<string, string>;
export declare const STATE_CODE_TO_NAME: Record<string, string>;
/** Normalize a user-supplied state param to a 2-letter uppercase code, or undefined. */
export declare function normalizeStateCode(state: string | undefined | null): string | undefined;
/**
 * Prisma `where` fragment matching both "CA" and "California" for a state code.
 * Replaces the previously duplicated if/else-if chain scattered across handlers.
 */
export declare function stateFilter(code: string): {
    in: string[];
} | string;
/**
 * Rough per-state bounding box: [southLat, westLng, northLat, eastLng].
 * Used server-side to drop geocoder-misfire pins (the map view only).
 * Wider than strict state polygons on purpose — real attractions near borders
 * shouldn't be filtered, but something on another continent absolutely will be.
 */
export declare const STATE_BBOX: Record<string, [number, number, number, number]>;
