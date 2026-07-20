"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type UserActionState =
  | { error: string }
  | { success: string; tempPassword?: string }
  | null;

function generateTempPassword() {
  // 16 chars from a set without ambiguous characters.
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

const inviteSchema = z.object({
  email: z.email("Enter a valid email address"),
  full_name: z.string().trim().min(1, "Full name is required").max(120),
  role: z.enum([
    "admin",
    "head_of_department",
    "coordinator",
    "manager",
    "staff",
  ]),
});

export async function inviteUser(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  await requireRole("admin");

  const parsed = inviteSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    full_name: formData.get("full_name"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  // createUser (not inviteUserByEmail) avoids needing SMTP: the admin hands
  // the temp password to the user directly.
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.full_name,
    },
  });
  if (error) return { error: error.message };

  // Every profile is created as staff by the database trigger. Assign the
  // requested role only here, behind the service-role client and admin guard.
  const { data: updatedProfile, error: roleError } = await admin
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", data.user.id)
    .select("id")
    .maybeSingle();
  if (roleError || !updatedProfile) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(
      data.user.id
    );
    const detail = roleError?.message ?? "The new profile was not created";
    return {
      error: cleanupError
        ? `${detail}. The incomplete account could not be removed: ${cleanupError.message}`
        : `${detail}. The incomplete account was removed.`,
    };
  }

  revalidatePath("/admin/users");
  return {
    success: `Account created for ${parsed.data.email}. Share this temporary password with them securely — it won't be shown again:`,
    tempPassword,
  };
}

export async function updateUserRole(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const me = await requireRole("admin");

  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (
    !userId ||
    ![
      "admin",
      "head_of_department",
      "coordinator",
      "manager",
      "staff",
    ].includes(role)
  ) {
    return { error: "Invalid request" };
  }
  if (userId === me.id) {
    return { error: "You cannot change your own role" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { success: "Role updated" };
}

export async function resetUserPassword(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const me = await requireRole("admin", "coordinator");

  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { error: "Invalid request" };
  if (userId === me.id) {
    return { error: "Reset your own password from your Supabase account instead" };
  }

  const admin = createAdminClient();
  if (me.role === "coordinator") {
    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (targetError) return { error: targetError.message };
    if (!target) return { error: "User not found" };
    if (target.role === "admin" || target.role === "head_of_department") {
      return {
        error:
          "Coordinators cannot reset Admin or Head of Department passwords",
      };
    }
  }

  const tempPassword = generateTempPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
  });
  if (error) return { error: error.message };

  return {
    success:
      "Password reset. Share this temporary password securely — it won't be shown again:",
    tempPassword,
  };
}

export async function deleteUser(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const me = await requireRole("admin");

  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { error: "Invalid request" };
  if (userId === me.id) return { error: "You cannot delete your own account" };

  const admin = createAdminClient();
  const { data: reports, error: reportsError } = await admin
    .from("reports")
    .select("id")
    .eq("author_id", userId);
  if (reportsError) return { error: reportsError.message };

  let storagePaths: string[] = [];
  const reportIds = (reports ?? []).map((report) => report.id);
  if (reportIds.length > 0) {
    const { data: attachments, error: attachmentsError } = await admin
      .from("report_attachments")
      .select("storage_path")
      .in("report_id", reportIds);
    if (attachmentsError) return { error: attachmentsError.message };
    storagePaths = (attachments ?? []).map(
      (attachment) => attachment.storage_path
    );
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  if (storagePaths.length > 0) {
    const { error: storageError } = await admin.storage
      .from("attachments")
      .remove(storagePaths);
    if (storageError) {
      revalidatePath("/admin/users");
      return {
        success: `User deleted, but some attachment files could not be cleaned up: ${storageError.message}`,
      };
    }
  }

  revalidatePath("/admin/users");
  return { success: "User deleted" };
}
