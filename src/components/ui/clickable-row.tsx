"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * A table row that navigates on click anywhere in the row (not just a link in
 * one cell). Keyboard-accessible: focusable, Enter/Space activate it.
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
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      className={cn("cursor-pointer outline-none focus-visible:bg-brand-50/60", className)}
    >
      {children}
    </tr>
  );
}
