"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  saveProjectMonth,
  type ProjectActionState,
} from "@/app/(app)/projects/actions";
import { ActionButton, ActionMessage } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LumaSpin } from "@/components/ui/luma-spin";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import { useActionToasts } from "@/components/use-action-toasts";
import {
  currency,
  parseAmountInput,
  parseUnitsInput,
  type ProjectRecord,
} from "@/lib/project-reports";
import { useSuccessFlash } from "@/components/use-success-flash";
import { cn } from "@/lib/utils";
import {
  MONTH_NAMES,
  PROJECT_CATEGORIES,
  PROJECT_STREAMS,
  UNASSIGNED_CATEGORY,
  filesByCategory,
  projectStreamLabelFor,
  projectStreamNoun,
  streamTracksUnits,
  type ProjectStream,
} from "@/lib/types";

export interface StreamRow {
  category: string;
  name: string;
  amount: string;
  units: string;
  // The name this row is stored under, so a rename moves the row instead of
  // founding a second one and leaving the first to be deleted with its other
  // eleven months. Empty for a row added on this visit, and for one carried
  // forward from last year — neither exists in the report being written.
  original: string;
}

export type StreamRows = Record<ProjectStream, StreamRow[]>;

function emptyRow(): StreamRow {
  return {
    category: PROJECT_CATEGORIES[0],
    name: "",
    amount: "",
    units: "",
    original: "",
  };
}

