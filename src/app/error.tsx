"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";

// Covers the routes that sit outside the signed-in shell — the landing redirect
// and /login. (app)/error.tsx handles everything behind authentication, and
// catches first because it is the nearer boundary.
//
// The recovery link points at /login, not /dashboard: if this fired, the most
// likely reader is someone who could not get in, and sending them to a page
// that will bounce them straight back to the login screen is a loop.
export default function RootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex-1 p-4 md:p-8">
      <ErrorState
        title="Something went wrong"
        description="This page didn't load. Try again, and if it keeps happening, send the reference below to whoever maintains this app."
        digest={error.digest}
        action={
          <>
            <Button onClick={() => unstable_retry()}>Try again</Button>
            <Button asChild variant="ghost">
              <Link href="/login">Go to sign in</Link>
            </Button>
          </>
        }
      />
    </main>
  );
}
