import { useState } from "react";

type AttractionImageProps = {
  imageUrl: string | null | undefined;
  alt?: string;
  className?: string;
  /** Optional placeholder when no image or load fails. Defaults to 🗿 in a flex container. */
  placeholder?: React.ReactNode;
};

/**
 * Renders an attraction image with referrerPolicy="no-referrer" so external hosts
 * (e.g. Wikimedia, Flickr) don't block the request, and falls back to placeholder on error.
 */
export function AttractionImage({ imageUrl, alt = "", className, placeholder }: AttractionImageProps) {
  const [error, setError] = useState(false);
  const showPlaceholder = !imageUrl || error;
  const defaultPlaceholder = (
    <div className="w-full h-full flex items-center justify-center min-h-0 bg-lbx-border/80 text-lbx-muted/50">
      <span className="text-4xl leading-none select-none" aria-hidden>🗿</span>
    </div>
  );

  if (showPlaceholder) {
    return <>{placeholder ?? defaultPlaceholder}</>;
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
    />
  );
}
