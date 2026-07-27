"use client";

import { useState } from "react";
import { ProductPanel } from "./product-panel";

/**
 * A product name mention that opens the inventory detail panel on click —
 * used anywhere a product is referenced outside the /inventory table itself
 * (Top Selling Products on region/city pages), since products have no
 * per-product URL to link to.
 */
export function ProductLink({
  name,
  className,
  children,
}: {
  name: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <ProductPanel name={open ? name : null} onClose={() => setOpen(false)} />
    </>
  );
}
