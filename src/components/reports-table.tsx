"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import {
  bulkDeleteReports,
  type ActionState,
} from "@/app/(app)/reports/actions";
import { DepartmentBadge } from "@/components/department-badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  return (
    <div className="space-y-3">
      {canBulkDelete ? (
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {selectedCount === 0
              ? "Select reports to delete multiple records at once."
              : `${selectedCount} ${selectedCount === 1 ? "report" : "reports"} selected`}
          </p>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={selectedCount === 0}
                className="gap-2"
              >
                <Trash2 className="size-4" />
                Delete selected
              </Button>
            </DialogTrigger>
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

      {/* A pane rather than a table that grows the page.

          The horizontal scrollbar belongs to the scroll box, so capping its
          height keeps the bar on screen instead of stranding it below every
          row — this list runs to 200 reports, and reaching the bar meant
          scrolling past all of them first. max-h rather than h, so a short
          list still takes only the room it needs.

          The scrolling moved onto the Table's own container, which already
          existed; this div keeps the border and clips the corners it rounds. */}
      <div className="overflow-hidden rounded-lg border">
        <Table containerClassName="max-h-[70vh] overflow-y-auto">
          <caption className="sr-only">Office reports</caption>
          {/* Sticky per cell rather than on the row: a sticky thead under
              border-collapse is not reliable across browsers. The underline is
              an inset shadow for the same reason — a bottom border on a sticky
              cell scrolls away from it. The background is the page's own, so
              the header turns opaque without changing colour. */}
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-background [&_th]:shadow-[inset_0_-1px_0_var(--border)]">
            <TableRow>
              {canBulkDelete ? (
                <TableHead className="w-10">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all visible reports"
                    className="size-4 rounded border-border accent-primary"
                  />
                </TableHead>
              ) : null}
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Period</TableHead>
              {showAuthor ? (
                <>
                  <TableHead>Author</TableHead>
                  <TableHead>Department</TableHead>
                </>
              ) : null}
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((report) => {
              const isSelected = selected.has(report.id);
              return (
                <TableRow
                  key={report.id}
                  data-state={isSelected ? "selected" : undefined}
                >
                  {canBulkDelete ? (
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleReport(report.id)}
                        aria-label={`Select ${report.title}`}
                        className="size-4 rounded border-border accent-primary"
                      />
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <Link
                      href={`/reports/${report.id}`}
                      className="font-medium hover:underline"
                    >
                      {report.title}
                    </Link>
                  </TableCell>
                  <TableCell>{report.typeLabel}</TableCell>
                  <TableCell>{report.periodLabel}</TableCell>
                  {showAuthor ? (
                    <>
                      <TableCell>{report.authorLabel}</TableCell>
                      <TableCell>
                        {report.hasAuthor ? (
                          <DepartmentBadge label={report.departmentLabel} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </>
                  ) : null}
                  <TableCell>
                    <StatusBadge status={report.status} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {report.updatedLabel}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
