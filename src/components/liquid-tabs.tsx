"use client";

import { Liquid } from "liquid-gooey";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LiquidTabOption {
  value: string;
  label: string;
  icon?: LucideIcon;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// The marketing side's segmented control: a row of white pills with the
// selected one in ink. The ink is liquid (liquid-gooey's "move" effect) — it
// slides to the pill you pick and trails a droplet behind it as it goes, so
// the eye follows the selection from where it was to where it is rather than
// watching one pill go dark and another go light.
//
// The layering is the library's. The group is isolated and paints its liquid
// at z-index -1, behind every child; each pill's white face is a ::before at
// -2, below the liquid, so the ink passes over the faces and under the labels.
// The indicator element itself is invisible — it only carries geometry. CSS
// slides it; the liquid layer renders it.
//
// Two roles. "tabs" switches a panel and speaks tablist; "filter" narrows a
// list and speaks pressed toggle buttons, which is what a screen reader should
// hear for "show only Rejected".
export function LiquidTabs({
  options,
  value,
  onChange,
  label,
  role = "tabs",
  idPrefix,
  className,
}: {
  options: LiquidTabOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  role?: "tabs" | "filter";
  // Needed for role="tabs", to tie each tab to its panel.
  idPrefix?: string;
  className?: string;
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const [indicator, setIndicator] = useState({ x: 0, w: 0 });
  // The first placement must not slide in from the left edge: the pill should
  // simply be where the page says it is. Transitions switch on after it lands.
  const [placed, setPlaced] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false
  );

  const measure = useCallback(() => {
    const el = refs.current.get(value);
    if (el) setIndicator({ x: el.offsetLeft, w: el.offsetWidth });
  }, [value]);

  useLayoutEffect(() => {
    measure();
    // A webfont swapping in, or the row reflowing, changes every pill's width
    // after the first measure; the ink has to follow or it sits off-centre.
    const ro = new ResizeObserver(measure);
    refs.current.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [measure]);

  useLayoutEffect(() => {
    if (indicator.w > 0 && !placed) {
      const frame = requestAnimationFrame(() => setPlaced(true));
      return () => cancelAnimationFrame(frame);
    }
  }, [indicator.w, placed]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (role !== "tabs") return;
    const index = options.findIndex((o) => o.value === value);
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = options[(index + step + options.length) % options.length];
    onChange(next.value);
    refs.current.get(next.value)?.focus();
  };

  const pills = options.map((option) => {
    const active = option.value === value;
    const Icon = option.icon;
    return (
      <button
        key={option.value}
        ref={(el) => {
          if (el) refs.current.set(option.value, el);
          else refs.current.delete(option.value);
        }}
        type="button"
        id={idPrefix ? `${idPrefix}-tab-${option.value}` : undefined}
        role={role === "tabs" ? "tab" : undefined}
        aria-selected={role === "tabs" ? active : undefined}
        aria-controls={
          role === "tabs" && idPrefix
            ? `${idPrefix}-panel-${option.value}`
            : undefined
        }
        aria-pressed={role === "filter" ? active : undefined}
        tabIndex={role === "tabs" && !active ? -1 : undefined}
        onClick={() => onChange(option.value)}
        className={cn(
          "type-callout relative inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 font-semibold whitespace-nowrap outline-none",
          // The press darkens the face rather than scaling the pill: a
          // transform would give the button its own stacking context for the
          // length of the press, lifting the white face above the ink.
          "transition-colors duration-200 ease-out before:transition-colors before:duration-200 active:before:bg-muted active:before:duration-100",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          // The white face, under the liquid.
          "before:absolute before:inset-0 before:-z-[2] before:rounded-full before:bg-card before:content-['']",
          "[&_svg]:size-4 [&_svg]:shrink-0",
          active
            ? "text-background"
            : "text-muted-foreground hover:text-foreground",
          // Without the liquid, the selected face is simply ink.
          reducedMotion && active && "before:bg-foreground"
        )}
      >
        {Icon ? <Icon aria-hidden /> : null}
        {option.label}
      </button>
    );
  });

  const groupProps = {
    role: role === "tabs" ? "tablist" : "group",
    "aria-label": label,
    onKeyDown,
  };

  // Reduced motion: no slide and no droplet, the selection just changes.
  if (reducedMotion) {
    return (
      <div
        {...groupProps}
        className={cn("relative isolate inline-flex gap-1.5", className)}
      >
        {pills}
      </div>
    );
  }

  return (
    <Liquid
      {...groupProps}
      // The indicator is 40px tall. The blur has to stay small relative to
      // that, or it rounds the pill's end-caps into a lozenge; the library's
      // own tabs run 3.5 on a 30px pill.
      blur={4.5}
      contrast={18}
      fill="var(--foreground)"
      shadow="0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 1px rgba(0, 0, 0, 0.08)"
      className={cn("inline-flex gap-1.5", className)}
    >
      <Liquid.Item effect="move" move={{ springiness: 0.5, trail: 0.575 }}>
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-0 left-0 h-10 rounded-full",
            placed &&
              "transition-[transform,width] duration-[280ms] ease-[cubic-bezier(0.3,1.05,0.4,1)]"
          )}
          style={{
            transform: `translateX(${indicator.x}px)`,
            width: indicator.w,
          }}
        />
      </Liquid.Item>
      {pills}
    </Liquid>
  );
}
