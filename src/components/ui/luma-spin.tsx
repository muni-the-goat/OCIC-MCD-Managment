import { cn } from "@/lib/utils";

// A square loader whose two arms sweep the corners in sequence. Adapted from the
// original 65px styled-jsx version to be size-scalable (the keyframes read
// --loader-gap) and theme-aware (drawn in currentColor, so `text-*` tints it).
// Pure CSS with the keyframes in globals.css, so it needs no client boundary.
export function LumaSpin({
  size = 65,
  className,
}: {
  size?: number;
  className?: string;
}) {
  // The gap the arms travel is ~54% of the box, the ratio the original 35/65px
  // animation used, so any size keeps the same motion.
  const gap = Math.round(size * 0.54);

  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("relative aspect-square text-foreground", className)}
      style={
        { width: size, "--loader-gap": `${gap}px` } as React.CSSProperties
      }
    >
      <span className="luma-span" />
      <span className="luma-span luma-span-delayed" />
    </div>
  );
}
