/**
 * Geocode helpers using OpenStreetMap Nominatim.
 * Respect 1 req/sec: callers should not issue concurrent requests;
 * geocodeAttraction() applies 1.1s delay between its own requests.
 */

import { parseCityStateFromAddress } from "./address.js";

const USER_AGENT = "RoadsideWonders/1.0 (local dev; geocoding for map)";
const GEOCODE_TIMEOUT_MS = 25_000;

function addressForGeocode(address: string | null): string | null {
  if (!address || typeof address !== "string") return null;
  const withoutDirections = address.replace(/Directions:.*$/i, "").trim();
  return withoutDirections.length > 5 ? withoutDirections : null;
}

function cityStateQuery(city: string | null, state: string | null): string | null {
  if (city && state && state !== "US") return `${city}, ${state}, USA`;
  if (state && state !== "US") return `${state}, USA`;
  return null;
}

function cityStateFromAddressPart(addressPart: string | null): string | null {
  if (!addressPart) return null;
  const parsed = parseCityStateFromAddress(addressPart + ",");
  return cityStateQuery(parsed.city, parsed.state);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Single Nominatim request. */
export async function geocodeOneQuery(query: string): Promise<{ lat: number; lon: number } | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as { lat: string; lon: string }[];
    if (!Array.isArray(data) || data.length === 0) return null;
    const first = data[0];
    const lat = parseFloat(first.lat);
    const lon = parseFloat(first.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return { lat, lon };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export type AttractionGeocodeInput = {
  address: string | null;
  city: string | null;
  state: string | null;
};

/**
 * Geocode an attraction by trying address, then city/state fallbacks.
 * Uses 1.1s delay between Nominatim requests (respects usage policy).
 */
export async function geocodeAttraction(
  attraction: AttractionGeocodeInput
): Promise<{ lat: number; lon: number } | null> {
  const parsed = parseCityStateFromAddress(attraction.address);
  const city = attraction.city ?? parsed.city;
  const state =
    attraction.state && attraction.state !== "US" ? attraction.state : parsed.state;
  const addressPart = addressForGeocode(attraction.address);
  const primaryQuery = addressPart ? `${addressPart}, USA` : null;
  const fallbackQuery = cityStateQuery(city, state);
  const addressPartFallback = cityStateFromAddressPart(addressPart);

  const queriesToTry = [primaryQuery, fallbackQuery, addressPartFallback].filter(
    (q): q is string => !!q && q.length > 0
  );
  const uniqueQueries = [...new Set(queriesToTry)];

  if (uniqueQueries.length === 0) return null;

  for (const query of uniqueQueries) {
    const result = await geocodeOneQuery(query);
    if (result) return result;
    await sleep(1100);
  }
  return null;
}
