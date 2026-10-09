import {
  TONE_COLOR,
  tint,
  toneText,
  type StatTone,
} from "@/components/dashboard-stats";
import type { ReportStatus } from "@/lib/types";

// The tones are the dashboard's own, so "Submitted" is the same amber here as
// the Awaiting review count that links to it — it used to be blue in one place
// and amber in the other, two colours for one state.
const STYLES: Record<ReportStatus, { label: string; tone: StatTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "warning" },
  reviewed: { label: "Reviewed", tone: "good" },
  rejected: { label: "Rejected", tone: "critical" },
};

// Two forms of the same mark. The dot sits beside a page title, where the
// title is the loud thing and the status is supporting. The pill is for a
// list, where the status is one of the things a reader scans the rows for and
// has to be findable at a glance from the right-hand edge.
export function StatusBadge({
  status,
  variant = "dot",
}: {
  status: ReportStatus;
  variant?: "dot" | "pill";
}) {
  const { label, tone } = STYLES[status];
  if (variant === "pill") {
    return (
      <span
        className="type-caption inline-flex h-7 shrink-0 items-center rounded-full px-3 font-semibold whitespace-nowrap"
        style={{ backgroundColor: tint(tone, 16), color: toneText(tone) }}
      >
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium whitespace-nowrap text-foreground">
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{ backgroundColor: TONE_COLOR[tone] }}
      />
      {label}
    </span>
  );
}
