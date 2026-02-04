import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { attractions, checkIns, type MapAttraction } from "../api";
import { useAuth } from "../context/AuthContext";
import { SaveToWantToSee } from "../components/SaveToWantToSee";
import "leaflet/dist/leaflet.css";

const MARKER_ICON_URL = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const MARKER_ICON_2X_URL = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const MARKER_SHADOW_URL = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

// Fix default marker icon in bundler (Vite) context — blue pin
const icon = L.icon({
  iconUrl: MARKER_ICON_URL,
  iconRetinaUrl: MARKER_ICON_2X_URL,
  shadowUrl: MARKER_SHADOW_URL,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Green pin — same icon + shadow as blue marker, tinted green (identical shape/size/anchor)
// Shadow anchor (4,62) vs icon anchor (12,41) → shadow offset (8,-21) from icon top-left
const visitedIcon = L.divIcon({
  className: "visited-marker",
  html: `<div class="visited-marker-wrapper" style="width:25px;height:41px;position:relative;overflow:visible;">
    <img src="${MARKER_SHADOW_URL}" alt="" style="position:absolute;left:8px;top:-21px;width:41px;height:41px;z-index:0;pointer-events:none;" />
    <img src="${MARKER_ICON_URL}" width="25" height="41" alt="" class="visited-marker-icon" style="position:relative;z-index:1;display:block;" />
  </div>`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

function FitBounds({ items, enabled }: { items: MapAttraction[]; enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || items.length === 0) return;
    if (items.length === 1) {
      map.setView([items[0].latitude, items[0].longitude], 12);
      return;
    }
    const bounds = L.latLngBounds(items.map((a) => [a.latitude, a.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
  }, [map, items, enabled]);
  return null;
}

/** When userCoords is set, fly the map to that position (geolocation). */
function FlyToLocation({ userCoords }: { userCoords: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!userCoords) return;
    map.flyTo([userCoords.lat, userCoords.lng], 12, { duration: 0.8 });
  }, [map, userCoords]);
  return null;
}

export function Map() {
  const { user } = useAuth();
  const [items, setItems] = useState<MapAttraction[]>([]);
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [showOnlyVisited, setShowOnlyVisited] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    attractions
      .mapMarkers()
      .then((res) => setItems(res.items))
      .catch(() => setError("Failed to load map data."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) {
      setVisitedIds(new Set());
      return;
    }
    checkIns
      .my()
      .then((res) => {
        const ids = new Set<string>();
        const list = (res.items ?? []) as { attraction?: { id: string }; attractionId?: string }[];
        list.forEach((c) => {
          const id = c.attraction?.id ?? c.attractionId;
          if (id) ids.add(id);
        });
        setVisitedIds(ids);
      })
      .catch(() => setVisitedIds(new Set()));
  }, [user]);

  const filteredItems = useMemo(() => {
    return showOnlyVisited ? items.filter((a) => visitedIds.has(a.id)) : items;
  }, [items, visitedIds, showOnlyVisited]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[480px] text-lbx-muted">
        Loading map…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-lbx-border bg-lbx-card p-6 text-center text-lbx-muted">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-lbx-border bg-lbx-card p-8 text-center">
        <p className="text-lbx-muted mb-2">No attractions with coordinates yet.</p>
        <p className="text-sm text-lbx-muted">
          Run the geocode script from the server: <code className="bg-lbx-dark px-1 rounded">npm run geocode-attractions</code>
        </p>
      </div>
    );
  }

  const handleLocate = () => {
    setLocationError(null);
    setLocating(true);
    if (!navigator.geolocation) {
      setLocationError("Location not supported");
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocationError("Location denied or unavailable");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-display font-bold text-2xl text-lbx-white">
          Roadside Attractions Map
        </h1>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            type="button"
            onClick={handleLocate}
            disabled={locating}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-lbx-border bg-lbx-card text-lbx-text hover:border-lbx-green hover:text-lbx-white transition-colors disabled:opacity-50 text-sm font-medium"
            title="Center map on my location"
          >
            {locating ? (
              "Locating…"
            ) : (
              <>
                <span aria-hidden>📍</span>
                My location
              </>
            )}
          </button>
          {locationError && (
            <p className="text-amber-400/90 text-sm" role="alert">
              {locationError}
            </p>
          )}
          {user && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setShowOnlyVisited((prev) => !prev);
              }}
              className={`text-sm flex items-center gap-1.5 transition-colors cursor-pointer ${
                showOnlyVisited
                  ? "text-lbx-white"
                  : "text-lbx-muted hover:text-lbx-white"
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-3 h-3 rounded-full border shadow-sm transition-colors ${
                  showOnlyVisited
                    ? "bg-lbx-green border-white/80"
                    : "bg-transparent border-lbx-muted"
                }`}
                aria-hidden
              >
                {showOnlyVisited && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </span>
              Visited
            </button>
          )}
          {!showOnlyVisited && (
            <p className="text-lbx-muted text-sm">
              {items.length} attraction{items.length !== 1 ? "s" : ""} on the map
            </p>
          )}
        </div>
      </div>
      <div className="rounded-xl overflow-hidden border border-lbx-border bg-lbx-card h-[calc(100vh-12rem)] min-h-[420px]">
        <MapContainer
          center={[39.5, -98.35]}
          zoom={4}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds items={filteredItems} enabled={showOnlyVisited} />
          <FlyToLocation userCoords={userCoords} />
          {filteredItems.map((a) => (
            <Marker
              key={a.id}
              position={[a.latitude, a.longitude]}
              icon={visitedIds.has(a.id) ? visitedIcon : icon}
            >
              <Popup>
                <div className="min-w-[180px]">
                  {a.imageUrl && (
                    <img
                      src={a.imageUrl}
                      alt=""
                      className="w-full h-24 object-cover rounded mb-2"
                    />
                  )}
                  <p className="font-semibold text-gray-900">{a.name}</p>
                  {(a.city || a.state) && (
                    <p className="text-sm text-gray-600">
                      {[a.city, a.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {user && (
                      <SaveToWantToSee attractionId={a.id} className="!px-2 !py-1 !text-xs" />
                    )}
                    <Link
                      to={`/attraction/${a.id}`}
                      className="text-sm text-green-600 hover:underline"
                    >
                      View details →
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
