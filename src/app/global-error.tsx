"use client";

import { useEffect } from "react";
import "./globals.css";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";

// The last resort: this fires only when the root layout itself fails, and it
// replaces that layout rather than rendering inside it. Three consequences,
// all of which shape what is written below.
//
//   1. It has to bring its own <html> and <body>.
//   2. It has to import globals.css itself, or the theme tokens every Button
//      and border reads are simply absent and the page renders unstyled.
//   3. The next/font variables live on the root layout's <html> className, so
//      they are gone here. Type falls back to the system sans. That is
//      accepted rather than worked around — re-declaring four fonts on the
//      screen nobody should ever see is weight in the bundle for no one.
//
// No metadata export is allowed in a global error, hence the <title> element.
export default function GlobalError({
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
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <title>Something went wrong · MCD Management</title>
        <main className="flex-1 p-4 md:p-8">
          <ErrorState
            title="MCD Management couldn't start"
            description="Something failed before the app could load. Try again — if it keeps happening, the app itself needs attention rather than anything you did."
            digest={error.digest}
            action={
              <Button onClick={() => unstable_retry()}>Try again</Button>
            }
          />
        </main>
      </body>
    </html>
  );
}
