"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ChevronRight, Trash2 } from "lucide-react";
import {
  bulkDeleteReports,
  type ActionState,
} from "@/app/(app)/reports/actions";
import { StatusBadge } from "@/components/status-badge";
import { ActionButton, ActionMessage } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ReportStatus } from "@/lib/types";

export interface ReportsTableItem {
  id: string;
  title: string;
  typeLabel: string;
  periodLabel: string;
  authorLabel: string;
  // Resolved on the server — departments are a table now, and this is a client
  // component. `hasAuthor` is separate because a null department and a missing
  // author row are different facts: one is unassigned, the other is unknown.
  departmentLabel: string | null;
  hasAuthor: boolean;
  status: ReportStatus;
  updatedLabel: string;
  // year * 100 + month, so groups sort newest period first whatever order the
  // rows arrived in.
  periodSort: number;
}

function DeleteSelectedButton({ count }: { count: number }) {
  const { pending } = useFormStatus();

  return (
    <ActionButton
      type="submit"
      variant="destructive"
      pending={pending}
      pendingLabel="Deleting…"
    >
      {`Delete ${count} ${count === 1 ? "report" : "reports"}`}
    </ActionButton>
  );
}

export function ReportsTable({
  reports,
  showAuthor,
  canBulkDelete,
}: {
  reports: ReportsTableItem[];
  showAuthor: boolean;
  canBulkDelete: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(
    bulkDeleteReports,
    null
  );
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectedIds = reports
    .filter((report) => selected.has(report.id))
    .map((report) => report.id);
  const selectedCount = selectedIds.length;
  const allSelected = reports.length > 0 && selectedCount === reports.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedCount > 0 && !allSelected;
    }
  }, [allSelected, selectedCount]);

  const toggleAll = () => {
    setSelected(
      allSelected ? new Set() : new Set(reports.map((report) => report.id))
    );
  };

  const toggleReport = (reportId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(reportId)) next.delete(reportId);
      else next.add(reportId);
      return next;
    });
  };

  // Grouped by the month a report covers, newest first, rows keeping the
  // server's most-recently-updated order inside each group. The table it
  // replaces repeated "September 2026" down a Period column on every row; as a
  // group heading it is said once, and the rows under it have room for the
  // title to be the biggest thing on the line.
  const groups: { label: string; sort: number; rows: ReportsTableItem[] }[] =
    [];
  for (const report of reports) {
    let group = groups.find((g) => g.label === report.periodLabel);
    if (!group) {
      group = { label: report.periodLabel, sort: report.periodSort, rows: [] };
      groups.push(group);
    }
    group.rows.push(report);
  }
  groups.sort((a, b) => b.sort - a.sort);

  return (
    <div className="space-y-6">
      {canBulkDelete ? (
        // A fixed-height bar so ticking the first box does not push the list
        // down under the pointer. Delete appears only once there is something
        // to delete: a red button sitting disabled on every visit was the
        // loudest thing on the page and did nothing.
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 px-1">
          <label className="type-callout flex min-h-11 cursor-pointer items-center gap-3 text-muted-foreground">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="size-[1.125rem] rounded border-border accent-primary"
            />
            <span aria-live="polite">
              {selectedCount === 0
                ? "Select all"
                : `${selectedCount} ${selectedCount === 1 ? "report" : "reports"} selected`}
            </span>
          </label>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            {selectedCount > 0 ? (
              <DialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="h-10 gap-2 rounded-full px-4"
                >
                  <Trash2 className="size-4" />
                  Delete selected
                </Button>
              </DialogTrigger>
            ) : null}
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Delete {selectedCount}{" "}
                  {selectedCount === 1 ? "report" : "reports"}?
                </DialogTitle>
                <DialogDescription>
                  The selected reports, their line items, comments, and
                  attachments will be permanently removed. This cannot be
                  undone.
                </DialogDescription>
              </DialogHeader>
              <ActionMessage error={state?.error} />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <form action={formAction}>
                  {selectedIds.map((reportId) => (
                    <input
                      key={reportId}
                      type="hidden"
                      name="report_ids"
                      value={reportId}
                    />
                  ))}
                  <DeleteSelectedButton count={selectedCount} />
                </form>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : null}

      {groups.map((group) => (
        <section key={group.label} aria-label={group.label} className="space-y-2">
          <h2 className="type-callout px-1 font-semibold text-muted-foreground">
            {group.label}
          </h2>
          <ul className="overflow-hidden rounded-[1.25rem] bg-card">
            {group.rows.map((report) => {
              const isSelected = selected.has(report.id);
              return (
                <li
                  key={report.id}
                  data-state={isSelected ? "selected" : undefined}
                  className="group relative flex min-h-[4.5rem] items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50 has-[a:focus-visible]:bg-muted/50 data-[state=selected]:bg-primary/[0.06] sm:px-5 [&+li]:border-t [&+li]:border-border/70"
                >
                  {canBulkDelete ? (
                    // Above the row's link overlay, so ticking a box selects
                    // the report rather than opening it.
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleReport(report.id)}
                      aria-label={`Select ${report.title}`}
                      className="relative z-10 size-[1.125rem] shrink-0 rounded border-border accent-primary"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    {/* The title's link covers the whole row through its
                        ::after, so the row is one target without nesting the
                        checkbox inside a link. */}
                    <Link
                      href={`/reports/${report.id}`}
                      // Two lines on a phone before the title is cut: there the
                      // row is narrow, and the end of a title is often the
                      // part that tells two reports apart.
                      className="type-headline line-clamp-2 outline-none after:absolute after:inset-0 after:content-[''] sm:line-clamp-none sm:truncate"
                    >
                      {report.title}
                    </Link>
                    {/* The department as words in the same line, not a tag:
                        a yellow chip on every row was a second colour fighting
                        the status pill for the eye, and said nothing the words
                        cannot. */}
                    <p className="type-callout mt-0.5 truncate text-muted-foreground">
                      {[
                        report.typeLabel,
                        showAuthor ? report.authorLabel : null,
                        showAuthor && report.hasAuthor
                          ? (report.departmentLabel ?? "Unassigned")
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <StatusBadge status={report.status} variant="pill" />
                  <span className="type-caption hidden w-20 shrink-0 text-right text-muted-foreground tabular-nums md:block">
                    {report.updatedLabel}
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="hidden size-5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none sm:block"
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
