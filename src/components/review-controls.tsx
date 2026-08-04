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
    <Card>
      <CardHeader>
        <CardTitle>Review</CardTitle>
        <CardDescription>
          {canMarkReviewed && canReject
            ? "Mark this report as reviewed, or reject it with feedback. The author can edit and resubmit a rejected report."
            : canMarkReviewed
              ? "Mark this report as reviewed. Only an Admin, Vice President or Head of Department can reject a report and send it back."
              : "Reject this report with feedback. The author can edit and resubmit it."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="report_id" value={reportId} />
          {canReject ? (
            <div className="space-y-2">
              <Label htmlFor="review-comment">
                Comment (required when rejecting)
              </Label>
              <Textarea
                id="review-comment"
                name="comment"
                rows={3}
                placeholder="Feedback for the author…"
              />
            </div>
          ) : null}
          <ActionMessage error={state?.error} />
          <div className="flex gap-3">
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
