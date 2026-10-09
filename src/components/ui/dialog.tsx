"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  // When the trigger wraps one of our Buttons, the Button keeps its own
  // data-slot="button". Slot merging let the trigger's "dialog-trigger"
  // overwrite it, so every container that styles its buttons by slot — the
  // report page's actions, the form's bar, the Users header — silently missed
  // Delete, Cancel, Invite and every other button that opens a dialog.
  //
  // Left out rather than set to undefined: Button spreads its props after its
  // own data-slot, so an undefined key would still erase "button".
  const slot = props.asChild ? {} : { "data-slot": "dialog-trigger" }
  return <DialogPrimitive.Trigger {...slot} {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/25 duration-200 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        // A sheet on a phone, a card on anything wider. On a phone the dialog
        // rises from the bottom edge, where the thumb already is, and its
        // buttons stack full width; above sm it sits centred and its buttons
        // line up on the right. Rounded and borderless like the pages behind
        // it, lifted by shadow rather than a ring. Sized type to match them:
        // the 14px dialog under a 44px page title read as a footnote.
        className={cn(
          "fixed left-1/2 z-50 grid w-[calc(100%-1.5rem)] -translate-x-1/2 gap-5 rounded-[1.75rem] bg-card p-6 text-[0.9375rem] text-card-foreground shadow-[0_24px_80px_rgba(0,0,0,0.18)] outline-none",
          "bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] duration-200 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-8 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-8",
          "sm:top-1/2 sm:bottom-auto sm:max-w-md sm:-translate-y-1/2 sm:p-7 sm:data-open:slide-in-from-bottom-0 sm:data-open:zoom-in-95 sm:data-closed:slide-out-to-bottom-0 sm:data-closed:zoom-out-95",
          "motion-reduce:data-open:slide-in-from-bottom-0 motion-reduce:data-closed:slide-out-to-bottom-0 motion-reduce:sm:data-open:zoom-in-100 motion-reduce:sm:data-closed:zoom-out-100",
          // The footer's buttons, whichever dialog this is: the pages' pill.
          "[&_[data-slot=dialog-footer]_[data-slot=button]]:h-11 [&_[data-slot=dialog-footer]_[data-slot=button]]:rounded-full [&_[data-slot=dialog-footer]_[data-slot=button]]:px-5 [&_[data-slot=dialog-footer]_[data-slot=button]]:text-[0.9375rem] [&_[data-slot=dialog-footer]_[data-slot=button]]:font-semibold",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-4 right-4 size-9 rounded-full bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground sm:top-5 sm:right-5"
              size="icon-sm"
            >
              <XIcon
              />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      // Clear of the close button, which sits in the top-right corner.
      className={cn(
        "pr-10 font-heading text-[1.25rem] leading-tight font-semibold tracking-[-0.012em]",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-[0.9375rem] leading-[1.45] text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
