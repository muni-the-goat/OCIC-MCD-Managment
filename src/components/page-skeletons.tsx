import { cn } from "@/lib/utils";

// Skeletons of the marketing pages, drawn in the same surfaces and at the same
// sizes as the pages they stand in for. A spinner answers "is it working"; a
// skeleton also answers "what is coming and where", so when the page lands
// nothing moves — the title is already where the title will be, the cards are
// already the size of the cards.
//
// Bones on the ivory page are ink at 6%; bones on a white card are the muted
// fill. The pulse lives on the wrapper and stops under reduced motion — the
// shapes alone still say "loading".

function Bone({
  className,
  onCard,
  style,
}: {
  className?: string;
  onCard?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn(
        "rounded-full",
        onCard ? "bg-muted" : "bg-foreground/[0.06]",
        className
      )}
    />
  );
}

function Shell({
  children,
  width = "max-w-6xl",
  label = "Loading",
}: {
  children: React.ReactNode;
  width?: string;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn(
        "mx-auto w-full space-y-10 motion-safe:animate-pulse sm:space-y-12",
        width
      )}
    >
      {children}
    </div>
  );
}

function Header({
  eyebrow = true,
  action = true,
}: {
  eyebrow?: boolean;
  action?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
      <div className="space-y-3">
        {eyebrow ? <Bone className="h-4 w-28" /> : null}
        <Bone className="h-10 w-56 rounded-xl sm:h-11 sm:w-72" />
        <Bone className="h-4 w-72 max-w-full" />
      </div>
      {action ? <Bone className="h-11 w-36" /> : null}
    </div>
  );
}

function SectionHeading() {
  return (
    <div className="space-y-2">
      <Bone className="h-6 w-56 rounded-lg" />
      <Bone className="h-4 w-80 max-w-full" />
    </div>
  );
}

// Rows of an inset grouped list: an optional leading mark, a title line and a
// detail line, a trailing pill.
export function ListRowsSkeleton({
  rows = 5,
  leading = "icon",
}: {
  rows?: number;
  leading?: "icon" | "check" | "none";
}) {
  return (
    <div className="overflow-hidden rounded-[1.25rem] bg-card">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex min-h-[4.5rem] items-center gap-4 border-border/70 px-4 py-3 sm:px-5 [&+div]:border-t"
        >
          {leading === "icon" ? (
            <Bone onCard className="size-10 shrink-0 rounded-xl" />
          ) : leading === "check" ? (
            <Bone onCard className="size-[1.125rem] shrink-0 rounded" />
          ) : null}
          <div className="min-w-0 flex-1 space-y-2">
            <Bone onCard className={cn("h-4", i % 2 ? "w-2/5" : "w-3/5")} />
            <Bone onCard className="h-3.5 w-1/3" />
          </div>
          <Bone onCard className="h-7 w-24 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// A bare card: a title line, then rows of text.
function CardSkeleton({
  lines = 4,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4 rounded-[1.25rem] bg-card p-6", className)}>
      <Bone onCard className="h-5 w-48" />
      <div className="space-y-3 pt-1">
        {Array.from({ length: lines }, (_, i) => (
          <Bone
            key={i}
            onCard
            className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")}
          />
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <Shell label="Loading the dashboard">
      <Header />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-4 rounded-[1.25rem] bg-card p-4 sm:p-6">
            <Bone onCard className="h-4 w-28" />
            <Bone onCard className="h-12 w-20 rounded-xl" />
            <Bone onCard className="h-1.5 w-full" />
            <Bone onCard className="h-3.5 w-36 max-w-full" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <SectionHeading />
        <ListRowsSkeleton rows={4} />
      </div>
      <div className="space-y-4">
        <SectionHeading />
        <div className="flex gap-1.5">
          <Bone className="h-10 w-40" />
          <Bone className="h-10 w-44" />
        </div>
        <SummarySkeleton />
      </div>
    </Shell>
  );
}

// The annual budget or monthly activity card while a filter change streams in.
export function SummarySkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading the summary"
      className="space-y-6 rounded-[1.25rem] bg-card p-6 motion-safe:animate-pulse"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Bone onCard className="h-5 w-56" />
          <Bone onCard className="h-3.5 w-80 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Bone onCard className="h-10 w-28" />
          <Bone onCard className="h-10 w-40" />
        </div>
      </div>
      <Bone onCard className="h-56 w-full rounded-2xl" />
    </div>
  );
}

export function ReportsListSkeleton() {
  return (
    <Shell label="Loading reports">
      <Header eyebrow={false} />
      <div className="space-y-8">
        <div className="flex flex-wrap gap-1.5">
          {[12, 24, 24, 22, 18].map((w, i) => (
            <Bone key={i} className="h-10" style={{ width: `${w * 4}px` }} />
          ))}
        </div>
        <ReportsRowsSkeleton standalone={false} />
      </div>
    </Shell>
  );
}

// The list alone, for a filter change: the header and filters stay on screen.
// `standalone` is false inside the full-page skeleton, which already carries
// the status role and the pulse.
export function ReportsRowsSkeleton({
  standalone = true,
}: {
  standalone?: boolean;
}) {
  return (
    <div
      role={standalone ? "status" : undefined}
      aria-busy={standalone ? true : undefined}
      aria-label={standalone ? "Loading reports" : undefined}
      className={cn("space-y-6", standalone && "motion-safe:animate-pulse")}
    >
      {[4, 3].map((rows, i) => (
        <div key={i} className="space-y-2">
          <Bone className="ml-1 h-4 w-32" />
          <ListRowsSkeleton rows={rows} leading="none" />
        </div>
      ))}
    </div>
  );
}

export function ReportDetailSkeleton() {
  return (
    <Shell width="max-w-4xl" label="Loading the report">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="space-y-3">
          <Bone className="h-4 w-56" />
          <Bone className="h-10 w-80 max-w-full rounded-xl sm:h-11" />
          <Bone className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <Bone className="h-10 w-20" />
          <Bone className="h-10 w-24" />
        </div>
      </div>
      <div className="space-y-4">
        <CardSkeleton lines={6} />
        <CardSkeleton lines={2} />
      </div>
    </Shell>
  );
}

export function ReportFormSkeleton() {
  return (
    <Shell width="max-w-3xl" label="Loading the form">
      <Header eyebrow action={false} />
      <div className="space-y-4">
        <div className="space-y-5 rounded-[1.25rem] bg-card p-6">
          <Bone onCard className="h-5 w-32" />
          {[0, 1].map((i) => (
            <div key={i} className="space-y-2">
              <Bone onCard className="h-3.5 w-24" />
              <Bone onCard className="h-11 w-full rounded-xl" />
            </div>
          ))}
        </div>
        <div className="space-y-5 rounded-[1.25rem] bg-card p-6">
          <Bone onCard className="h-5 w-40" />
          <Bone onCard className="h-32 w-full rounded-xl" />
          <Bone onCard className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </Shell>
  );
}

// Any other page under the app shell: a title and a card.
export function PageSkeleton() {
  return (
    <Shell>
      <Header eyebrow={false} />
      <CardSkeleton lines={5} />
    </Shell>
  );
}
