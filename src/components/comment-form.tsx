"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { addComment, type ActionState } from "@/app/(app)/reports/actions";
import { ActionButton } from "@/components/ui/action-button";
import { Textarea } from "@/components/ui/textarea";

export function CommentForm({ reportId }: { reportId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    (prev, formData) => {
      const result = addComment(prev, formData);
      result.then((r) => {
        if (r === null) formRef.current?.reset();
      });
      return result;
    },
    null
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="report_id" value={reportId} />
      <Textarea
        name="body"
        rows={2}
        required
        maxLength={4000}
        placeholder="Add a comment…"
      />
      {/* Pending only, no checkmark: the comment appearing in the thread above
          and the box emptying are the completion signal, and they say it
          better than a button could. */}
      <ActionButton
        type="submit"
        size="sm"
        pending={pending}
        pendingLabel="Posting…"
      >
        Post comment
      </ActionButton>
    </form>
  );
}
