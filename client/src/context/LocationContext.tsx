import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Shared geolocation state. Before this, Home and Map each prompted the user
 * separately and kept their own `userCoords` state — so denying on Map wouldn't
 * affect Home's cached coords, and vice versa. This provider gives both pages
 * a single source of truth and a single permission prompt per session.
 */
export type LocationStatus = "idle" | "requesting" | "granted" | "denied" | "unsupported";

type LocationContextValue = {
  coords: { lat: number; lng: number } | null;
  error: string | null;
  status: LocationStatus;
  /** Trigger a geolocation request. No-op if already granted, requesting, or denied. */
  request: () => void;
  /** Clear denied state so a retry button can re-prompt. */
  reset: () => void;
};

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");

  const request = useCallback(() => {
    // Don't re-prompt while one is in flight or already answered.
    if (status === "requesting" || status === "granted" || status === "denied" || status === "unsupported") {
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      setError("Location not supported");
      return;
    }
    setStatus("requesting");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("granted");
      },
      () => {
        setStatus("denied");
        setError("Location denied or unavailable");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [status]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  const value = useMemo<LocationContextValue>(
    () => ({ coords, error, status, request, reset }),
    [coords, error, status, request, reset]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationCoords(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocationCoords must be used within LocationProvider");
  return ctx;
}
