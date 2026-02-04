import { useState, useRef, useEffect } from "react";
import { checkIns } from "../api";
import { StarRating } from "./StarRating";

type Props = {
  checkInId: string;
  rating: number | null;
  review: string | null;
  visitDate: string;
  onSaved: () => void;
  className?: string;
};

/** Format YYYY-MM-DD for display; pass through if already that format. */
function toInputDate(visitDate: string): string {
  const d = new Date(visitDate);
  if (Number.isNaN(d.getTime())) return visitDate;
  return d.toISOString().slice(0, 10);
}

export function EditCheckIn({ checkInId, rating, review, visitDate, onSaved, className = "" }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(rating ?? 0);
  const [editReview, setEditReview] = useState(review ?? "");
  const [editVisitDate, setEditVisitDate] = useState(toInputDate(visitDate));
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setEditing(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [editing]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      await checkIns.update(checkInId, {
        rating: editRating >= 1 ? editRating : null,
        review: editReview.trim() || undefined,
        visitDate: editVisitDate,
      });
      onSaved();
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const startEditing = () => {
    setEditRating(rating ?? 0);
    setEditReview(review ?? "");
    setEditVisitDate(toInputDate(visitDate));
    setError(null);
    setEditing(true);
  };

  if (editing) {
    return (
      <div ref={wrapRef} className={`space-y-3 ${className}`}>
        <div>
          <label className="block text-xs font-medium text-lbx-muted mb-1">Rating</label>
          <StarRating
            value={editRating}
            onChange={setEditRating}
            disabled={saving}
            size="sm"
            allowClear
            aria-label="Edit rating"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-lbx-muted mb-1">Visit date</label>
          <input
            type="date"
            value={editVisitDate}
            onChange={(e) => setEditVisitDate(e.target.value)}
            className="w-full px-3 py-2 bg-lbx-dark border border-lbx-border rounded-md text-lbx-white text-sm focus:border-lbx-green focus:ring-1 focus:ring-lbx-green focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-lbx-muted mb-1">Review (optional)</label>
          <textarea
            value={editReview}
            onChange={(e) => setEditReview(e.target.value)}
            rows={3}
            placeholder="What did you think?"
            className="w-full px-3 py-2 bg-lbx-dark border border-lbx-border rounded-md text-lbx-white placeholder-lbx-muted text-sm focus:border-lbx-green focus:ring-1 focus:ring-lbx-green focus:outline-none resize-none"
          />
        </div>
        {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || editRating < 1}
            className="px-3 py-1.5 bg-lbx-green text-lbx-dark text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={saving}
            className="px-3 py-1.5 border border-lbx-border text-lbx-muted text-sm rounded-md hover:text-lbx-white hover:border-lbx-green transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-3 flex-wrap mb-1">
        {rating != null ? (
          <span className="text-lbx-green text-sm font-medium">★ {rating}/5</span>
        ) : (
          <span className="text-lbx-muted text-sm">— No rating</span>
        )}
        <span className="text-lbx-muted text-sm">
          {new Date(visitDate).toLocaleDateString()}
        </span>
        <button
          type="button"
          onClick={startEditing}
          className="text-lbx-green text-sm font-medium hover:underline"
          aria-label="Edit check-in"
        >
          Edit
        </button>
      </div>
      {review ? (
        <p className="text-lbx-text text-sm whitespace-pre-wrap mt-1">{review}</p>
      ) : (
        <p className="text-lbx-muted text-sm italic mt-1">No written review</p>
      )}
    </div>
  );
}
