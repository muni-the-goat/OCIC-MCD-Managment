"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// The one moment in this app where somebody hands their work to someone else.
// It opens on arrival rather than in the form, because saveReport() ends in a
// redirect: the form is unmounted before it could show anything, and the page
// the redirect lands on is the only place left to say it.

// The mark. A solid badge with a white check struck on it — one shape, high
// contrast — rather than a pale tint holding a dark check inside a ring, which
// stacked two rings of different weights and read as unfinished.
//
// All inline SVG and CSS keyframes, no motion library: this branch may ship
// without the animated nav icons, and a success mark is not a reason to take
// on framer-motion.
const CENTRE = 70;

// Twelve lobes on two radii. The round stroke in the same colour as the fill
// is what turns twelve sharp points into the soft badge in the reference — a
// path with genuinely rounded lobes would be four times the coordinates for
// the same silhouette.
const BADGE_POINTS = Array.from({ length: 24 }, (_, index) => {
  const radius = index % 2 === 0 ? 37 : 27;
  const angle = (index / 24) * Math.PI * 2 - Math.PI / 2;
  return `${(CENTRE + radius * Math.cos(angle)).toFixed(2)},${(CENTRE + radius * Math.sin(angle)).toFixed(2)}`;
}).join(" ");

// Thrown outward past the badge's edge, alternating a chip and a dot so the
// scatter is not twelve of the same thing. Deterministic — a mark that dealt
// itself a different hand on every render would be a different picture each
// time somebody submitted.
const CONFETTI = Array.from({ length: 12 }, (_, index) => {
  // Twelve pieces on exact thirty-degree spokes is a clock face. The jitter is
  // arithmetic rather than random for the same reason the rest of this is:
  // every submission should throw the same handful.
  const jitter = (((index * 53) % 17) - 8) * (Math.PI / 180) * 1.6;
  const angle = (index / 12) * Math.PI * 2 - Math.PI / 2 + jitter;
  const distance = 42 + ((index * 7) % 17);
  return {
    dx: `${(distance * Math.cos(angle)).toFixed(1)}px`,
    dy: `${(distance * Math.sin(angle)).toFixed(1)}px`,
    rot: `${((index * 97) % 200) - 100}deg`,
    delay: `${(index % 4) * 45}ms`,
    colour: `var(--series-${(index % 6) + 1})`,
    chip: index % 2 === 0,
  };
});

function SuccessMark() {
  return (
    <svg viewBox="0 0 140 140" className="size-28" aria-hidden>
      {CONFETTI.map((piece, index) => {
        const style = {
          "--dx": piece.dx,
          "--dy": piece.dy,
          "--rot": piece.rot,
          "--delay": piece.delay,
        } as React.CSSProperties;
        return piece.chip ? (
          <rect
            key={index}
            x={CENTRE - 2.5}
            y={CENTRE - 3.5}
            width={5}
            height={7}
            rx={1.5}
            fill={piece.colour}
            style={style}
            className="motion-safe:animate-confetti motion-reduce:hidden"
          />
        ) : (
          <circle
            key={index}
            cx={CENTRE}
            cy={CENTRE}
            r={2.6}
            fill={piece.colour}
            style={style}
            className="motion-safe:animate-confetti motion-reduce:hidden"
          />
        );
      })}
      {/* Solid, not a tint. The check on top is white, which is the contrast
          the reference gets and the tinted version never could. */}
      <polygon
        points={BADGE_POINTS}
        fill="var(--status-good)"
        stroke="var(--status-good)"
        strokeWidth={9}
        strokeLinejoin="round"
        className="origin-center motion-safe:animate-burst"
      />
      <path
        d="M57 70.5 L66.5 80 L84 60"
        fill="none"
        stroke="#fff"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="motion-safe:animate-check-pop"
      />
    </svg>
  );
}

export function ReportSubmittedDialog({ locked }: { locked: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  // The flag is a one-shot. Left in the URL it would reopen on every refresh
  // and on every back-navigation to this report, so closing strips it — with
  // replace rather than push, so Back still leaves the report rather than
  // stepping through a dialog that is no longer there.
  const close = () => {
    setOpen(false);
    router.replace(window.location.pathname, { scroll: false });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="text-center duration-200 sm:max-w-sm">
        <DialogHeader className="items-center gap-1">
          <SuccessMark />
          <DialogTitle className="text-xl motion-safe:animate-rise motion-safe:[animation-delay:320ms]">
            Yaaayyy, your report is submitted for review!
          </DialogTitle>
          <DialogDescription className="motion-safe:animate-rise motion-safe:[animation-delay:400ms]">
            {/* The part nobody was told before: for most authors submitting is
                a one-way door. The "reports: author update" policy allows an
                author only at 'draft' and 'rejected', so the Edit button they
                had a second ago is gone, and finding that out by going to look
                for it is a worse way to learn it.

                Not for everyone, though — "reports: admin update" keeps an
                Admin's write, and a Head of Department reaches the same rows
                through canManageAnyReport(). Telling them their report is
                locked while the Edit button sits above the dialog would make
                the sentence something to distrust rather than to read. */}
            {locked
              ? "It's waiting on a decision now, and can't be edited until there is one. You'll see it move on your dashboard."
              : "It's waiting on a decision now. You'll see it move on your dashboard."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-col">
          <Button onClick={close} className="w-full">
            View the report
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/reports">Back to all reports</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
