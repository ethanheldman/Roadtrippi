import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import { attractions, checkIns, type MapAttraction } from "../api";
import { useAuth } from "../context/AuthContext";
import { useLocationCoords } from "../context/LocationContext";
import { AttractionImage } from "../components/AttractionImage";
import { SaveToWantToSee } from "../components/SaveToWantToSee";
import { STATE_BOUNDS, US_BOUNDS } from "../constants/stateBounds";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

const STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

const MARKER_ICON_URL = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const MARKER_ICON_2X_URL = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const MARKER_SHADOW_URL = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

// Default blue pin
const icon = L.icon({
  iconUrl: MARKER_ICON_URL,
  iconRetinaUrl: MARKER_ICON_2X_URL,
  shadowUrl: MARKER_SHADOW_URL,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Visited green pin
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

type PopupState = {
  attractionId: string;
  /** Container DIV we rendered into Leaflet's popup DOM — a React portal target. */
  container: HTMLDivElement;
};

/**
 * Clustered marker layer. Adds one L.markerClusterGroup to the map, syncs it
 * with the items prop, and renders each popup's React content via a portal
 * so it keeps all client-side routing (Link) and auth context intact.
 *
 * This replaces the "one <Marker> per pin" approach which rendered 1548 DOM
 * nodes for California and dragged the page hard.
 */
function ClusteredMarkers({
  items,
  visitedIds,
  user,
  onPopupOpen,
  onPopupClose,
  markerRefs,
}: {
  items: MapAttraction[];
  visitedIds: Set<string>;
  user: unknown;
  onPopupOpen: (state: PopupState) => void;
  onPopupClose: () => void;
  markerRefs: React.MutableRefObject<Record<string, L.Marker | null>>;
}) {
  const map = useMap();
  // We keep a single cluster group for the lifetime of the map.
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    const group = L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 60,
    });
    map.addLayer(group);
    clusterRef.current = group;
    return () => {
      map.removeLayer(group);
      clusterRef.current = null;
    };
  }, [map]);

  // Re-populate the cluster group whenever the item set changes.
  useEffect(() => {
    const group = clusterRef.current;
    if (!group) return;
    group.clearLayers();
    markerRefs.current = {};

    const markers: L.Marker[] = items.map((a) => {
      const m = L.marker([a.latitude, a.longitude], {
        icon: visitedIds.has(a.id) ? visitedIcon : icon,
      });
      markerRefs.current[a.id] = m;

      // Empty container Leaflet will mount into a popup; React will portal
      // into it when the popup opens. We attach handlers via L for open/close
      // so we only render React content on demand (not for all N markers).
      m.on("popupopen", () => {
        const container = document.createElement("div");
        container.className = "rt-popup-root";
        m.setPopupContent(container);
        onPopupOpen({ attractionId: a.id, container });
      });
      m.on("popupclose", () => {
        onPopupClose();
      });
      // Bind a placeholder popup so click actually opens one; real content is
      // injected in popupopen above.
      m.bindPopup("", { minWidth: 200 });

      return m;
    });
    group.addLayers(markers);

    return () => {
      group.clearLayers();
      markerRefs.current = {};
    };
  // `user` changing alone doesn't need to rebuild the group, but visitedIds does.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, visitedIds]);

  // Suppress unused `user` param linting; it's part of the API for callers.
  void user;
  return null;
}

/** Fit the visible map to the given bounds when they change. */
function FitBoundsTo({ bounds }: { bounds: [number, number, number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    const [s, w, n, e] = bounds;
    map.fitBounds([[s, w], [n, e]] as L.LatLngBoundsExpression, { padding: [40, 40], maxZoom: 10 });
  }, [map, bounds]);
  return null;
}

function FlyToLocation({ userCoords }: { userCoords: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!userCoords) return;
    map.flyTo([userCoords.lat, userCoords.lng], 10, { duration: 0.8 });
  }, [map, userCoords]);
  return null;
}

function FlyToAttraction({
  focusAttractionId,
  items,
  markerRefs,
}: {
  focusAttractionId: string | null;
  items: MapAttraction[];
  markerRefs: React.MutableRefObject<Record<string, L.Marker | null>>;
}) {
  const map = useMap();
  useEffect(() => {
    if (!focusAttractionId || items.length === 0) return;
    const item = items.find((a) => a.id === focusAttractionId);
    if (!item) return;
    map.flyTo([item.latitude, item.longitude], 14, { duration: 0.6 });
    const t = setTimeout(() => {
      const marker = markerRefs.current[focusAttractionId];
      if (marker) marker.openPopup();
    }, 500);
    return () => clearTimeout(t);
  }, [map, focusAttractionId, items, markerRefs]);
  return null;
}

