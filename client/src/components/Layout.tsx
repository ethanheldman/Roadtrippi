import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * Single source of truth for the attractions search input in the header.
 * Shown on every page except Home (which has its own filter bar on the grid).
 * On Home it stays hidden to avoid a duplicate "Search attractions…" input.
 * On other pages, typing live-updates a local draft; submitting navigates to
 * /?search=... so the result actually shows up in the Explore grid.
 */
function HeaderSearch() {
  const loc = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get("search") ?? "";
  const [draft, setDraft] = useState(urlSearch);

  // Keep draft in sync with URL when navigating between pages.
  useEffect(() => {
    setDraft(urlSearch);
  }, [urlSearch, loc.pathname]);

  // Home has its own richer filter bar — don't double up.
  const hideOnHome = loc.pathname === "/";
  if (hideOnHome) return <div className="flex-1" aria-hidden />;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = draft.trim();
    const params = new URLSearchParams();
    if (q) params.set("search", q);
    navigate(params.toString() ? `/?${params.toString()}` : "/");
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 max-w-md hidden sm:block" role="search">
      <label htmlFor="header-search" className="sr-only">Search attractions</label>
      <input
        id="header-search"
        type="search"
        placeholder="Search attractions..."
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-full px-3 py-1.5 rounded-md bg-lbx-dark border border-lbx-border text-sm text-lbx-white placeholder-lbx-muted focus:outline-none focus:border-lbx-green focus:ring-1 focus:ring-lbx-green/40 transition-colors"
        aria-label="Search attractions"
      />
    </form>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const loc = useLocation();

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

          <HeaderSearch />

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
              to="/featured"
              className={loc.pathname === "/featured" ? "text-lbx-green" : "text-lbx-muted hover:text-lbx-white transition-colors"}
            >
              Featured
            </Link>
            <Link
              to="/play"
              className={`flex items-center gap-1 ${loc.pathname === "/play" || loc.pathname.startsWith("/game") || loc.pathname === "/connections" || loc.pathname === "/geo" ? "text-lbx-green" : "text-lbx-muted hover:text-lbx-white transition-colors"}`}
              title="Daily games — Detour & Connections"
            >
              Play
              <span className="text-[10px] leading-none bg-lbx-green/15 text-lbx-green px-1.5 py-0.5 rounded-full uppercase tracking-wide font-semibold">
                Daily
              </span>
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
              <Link to="/featured" className="hover:text-lbx-green transition-colors">Featured</Link>
              <Link to="/play" className="hover:text-lbx-green transition-colors">Play</Link>
              <Link to="/people" className="hover:text-lbx-green transition-colors">People</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
