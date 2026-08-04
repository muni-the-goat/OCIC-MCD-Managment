"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditProjectReports, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PROJECT_STREAMS, streamTracksUnits, type ProjectStream } from "@/lib/types";

export type ProjectActionState = { error: string } | { success: string } | null;

// One month of one year, across all three streams. The form posts a flat
// FormData because the row set is dynamic — the assistant can add a property
// mid-year — so the field names carry the structure:
//
//   amount:<stream>:<name>   the month's figure
//   units:<stream>:<name>    the month's unit count, sales only
//
// Names round-trip through the field key rather than through an id, because a
// row the assistant just typed has no id yet.
const FIELD = /^(amount|units):(sales|leasing|property_management):(.+)$/;

const schema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  // Validity is a lookup against public.projects rather than a list in this
  // file, for the same reason departments stopped being a union in 0013.
  project: z.string().trim().min(1, "Choose a project"),
});

// "1,234.56", "$1,234.56" and "1234.56" all mean the same thing to someone
// pasting out of the workbook, and refusing two of the three would be pedantry
// dressed up as validation.
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "").trim();
  if (cleaned === "") return 0;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

function parseUnits(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, "").trim();
  if (cleaned === "") return 0;
  const value = Number(cleaned);
  if (!Number.isInteger(value) || value < 0) return null;
  return value;
}

interface Row {
  stream: ProjectStream;
  name: string;
  amount: number;
  units: number;
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

  // Collect the posted cells into one row per stream + name, so a stream's
  // amount and its unit count arrive together rather than as two passes.
  const rows = new Map<string, Row>();
  for (const [key, raw] of formData.entries()) {
    const match = FIELD.exec(key);
    if (!match) continue;
    const [, kind, stream, rawName] = match;
    const name = rawName.trim();
    if (!name) continue;

    const mapKey = `${stream}:${name}`;
    const row =
      rows.get(mapKey) ??
      ({ stream: stream as ProjectStream, name, amount: 0, units: 0 } as Row);

    const value = String(raw ?? "");
    if (kind === "amount") {
      const amount = parseAmount(value);
      if (amount === null) {
        return { error: `"${value}" is not a valid amount for ${name}` };
      }
      row.amount = amount;
    } else {
      const units = parseUnits(value);
      if (units === null) {
        return { error: `"${value}" is not a valid unit count for ${name}` };
      }
      row.units = units;
    }
    rows.set(mapKey, row);
  }

  if (rows.size === 0) return { error: "Nothing to save" };

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

  for (const stream of PROJECT_STREAMS) {
    const streamRows = [...rows.values()].filter(
      (row) => row.stream === stream
    );
    if (streamRows.length === 0) continue;

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
      return { error: reportError?.message ?? "Could not open the report" };
    }

    const tracksUnits = streamTracksUnits(stream);
    // Only this month's columns are written. Every other month on the row is
    // left exactly as it was, which is what makes the form safe to reopen: an
    // assistant correcting March cannot blank out April by saving.
    const payload = streamRows.map((row, index) => ({
      report_id: report.id,
      name: row.name,
      sort_order: (index + 1) * 10,
      [amountColumn]: row.amount,
      ...(tracksUnits ? { [unitColumn]: row.units } : {}),
    }));

    const { error: itemError } = await supabase
      .from("project_report_items")
      .upsert(payload, { onConflict: "report_id,name" });
    if (itemError) return { error: itemError.message };
  }

  revalidatePath("/projects");
  return { success: "Saved" };
}
