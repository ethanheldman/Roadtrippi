import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { geo as geoApi, type GeoRound, type GeoResult } from "../api";
import { AttractionImage } from "../components/AttractionImage";
import "leaflet/dist/leaflet.css";

/**
 * "Where in the USA?" — a GeoGuessr-style game. See an attraction, click the
 * map to guess where it is, score by distance. Five rounds, max 5,000 each.
 */

const ROUNDS = 5;
const US_CENTER: [number, number] = [39.5, -98.35];

const guessIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 1.5px rgba(0,0,0,.5)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});
const actualIcon = L.divIcon({
  className: "",
  html: `<div style="font-size:26px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))">📍</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 24],
});

function ClickCatcher({ disabled, onPick }: { disabled: boolean; onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (!disabled) onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitOnReveal({ guess, actual }: { guess: { lat: number; lng: number } | null; actual: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (guess && actual) {
      map.fitBounds(
        [
          [guess.lat, guess.lng],
          [actual.lat, actual.lng],
        ],
        { padding: [50, 50], maxZoom: 7, animate: true }
      );
    }
  }, [guess, actual, map]);
  return null;
}

const scoreEmoji = (pts: number) => (pts >= 4000 ? "🟩" : pts >= 2000 ? "🟨" : "🟥");

export function GeoGuess() {
  const [rounds, setRounds] = useState<GeoRound[] | null>(null);
  const [maxPoints, setMaxPoints] = useState(5000);
  const [error, setError] = useState<string | null>(null);

  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState<{ lat: number; lng: number } | null>(null);
  const [result, setResult] = useState<GeoResult | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadRounds = () => {
    setRounds(null);
    setError(null);
    setIdx(0);
    setGuess(null);
    setResult(null);
    setScores([]);
    geoApi
      .round(ROUNDS)
      .then((d) => {
        setRounds(d.rounds);
        setMaxPoints(d.maxPoints);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the game"));
  };

  useEffect(() => {
    loadRounds();
  }, []);

  const total = scores.reduce((a, b) => a + b, 0);
  const finished = !!rounds && scores.length === rounds.length && !!result && idx === rounds.length - 1;
  const current = rounds?.[idx];

  const submitGuess = async () => {
    if (!current || !guess || result || busy) return;
    setBusy(true);
    try {
      const res = await geoApi.guess(current.id, guess.lat, guess.lng);
      setResult(res);
      setScores((s) => [...s, res.points]);
    } catch {
      setError("Couldn't score that — try again.");
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (!rounds) return;
    if (idx < rounds.length - 1) {
      setIdx((i) => i + 1);
      setGuess(null);
      setResult(null);
    }
  };

  const shareText = (() => {
    if (!rounds || !finished) return "";
    const grid = scores.map(scoreEmoji).join("");
    return `Where in the USA? — ${total.toLocaleString()}/${(rounds.length * maxPoints).toLocaleString()}\n${grid}\nroadtrippi.com/geo`;
  })();
  const handleShare = async () => {
    if (!shareText) return;
    try {
      if (navigator.share) await navigator.share({ text: shareText });
      else {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* dismissed */
    }
  };

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="font-display text-2xl text-lbx-white mb-2">Where in the USA?</h1>
        <p className="text-lbx-red">{error}</p>
      </div>
    );
  }
  if (!rounds || !current) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <div className="skeleton h-9 w-72 mb-6 mx-auto" />
        <div className="skeleton h-56 w-full mb-3 rounded-lg" />
        <div className="skeleton h-[360px] w-full rounded-lg" />
      </div>
    );
  }

  const maxTotal = rounds.length * maxPoints;

  return (
    <div className="max-w-2xl mx-auto py-6 sm:py-10">
      <div className="text-center mb-5">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-lbx-white tracking-tight">
          Where in the USA?
        </h1>
        <p className="text-lbx-muted mt-1 text-sm">
          Study the attraction, then click the map to guess where it is.
        </p>
        <div className="mt-3 flex items-center justify-center gap-4 text-xs uppercase tracking-wider text-lbx-muted">
          <span>Round {Math.min(idx + 1, rounds.length)} / {rounds.length}</span>
          <span className="text-lbx-white">Score {total.toLocaleString()}</span>
          <Link to="/play" className="text-lbx-green hover:underline normal-case tracking-normal">All games</Link>
        </div>
      </div>

      {!finished && (
        <>
          {/* Attraction */}
          <div className="rounded-xl border border-lbx-border bg-lbx-card overflow-hidden mb-3">
            <div className="aspect-video max-h-72 bg-lbx-dark flex items-center justify-center overflow-hidden">
              <AttractionImage imageUrl={current.imageUrl} alt={current.name} className="w-full h-full object-cover" />
            </div>
            <div className="p-3 text-center font-display text-lg text-lbx-white">{current.name}</div>
          </div>

          {/* Map */}
          <div className="h-[360px] rounded-xl overflow-hidden border border-lbx-border mb-4">
            <MapContainer center={US_CENTER} zoom={4} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <ClickCatcher disabled={!!result} onPick={(lat, lng) => setGuess({ lat, lng })} />
              {guess && <Marker position={[guess.lat, guess.lng]} icon={guessIcon} />}
              {result && <Marker position={[result.actual.lat, result.actual.lng]} icon={actualIcon} />}
              {result && guess && (
                <>
                  <Polyline positions={[[guess.lat, guess.lng], [result.actual.lat, result.actual.lng]]} pathOptions={{ color: "#f85149", dashArray: "6 6" }} />
                  <FitOnReveal guess={guess} actual={result.actual} />
                </>
              )}
            </MapContainer>
          </div>

          {/* Result / submit */}
          {result ? (
            <div className="rounded-xl border border-lbx-border bg-lbx-card p-4 text-center">
              <div className="flex items-center justify-center gap-6">
                <div>
                  <div className="text-2xl font-bold text-lbx-green">+{result.points.toLocaleString()}</div>
                  <div className="text-[11px] uppercase tracking-wider text-lbx-muted">points</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-lbx-white">{result.distanceMiles.toLocaleString()}</div>
                  <div className="text-[11px] uppercase tracking-wider text-lbx-muted">miles off</div>
                </div>
              </div>
              <p className="text-lbx-muted text-sm mt-3">
                It&apos;s{" "}
                <Link to={`/attraction/${current.id}`} className="text-lbx-green hover:underline">
                  {result.name}
                </Link>{" "}
                — {result.city ? `${result.city}, ` : ""}
                {result.state}
              </p>
              <button
                type="button"
                onClick={next}
                className="mt-4 w-full bg-lbx-green text-lbx-dark font-semibold py-3 rounded-lg hover:opacity-95 transition-opacity uppercase text-sm tracking-wider"
              >
                {idx < rounds.length - 1 ? "Next round →" : "See final score"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={submitGuess}
              disabled={!guess || busy}
              className="w-full bg-lbx-green text-lbx-dark font-semibold py-3 rounded-lg hover:opacity-95 transition-opacity disabled:opacity-40 uppercase text-sm tracking-wider"
            >
              {guess ? "Submit guess" : "Click the map to place your guess"}
            </button>
          )}
        </>
      )}

      {/* Final score */}
      {finished && (
        <div className="rounded-xl border border-lbx-border bg-lbx-card p-6 text-center">
          <p className="text-lbx-muted text-sm uppercase tracking-wider">Final score</p>
          <p className="font-display text-4xl font-bold text-lbx-white mt-1">
            {total.toLocaleString()}
            <span className="text-lbx-muted text-xl"> / {maxTotal.toLocaleString()}</span>
          </p>
          <div className="text-2xl mt-3">{scores.map(scoreEmoji).join(" ")}</div>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={handleShare}
              className="flex-1 bg-lbx-card border border-lbx-border text-lbx-white font-semibold py-3 rounded-lg hover:border-lbx-muted transition-colors uppercase text-sm tracking-wider"
            >
              {copied ? "Copied!" : "Share"}
            </button>
            <button
              type="button"
              onClick={loadRounds}
              className="flex-1 bg-lbx-green text-lbx-dark font-semibold py-3 rounded-lg hover:opacity-95 transition-opacity uppercase text-sm tracking-wider"
            >
              Play again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