export function Map() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const stateFromUrl = searchParams.get("state");
  const focusAttractionId = searchParams.get("attraction");
  const [state, setState] = useState<string>(() => stateFromUrl ?? "");
  const [items, setItems] = useState<MapAttraction[]>([]);
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOnlyVisited, setShowOnlyVisited] = useState(false);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const markerRefs = useRef<Record<string, L.Marker | null>>({});
  const {
    coords: userCoords,
    error: locationError,
    status: locationStatus,
    request: requestCoords,
  } = useLocationCoords();
  const locating = locationStatus === "requesting";

  useEffect(() => {
    if (stateFromUrl && STATES.includes(stateFromUrl)) setState(stateFromUrl);
  }, [stateFromUrl]);

  useEffect(() => {
    if (!state) {
      setItems([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    attractions
      .mapMarkers(state)
      .then((res) => setItems(res.items))
      .catch(() => setError("Failed to load map data."))
      .finally(() => setLoading(false));
  }, [state]);

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

  const filteredItems = useMemo(
    () => (showOnlyVisited ? items.filter((a) => visitedIds.has(a.id)) : items),
    [items, visitedIds, showOnlyVisited]
  );

  // T1.4: always render the map with a sensible default. No state → show continental US.
  //        Picking a state → fly to that state's bounding box immediately (not waiting for markers).
  const initialBounds = state && STATE_BOUNDS[state] ? STATE_BOUNDS[state] : US_BOUNDS;
  const fitBounds = state && STATE_BOUNDS[state] ? STATE_BOUNDS[state] : null;

  const popupAttraction = popup ? items.find((a) => a.id === popup.attractionId) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-display font-bold text-2xl text-lbx-white">
          Roadside Attractions Map
        </h1>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-lbx-muted/90 uppercase tracking-widest">State</span>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="pl-2 pr-8 py-2 rounded-md border border-lbx-border bg-lbx-card text-lbx-white focus:border-lbx-green focus:outline-none focus:ring-1 focus:ring-lbx-green text-sm min-w-[88px] appearance-none cursor-pointer"
              aria-label="Choose state for map"
            >
              <option value="">All states</option>
              {STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={requestCoords}
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
          {state && user && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setShowOnlyVisited((prev) => !prev);
              }}
              className={`text-sm flex items-center gap-1.5 transition-colors cursor-pointer ${
                showOnlyVisited ? "text-lbx-white" : "text-lbx-muted hover:text-lbx-white"
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-3 h-3 rounded-full border shadow-sm transition-colors ${
                  showOnlyVisited ? "bg-lbx-green border-white/80" : "bg-transparent border-lbx-muted"
                }`}
                aria-hidden
              >
                {showOnlyVisited && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </span>
              Visited
            </button>
          )}
          {state && !showOnlyVisited && (
            <p className="text-lbx-muted text-sm">
              {items.length} attraction{items.length !== 1 ? "s" : ""} on the map
            </p>
          )}
          {!state && (
            <p className="text-lbx-muted text-sm">
              Choose a state or use your location
            </p>
          )}
        </div>
      </div>
      <div className="rounded-xl overflow-hidden border border-lbx-border bg-lbx-card h-[calc(100vh-12rem)] min-h-[420px]">
        {error ? (
          <div className="h-full flex items-center justify-center p-6 text-lbx-muted text-center">
            {error}
          </div>
        ) : (
          <MapContainer
            bounds={[[initialBounds[0], initialBounds[1]], [initialBounds[2], initialBounds[3]]]}
            className="h-full w-full"
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBoundsTo bounds={fitBounds} />
            <FlyToLocation userCoords={userCoords} />
            <FlyToAttraction
              focusAttractionId={focusAttractionId}
              items={filteredItems}
              markerRefs={markerRefs}
            />
            {!loading && filteredItems.length > 0 && (
              <ClusteredMarkers
                items={filteredItems}
                visitedIds={visitedIds}
                user={user}
                onPopupOpen={setPopup}
                onPopupClose={() => setPopup(null)}
                markerRefs={markerRefs}
              />
            )}
          </MapContainer>
        )}
        {popup && popupAttraction && createPortal(
          <div className="min-w-[200px]">
            <AttractionImage
              imageUrl={popupAttraction.imageUrl}
              className="w-full h-24 object-cover rounded mb-2"
            />
            <p className="font-semibold text-gray-900">{popupAttraction.name}</p>
            {(popupAttraction.city || popupAttraction.state) && (
              <p className="text-sm text-gray-600">
                {[popupAttraction.city, popupAttraction.state].filter(Boolean).join(", ")}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {user && (
                <SaveToWantToSee attractionId={popupAttraction.id} className="!px-2 !py-1 !text-xs" />
              )}
              <Link
                to={`/attraction/${popupAttraction.id}`}
                className="text-sm text-green-600 hover:underline"
              >
                View details →
              </Link>
            </div>
          </div>,
          popup.container
        )}
      </div>
    </div>
  );
}
