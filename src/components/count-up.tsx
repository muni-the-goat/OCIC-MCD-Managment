"use client";

import { useEffect, useRef, useState } from "react";

// Tweens a number toward its value on mount (and on change), for the dashboard's
// headline figures. Starts from 0 on first render — server and first client
// render agree on 0, so there is no hydration mismatch — then animates up.
// Honours prefers-reduced-motion by jumping straight to the value.
export function CountUp({
  value,
  durationMs = 700,
  format = (n) => String(Math.round(n)),
  className,
}: {
  value: number;
  durationMs?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Reduced motion is a zero-duration tween: the first frame lands on the
    // value. Keeping the single setState inside the rAF callback (never the
    // effect body) is also what the react-hooks lint rule wants.
    const effective = reduce ? 0 : durationMs;
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = effective <= 0 ? 1 : Math.min(1, (now - start) / effective);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const current = from + (value - from) * eased;
      setDisplay(current);
      fromRef.current = current;
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <span className={className}>{format(display)}</span>;
}
