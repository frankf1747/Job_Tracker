import { useEffect, useRef, useState } from 'react';

/**
 * Track an element's rendered width.
 *
 * Used where layout has to be computed in JS rather than expressed in CSS —
 * fitting a map projection to its container, and working out how many countdown
 * ticks fit on a row.
 */
export function useElementWidth(min = 0, initial = 300) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.max(min, entry.contentRect.width || initial));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [min, initial]);

  return [ref, width] as const;
}