// One month across the streams a project actually reports, which is how the
// workbook is compiled — someone sits down at the start of July and fills in
// June. A whole-year grid would be more powerful and would also put eleven
// months the reader is not thinking about within one mis-key of the one they
// are.
export function ProjectMonthForm({
  years,
  projects,
  initialProject,
  initialYear,
  initialMonth,
  initialRows,
  // The streams this project has filed in either year. Chroy Changvar Bay has
  // no property management report — migration 0021 says so and seeds none — and
  // a form that offered one anyway created an empty one on the next save. Two
  // of those are in the database from exactly that.
  reportedStreams,
}: {
  years: number[];
  projects: ProjectRecord[];
  initialProject: string;
  initialYear: number;
  initialMonth: number;
  // Pre-filled from whatever the chosen month already holds, so reopening a
  // saved month shows what is in it rather than an empty form that would
  // silently overwrite on save.
  initialRows: StreamRows;
  reportedStreams: ProjectStream[];
}) {
  const [state, formAction, pending] = useActionState<
    ProjectActionState,
    FormData
  >(saveProjectMonth, null);
  const succeeded = useSuccessFlash(state);
  const [rows, setRows] = useState<StreamRows>(initialRows);
  // Streams the reader has deliberately opened on this visit. A report a
  // project does not file is not on the form; starting one is a decision, and
  // this is where that decision is held until it is saved.
  const [started, setStarted] = useState<ProjectStream[]>([]);
  // Whether anything has been typed. Only used to decide whether changing the
  // period needs to ask first.
  const [dirty, setDirty] = useState(false);
  useActionToasts(state);

  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  // The period lives in the URL, so changing it is a navigation and the server
  // sends back that month's figures. It used to be `window.location.search =`,
  // a full document load that threw away everything typed without asking. A
  // transition keeps it in the app and surfaces the wait.
  const [navigating, startNavigating] = useTransition();

  const setPeriod = (key: "project" | "year" | "month", value: string) => {
    // The figures on screen belong to the period being left, so they cannot
    // come along. Asking is the difference between discarding the reader's work
    // and the reader discarding it.
    if (
      dirty &&
      !window.confirm(
        "Changing the period loads that month's figures and discards what you have typed here. Continue?"
      )
    ) {
      // The pickers are controlled by the URL, so declining simply leaves them
      // showing the period that is still on screen.
      return;
    }
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    startNavigating(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  // A project with nothing filed at all is one where every report is plausible,
  // so it gets the full set rather than an empty page and three buttons.
  const shownStreams = PROJECT_STREAMS.filter((stream) =>
    reportedStreams.length === 0
      ? true
      : reportedStreams.includes(stream) || started.includes(stream)
  );
  const startableStreams = PROJECT_STREAMS.filter(
    (stream) => !shownStreams.includes(stream)
  );

  const setCell = (
    stream: ProjectStream,
    index: number,
    field: keyof StreamRow,
    value: string
  ) => {
    setDirty(true);
    setRows((current) => ({
      ...current,
      [stream]: current[stream].map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, [field]: value };
        // On a report filed by category the name is the category, so changing
        // one changes both. Which makes it a rename of the row, and a rename
        // moves the row with all twelve months on it — see saveProjectMonth.
        if (field === "category" && filesByCategory(initialProject, stream)) {
          next.name = value;
        }
        return next;
      }),
    }));
  };

  const addRow = (stream: ProjectStream) => {
    setDirty(true);
    setRows((current) => {
      const row = emptyRow();
      if (filesByCategory(initialProject, stream)) row.name = row.category;
      return { ...current, [stream]: [...current[stream], row] };
    });
  };

  const removeRow = (stream: ProjectStream, index: number) => {
    setDirty(true);
    setRows((current) => ({
      ...current,
      [stream]: current[stream].filter((_, i) => i !== index),
    }));
  };

  // A row's identity is its name (migration 0024), so two rows of one name are
  // one row as far as the database is concerned — and an upsert carrying both
  // fails the entire save with a sentence about ON CONFLICT that names nothing
  // the reader can act on. Caught here, before it is submitted, and again in
  // the action for a POST that did not come from this form.
  const duplicates = useMemo(() => {
    const found: Record<string, Set<string>> = {};
    for (const stream of PROJECT_STREAMS) {
      const seen = new Set<string>();
      const clashes = new Set<string>();
      for (const row of rows[stream] ?? []) {
        const name = row.name.trim();
        if (name === "") continue;
        if (seen.has(name)) clashes.add(name);
        seen.add(name);
      }
      found[stream] = clashes;
    }
    return found;
  }, [rows]);

  const hasDuplicates = shownStreams.some(
    (stream) => duplicates[stream].size > 0
  );

  // What the figures on screen come to. The workbook is compiled from a sheet
  // that already carries its own total, and typing seven properties into a form
  // that will not tell you what they add up to means checking the save against
  // the source afterwards rather than before. Parsed with the same functions
  // the action parses with, so this total and the saved one cannot disagree.
  const streamTotal = (stream: ProjectStream) =>
    (rows[stream] ?? []).reduce(
      (acc, row) => {
        if (row.name.trim() === "") return acc;
        return {
          amount: acc.amount + (parseAmountInput(row.amount) ?? 0),
          units: acc.units + (parseUnitsInput(row.units) ?? 0),
        };
      },
      { amount: 0, units: 0 }
    );

  return (
    <form action={formAction} className="space-y-5">
      {/* The period is posted from here rather than from the pickers. The
          pickers navigate — they decide which month the server loads — and a
          control that is both a link and a form field is one whose two jobs can
          disagree the moment a navigation is in flight. */}
      <input type="hidden" name="project" value={initialProject} />
      <input type="hidden" name="year" value={initialYear} />
      <input type="hidden" name="month" value={initialMonth} />

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Period</CardTitle>
          <CardDescription>
            The project and month these figures cover. Reopening a month you
            have already saved loads what is in it — only the month you pick is
            written, so correcting June never touches May. Renaming a row moves
            it and every month on it; removing one, or changing its category,
            applies to the whole report.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-project">Project</Label>
            <ResponsiveSelect
              id="project-project"
              className="w-52"
              value={initialProject}
              onValueChange={(value) => setPeriod("project", value)}
              disabled={navigating}
              options={projects.map((project) => ({
                value: project.id,
                label: project.label,
              }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-year">Year</Label>
            <ResponsiveSelect
              id="project-year"
              className="w-32"
              value={String(initialYear)}
              onValueChange={(value) => setPeriod("year", value)}
              disabled={navigating}
              options={years.map((year) => ({
                value: String(year),
                label: String(year),
              }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-month">Month</Label>
            <ResponsiveSelect
              id="project-month"
              className="w-40"
              value={String(initialMonth)}
              onValueChange={(value) => setPeriod("month", value)}
              disabled={navigating}
              options={MONTH_NAMES.map((name, index) => ({
                value: String(index + 1),
                label: name,
              }))}
            />
          </div>
          {navigating ? (
            <LumaSpin
              size={22}
              className="mb-1.5 self-center text-muted-foreground"
            />
          ) : null}
        </CardContent>
      </Card>

      {shownStreams.map((stream) => {
        const tracksUnits = streamTracksUnits(stream);
        const noun = projectStreamNoun(stream);
        const clashes = duplicates[stream];
        const total = streamTotal(stream);
        // Chroy Changvar Bay's Commercial report is one line that somebody puts
        // a figure into each month. Its rows are its categories, so the name is
        // the category and asking for it separately put the same word on screen
        // three times.
        const byCategory = filesByCategory(initialProject, stream);
        const seeded = (initialRows[stream] ?? []).some(
          (row) => row.original !== ""
        );

        return (
          <Card key={stream} className="rounded-2xl">
            <CardHeader>
              <CardTitle>{projectStreamLabelFor(initialProject, stream)}</CardTitle>
              <CardDescription>
                {tracksUnits
                  ? "Units sold and their value, by property type."
                  : `Income for the month, by ${noun}.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Tells the action this stream was on the form, and whether it
                  arrived with rows. Without the first, a stream whose rows were
                  all removed is indistinguishable from one the form never
                  rendered, and the two want opposite handling. Without the
                  second, a stream that has never held anything still opens a
                  report on save — which is where the two empty Chroy Changvar
                  Bay property management reports came from. */}
              <input
                type="hidden"
                name={`present:${stream}`}
                value={seeded ? "seeded" : "new"}
              />
              {rows[stream].map((row, index) => {
                const duplicate =
                  row.name.trim() !== "" && clashes.has(row.name.trim());
                // Every cell in this row is flex + gap rather than space-y.
                //
                // space-y hangs a margin on each child that is not :last-child,
                // and :last-child is structural — it counts a child that paints
                // nothing. Radix's Select renders a visually-hidden <select>
                // after its trigger whenever it is inside a form, so in the
                // category cell the trigger stopped being the last child and
                // picked up 6px of margin beneath it. Under items-end that is
                // 6px of clear air holding the control up off the row, which is
                // why the category box sat high against the name beside it.
                //
                // A gap cannot do this: an absolutely positioned child is not a
                // flex item, so neither that <select> nor the sr-only label can
                // put space under anything.
                return (
                  <div
                    key={index}
                    className={cn(
                      "grid gap-2 sm:items-end",
                      byCategory
                        ? tracksUnits
                          ? "sm:grid-cols-[9rem_10rem_7rem_minmax(0,1fr)_auto]"
                          : "sm:grid-cols-[9rem_10rem_minmax(0,1fr)_auto]"
                        : "sm:grid-cols-[9rem_minmax(0,1fr)_10rem_7rem_auto]"
                    )}
                  >
                    {/* Not shown, and not derived on the server either: the
                        action has to be told which row this was so it can move
                        it rather than replace it. */}
                    <input
                      type="hidden"
                      name={`row:${stream}:${index}:original`}
                      value={row.original}
                    />
                    <div className="flex flex-col gap-1.5">
                      <Label
                        htmlFor={`${stream}-category-${index}`}
                        className="sm:sr-only"
                      >
                        Category
                      </Label>
                      {/* Posted per row rather than derived from the name, so a
                          unit can be moved between categories without being
                          retyped — which is exactly what the leasing rows
                          sitting in Unassigned need.

                          Posted from a hidden input rather than from the
                          control. ResponsiveSelect is a native <select> on a
                          phone and a Radix one on a laptop, and the Radix half
                          submits through a shadow field it mounts itself once
                          it has found the surrounding form. That is one more
                          thing that has to be true for a category to be saved,
                          on a field where being silently dropped means every
                          row on the report comes back Unassigned — which is a
                          state one of these reports is already in. The value is
                          in React state either way, so a hidden input is the
                          same value with nothing in between. */}
                      <input
                        type="hidden"
                        name={`row:${stream}:${index}:category`}
                        value={row.category}
                      />
                      <ResponsiveSelect
                        id={`${stream}-category-${index}`}
                        className={cn(
                          "w-full",
                          byCategory &&
                            duplicate &&
                            "border-destructive ring-3 ring-destructive/20"
                        )}
                        value={row.category}
                        onValueChange={(value) =>
                          setCell(stream, index, "category", value)
                        }
                        options={[
                          ...PROJECT_CATEGORIES.map((category) => ({
                            value: category,
                            label: category,
                          })),
                          {
                            value: UNASSIGNED_CATEGORY,
                            label: UNASSIGNED_CATEGORY,
                          },
                        ]}
                      />
                    </div>
                    {/* The row still has a name — it is the row's identity,
                        and the action still writes it — but on a report filed
                        by category there is nothing to ask: the name is the
                        category, kept in step by setCell above. */}
                    {byCategory ? (
                      <input
                        type="hidden"
                        name={`row:${stream}:${index}:name`}
                        value={row.name}
                      />
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <Label
                          htmlFor={`${stream}-name-${index}`}
                          className="sm:sr-only"
                        >
                          {noun[0].toUpperCase() + noun.slice(1)}
                        </Label>
                        <Input
                          id={`${stream}-name-${index}`}
                          name={`row:${stream}:${index}:name`}
                          value={row.name}
                          onChange={(event) =>
                            setCell(stream, index, "name", event.target.value)
                          }
                          placeholder={
                            tracksUnits
                              ? "Land / House / Condo"
                              : "Property name"
                          }
                          maxLength={60}
                          autoComplete="off"
                          aria-invalid={duplicate || undefined}
                          className={cn(
                            duplicate &&
                              "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/40"
                          )}
                        />
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <Label
                        htmlFor={`${stream}-amount-${index}`}
                        className="sm:sr-only"
                      >
                        Amount
                      </Label>
                      <Input
                        id={`${stream}-amount-${index}`}
                        name={`row:${stream}:${index}:amount`}
                        value={row.amount}
                        onChange={(event) =>
                          setCell(stream, index, "amount", event.target.value)
                        }
                        inputMode="decimal"
                        placeholder="0.00"
                        autoComplete="off"
                        className="text-right tabular-nums"
                      />
                    </div>
                    {tracksUnits ? (
                      <div className="flex flex-col gap-1.5">
                        <Label
                          htmlFor={`${stream}-units-${index}`}
                          className="sm:sr-only"
                        >
                          Units
                        </Label>
                        <Input
                          id={`${stream}-units-${index}`}
                          name={`row:${stream}:${index}:units`}
                          value={row.units}
                          onChange={(event) =>
                            setCell(stream, index, "units", event.target.value)
                          }
                          inputMode="numeric"
                          placeholder="0"
                          autoComplete="off"
                          className="text-right tabular-nums"
                        />
                      </div>
                    ) : (
                      !byCategory && <div className="hidden sm:block" />
                    )}
                    {/* Everything left over, so the amount sits against the
                        category it belongs to and the delete control still
                        lands at the edge of the row like every other one. */}
                    {byCategory ? <div className="hidden sm:block" /> : null}
                    {/* Removes the unit from the report on save — all twelve of
                        its months, not just this one. A month you have no
                        figure for is left blank; this is for a row that should
                        not be on the report at all. */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(stream, index)}
                      aria-label={`Remove ${row.name || "this row"} from the report`}
                      title="Remove from the report"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}

              {clashes.size > 0 ? (
                <p role="alert" className="text-sm text-destructive">
                  {[...clashes].map((name) => `"${name}"`).join(", ")}{" "}
                  {clashes.size === 1 ? "is" : "are"} on more than one row.{" "}
                  {byCategory
                    ? "A row is identified by its category here, so each one needs its own."
                    : "A row is identified by its name, so each one needs its own."}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => addRow(stream)}
                >
                  <Plus className="size-4" />
                  Add {byCategory ? "category" : noun}
                </Button>
                {/* What is on screen, not what is stored — this is the figure
                    to check against the sheet being copied from, before the
                    save rather than after it. */}
                <p className="text-sm text-muted-foreground">
                  {MONTH_NAMES[initialMonth - 1]} total:{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {currency.format(total.amount)}
                  </span>
                  {tracksUnits ? (
                    <span className="tabular-nums">
                      {" "}
                      · {total.units} {total.units === 1 ? "unit" : "units"}
                    </span>
                  ) : null}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {startableStreams.length > 0 ? (
        <Card className="rounded-2xl border-dashed shadow-none">
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <p className="text-sm text-muted-foreground">
              {projects.find((project) => project.id === initialProject)?.label}{" "}
              does not file{" "}
              {startableStreams
                .map((stream) =>
                  projectStreamLabelFor(initialProject, stream).toLowerCase()
                )
                .join(" or ")}
              .
            </p>
            {startableStreams.map((stream) => (
              <Button
                key={stream}
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  setStarted((current) => [...current, stream]);
                  setRows((current) => ({
                    ...current,
                    [stream]:
                      current[stream].length > 0
                        ? current[stream]
                        : [emptyRow()],
                  }));
                }}
              >
                <Plus className="size-4" />
                Start {projectStreamLabelFor(initialProject, stream)}
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-2">
        <ActionButton
          type="submit"
          pending={pending}
          success={succeeded}
          disabled={hasDuplicates || navigating}
          pendingLabel="Saving…"
          successLabel="Month saved"
        >
          Save month
        </ActionButton>
        <ActionMessage
          error={state && "error" in state ? state.error : null}
        />
      </div>
    </form>
  );
}
