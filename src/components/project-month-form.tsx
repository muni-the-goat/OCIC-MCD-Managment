"use client";

import { useActionState, useState } from "react";
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
import { useActionToasts } from "@/components/use-action-toasts";
import type { ProjectRecord } from "@/lib/project-reports";
import { useSuccessFlash } from "@/components/use-success-flash";
import {
  MONTH_NAMES,
  PROJECT_CATEGORIES,
  PROJECT_STREAMS,
  UNASSIGNED_CATEGORY,
  projectStreamLabel,
  projectStreamNoun,
  streamTracksUnits,
  type ProjectStream,
} from "@/lib/types";

export interface StreamRow {
  category: string;
  name: string;
  amount: string;
  units: string;
}

export type StreamRows = Record<ProjectStream, StreamRow[]>;

// One month across all three streams, which is how the workbook is actually
// compiled — someone sits down at the start of July and fills in June. A
// whole-year grid would be more powerful and would also put eleven months the
// reader is not thinking about within one mis-key of the one they are.
export function ProjectMonthForm({
  years,
  projects,
  initialProject,
  initialYear,
  initialMonth,
  initialRows,
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
}) {
  const [state, formAction, pending] = useActionState<
    ProjectActionState,
    FormData
  >(saveProjectMonth, null);
  const succeeded = useSuccessFlash(state);
  const [rows, setRows] = useState<StreamRows>(initialRows);
  useActionToasts(state as never);

  const setCell = (
    stream: ProjectStream,
    index: number,
    field: keyof StreamRow,
    value: string
  ) => {
    setRows((current) => ({
      ...current,
      [stream]: current[stream].map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      ),
    }));
  };

  const addRow = (stream: ProjectStream) => {
    setRows((current) => ({
      ...current,
      [stream]: [
        ...current[stream],
        { category: PROJECT_CATEGORIES[0], name: "", amount: "", units: "" },
      ],
    }));
  };

  const removeRow = (stream: ProjectStream, index: number) => {
    setRows((current) => ({
      ...current,
      [stream]: current[stream].filter((_, i) => i !== index),
    }));
  };

  return (
    <form action={formAction} className="space-y-5">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Period</CardTitle>
          <CardDescription>
            The project and month these figures cover. Reopening a month you
            have already saved loads what is in it — only the month you pick is
            written, so correcting June never touches May. Removing a row, or
            changing its category, applies to the whole report.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="project-project">Project</Label>
            {/* Changing any of the three reloads with that period's figures.
                A client-only picker would have to carry a second copy of every
                saved month to do the same, and the copy would go stale. */}
            <select
              id="project-project"
              name="project"
              defaultValue={initialProject}
              onChange={(event) => {
                const params = new URLSearchParams(window.location.search);
                params.set("project", event.target.value);
                window.location.search = params.toString();
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-year">Year</Label>
            <select
              id="project-year"
              name="year"
              defaultValue={initialYear}
              onChange={(event) => {
                const params = new URLSearchParams(window.location.search);
                params.set("year", event.target.value);
                window.location.search = params.toString();
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-month">Month</Label>
            <select
              id="project-month"
              name="month"
              defaultValue={initialMonth}
              onChange={(event) => {
                const params = new URLSearchParams(window.location.search);
                params.set("month", event.target.value);
                window.location.search = params.toString();
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {PROJECT_STREAMS.map((stream) => {
        const tracksUnits = streamTracksUnits(stream);
        const noun = projectStreamNoun(stream);
        return (
          <Card key={stream} className="rounded-2xl">
            <CardHeader>
              <CardTitle>{projectStreamLabel(stream)}</CardTitle>
              <CardDescription>
                {tracksUnits
                  ? "Units sold and their value, by property type."
                  : `Income for the month, by ${noun}.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Tells the action this stream was on the form. Without it a
                  stream whose rows were all removed is indistinguishable from
                  one the form never rendered, and the two want opposite
                  handling. */}
              <input type="hidden" name={`present:${stream}`} value="1" />
              {rows[stream].map((row, index) => (
                <div
                  key={index}
                  className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_10rem_7rem_auto] sm:items-end"
                >
                  <div className="space-y-1.5">
                    <Label
                      htmlFor={`${stream}-category-${index}`}
                      className="sm:sr-only"
                    >
                      Category
                    </Label>
                    {/* Posted per row rather than derived from the name, so a
                        unit can be moved between categories without being
                        retyped — which is exactly what the leasing rows sitting
                        in Unassigned need. */}
                    <select
                      id={`${stream}-category-${index}`}
                      name={`row:${stream}:${index}:category`}
                      value={row.category}
                      onChange={(event) =>
                        setCell(stream, index, "category", event.target.value)
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {PROJECT_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                      <option value={UNASSIGNED_CATEGORY}>
                        {UNASSIGNED_CATEGORY}
                      </option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
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
                        tracksUnits ? "Land / House / Condo" : "Property name"
                      }
                      maxLength={60}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor={`${stream}-amount-${index}`}
                      className="sm:sr-only"
                    >
                      Amount
                    </Label>
                    <Input
                      id={`${stream}-amount-${index}`}
                      // The field name carries the row's name, so a row typed
                      // moments ago posts without needing an id it does not have.
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
                    <div className="space-y-1.5">
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
                    <div className="hidden sm:block" />
                  )}
                  {/* Removes the unit from the report on save — all twelve of
                      its months, not just this one. A month you have no figure
                      for is left blank; this is for a row that should not be on
                      the report at all. */}
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
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => addRow(stream)}
              >
                <Plus className="size-4" />
                Add {noun}
              </Button>
            </CardContent>
          </Card>
        );
      })}

      <div className="space-y-2">
        <ActionButton
          type="submit"
          pending={pending}
          success={succeeded}
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
