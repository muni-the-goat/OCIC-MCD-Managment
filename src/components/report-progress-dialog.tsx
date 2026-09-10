"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CheckCircle2, Undo2 } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  summaryCopy,
  type ReportProgress,
} from "@/lib/report-progress";
import { reportPeriodLabel, reportTypeLabel } from "@/lib/types";

// What happened to your reports while you were away, said once, on arrival.
//
// The three places that already carry a decision — the Rejected stat card, the
// red badge in the list, the banner on the report itself — all require the
// author to go and look. Nothing reaches somebody who signs in and reads their
// dashboard, which is most people most mornings. This is that one push, and it
// is deliberately not a notification system: there is no bell, no feed, no
// read/unread table. The dashboard already knows the answer, so the only thing
// missing was saying it unprompted.

const STORAGE_KEY = "mcd:report-progress-seen";

// Nothing in this tab writes the key behind our back, so there is nothing to
// subscribe to. The hook still wants a subscribe function, and an empty one is
// the honest answer rather than a stub around a `storage` event that only fires
// for *other* tabs.
const subscribe = () => () => {};

// Distinct from both null (storage read, nothing dismissed) and any digest.
// Rendering under it means "not known yet", which is the truth on the server
// and during hydration, and it keeps the summary shut until the real answer
// arrives — a dialog that mounts open and then discovers it was dismissed is a
// flash on every page of every visit after the first.
const UNKNOWN = "\u0000unknown";

function readSeen() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // A private window throws here rather than returning null. No memory of a
    // dismissal means the summary shows once per page load, which is worse than
    // once per visit and much better than a blank dashboard.
    return null;
  }
}

// A digest of what was shown, not a flag that something was. Two consequences,
// both wanted: navigating around the app inside one visit does not reopen it,
// and a decision that lands while the tab is still open *does* — because the
// list it describes is no longer the list that was dismissed.
function digestOf(updates: ReportProgress[]) {
  return updates.map((row) => `${row.id}:${row.status}`).join("|");
}

export function ReportProgressDialog({
  updates,
}: {
  updates: ReportProgress[];
}) {
  const digest = digestOf(updates);
  const [dismissed, setDismissed] = useState(false);

  // sessionStorage is an external store, and this is the hook for reading one
  // during render. The two obvious alternatives are both wrong: opening from an
  // effect is the cascading render that react-hooks/set-state-in-effect exists
  // to refuse, and reading storage in a lazy useState initialiser would have the
  // server and the first client render disagree. React re-renders on its own
  // once the client snapshot turns out to differ from the server's.
  const seen = useSyncExternalStore(subscribe, readSeen, () => UNKNOWN);

  const open =
    updates.length > 0 && seen !== UNKNOWN && seen !== digest && !dismissed;

  // Called by the buttons that navigate as well as the ones that close. A link
  // out of here unmounts the dialog without closing it, so without this the
  // summary would be waiting again the moment they came back.
  const remember = () => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, digest);
    } catch {
      // As above.
    }
  };

  const close = () => {
    setDismissed(true);
    remember();
  };

  if (updates.length === 0) return null;

  const sentBack = updates.filter((row) => row.status === "rejected");
  const { tone, title, description } = summaryCopy(updates);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span
            className={
              tone === "sent-back"
                ? "mb-1 grid size-11 place-items-center rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                : "mb-1 grid size-11 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            }
            aria-hidden
          >
            {tone === "sent-back" ? (
              <Undo2 className="size-5" />
            ) : (
              <CheckCircle2 className="size-5" />
            )}
          </span>
          {/* The primitive inherits body size, which left the heading and the
              sentence under it looking like two sentences. */}
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ul className="divide-y overflow-hidden rounded-lg border">
          {updates.map((row) => (
            <li key={row.id}>
              <Link
                href={`/reports/${row.id}`}
                onClick={remember}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/60"
              >
                <div className="min-w-0 flex-1">
                  {/* The badge sits on the title's line rather than beside the
                      whole row. Down there it took 80px off every line of the
                      meta beneath it, which wrapped the reviewer's name onto a
                      second line in every row. Up here the meta gets the full
                      width and fits. */}
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{row.title}</p>
                    <span className="shrink-0">
                      <StatusBadge status={row.status} />
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {reportTypeLabel(row.type, row.budgetPeriod)} ·{" "}
                    {reportPeriodLabel(
                      row.type,
                      row.month,
                      row.year,
                      row.budgetPeriod
                    )}{" "}
                    · {row.status === "rejected" ? "sent back" : "approved"} by{" "}
                    {row.decidedBy}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <DialogFooter className="flex-col sm:flex-col">
          {sentBack.length === 1 ? (
            <Button asChild onClick={remember} className="w-full">
              <Link href={`/reports/${sentBack[0].id}`}>Open the report</Link>
            </Button>
          ) : sentBack.length > 1 ? (
            <Button asChild onClick={remember} className="w-full">
              <Link href="/reports?status=rejected">See the reports</Link>
            </Button>
          ) : null}
          <Button
            variant={sentBack.length ? "ghost" : "default"}
            onClick={close}
            className="w-full"
          >
            {sentBack.length ? "Later" : "Got it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
