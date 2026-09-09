"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditProjectReports, getProfile } from "@/lib/auth";
import { parseAmountInput, parseUnitsInput } from "@/lib/project-reports";
import { createClient } from "@/lib/supabase/server";
import {
  PROJECT_STREAMS,
  UNASSIGNED_CATEGORY,
  projectStreamLabel,
  streamTracksUnits,
  type ProjectStream,
} from "@/lib/types";

export type ProjectActionState = { error: string } | { success: string } | null;

// One month of one year, across the streams the form put on screen. The form
// posts a flat FormData because the row set is dynamic — a unit can be added
// mid-year and a category reassigned — so the field names carry the structure:
//
//   row:<stream>:<index>:category|name|original|amount|units
//   present:<stream>            marks a stream the form actually rendered
//
// Indexed rather than keyed by name, which is what the first version did. A
// name-keyed field cannot express "this row is now a Condo rather than
// Unassigned" without the row appearing to be a different row, and reassigning
// the leasing properties out of Unassigned is the first thing anyone will do.
const FIELD =
  /^row:(sales|leasing|property_management):(\d+):(category|name|original|amount|units)$/;

// Which streams the form put on screen. Needed because "this stream posted no
// rows" and "this stream was not on the form" look identical in a FormData, and
// they call for opposite behaviour: the first means every row was removed and
// should be deleted, the second means leave the report alone.
const PRESENT = /^present:(sales|leasing|property_management)$/;

const schema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  // Validity is a lookup against public.projects rather than a list in this
  // file, for the same reason departments stopped being a union in 0013.
  project: z.string().trim().min(1, "Choose a project"),
});

// Postgres 42P10: the ON CONFLICT target names no unique constraint. Here it
// has exactly one cause — the running code and the database disagree about what
// identifies a row — and it fires in *both* directions, which is what makes it
// worth naming rather than passing through:
//
//   code ahead of the database   0024 not run; the code asks for
//                                (report_id, name), which does not exist yet
//   database ahead of the code   0024 run against an older deployment; the old
//                                code asks for (report_id, category, name),
//                                which 0024 removed
//
// Both present identically to whoever is looking at the screen: a save that
// changes nothing. The raw message ("there is no unique or exclusion constraint
// matching the ON CONFLICT specification") gives them nothing to act on, and
// the fix is never in the form — it is to get the two into step.
//
// 23505 and 21000 are the other two a row's name can cause, and both now have a
// guard above that should catch them first. If one still reaches here the guard
// has a hole, so it says the name rather than the constraint.
function describeWriteError(error: { code?: string; message: string }): string {
  if (error.code === "42P10" || /ON CONFLICT/i.test(error.message)) {
    return "Nothing was saved: this version of the app and the database are out of step over migration 0024. Both need to be up to date — check that 0024 has run and that the latest deployment is live.";
  }
  if (error.code === "23505" || error.code === "21000") {
    return "Two rows on this report have the same name. Give each one its own name and save again.";
  }
  return error.message;
}

interface Row {
  stream: ProjectStream;
  category: string;
  name: string;
  // The name this row is stored under. Empty for a row added on this visit, or
  // for one carried forward from last year's report — neither exists in the
  // report being written, so neither can be renamed.
  original: string;
  amount: number;
  units: number;
}

// Everything the save needs, checked before a single row is written.
//
// The three streams used to be validated inside the loop that wrote them, so a
// bad figure in leasing surfaced only after sales had already been committed —
// and the message it surfaced with said "Nothing was saved". Every check that
// can be made from the form alone is made here, which leaves a genuine database
// failure as the only way to get a partial write, and that one says so.
interface Plan {
  streams: { stream: ProjectStream; rows: Row[]; seeded: boolean }[];
}

