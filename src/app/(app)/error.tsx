"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";

// Catches anything thrown while rendering a signed-in page — Dashboard,
// Reports, a report detail, Users. It sits inside (app)/layout.tsx, so the
// sidebar, the header and the user's own name stay on screen: the app is still
// there, one page inside it failed.
//
// `unstable_retry` rather than `reset`. Next 16.2 added it and the docs are
// explicit that it is what you want in almost every case — `reset` only clears
// the boundary and re-renders the same failed data, which for a page whose
// error came from a Supabase query means failing again immediately.
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // The digest is all the client is given in production; the message lives in
    // the server logs. Logging here is what puts the two in the same place when
    // someone reports it from their own browser console.
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Something went wrong"
      description="This page didn't load. It's usually temporary — try again, and if it keeps happening, send the reference below to whoever maintains this app."
      digest={error.digest}
      action={
        <>
          <Button onClick={() => unstable_retry()}>Try again</Button>
          <Button asChild variant="ghost">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </>
      }
    />
  );
}
