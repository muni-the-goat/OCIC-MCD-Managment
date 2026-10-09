"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XIcon } from "lucide-react";
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
        {/* A round × on a phone, first in the bar, so Save draft and Submit
            keep one line between them; the word "Cancel", last, from sm up.
            The accessible name is "Cancel" at every width. */}
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          className="max-sm:order-first max-sm:size-11 max-sm:shrink-0 max-sm:bg-muted/70 max-sm:px-0"
        >
          <XIcon className="sm:hidden" aria-hidden />
          <span className="max-sm:sr-only">Cancel</span>
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
        {/* Keep editing is the filled button and Leave is the quiet red one.
            The other way round, the most prominent control on the screen was
            the one that throws work away — and a prominent button is the one
            people press without reading. */}
        {/* Keep editing comes first in the markup, so it is the button the
            dialog focuses on opening — Enter keeps the work. The footer's
            direction puts it on top on a phone and on the right above sm,
            where the primary action sits. */}
        <DialogFooter className="flex-col sm:flex-row-reverse sm:justify-start">
          <Button type="button" onClick={() => setOpen(false)}>
            Keep editing
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => router.push(href)}
          >
            Leave without saving
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
