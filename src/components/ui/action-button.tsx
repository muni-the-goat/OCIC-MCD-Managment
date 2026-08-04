"use client";

import * as React from "react";
import { Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// A submit button that reports the three states a server action actually has:
// what it's doing, that it worked, and — by returning to idle rather than
// locking — that you may try again.
//
// Why the completion state lives here and not only in a toast: feedback has to
// be attributable to what caused it. A confirmation that appears in the far
// corner of the screen makes you look away from the control you just used to
// find out what it did. The toast is still worth keeping for the wording; the
// checkmark on the button is what answers "did that work" without moving your
// eyes.
//
// Errors deliberately do *not* land on the button. A button stuck in a red
// state is a button you cannot retry with, and the message never fits in a
// label anyway — those go to <ActionMessage> beneath the control, where there
// is room to say what went wrong.
export function ActionButton({
  pending,
  success,
  pendingLabel,
  successLabel = "Done",
  children,
  className,
  disabled,
  ...props
}: React.ComponentProps<typeof Button> & {
  pending?: boolean;
  success?: boolean;
  // Present tense — this is shown while the work is happening.
  pendingLabel: string;
  successLabel?: string;
}) {
  const state = pending ? "pending" : success ? "success" : "idle";
  const label =
    state === "pending"
      ? pendingLabel
      : state === "success"
        ? successLabel
        : children;

  return (
    <Button
      {...props}
      // Still clickable in the success state — the work is finished, and
      // disabling a control because it recently worked is a small betrayal of
      // the person who wants to do it twice.
      disabled={disabled || pending}
      data-state={state}
      className={cn(
        // The tint is the same green the reviewed status badge uses, so
        // "this succeeded" is one colour across the whole application.
        state === "success" &&
          "border-status-good/30 bg-status-good/10 text-status-good hover:bg-status-good/10",
        className
      )}
      {...(state === "pending" ? { "aria-busy": true } : {})}
    >
      {/* A fixed slot, so the label does not slide sideways when an icon
          arrives or leaves. Motion that isn't telling you anything is just
          motion. */}
      {state !== "idle" ? (
        <span className="relative grid size-4 shrink-0 place-items-center">
          {state === "pending" ? (
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <Check className="size-4 animate-check-in" />
          )}
        </span>
      ) : null}
      {/* Announced to screen readers as it changes, since the visual swap is
          the only signal a sighted user gets. */}
      <span aria-live="polite">{label}</span>
    </Button>
  );
}

// The other half of the pair: the message the button refuses to carry. Sits
// directly beneath the control it belongs to, because a message about a
// control that isn't near the control is a puzzle.
export function ActionMessage({
  error,
  success,
  className,
}: {
  error?: string | null;
  success?: string | null;
  className?: string;
}) {
  const message = error ?? success;
  if (!message) return null;

  return (
    <p
      role={error ? "alert" : "status"}
      className={cn(
        "animate-message-in text-sm motion-reduce:animate-none",
        error ? "text-destructive" : "text-status-good",
        className
      )}
    >
      {message}
    </p>
  );
}
