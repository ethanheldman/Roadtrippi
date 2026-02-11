/**
 * Geocode helpers using OpenStreetMap Nominatim.
 * Respect 1 req/sec: callers should not issue concurrent requests;
 * geocodeAttraction() applies 1.1s delay between its own requests.
 */
/** Single Nominatim request. */
export declare function geocodeOneQuery(query: string): Promise<{
    lat: number;
    lon: number;
} | null>;
export type AttractionGeocodeInput = {
    address: string | null;
    city: string | null;
    state: string | null;
    /** Optional attraction name; used as "name, city, state, USA" fallback for landmarks. */
    name?: string | null;
};
/**
 * Geocode an attraction using exact location when possible.
 * Order: address first, then name+city+state (so each attraction gets distinct coords, not city center), then city+state last.
 * Uses 1.1s delay between Nominatim requests (respects usage policy).
 */
export declare function geocodeAttraction(attraction: AttractionGeocodeInput): Promise<{
    lat: number;
    lon: number;
} | null>;
