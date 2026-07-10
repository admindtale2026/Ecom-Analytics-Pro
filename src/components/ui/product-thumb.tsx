import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Product thumbnail. The ingest schema carries an image_url column but the
 * current feeds never populate it, so the placeholder is the common path, not
 * an error state — it must look deliberate.
 */
export function ProductThumb({
  imageUrl,
  name,
  size = 40,
  className,
}: {
  imageUrl?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const box = cn("shrink-0 overflow-hidden rounded-lg border border-line", className);
  if (imageUrl) {
    return (
      // Feed images are arbitrary remote URLs on hosts we don't control, so
      // next/image's optimizer would need a wildcard remotePattern to serve them.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name ?? "Product"}
        width={size}
        height={size}
        loading="lazy"
        className={cn(box, "object-cover")}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(box, "flex items-center justify-center bg-slate-50 text-slate-300")}
      style={{ width: size, height: size }}
    >
      <Package style={{ width: size * 0.45, height: size * 0.45 }} />
    </span>
  );
}
