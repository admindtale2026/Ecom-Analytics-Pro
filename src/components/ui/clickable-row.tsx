"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * A table row whose whole area is clickable for convenience. The row itself
 * navigates via JS (so it only works once hydrated), so callers should ALSO
 * render a real `<Link>` on the primary cell — that anchor is the accessible,
 * keyboard-focusable target and it navigates even before hydration. This
 * onClick just adds "click anywhere on the row"; when the click lands on that
 * inner link (or any link/button), we bail so we don't navigate twice.
 */
export function ClickableRow({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button")) return;
        router.push(href);
      }}
      className={cn("cursor-pointer", className)}
    >
      {children}
    </tr>
  );
}
