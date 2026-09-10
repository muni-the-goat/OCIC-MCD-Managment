"use client";

import { useEffect } from "react";
import { Dialog } from "radix-ui";
import { ArrowRight } from "lucide-react";
import type { LoginResult } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { safeNextPath } from "@/lib/login-rules";
import styles from "@/app/login/sign-in.module.css";

export function LoginFeedback({
  result,
  open,
  onDismiss,
  onReturnFocus,
}: {
  result: LoginResult;
  open: boolean;
  onDismiss: () => void;
  onReturnFocus: () => void;
}) {
  const success = result.status === "success";
  const destination = success ? safeNextPath(result.next) ?? "/dashboard" : null;

  useEffect(() => {
    if (!open || !destination) return;
    // A short acknowledgement, with a direct Continue action for people who
    // don't want to wait. Full navigation reads the newly set auth cookies and
    // leaves role-specific routing to the existing dashboard guard.
    const timer = window.setTimeout(() => window.location.replace(destination), 1600);
    return () => window.clearTimeout(timer);
  }, [open, destination]);

  const continueOrDismiss = () => {
    if (destination) window.location.replace(destination);
    else onDismiss();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(value) => { if (!value) continueOrDismiss(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.feedback}
          data-result={success ? "success" : "error"}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!success) onReturnFocus();
          }}
        >
          <div className={styles.resultMark} aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none">
              {success ? (
                <path className={styles.markStroke} pathLength="1" d="m13 24 7.5 7.5L35 17" />
              ) : (
                <path className={styles.markStroke} pathLength="1" d="m16 16 16 16m0-16L16 32" />
              )}
            </svg>
          </div>
          <div className={styles.feedbackCopy}>
            <Dialog.Title className={styles.feedbackTitle}>
              {success ? "You’re signed in" : "Unable to sign in"}
            </Dialog.Title>
            <Dialog.Description className={styles.feedbackDescription}>
              {success ? "Welcome back. Opening your workspace…" : result.message}
            </Dialog.Description>
          </div>
          <Button className={styles.feedbackButton} onClick={continueOrDismiss}>
            {success ? "Continue" : "Try again"}
            {success ? <ArrowRight className="size-4" aria-hidden /> : null}
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