function collect(formData: FormData): Plan | { error: string } {
  const rows = new Map<string, Row>();
  for (const [key, raw] of formData.entries()) {
    const match = FIELD.exec(key);
    if (!match) continue;
    const [, stream, index, field] = match;
    const mapKey = `${stream}:${index}`;
    const row =
      rows.get(mapKey) ??
      ({
        stream: stream as ProjectStream,
        category: UNASSIGNED_CATEGORY,
        name: "",
        original: "",
        amount: 0,
        units: 0,
      } as Row);

    const value = String(raw ?? "");
    if (field === "name") {
      row.name = value.trim();
    } else if (field === "original") {
      row.original = value.trim();
    } else if (field === "category") {
      row.category = value.trim() || UNASSIGNED_CATEGORY;
    } else if (field === "amount") {
      const amount = parseAmountInput(value);
      if (amount === null) return { error: `"${value}" is not a valid amount` };
      row.amount = amount;
    } else {
      const units = parseUnitsInput(value);
      if (units === null) {
        return { error: `"${value}" is not a valid unit count` };
      }
      row.units = units;
    }
    rows.set(mapKey, row);
  }

  // A row with no name was added and left blank; dropping it silently is
  // kinder than refusing the whole save over an empty line nobody filled in.
  for (const [key, row] of rows) if (!row.name) rows.delete(key);

  // The marker carries two facts, because they need two different answers. Its
  // presence says the stream was on the form; its value says whether the stream
  // arrived holding rows.
  const present = new Map<ProjectStream, string>();
  for (const [key, raw] of formData.entries()) {
    const match = PRESENT.exec(key);
    if (match) present.set(match[1] as ProjectStream, String(raw ?? ""));
  }
  if (present.size === 0) return { error: "Nothing to save" };

  const streams = PROJECT_STREAMS.filter((stream) => present.has(stream))
    .map((stream) => ({
      stream,
      rows: [...rows.values()].filter((row) => row.stream === stream),
      seeded: present.get(stream) === "seeded",
    }))
    // A stream this year's report has never held is only written once somebody
    // puts a figure in it. Opening one anyway is what put two empty Chroy
    // Changvar Bay property management reports in the database — an absent
    // report and an empty one say different things, and only one of them was
    // true.
    //
    // The figure, rather than the row, is what decides it. A stream whose rows
    // were carried forward from last year arrives already named — that is what
    // the carry-forward is for — so "has rows" would open a leasing report for
    // the year every time somebody saved a month of sales, with seven of last
    // year's properties in it at zero.
    //
    // A stream that arrived with rows always runs, even when it posts none:
    // that is every row having been removed, which is a deletion to carry out
    // rather than nothing to do.
    .filter(
      ({ rows: streamRows, seeded }) =>
        seeded || streamRows.some((row) => row.amount !== 0 || row.units !== 0)
    );

  if (streams.length === 0) {
    return {
      error:
        "Nothing to save — add a figure to at least one row before saving.",
    };
  }

  for (const { stream, rows: streamRows } of streams) {
    const where = projectStreamLabel(stream);

    // Two rows of one name are one row as far as the database is concerned, and
    // an upsert carrying both raises 21000 — "cannot affect row a second time" —
    // which fails the whole save with a sentence about ON CONFLICT. The form
    // blocks this before it is submitted; this is the same check on the side
    // that a POST from anywhere else also has to pass.
    const seen = new Set<string>();
    for (const row of streamRows) {
      if (seen.has(row.name)) {
        return {
          error: `${where} has two rows named "${row.name}". Give each one its own name.`,
        };
      }
      seen.add(row.name);
    }

    // One rename taking a name another rename is giving up.
    //
    // A rename is an UPDATE of the row's name, and the report holds one row per
    // name, so two of them that have to be true at once cannot both go through:
    // a straight swap (A → B alongside B → A) deadlocks on the constraint, and
    // a chain (A → B alongside B → C) only works in one order. Ordering the
    // chain is possible and is not worth the machinery for something nobody has
    // asked to do; refusing both with a sentence the reader can act on beats
    // discovering it half way through the writes.
    //
    // Renaming onto a name that simply already exists needs no check of its
    // own. If that row is still on the form the two end up with one name
    // between them, which the duplicate check above has already refused; if it
    // was removed on this visit, the deletion runs before the renames and the
    // name is free by the time the rename asks for it.
    const vacating = new Set(
      streamRows
        .filter((row) => row.original !== "" && row.original !== row.name)
        .map((row) => row.original)
    );
    for (const row of streamRows) {
      if (row.original === "" || row.original === row.name) continue;
      if (vacating.has(row.name)) {
        return {
          error: `${where} is renaming a row to "${row.name}" while another row is being renamed away from it. Save one of the two changes first, so neither row is lost.`,
        };
      }
    }
  }

  return { streams };
}

