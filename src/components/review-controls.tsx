"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { reviewReport, type ActionState } from "@/app/(app)/reports/actions";
import { ActionButton, ActionMessage } from "@/components/ui/action-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ReviewControls({
  reportId,
  canMarkReviewed,
  canReject,
}: {
  reportId: string;
  canMarkReviewed: boolean;
  canReject: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    reviewReport,
    null
  );
  const lastError = useRef<string | null>(null);
  // Both buttons submit the same form, so `pending` is true for whichever was
  // pressed — spinning both would say the app is doing two contradictory things
  // at once. Recording the decision on the way down makes the feedback point
  // back at the button that caused it.
  //
  // Nothing clears this on failure and nothing needs to: the spinner is gated
  // on `pending && submitted === …`, so a refused decision drops both buttons
  // back to rest on its own and the next click overwrites the value.
  const [submitted, setSubmitted] = useState<"reviewed" | "rejected" | null>(
    null
  );

  useEffect(() => {
    if (state?.error && state.error !== lastError.current) {
      lastError.current = state.error;
      toast.error(state.error);
    }
  }, [state]);

  return (
    // Ringed in the Awaiting review amber: this is the one card on the page
    // that asks something of the reader, and it now sits at the top, so it has
    // to read as a request rather than as more of the report.
    <Card className="rounded-[1.25rem] shadow-none ring-2 ring-status-warning/60">
      <CardHeader>
        <CardTitle className="type-headline">
          Waiting for your decision
        </CardTitle>
        <CardDescription className="type-callout">
          {/* Named roles have been wrong in this sentence twice: it credited a
              Vice President after 0019 took the marketing side away from them,
              and it would have excluded a Coordinator after 0030. It says what
              the reader can do instead of who else can do it. */}
          {canMarkReviewed && canReject
            ? "Read the report below, then mark it as reviewed or send it back with feedback. A rejected report goes back to its author to edit and resubmit."
            : canMarkReviewed
              ? "Read the report below, then mark it as reviewed. Sending it back with feedback is not available to you."
              : "Read the report below. If it needs changes, send it back with feedback for the author to edit and resubmit."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="report_id" value={reportId} />
          {canReject ? (
            <div className="space-y-2">
              <Label htmlFor="review-comment" className="block leading-snug">
                Feedback for the author{" "}
                <span className="font-normal text-muted-foreground">
                  (needed to reject)
                </span>
              </Label>
              <Textarea
                id="review-comment"
                name="comment"
                rows={3}
                className="rounded-xl text-base"
                placeholder="What needs to change…"
              />
            </div>
          ) : null}
          <ActionMessage error={state?.error} />
          {/* Pills at the page's button size. Reject stays the quiet tinted
              red and never the filled one — the filled button is the one
              people press without reading. */}
          <div className="flex flex-wrap gap-3 [&_[data-slot=button]]:h-11 [&_[data-slot=button]]:rounded-full [&_[data-slot=button]]:px-5 [&_[data-slot=button]]:text-[0.9375rem] [&_[data-slot=button]]:font-semibold">
            {canMarkReviewed ? (
              <ActionButton
                type="submit"
                name="decision"
                value="reviewed"
                pending={pending && submitted === "reviewed"}
                pendingLabel="Approving…"
                disabled={pending}
                onClick={() => setSubmitted("reviewed")}
              >
                Mark as reviewed
              </ActionButton>
            ) : null}
            {canReject ? (
              <ActionButton
                type="submit"
                name="decision"
                value="rejected"
                variant="destructive"
                pending={pending && submitted === "rejected"}
                pendingLabel="Rejecting…"
                disabled={pending}
                onClick={() => setSubmitted("rejected")}
              >
                Reject
              </ActionButton>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
