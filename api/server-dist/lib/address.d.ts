/**
 * Parse "City, ST" from a US-style address string (e.g. "1 Court Square, Andalusia, ALDirections:...").
 * Returns { city, state } when found, otherwise { city: null, state: null }.
 */
export declare function parseCityStateFromAddress(address: string | null): {
    city: string | null;
    state: string | null;
};
/**
 * Resolve display city/state: use DB values if set, otherwise parse from address.
 */
export declare function resolveCityState(city: string | null, state: string | null, address: string | null): {
    city: string | null;
    state: string | null;
};
