"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  canDecideOnReport,
  canManageAnyReport,
  canMarkReviewed,
  canRejectReport,
  getProfile,
} from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type BudgetPeriod } from "@/lib/types";

export type ActionState = { error: string } | null;

const amount = z.coerce.number().min(0).max(999_999_999).catch(0);

const budgetItemSchema = z.object({
  name: z.string().trim().max(200),
  amounts: z.array(amount).length(12),
});

const budgetSectionSchema = z.object({
  name: z.string().trim().max(200),
  items: z.array(budgetItemSchema).max(200),
});

const MONTH_COLS = [
  "m01",
  "m02",
  "m03",
  "m04",
  "m05",
  "m06",
  "m07",
  "m08",
  "m09",
  "m10",
  "m11",
  "m12",
] as const;

// Flatten sections → budget_items rows; drop fully-empty rows.
function budgetRows(
  sections: z.infer<typeof budgetSectionSchema>[],
  reportId: string,
  budgetPeriod: BudgetPeriod,
  periodMonth: number
) {
  const rows: Record<string, unknown>[] = [];
  let order = 0;
  for (const section of sections) {
    for (const item of section.items) {
      const hasValue =
        item.name.trim() !== "" || item.amounts.some((a) => a > 0);
      if (!hasValue) continue;
      const monthly: Record<string, number> = {};
      MONTH_COLS.forEach((col, i) => {
        monthly[col] =
          budgetPeriod === "annual" || i === periodMonth - 1
            ? item.amounts[i]
            : 0;
      });
      rows.push({
        report_id: reportId,
        section: section.name.trim(),
        name: item.name.trim(),
        sort_order: order++,
        ...monthly,
      });
    }
  }
  return rows;
}


const reportSchema = z.object({
  type: z.enum(["budget", "monthly"]),
  budget_period: z.enum(["annual", "monthly"]),
  title: z.string().trim().min(1, "Title is required").max(200),
  period_month: z.coerce.number().int().min(1).max(12),
  period_year: z.coerce.number().int().min(2000).max(2100),
});

const MAX_FILE_BYTES = 15 * 1024 * 1024;

