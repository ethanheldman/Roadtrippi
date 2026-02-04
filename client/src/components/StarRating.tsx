import { useState, useCallback } from "react";

type Props = {
  /** 0 = no rating (empty stars), 1–5 in 0.5 steps */
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  "aria-label"?: string;
  /** Show a "Clear" button to set value to 0 (for edit mode) */
  allowClear?: boolean;
};

const EMPTY_STAR = "☆";
const FILLED_STAR = "★";

export function StarRating({ value, onChange, disabled, size = "md", "aria-label": ariaLabel = "Rating", allowClear }: Props) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue != null ? hoverValue : value;

  const sizeClass = size === "sm" ? "text-xl" : "text-3xl";
  const fillColor = "text-amber-400";
  const emptyColor = "text-lbx-border";
  const starSize = size === "sm" ? "w-6" : "w-8";

  const handleHalfClick = useCallback(
    (halfValue: number) => {
      if (disabled) return;
      onChange(halfValue);
    },
    [disabled, onChange]
  );

  return (
    <div
      className={`inline-flex items-center gap-0.5 ${sizeClass} leading-none`}
      role="group"
      aria-label={ariaLabel}
    >
      {[0, 1, 2, 3, 4].map((starIndex) => {
        const fillAmount = Math.min(1, Math.max(0, displayValue - starIndex));
        return (
          <span
            key={starIndex}
            className={`relative inline-flex ${starSize} justify-center items-center shrink-0`}
          >
            {/* Visual: empty star + filled portion (supports half fill) */}
            <span className={`inline-block ${emptyColor} select-none pointer-events-none`} aria-hidden>
              {EMPTY_STAR}
            </span>
            <span
              className={`absolute inset-0 flex justify-start items-center overflow-hidden ${fillColor} select-none pointer-events-none`}
              style={{ width: `${fillAmount * 100}%` }}
              aria-hidden
            >
              <span className="flex-shrink-0">{FILLED_STAR}</span>
            </span>
            {/* Left half: value = starIndex + 0.5 */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleHalfClick(starIndex + 0.5)}
              onMouseEnter={() => !disabled && setHoverValue(starIndex + 0.5)}
              onMouseLeave={() => setHoverValue(null)}
              className="absolute left-0 top-0 bottom-0 w-1/2 cursor-pointer border-0 bg-transparent p-0 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-70"
              aria-label={`${starIndex + 0.5} stars`}
            />
            {/* Right half: value = starIndex + 1 */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleHalfClick(starIndex + 1)}
              onMouseEnter={() => !disabled && setHoverValue(starIndex + 1)}
              onMouseLeave={() => setHoverValue(null)}
              className="absolute right-0 top-0 bottom-0 w-1/2 cursor-pointer border-0 bg-transparent p-0 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-70"
              aria-label={`${starIndex + 1} stars`}
            />
          </span>
        );
      })}
      {allowClear && !disabled && (
        <button
          type="button"
          onClick={() => onChange(0)}
          className="ml-2 text-lbx-muted hover:text-lbx-white text-sm font-medium transition-colors"
          aria-label="Clear rating"
        >
          Clear
        </button>
      )}
    </div>
  );
}
