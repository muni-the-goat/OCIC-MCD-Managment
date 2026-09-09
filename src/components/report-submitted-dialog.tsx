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
//
// The starburst is drawn rather than imported. Twelve points on two alternating
// radii is the whole shape, and a path this small does not need a library or a
// second visual vocabulary — it is the app's existing status green with the
// same check the Reviewed badge already carries.
function Starburst() {
  const points = Array.from({ length: 24 }, (_, index) => {
    const radius = index % 2 === 0 ? 47 : 34;
    const angle = (index / 24) * Math.PI * 2 - Math.PI / 2;
    return `${(50 + radius * Math.cos(angle)).toFixed(2)},${(50 + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 100 100" className="size-24" aria-hidden>
      <polygon
        points={points}
        // 18% of the status green: enough to read as a shape on the popover's
        // white, light enough that the stroked check on top of it stays the
        // thing you look at.
        fill="color-mix(in oklab, var(--status-good) 18%, transparent)"
        className="motion-safe:animate-burst origin-center"
      />
      <circle
        cx="50"
        cy="50"
        r="20"
        fill="none"
        strokeWidth={4}
        className="stroke-foreground"
      />
      <path
        d="M41 50.5 L47.5 57 L59.5 44"
        fill="none"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-foreground"
      />
    </svg>
  );
}

export function ReportSubmittedDialog() {
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
      <DialogContent className="text-center sm:max-w-sm">
        <DialogHeader className="items-center gap-1">
          <Starburst />
          <DialogTitle className="text-xl">
            Yaaayyy, your report is submitted for review!
          </DialogTitle>
          <DialogDescription>
            {/* The part nobody was told before: submitting is a one-way door.
                can_edit_report() drops the author at 'submitted', so the Edit
                button they had a second ago is gone, and finding that out by
                looking for it is a worse way to learn it. */}
            It&apos;s waiting on a decision now, and can&apos;t be edited until
            there is one. You&apos;ll see it move on your dashboard.
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
