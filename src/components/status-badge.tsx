import { TONE_COLOR, type StatTone } from "@/components/dashboard-stats";
import type { ReportStatus } from "@/lib/types";

// A dot and a word rather than a filled pill. A column of six coloured pills
// was the loudest thing on every list it sat in, louder than the titles the
// reader came for; the word carries the meaning and the dot lets it be found.
//
// The tones are the dashboard's own, so "Submitted" is the same amber here as
// the Awaiting review count that links to it — it used to be blue in one place
// and amber in the other, two colours for one state.
const STYLES: Record<ReportStatus, { label: string; tone: StatTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "warning" },
  reviewed: { label: "Reviewed", tone: "good" },
  rejected: { label: "Rejected", tone: "critical" },
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  const { label, tone } = STYLES[status];
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
