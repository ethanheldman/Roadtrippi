/**
 * Parse "City, ST" from a US-style address string (e.g. "1 Court Square, Andalusia, ALDirections:...").
 * Returns { city, state } when found, otherwise { city: null, state: null }.
 */
export function parseCityStateFromAddress(address: string | null): {
  city: string | null;
  state: string | null;
} {
  if (!address || typeof address !== "string") return { city: null, state: null };
  const trimmed = address.trim();
  const parts = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 1; i--) {
    const part = parts[i].replace(/Directions.*$/i, "").trim();
    if (/^[A-Z]{2}$/i.test(part)) {
      return {
        city: parts[i - 1] || null,
        state: part.toUpperCase(),
      };
    }
  }
  return { city: null, state: null };
}

/**
 * Resolve display city/state: use DB values if set, otherwise parse from address.
 */
export function resolveCityState(
  city: string | null,
  state: string | null,
  address: string | null
): { city: string | null; state: string | null } {
  const hasCity = city != null && city.trim() !== "";
  const hasState = state != null && state.trim() !== "" && state !== "US";
  if (hasCity && hasState) return { city, state };
  const parsed = parseCityStateFromAddress(address);
  return {
    city: hasCity ? city : parsed.city,
    state: hasState ? state : parsed.state,
  };
}