async function uploadAttachments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reportId: string,
  userId: string,
  files: File[]
): Promise<string | null> {
  for (const file of files) {
    if (!(file instanceof File) || file.size === 0) continue;
    if (file.size > MAX_FILE_BYTES) {
      return `"${file.name}" is larger than 15 MB`;
    }
    const safeName = file.name.replace(/[^\w.\- ]/g, "_");
    const path = `${reportId}/${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("attachments")
      .upload(path, file, { contentType: file.type || undefined });
    if (uploadError) return `Upload failed for "${file.name}": ${uploadError.message}`;

    const { error: rowError } = await supabase.from("report_attachments").insert({
      report_id: reportId,
      file_name: file.name,
      storage_path: path,
      uploaded_by: userId,
    });
    if (rowError) {
      await supabase.storage.from("attachments").remove([path]);
      return `Could not record attachment "${file.name}": ${rowError.message}`;
    }
  }
  return null;
}

export async function saveReport(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await getProfile();
  const supabase = await createClient();

  const parsed = reportSchema.safeParse({
    type: formData.get("type"),
    budget_period: formData.get("budget_period"),
    title: formData.get("title"),
    period_month: formData.get("period_month"),
    period_year: formData.get("period_year"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const intent = formData.get("intent") === "submit" ? "submitted" : "draft";
  const reportId = String(formData.get("report_id") ?? "") || null;

  if (
    !reportId &&
    parsed.data.type === "budget" &&
    parsed.data.budget_period !== "monthly"
  ) {
    return { error: "New budget reports must use a monthly reporting period" };
  }

  if (reportId) {
    const { data: existing, error } = await supabase
      .from("reports")
      .select("id, type, budget_period")
      .eq("id", reportId)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!existing) return { error: "This report can no longer be edited" };
    if (existing.type !== parsed.data.type) {
      return { error: "The report type does not match the saved report" };
    }
    if (
      existing.type === "budget" &&
      existing.budget_period !== parsed.data.budget_period
    ) {
      return {
        error: "An existing budget report's period type cannot be changed",
      };
    }
  }

  // Multiple monthly budgets per author/month/year are allowed (migration
  // 0016 removed the one-per-period rule), so there is no duplicate check here.

  // Type-specific content
  let content: Record<string, unknown> = {};
  let budgetSections: z.infer<typeof budgetSectionSchema>[] = [];

  if (parsed.data.type === "monthly") {
    const summary = String(formData.get("summary") ?? "").trim();
    content = {
      summary,
      accomplishments: String(formData.get("accomplishments") ?? "").trim(),
      challenges: String(formData.get("challenges") ?? "").trim(),
      next_month_plan: String(formData.get("next_month_plan") ?? "").trim(),
    };
    if (intent === "submitted" && !summary) {
      return { error: "A summary is required before submitting" };
    }
  } else {
    let rawSections: unknown;
    try {
      rawSections = JSON.parse(String(formData.get("budget_sections") ?? "[]"));
    } catch {
      return { error: "Budget data is malformed" };
    }
    const sectionsParsed = z
      .array(budgetSectionSchema)
      .max(50)
      .safeParse(rawSections);
    if (!sectionsParsed.success) {
      return { error: "Check the budget — amounts must be numbers ≥ 0" };
    }
    budgetSections = sectionsParsed.data;
    if (
      intent === "submitted" &&
      budgetRows(
        budgetSections,
        "x",
        parsed.data.budget_period,
        parsed.data.period_month
      ).length === 0
    ) {
      return { error: "Add at least one line item before submitting" };
    }
  }

  let id = reportId;

  if (id) {
    // Keep the report editable while replacing its child rows and uploading
    // attachments. Moving it to submitted first would make can_edit_report()
    // false and cause the child writes to be rejected by RLS.
    const { data: updated, error } = await supabase
      .from("reports")
      .update({
        title: parsed.data.title,
        budget_period: parsed.data.budget_period,
        period_month: parsed.data.period_month,
        period_year: parsed.data.period_year,
        status: "draft",
        content,
        reviewed_by: null,
        reviewed_at: null,
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) return { error: error.message };
    if (!updated) return { error: "This report can no longer be edited" };

    if (parsed.data.type === "budget") {
      const { error: delError } = await supabase
        .from("budget_items")
        .delete()
        .eq("report_id", id);
      if (delError) return { error: delError.message };
    }
  } else {
    const { data: created, error } = await supabase
      .from("reports")
      .insert({
        author_id: profile.id,
        type: parsed.data.type,
        budget_period: parsed.data.budget_period,
        title: parsed.data.title,
        period_month: parsed.data.period_month,
        period_year: parsed.data.period_year,
        status: "draft",
        content,
      })
      .select("id")
      .single();
    if (error) {
      return { error: error.message };
    }
    id = created.id as string;
  }

  if (parsed.data.type === "budget") {
    const rows = budgetRows(
      budgetSections,
      id,
      parsed.data.budget_period,
      parsed.data.period_month
    );
    if (rows.length > 0) {
      const { error } = await supabase.from("budget_items").insert(rows);
      if (error) return { error: error.message };
    }
  }

  const files = formData.getAll("files") as File[];
  const uploadError = await uploadAttachments(supabase, id, profile.id, files);
  if (uploadError) {
    // The report itself was saved; surface the attachment problem.
    return { error: `Report saved, but: ${uploadError}` };
  }

  if (intent === "submitted") {
    const { data: submitted, error } = await supabase
      .from("reports")
      .update({ status: "submitted" })
      .eq("id", id)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();
    if (error) {
      return {
        error: `Report saved as a draft, but could not be submitted: ${error.message}`,
      };
    }
    if (!submitted) {
      return {
        error: "Report saved as a draft, but it could no longer be submitted",
      };
    }
  }

  revalidatePath("/reports");
  revalidatePath("/dashboard");
  redirect(`/reports/${id}`);
}

export async function deleteReport(formData: FormData) {
  const reportId = String(formData.get("report_id") ?? "");
  if (!reportId) redirect("/reports");

  const supabase = await createClient();

  // Remove storage objects first (rows cascade with the report).
  const { data: attachments } = await supabase
    .from("report_attachments")
    .select("storage_path")
    .eq("report_id", reportId);
  if (attachments && attachments.length > 0) {
    await supabase.storage
      .from("attachments")
      .remove(attachments.map((a) => a.storage_path));
  }

  await supabase.from("reports").delete().eq("id", reportId);
  revalidatePath("/reports");
  redirect("/reports");
}

export async function bulkDeleteReports(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await getProfile();
  if (!canManageAnyReport(profile.role)) {
    return {
      error:
        "Only an Admin or the Head of Department can delete multiple reports",
    };
  }

  const parsed = z
    .array(z.string().uuid())
    .min(1)
    .max(200)
    .safeParse(formData.getAll("report_ids"));
  if (!parsed.success) {
    return { error: "Select between 1 and 200 valid reports to delete" };
  }

  const reportIds = [...new Set(parsed.data)];
  const supabase = await createClient();
  const { data: attachments, error: attachmentError } = await supabase
    .from("report_attachments")
    .select("storage_path")
    .in("report_id", reportIds);
  if (attachmentError) return { error: attachmentError.message };

  if (attachments && attachments.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("attachments")
      .remove(attachments.map((attachment) => attachment.storage_path));
    if (storageError) return { error: storageError.message };
  }

  const { error: deleteError } = await supabase
    .from("reports")
    .delete()
    .in("id", reportIds);
  if (deleteError) return { error: deleteError.message };

  revalidatePath("/reports");
  revalidatePath("/dashboard");
  redirect("/reports");
}

export async function deleteAttachment(formData: FormData) {
  const attachmentId = String(formData.get("attachment_id") ?? "");
  const reportId = String(formData.get("report_id") ?? "");
  if (!attachmentId || !reportId) return;

  const supabase = await createClient();
  const { data: deleted } = await supabase
    .from("report_attachments")
    .delete()
    .eq("id", attachmentId)
    .select("storage_path")
    .maybeSingle();
  if (deleted) {
    await supabase.storage.from("attachments").remove([deleted.storage_path]);
  }
  revalidatePath(`/reports/${reportId}`);
}

export async function reviewReport(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await getProfile();
  const reportId = String(formData.get("report_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();

  if (!reportId || (decision !== "reviewed" && decision !== "rejected")) {
    return { error: "Invalid review request" };
  }
  if (decision === "reviewed" && !canMarkReviewed(profile.role)) {
    return {
      error: "You do not have permission to mark reports as reviewed",
    };
  }
  if (decision === "rejected" && !canRejectReport(profile.role)) {
    return {
      error: "Only an Admin or the Head of Department can reject a report",
    };
  }
  if (decision === "rejected" && !comment) {
    return { error: "A comment explaining the rejection is required" };
  }

  const supabase = await createClient();

  // A Coordinator decides on budget reports and their own only. RLS enforces it,
  // but reading the row first turns a silent "not awaiting review" into an
  // answer that says what actually happened.
  const { data: target } = await supabase
    .from("reports")
    .select("type, author_id")
    .eq("id", reportId)
    .maybeSingle();
  if (
    target &&
    !canDecideOnReport(
      profile.role,
      target.type as "budget" | "monthly",
      target.author_id === profile.id
    )
  ) {
    return { error: "A Coordinator can only review budget reports" };
  }

  // The RPC applies the status and feedback atomically; its update/insert still
  // run under the caller's RLS policies.
  const { data: updated, error } = await supabase.rpc("review_report", {
    p_report_id: reportId,
    p_decision: decision,
    p_comment: comment,
  });
  if (error) return { error: error.message };
  if (!updated) return { error: "This report is not awaiting review" };

  revalidatePath(`/reports/${reportId}`);
  revalidatePath("/reports");
  revalidatePath("/dashboard");
  return null;
}

export async function addComment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await getProfile();
  const reportId = String(formData.get("report_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!reportId) return { error: "Missing report" };
  if (!body) return { error: "Comment cannot be empty" };
  if (body.length > 4000) return { error: "Comment is too long" };

  const supabase = await createClient();
  const { error } = await supabase.from("report_comments").insert({
    report_id: reportId,
    author_id: profile.id,
    body,
  });
  if (error) return { error: error.message };

  revalidatePath(`/reports/${reportId}`);
  return null;
}