export async function saveProjectMonth(
  _prev: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const profile = await getProfile();
  if (!canEditProjectReports(profile.role)) {
    return { error: "You do not have permission to edit project reports" };
  }

  const parsed = schema.safeParse({
    year: formData.get("year"),
    month: formData.get("month"),
    project: formData.get("project"),
  });
  if (!parsed.success) return { error: "Choose a valid project, month and year" };
  const { year, month, project } = parsed.data;

  const plan = collect(formData);
  if ("error" in plan) return plan;

  const supabase = await createClient();

  const { data: projectRow, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", project)
    .maybeSingle();
  if (projectError) return { error: projectError.message };
  if (!projectRow) return { error: "Choose a project from the list" };

  const amountColumn = `m${String(month).padStart(2, "0")}`;
  const unitColumn = `u${String(month).padStart(2, "0")}`;

  // Named so a failure part-way through can say which streams did get written.
  // Nothing above this line has touched the database.
  const written: ProjectStream[] = [];
  const stopped = (message: string): ProjectActionState => ({
    error:
      written.length === 0
        ? message
        : `${message} ${written.map(projectStreamLabel).join(" and ")} ${
            written.length === 1 ? "was" : "were"
          } already saved.`,
  });

  for (const { stream, rows: streamRows } of plan.streams) {
    // The year's report is created on first save rather than up front, so a
    // year nobody has reported yet leaves no empty shell behind.
    const { data: report, error: reportError } = await supabase
      .from("project_reports")
      .upsert(
        {
          project_id: projectRow.id,
          stream,
          period_year: year,
          updated_by: profile.id,
        },
        { onConflict: "project_id,stream,period_year" }
      )
      .select("id")
      .single();
    if (reportError || !report) {
      return stopped(reportError?.message ?? "Could not open the report.");
    }

    // Removals first, and matched on the name each row is stored under right
    // now rather than the name it is about to have.
    //
    // Order matters between these three, and this is the only one that works.
    // Deleting last — which is what it used to do — cannot tell a row that was
    // removed from a row that was renamed, because after a rename the old name
    // is gone from the form either way. Deleting first on the *current* names
    // can: a removed row is one whose stored name nothing on the form claims,
    // and a renamed row still claims its old name through `original`.
    //
    // It also frees the name. Remove "Elite Cove" and rename "La Seine" onto
    // it in one save and the rename would otherwise collide with a row that is
    // about to be deleted anyway.
    const heldNames = streamRows.map((row) =>
      row.original !== "" ? row.original : row.name
    );
    const deletion = supabase
      .from("project_report_items")
      .delete()
      .eq("report_id", report.id);
    const { error: deleteError } = await (heldNames.length > 0
      ? deletion.not(
          "name",
          "in",
          `(${heldNames.map((name) => `"${name.replace(/"/g, '""')}"`).join(",")})`
        )
      : deletion);
    if (deleteError) return stopped(describeWriteError(deleteError));

    // Then the renames, as a rename rather than as a new row.
    //
    // A row's identity has been its name since 0024, so an upsert under the new
    // name inserts a second row holding this month alone and leaves the
    // original behind — and the old delete-last step then removed that original
    // with the other eleven months on it, reporting "Month saved" while doing
    // it. Moving the name instead is the same guarantee 0024 gives a category
    // change: the row arrives where it was asked to go, still carrying its year.
    for (const row of streamRows) {
      if (row.original === "" || row.original === row.name) continue;
      const { error: renameError } = await supabase
        .from("project_report_items")
        .update({ name: row.name })
        .eq("report_id", report.id)
        .eq("name", row.original);
      if (renameError) return stopped(describeWriteError(renameError));
    }

    const tracksUnits = streamTracksUnits(stream);
    // Only this month's columns are written. Every other month on the row is
    // left exactly as it was, which is what makes the form safe to reopen: an
    // assistant correcting March cannot blank out April by saving.
    //
    // Keyed on (report_id, name) since 0024, so a row whose category changed is
    // updated in place and arrives in its new category still carrying all
    // twelve months. Keying on the category as well used to insert a second row
    // and leave the first behind.
    if (streamRows.length > 0) {
      const payload = streamRows.map((row, index) => ({
        report_id: report.id,
        category: row.category,
        name: row.name,
        sort_order: (index + 1) * 10,
        [amountColumn]: row.amount,
        ...(tracksUnits ? { [unitColumn]: row.units } : {}),
      }));

      const { error: itemError } = await supabase
        .from("project_report_items")
        .upsert(payload, { onConflict: "report_id,name" });
      if (itemError) return stopped(describeWriteError(itemError));
    }

    written.push(stream);
  }

  // The form is at /projects/new and the figures are read on the other two, so
  // all three are named. A path left out here is a page that keeps showing what
  // was there before the save.
  revalidatePath("/projects");
  revalidatePath("/projects/dashboard");
  revalidatePath("/projects/new");
  return { success: "Saved" };
}
