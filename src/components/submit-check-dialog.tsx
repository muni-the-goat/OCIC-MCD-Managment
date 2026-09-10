"use client";

import { useState } from "react";
import { AlertTriangle, CalendarDays } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SubmitCheck } from "@/lib/submit-check";

// The step between pressing Submit and the report going in.
//
// It is not an "are you sure?" — those get clicked through, and a confirmation
// that could have been written before the form was filled in teaches people to
// stop reading. This one can only be written afterwards: it reads back the
// month the report will be filed under and the figure that will land there, so
// the check is against what was actually chosen.
//
// Leading with the month is the point. See src/lib/submit-check.ts for the
// report that went into the wrong one.

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
      <AlertTriangle className="mt-px size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function SubmitCheckDialog({
  summarise,
  onConfirm,
  pending,
  disabled,
}: {
  // Read at the moment of pressing, not on every render: the month, the title
  // and every figure can change right up until then.
  summarise: () => SubmitCheck;
  onConfirm: () => void;
  pending: boolean;
  disabled: boolean;
}) {
  const [check, setCheck] = useState<SubmitCheck | null>(null);

  return (
    <>
      <ActionButton
        type="button"
        pending={pending}
        pendingLabel="Submitting…"
        disabled={disabled}
        onClick={() => setCheck(summarise())}
      >
        Submit for review
      </ActionButton>

      <Dialog
        open={check !== null}
        onOpenChange={(next) => {
          if (!next) setCheck(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {check ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">
                  Check the month before this goes in
                </DialogTitle>
                <DialogDescription>
                  A report is filed under the month you picked, not the month in
                  its title. This is what will be recorded.
                </DialogDescription>
              </DialogHeader>

              {/* The month is the whole reason this dialog exists, so it is set
                  out on its own rather than as one row among equals. */}
              <div className="rounded-lg border bg-muted/40 p-4 text-center">
                <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="size-3.5" aria-hidden />
                  Filed under
                </p>
                <p className="mt-1 font-heading text-2xl font-semibold tracking-tight">
                  {check.period}
                </p>
              </div>

              <div className="divide-y rounded-lg border px-3">
                <Row label="Report" value={check.kind} />
                <Row
                  label="Title"
                  value={
                    check.title || (
                      <span className="text-muted-foreground">Untitled</span>
                    )
                  }
                />
                {check.amount ? (
                  <Row label="Total for the month" value={check.amount} />
                ) : null}
              </div>

              {check.duplicate ? (
                <Warning>
                  You already have a report filed under {check.period} —{" "}
                  <strong className="font-medium">
                    {check.duplicate.title || "Untitled"}
                  </strong>
                  . Two reports on the same month are both counted, so check
                  this is the month you meant.
                </Warning>
              ) : null}

              {check.empty ? (
                <Warning>
                  Every figure in this report is zero. If that is not right, go
                  back and check the month you are filling in.
                </Warning>
              ) : null}

              {check.locked ? (
                <p className="text-xs text-muted-foreground">
                  Once submitted you cannot edit it until it has been reviewed.
                </p>
              ) : null}

              <DialogFooter className="flex-col sm:flex-col">
                <Button
                  className="w-full"
                  onClick={() => {
                    setCheck(null);
                    onConfirm();
                  }}
                >
                  Yes, submit it
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setCheck(null)}
                >
                  Go back and check
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
