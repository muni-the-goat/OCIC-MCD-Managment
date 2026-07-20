"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { reviewReport, type ActionState } from "@/app/(app)/reports/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ReviewControls({ reportId }: { reportId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    reviewReport,
    null
  );
  const lastError = useRef<string | null>(null);

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
          Mark this report as reviewed, or reject it with a comment explaining
          what needs to change. The author can edit and resubmit a rejected
          report.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="report_id" value={reportId} />
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
          <div className="flex gap-3">
            <Button
              type="submit"
              name="decision"
              value="reviewed"
              disabled={pending}
            >
              Mark as reviewed
            </Button>
            <Button
              type="submit"
              name="decision"
              value="rejected"
              variant="destructive"
              disabled={pending}
            >
              Reject
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
