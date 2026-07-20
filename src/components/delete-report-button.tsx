"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteReport } from "@/app/(app)/reports/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DeleteReportButton({ reportId }: { reportId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-destructive">
          <Trash2 className="size-4" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this report?</DialogTitle>
          <DialogDescription>
            The report, its line items, comments, and attachments will be
            permanently removed. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <form action={deleteReport}>
            <input type="hidden" name="report_id" value={reportId} />
            <Button type="submit" variant="destructive">
              Delete report
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
