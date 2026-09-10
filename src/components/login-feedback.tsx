"use client";

import { useEffect } from "react";
import { Dialog } from "radix-ui";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { safeNextPath } from "@/lib/login-rules";
import styles from "@/app/login/sign-in.module.css";

// Shown once the sign-in has actually succeeded, and only then.
//
// It began as a confirmation that waited 1.6 seconds before navigating. The
// wait was the problem: it is paid on every sign-in, forever, to say something
// the dashboard arriving says by itself. So the navigation starts immediately
// and this covers it — the reader sees the confirmation for exactly as long as
// the next page takes to load, which is honest feedback rather than a manufactured
// pause. It is the same job the full-screen overlay did before the redesign.
//
// Full document load, not router.push: the browser has to carry the auth
// cookies the Server Action just set through proxy.ts, and a soft navigation
// would not.
//
// An error never reaches this component. It is written under the field that
// caused it, where the person is already looking.
export function LoginFeedback({ next }: { next: string }) {
  // Sanitised on the way out of the action too. Repeated here because this is
  // the line that actually moves the browser, and a redirect target is worth
  // checking at the point of use.
  const destination = safeNextPath(next) ?? "/dashboard";

  useEffect(() => {
    window.location.replace(destination);
  }, [destination]);

  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.feedback}
          data-result="success"
          // Nothing here to act on, and the page is leaving.
          onCloseAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <div className={styles.resultMark} aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none">
              <path
                className={styles.markStroke}
                pathLength="1"
                d="m13 24 7.5 7.5L35 17"
              />
            </svg>
          </div>
          <div className={styles.feedbackCopy}>
            <Dialog.Title className={styles.feedbackTitle}>
              You&rsquo;re signed in
            </Dialog.Title>
            <Dialog.Description className={styles.feedbackDescription}>
              Welcome back. Opening your workspace&hellip;
            </Dialog.Description>
          </div>
          {/* A way through if the navigation is slow or something blocks it,
              rather than the only way through. */}
          <Button
            className={styles.feedbackButton}
            onClick={() => window.location.replace(destination)}
          >
            Continue
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
