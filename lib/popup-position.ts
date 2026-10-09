/** A rectangle in the window, as getBoundingClientRect gives it. */
export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Where a popup of `size` goes beside its mention (fixed coordinates): below it, else above it when it fits
 * there and not below, at the mention's left edge shifted to stay `margin` inside the window.
 */
export function popupPosition(
  anchor: Box, size: { width: number; height: number }, viewport: { width: number; height: number }, gap = 6, margin = 8,
): { top: number; left: number; placement: "below" | "above" } {
  const below = anchor.bottom + gap;
  const above = anchor.top - gap - size.height;
  const fitsBelow = below + size.height <= viewport.height - margin;
  const fitsAbove = above >= margin;
  const placement = fitsBelow || (!fitsAbove && viewport.height - anchor.bottom >= anchor.top) ? "below" : "above";
  const top = placement === "below" ? below : Math.max(margin, above);
  const left = Math.min(Math.max(anchor.left, margin), Math.max(margin, viewport.width - size.width - margin));
  return { top, left, placement };
}
