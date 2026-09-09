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

// The mark, drawn in five steps rather than dropped in finished. Everything is
// inline SVG and CSS keyframes — no motion library — so this component stays
// standalone whether or not the animated nav icons ship with it.
//
// The starburst is twelve points on two alternating radii. A path this small
// does not need a dependency, and it is the app's own status green with the
// same check the Reviewed badge already carries, rather than a second visual
// vocabulary invented for one dialog.
function SuccessMark() {
  const points = Array.from({ length: 24 }, (_, index) => {
    const radius = index % 2 === 0 ? 47 : 34;
    const angle = (index / 24) * Math.PI * 2 - Math.PI / 2;
    return `${(50 + radius * Math.cos(angle)).toFixed(2)},${(50 + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 100 100" className="size-24" aria-hidden>
      {/* Goes out from under the burst and is gone before the check lands. */}
      <circle
        cx="50"
        cy="50"
        r="26"
        fill="none"
        strokeWidth={3}
        stroke="var(--status-good)"
        className="origin-center motion-safe:animate-ripple"
      />
      <polygon
        points={points}
        // 18% of the status green: enough to read as a shape on the popover's
        // white, light enough that the stroked check on top of it stays the
        // thing you look at.
        fill="color-mix(in oklab, var(--status-good) 18%, transparent)"
        className="origin-center motion-safe:animate-burst"
      />
      {/* pathLength normalises both strokes to 100 units, so one dash pattern
          and one keyframe serve a circle and a polyline of quite different
          real lengths. Rotated so the ring closes from the top. */}
      <circle
        cx="50"
        cy="50"
        r="20"
        fill="none"
        strokeWidth={4}
        pathLength={100}
        strokeDasharray={100}
        transform="rotate(-90 50 50)"
        className="stroke-foreground motion-safe:animate-check-ring"
      />
      <path
        d="M41 50.5 L47.5 57 L59.5 44"
        fill="none"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={100}
        strokeDasharray={100}
        className="stroke-foreground motion-safe:animate-check-mark"
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
