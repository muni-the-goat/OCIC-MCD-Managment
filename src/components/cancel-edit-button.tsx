"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

// The way out of the report form.
//
// Without one the only exits were the two submit buttons and the browser's back
// arrow, which on a form someone opened by mistake — on a *submitted* report,
// where saving clears the review status — is not much of a choice.
//
// It asks first, and always, rather than only when something has been typed.
// Tracking whether the form is dirty would mean watching six editors, a file
// picker and a budget grid, and a dirty check that misses one of them discards
// work silently, which is a worse failure than one extra click. The wording is
// written to be true either way: someone who changed nothing is told nothing
// will be saved, which is exactly right.
export function CancelEditButton({
  href,
  disabled,
}: {
  // Where leaving goes: the report being edited, or the list for a new one.
  href: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {/* A <button> inside a <form> submits by default, and this one sits
            inside the report form. Without the explicit type, Cancel would
            file the report. */}
        <Button type="button" variant="ghost" disabled={disabled}>
          Cancel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave without saving?</DialogTitle>
          <DialogDescription>
            Anything you have changed here will not be saved. The report itself
            stays exactly as it is, including its review status.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Keep editing
          </Button>
          <Button type="button" onClick={() => router.push(href)}>
            Leave without saving
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
