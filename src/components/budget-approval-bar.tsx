"use client";

import { useActionState, useCallback, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  setBudgetApproval,
  type BudgetApprovalState,
} from "@/app/(app)/dashboard/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToasts } from "@/components/use-action-toasts";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

// The workbook's top line — "Budget Approval: $150,000.00" — plus the rollup it
// exists to support. Spend against an approved figure is the question the
// percentage column answers, so the denominator is stated rather than left to
// be inferred from a column header.
export function BudgetApprovalBar({
  year,
  approval,
  spent,
  canEdit,
}: {
  year: number;
  approval: number | null;
  spent: number;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    BudgetApprovalState,
    FormData
  >(setBudgetApproval, null);
  useActionToasts(
    state as never,
    useCallback((result: { success: string }) => {
      toast.success(result.success);
      setOpen(false);
    }, [])
  );

  const share = approval && approval > 0 ? (spent / approval) * 100 : null;
  const remaining = approval === null ? null : approval - spent;

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 rounded-lg border bg-muted/30 px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Budget approval · FY {year}
        </span>
        <span className="font-heading text-lg font-semibold tabular-nums">
          {approval === null ? "Not set" : currency.format(approval)}
        </span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {approval === null ? (
          <span>
            Set it to measure spend against the approved figure instead of
            against the year&apos;s own total.
          </span>
        ) : (
          <>
            <span className="tabular-nums">
              {currency.format(spent)} spent
              {share === null ? "" : ` · ${share.toFixed(2)}%`}
            </span>
            {/* Overspend is a fact worth stating plainly rather than as a
                negative "remaining", which reads as a rendering fault. */}
            <span className="tabular-nums">
              {remaining !== null && remaining < 0
                ? `${currency.format(Math.abs(remaining))} over`
                : `${currency.format(remaining ?? 0)} remaining`}
            </span>
          </>
        )}
        {canEdit ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Pencil className="size-3.5" />
                {approval === null ? "Set" : "Edit"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Approved budget · FY {year}</DialogTitle>
                <DialogDescription>
                  The figure every month is measured against on this card. It is
                  stored per year, so setting it here does not affect any other
                  fiscal year.
                </DialogDescription>
              </DialogHeader>
              <form action={formAction} className="space-y-4">
                {state && "error" in state ? (
                  <Alert variant="destructive">
                    <AlertDescription>{state.error}</AlertDescription>
                  </Alert>
                ) : null}
                <input type="hidden" name="year" value={year} />
                <div className="space-y-2">
                  <Label htmlFor="budget-approval-amount">
                    Approved amount
                  </Label>
                  <Input
                    id="budget-approval-amount"
                    name="amount"
                    inputMode="decimal"
                    defaultValue={approval === null ? "" : String(approval)}
                    placeholder="150000.00"
                    autoComplete="off"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Currency symbols and thousands separators are fine —
                    $150,000.00 works.
                  </p>
                </div>
                <Button type="submit" disabled={pending} className="w-full">
                  {pending ? "Saving…" : "Save approved budget"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </div>
  );
}
