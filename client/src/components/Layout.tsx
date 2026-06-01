import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * Attractions search input. Hidden on Home (which has its own filter bar).
 * Submitting navigates to /?search=… so results show in the Explore grid.
 */
function HeaderSearch({ className = "", onSubmitted }: { className?: string; onSubmitted?: () => void }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get("search") ?? "";
  const [draft, setDraft] = useState(urlSearch);

  useEffect(() => {
    setDraft(urlSearch);
  }, [urlSearch, loc.pathname]);

  if (loc.pathname === "/") return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = draft.trim();
    const params = new URLSearchParams();
    if (q) params.set("search", q);
    navigate(params.toString() ? `/?${params.toString()}` : "/");
    onSubmitted?.();
  };

  return (
    <form onSubmit={handleSubmit} className={className} role="search">
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

type NavItem = { to: string; label: string; badge?: string; match: (p: string) => boolean };

const PRIMARY: NavItem[] = [
  { to: "/", label: "Explore", match: (p) => p === "/" },
  { to: "/map", label: "Map", match: (p) => p === "/map" },
  { to: "/featured", label: "Featured", match: (p) => p === "/featured" },
  {
    to: "/play",
    label: "Play",
    badge: "Daily",
    match: (p) => p === "/play" || p.startsWith("/game") || p === "/connections" || p === "/geo",
  },
  { to: "/people", label: "People", match: (p) => p === "/people" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const [menuOpen, setMenuOpen] = useState(false); // mobile drawer
  const [userOpen, setUserOpen] = useState(false); // desktop account dropdown
  const userRef = useRef<HTMLDivElement>(null);

  // Close menus on navigation.
  useEffect(() => {
    setMenuOpen(false);
    setUserOpen(false);
  }, [loc.pathname]);

  // Close the user dropdown on outside click / Escape.
  useEffect(() => {
    if (!userOpen) return;
    const onClick = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setUserOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [userOpen]);

  const linkCls = (active: boolean) =>
    active ? "text-lbx-green" : "text-lbx-muted hover:text-lbx-white transition-colors";

  const exploreScroll = (e: React.MouseEvent) => {
    if (loc.pathname === "/") {
      e.preventDefault();
      document.getElementById("all-attractions")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const initial = user?.username?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="min-h-screen flex flex-col bg-lbx-dark">
      <header className="bg-lbx-card/90 border-b border-lbx-border sticky top-0 z-30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3 sm:gap-4">
          {/* Logo */}
          <Link
            to="/"
            className="font-display font-bold text-xl text-lbx-white flex items-center gap-2 tracking-tight shrink-0"
          >
            <img src="/roadtrippi-logo.png" alt="" className="h-9 w-auto" aria-hidden />
            <span>Roadtrippi</span>
          </Link>

          {/* Search (desktop) — keeps the row balanced; empty on Home */}
          <div className="flex-1 hidden lg:block">
            <HeaderSearch className="w-full max-w-sm" />
          </div>

          {/* Primary nav (desktop) */}
          <nav className="hidden lg:flex items-center gap-5 text-sm font-medium shrink-0">
            {PRIMARY.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={item.to === "/" ? exploreScroll : undefined}
                className={`flex items-center gap-1 ${linkCls(item.match(loc.pathname))}`}
              >
                {item.label}
                {item.badge && (
                  <span className="text-[10px] leading-none bg-lbx-green/15 text-lbx-green px-1.5 py-0.5 rounded-full uppercase tracking-wide font-semibold">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Account (desktop) */}
          <div className="hidden lg:block shrink-0">
            {user ? (
              <div className="relative" ref={userRef}>
                <button
                  type="button"
                  onClick={() => setUserOpen((o) => !o)}
                  className="flex items-center gap-2 text-sm font-medium text-lbx-white hover:opacity-90 transition-opacity"
                  aria-haspopup="menu"
                  aria-expanded={userOpen}
                >
                  <span className="h-7 w-7 rounded-full bg-lbx-green text-lbx-dark font-bold flex items-center justify-center text-xs">
                    {initial}
                  </span>
                  <span className="max-w-[10ch] truncate">{user.username}</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" className="text-lbx-muted" aria-hidden>
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {userOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-48 rounded-lg border border-lbx-border bg-lbx-card shadow-card-hover py-1.5 text-sm"
                  >
                    <Link to="/profile" className="block px-4 py-2 text-lbx-text hover:bg-lbx-border/60 transition-colors" role="menuitem">
                      Your profile
                    </Link>
                    <Link to="/lists" className="block px-4 py-2 text-lbx-text hover:bg-lbx-border/60 transition-colors" role="menuitem">
                      Saved
                    </Link>
                    <Link to="/profile/friends" className="block px-4 py-2 text-lbx-text hover:bg-lbx-border/60 transition-colors" role="menuitem">
                      Activity
                    </Link>
                    <div className="my-1 border-t border-lbx-border" />
                    <button
                      type="button"
                      onClick={logout}
                      className="block w-full text-left px-4 py-2 text-lbx-muted hover:bg-lbx-border/60 hover:text-lbx-white transition-colors"
                      role="menuitem"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Link to="/login" className="text-lbx-muted hover:text-lbx-white transition-colors text-sm font-medium">
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="bg-lbx-green text-lbx-dark px-4 py-1.5 rounded-md font-semibold hover:opacity-95 transition-opacity text-sm"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile: hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="lg:hidden ml-auto p-2 -mr-2 text-lbx-white"
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            )}
          </button>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="lg:hidden border-t border-lbx-border bg-lbx-card">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 space-y-1">
              <HeaderSearch className="w-full mb-2" onSubmitted={() => setMenuOpen(false)} />
              {PRIMARY.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={item.to === "/" ? exploreScroll : undefined}
                  className={`flex items-center gap-2 py-2.5 text-base font-medium ${linkCls(item.match(loc.pathname))}`}
                >
                  {item.label}
                  {item.badge && (
                    <span className="text-[10px] leading-none bg-lbx-green/15 text-lbx-green px-1.5 py-0.5 rounded-full uppercase tracking-wide font-semibold">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
              <div className="border-t border-lbx-border my-2" />
              {user ? (
                <>
                  <Link to="/profile" className="block py-2.5 text-base text-lbx-text">Your profile ({user.username})</Link>
                  <Link to="/lists" className="block py-2.5 text-base text-lbx-text">Saved</Link>
                  <Link to="/profile/friends" className="block py-2.5 text-base text-lbx-text">Activity</Link>
                  <button type="button" onClick={logout} className="block w-full text-left py-2.5 text-base text-lbx-muted">
                    Log out
                  </button>
                </>
              ) : (
                <div className="flex gap-3 pt-1">
                  <Link to="/login" className="flex-1 text-center py-2.5 rounded-md border border-lbx-border text-lbx-white font-medium">
                    Sign in
                  </Link>
                  <Link to="/signup" className="flex-1 text-center py-2.5 rounded-md bg-lbx-green text-lbx-dark font-semibold">
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
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
            <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-lbx-muted">
              <Link to="/" onClick={exploreScroll} className="hover:text-lbx-green transition-colors">Explore</Link>
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
