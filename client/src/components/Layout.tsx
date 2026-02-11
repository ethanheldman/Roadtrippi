import { Link, useLocation, useSearchParams } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";

  return (
    <div className="min-h-screen flex flex-col bg-lbx-dark">
      <header className="bg-lbx-card/90 border-b border-lbx-border sticky top-0 z-20 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-4">
          <Link
            to="/"
            className="font-display font-bold text-xl text-lbx-white flex items-center gap-2 tracking-tight shrink-0"
          >
            <img src="/roadtrippi-logo.png" alt="" className="h-10 w-auto" aria-hidden />
            <span>Roadtrippi</span>
          </Link>

          {/* Top search bar — Explore, Map, People, Saved, Activity, Profile so it doesn't disappear when switching tabs */}
          {(loc.pathname === "/" || loc.pathname === "/map" || loc.pathname === "/people" || loc.pathname.startsWith("/lists") || loc.pathname.startsWith("/profile")) && (
            <div className="flex-1 max-w-md hidden sm:block">
              <label htmlFor="header-search" className="sr-only">Search attractions</label>
              <input
                id="header-search"
                type="search"
                placeholder="Search attractions..."
                value={search}
                onChange={(e) => {
                  const next = new URLSearchParams(searchParams);
                  const value = e.target.value;
                  if (value.trim()) {
                    next.set("search", value);
                    next.delete("page");
                  } else {
                    next.delete("search");
                    next.delete("page");
                  }
                  setSearchParams(next, { replace: false });
                  // On Explore, scroll down to the in-page filters so the user sees the "other" search and results
                  if (loc.pathname === "/") {
                    requestAnimationFrame(() => {
                      document.getElementById("all-attractions")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    });
                  }
                }}
                className="w-full px-3 py-1.5 rounded-md bg-lbx-dark border border-lbx-border text-sm text-lbx-white placeholder-lbx-muted focus:outline-none focus:border-lbx-green focus:ring-1 focus:ring-lbx-green/40 transition-colors"
                aria-label="Search attractions"
              />
            </div>
          )}

          <nav className="flex items-center gap-4 sm:gap-6 text-sm font-medium shrink-0">
            <Link
              to="/"
              onClick={(e) => {
                if (loc.pathname === "/") {
                  e.preventDefault();
                  const element = document.getElementById("all-attractions");
                  if (element) {
                    element.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }
              }}
              className={loc.pathname === "/" ? "text-lbx-green" : "text-lbx-muted hover:text-lbx-white transition-colors"}
            >
              Explore
            </Link>
            <Link
              to="/map"
              className={loc.pathname === "/map" ? "text-lbx-green" : "text-lbx-muted hover:text-lbx-white transition-colors"}
            >
              Map
            </Link>
            <Link
              to="/people"
              className={loc.pathname === "/people" ? "text-lbx-green" : "text-lbx-muted hover:text-lbx-white transition-colors"}
            >
              People
            </Link>
            {user ? (
              <>
                <Link
                  to="/lists"
                  className={loc.pathname.startsWith("/lists") ? "text-lbx-green" : "text-lbx-muted hover:text-lbx-white transition-colors"}
                  title="Your saved places and lists"
                >
                  Saved
                </Link>
                <Link
                  to="/profile/friends"
                  className={loc.pathname.startsWith("/profile/") ? "text-lbx-green" : "text-lbx-muted hover:text-lbx-white transition-colors"}
                  title="Activity, following, followers"
                >
                  Activity
                </Link>
                <Link
                  to="/profile"
                  className={loc.pathname === "/profile" ? "text-lbx-green" : "text-lbx-muted hover:text-lbx-white transition-colors"}
                >
                  {user.username}
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="text-lbx-muted hover:text-lbx-white transition-colors"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-lbx-muted hover:text-lbx-white transition-colors uppercase text-xs tracking-wider font-semibold">
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="bg-lbx-green text-lbx-dark px-4 py-2 rounded-md font-semibold hover:opacity-95 transition-opacity uppercase text-xs tracking-wider"
                >
                  Create account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className={`max-w-6xl w-full mx-auto px-4 sm:px-6 text-lbx-text min-h-[50vh] ${loc.pathname === "/" ? "pt-0 pb-8 sm:pb-10" : "py-8 sm:py-10"}`}>
        {children}
      </main>
      <footer className="border-t border-lbx-border bg-lbx-card/60 py-10 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-sm">
            <div className="flex items-center gap-2">
              <img src="/roadtrippi-logo.png" alt="" className="h-12 w-auto bg-transparent" aria-hidden />
              <span className="font-display font-semibold text-lbx-white">Roadtrippi</span>
            </div>
            <p className="text-lbx-muted text-center sm:text-left order-last sm:order-none">
              © {new Date().getFullYear()} Roadtrippi. Track visits. Share the road.
            </p>
            <nav className="flex gap-6 text-lbx-muted">
              <Link
                to="/"
                onClick={(e) => {
                  if (loc.pathname === "/") {
                    e.preventDefault();
                    const element = document.getElementById("all-attractions");
                    if (element) {
                      element.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }
                }}
                className="hover:text-lbx-green transition-colors"
              >
                Explore
              </Link>
              <Link to="/map" className="hover:text-lbx-green transition-colors">Map</Link>
              <Link to="/people" className="hover:text-lbx-green transition-colors">People</Link>
              <Link to="/" className="hover:text-lbx-green transition-colors">About</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
