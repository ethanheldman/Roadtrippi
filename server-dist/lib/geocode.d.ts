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
};
/**
 * Geocode an attraction by trying address, then city/state fallbacks.
 * Uses 1.1s delay between Nominatim requests (respects usage policy).
 */
export declare function geocodeAttraction(attraction: AttractionGeocodeInput): Promise<{
    lat: number;
    lon: number;
} | null>;
