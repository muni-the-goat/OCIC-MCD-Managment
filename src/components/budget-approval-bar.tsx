"use client";

import { useActionState, useCallback, useState } from "react";
import { AlertTriangle, Pencil } from "lucide-react";
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

// Spend crosses into "watch this" here. One constant so the ring's tick, the
// arc's colour and the banner's wording can never disagree about where the line
// is.
const WARN_AT = 80;

type Tone = "good" | "warning" | "critical";

// Status colours, not the categorical --series-N palette. Budget consumption is
// a state against a limit, not an identity, and painting it with series hues
// would say "spent" and "remaining" are two peer categories. They are not: one
// is a measure, the other is what is left of its limit.
const TONE_COLOR: Record<Tone, string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  critical: "var(--status-critical)",
};

function toneFor(percent: number): Tone {
  if (percent > 100) return "critical";
  if (percent >= WARN_AT) return "warning";
  return "good";
}

// A meter, not a two-slice pie. The unspent portion is a recessive track in the
// surface's own ramp rather than a second coloured segment, so the reader is
// comparing one arc against a limit instead of judging two wedges by area. The
// figure in the hole carries the value as text — which is what lets the warning
// arc be used at all: it sits at 1.83:1 on the light card, below the 3:1 a mark
// needs to carry meaning on its own.
function BudgetMeter({ percent, tone }: { percent: number; tone: Tone }) {
  const filled = Math.min(percent, 100);
  // Past the limit the ring is full and the overage is stated in words. An arc
  // that laps itself reads as a smaller number than it is.
  const angle = ((WARN_AT / 100) * 360 - 90) * (Math.PI / 180);
  const tick = {
    x1: 50 + 35 * Math.cos(angle),
    y1: 50 + 35 * Math.sin(angle),
    x2: 50 + 49 * Math.cos(angle),
    y2: 50 + 49 * Math.sin(angle),
  };

  return (
    <svg
      viewBox="0 0 100 100"
      className="size-20 shrink-0"
      role="img"
      aria-label={`${percent.toFixed(1)}% of the approved budget spent`}
    >
      <circle
        cx="50"
        cy="50"
        r="42"
        fill="none"
        strokeWidth={9}
        className="stroke-foreground/10"
      />
      {/* Where the warning begins, drawn on the track so the threshold is a
          visible line rather than a rule stated only in prose. */}
      <line
        {...tick}
        strokeWidth={2}
        strokeLinecap="round"
        className="stroke-foreground/25"
      />
      {filled > 0 ? (
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={TONE_COLOR[tone]}
          strokeWidth={9}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${filled} 100`}
          transform="rotate(-90 50 50)"
        />
      ) : null}
      <text
        x="50"
        y="56"
        textAnchor="middle"
        className="fill-foreground font-heading text-[22px] font-semibold tabular-nums"
      >
        {Math.round(percent)}%
      </text>
    </svg>
  );
}

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
  const tone = share === null ? "good" : toneFor(share);
  const alert = share !== null && share >= WARN_AT;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-center gap-4">
          {approval !== null && share !== null ? (
            <BudgetMeter percent={share} tone={tone} />
          ) : null}
          <div className="space-y-0.5">
            <p className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Budget approval · FY {year}
            </p>
            <p className="font-heading text-xl font-semibold tabular-nums">
              {approval === null ? "Not set" : currency.format(approval)}
            </p>
            {approval === null ? (
              // Two audiences, two sentences. Telling someone to set a figure
              // they have no control over is worse than saying nothing.
              <p className="max-w-md text-sm text-muted-foreground">
                {canEdit
                  ? "Set it to measure spend against the approved figure instead of against the year's own total."
                  : "The Head of Department has not set one yet, so spend is measured against the year's own total."}
              </p>
            ) : (
              <p className="text-sm tabular-nums text-muted-foreground">
                {currency.format(spent)} spent ·{" "}
                {/* Overspend is a fact worth stating plainly rather than as a
                    negative "remaining", which reads as a rendering fault. */}
                {remaining !== null && remaining < 0
                  ? `${currency.format(Math.abs(remaining))} over`
                  : `${currency.format(remaining ?? 0)} remaining`}
              </p>
            )}
          </div>
        </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground">
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

      {/* The arc alone cannot carry this. Warning sits at 1.83:1 on the light
          card — below the 3:1 a mark needs to mean something on its own — so the
          status colour ships with an icon and a sentence, and the sentence is
          what a colour-blind or monochrome reader actually reads. */}
      {alert && share !== null ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-md px-3 py-2 text-sm"
          style={{
            backgroundColor: `color-mix(in oklab, ${TONE_COLOR[tone]} 14%, transparent)`,
          }}
        >
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0"
            style={{ color: TONE_COLOR[tone] }}
            aria-hidden
          />
          <span className="text-foreground">
            {tone === "critical" ? (
              <>
                <strong className="font-semibold">Over budget.</strong> FY {year}{" "}
                spend is {share.toFixed(1)}% of the approved{" "}
                {currency.format(approval ?? 0)} —{" "}
                {currency.format(Math.abs(remaining ?? 0))} beyond it.
              </>
            ) : (
              <>
                <strong className="font-semibold">
                  Approaching the approved budget.
                </strong>{" "}
                {share.toFixed(1)}% spent, with{" "}
                {currency.format(remaining ?? 0)} left for the rest of FY {year}.
              </>
            )}
          </span>
        </p>
      ) : null}
    </div>
  );
}
