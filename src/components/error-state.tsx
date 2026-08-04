import Link from "next/link";
import { AlertTriangle, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

// The shared body of every failure screen: the two error boundaries, the two
// not-found pages. One component so an office administrator meets the same
// shape whichever way the app breaks, rather than four differently-worded dead
// ends written months apart.
//
// Deliberately borrows the dashboard's empty-state language — dashed border,
// icon in a muted circle, centred — because "nothing here" and "something
// broke" are neighbours, and inventing a second visual vocabulary for the
// rarer one would make the rarer one look like a different application.
export function ErrorState({
  icon = "error",
  title,
  description,
  digest,
  action,
}: {
  icon?: "error" | "missing";
  title: string;
  description: string;
  // The server-side error id. Shown only when Next.js provides one, because it
  // is the only thread between what the user saw and what the logs recorded —
  // "it broke" is unactionable, "it broke, reference 4f2a9c" is a lookup.
  digest?: string;
  action: React.ReactNode;
}) {
  const Icon = icon === "missing" ? FileQuestion : AlertTriangle;

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-10 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-6" />
        </span>
        <div className="space-y-1.5">
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {action}
        </div>
        {digest ? (
          <p className="font-mono text-xs text-muted-foreground">
            Reference {digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// Both not-found pages want the same pair of buttons; the error boundaries do
// not, because theirs carries a retry callback that only they can supply.
export function BackLinks() {
  return (
    <>
      <Button asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
      <Button asChild variant="ghost">
        <Link href="/reports">All reports</Link>
      </Button>
    </>
  );
}
