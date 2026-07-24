"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteAttachment } from "@/app/(app)/reports/actions";
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

export function DeleteAttachmentButton({
  attachmentId,
  reportId,
  fileName,
}: {
  attachmentId: string;
  reportId: string;
  fileName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive"
          aria-label={`Delete ${fileName}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this attachment?</DialogTitle>
          <DialogDescription>
            {fileName} will be permanently removed from this report. This cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <form action={deleteAttachment}>
            <input type="hidden" name="attachment_id" value={attachmentId} />
            <input type="hidden" name="report_id" value={reportId} />
            <Button type="submit" variant="destructive">
              Delete attachment
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
