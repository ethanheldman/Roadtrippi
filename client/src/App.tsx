import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";

// T1.2: lazy-load everything except the two most likely entry points (Home + auth).
// Biggest wins here are Map (pulls in Leaflet + markercluster) and Profile (drag-reorder UI).
// Before this, a single 523 KB JS bundle shipped to every visitor even if they
// never opened the map.
const AttractionDetail = lazy(() =>
  import("./pages/AttractionDetail").then((m) => ({ default: m.AttractionDetail }))
);
const Profile = lazy(() =>
  import("./pages/Profile").then((m) => ({ default: m.Profile }))
);
const UserProfile = lazy(() =>
  import("./pages/UserProfile").then((m) => ({ default: m.UserProfile }))
);
const UserTab = lazy(() =>
  import("./pages/UserTab").then((m) => ({ default: m.UserTab }))
);
const PeopleList = lazy(() =>
  import("./pages/PeopleList").then((m) => ({ default: m.PeopleList }))
);
const DiscoverPeople = lazy(() =>
  import("./pages/DiscoverPeople").then((m) => ({ default: m.DiscoverPeople }))
);
const MyLists = lazy(() =>
  import("./pages/MyLists").then((m) => ({ default: m.MyLists }))
);
const ListDetail = lazy(() =>
  import("./pages/ListDetail").then((m) => ({ default: m.ListDetail }))
);
const MapPage = lazy(() =>
  import("./pages/Map").then((m) => ({ default: m.Map }))
);
const BestOfState = lazy(() =>
  import("./pages/BestOfState").then((m) => ({ default: m.BestOfState }))
);
const Game = lazy(() =>
  import("./pages/Game").then((m) => ({ default: m.Game }))
);

/** Minimal fallback — matches the app's dark card style to avoid flash. */
function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-lbx-muted">
      <span className="text-sm">Loading…</span>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/game" element={<Game />} />
              <Route path="/best-roadside-attractions/:state" element={<BestOfState />} />
              <Route path="/attraction/:id" element={<AttractionDetail />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/:tab" element={<PeopleList />} />
              <Route path="/user/:id" element={<UserProfile />} />
              <Route path="/user/:id/following" element={<UserTab />} />
              <Route path="/user/:id/followers" element={<UserTab />} />
              <Route path="/user/:id/lists" element={<UserTab />} />
              <Route path="/people" element={<DiscoverPeople />} />
              <Route path="/lists" element={<MyLists />} />
              <Route path="/lists/:id" element={<ListDetail />} />
              <Route path="/inbox" element={<Navigate to="/profile/friends" replace />} />
              <Route path="/profile/activity" element={<Navigate to="/profile/friends" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
