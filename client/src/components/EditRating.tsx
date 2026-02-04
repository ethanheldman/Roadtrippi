import { useState, useRef, useEffect } from "react";
import { checkIns } from "../api";
import { StarRating } from "./StarRating";

type Props = {
  checkInId: string;
  rating: number | null;
  onSaved: () => void;
  className?: string;
  size?: "sm" | "md";
};

export function EditRating({ checkInId, rating, onSaved, className = "", size = "sm" }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  const textSize = size === "sm" ? "text-xs" : "text-sm";

  useEffect(() => {
    if (!editing) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setEditing(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [editing]);

  const handlePick = async (newRating: number | null) => {
    if (newRating === rating) {
      setEditing(false);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await checkIns.update(checkInId, { rating: newRating });
      onSaved();
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <span ref={wrapRef} className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
        <StarRating
          value={rating ?? 0}
          onChange={(v) => handlePick(v === 0 ? null : v)}
          disabled={saving}
          size={size}
          allowClear
          aria-label="Edit rating"
        />
        {error && <span className="text-xs text-red-400" role="alert">{error}</span>}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`${textSize} text-lbx-green font-medium hover:underline text-left inline-flex items-baseline gap-0.5 ${className}`}
      aria-label="Edit rating"
    >
      {rating != null ? (
        <>
          <span>★</span>
          <span>{rating}/5</span>
        </>
      ) : (
        <span className="text-lbx-muted">— Add rating</span>
      )}
    </button>
  );
}
