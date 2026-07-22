"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canResetPasswords, getProfile } from "@/lib/auth";
import { departmentId } from "@/lib/departments";
import { ALLOWED_EMAIL_DOMAIN, isAllowedEmail } from "@/lib/login-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole, Department, Profile } from "@/lib/types";

const UNASSIGNED = "unassigned";

const ROLES = [
  "admin",
  "head_of_department",
  "coordinator",
  "manager",
  "staff",
] as const;

export type UserActionState =
  | { error: string }
  | { success: string; tempPassword?: string }
  | null;

// A Head of Department manages accounts exactly as an Admin does, with two
// carve-outs that exist to keep "cannot reset passwords" from being decorative:
// they cannot grant the admin role, and cannot touch an admin account. Without
// both, the restriction is one promotion away from meaningless.
async function requireUserManager(): Promise<
  { profile: Profile } | { error: string }
> {
  const profile = await getProfile();
  if (profile.role !== "admin" && profile.role !== "head_of_department") {
    return { error: "You do not have permission to manage accounts" };
  }
  return { profile };
}

async function guardTarget(
  actor: Profile,
  targetId: string,
  admin: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  if (actor.role === "admin") return null;
  const { data: target, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", targetId)
    .maybeSingle();
  if (error) return error.message;
  if (!target) return "User not found";
  if (target.role === "admin") {
    return "Only an Admin can change or remove an Admin account";
  }
  return null;
}

function guardGrantedRole(actor: Profile, role: AppRole): string | null {
  if (actor.role === "admin") return null;
  if (role === "admin") {
    return "Only an Admin can grant the Admin role";
  }
  return null;
}

// The select submits a sentinel rather than an empty string, because an empty
// string would fail the foreign key instead of clearing the column. Departments
// are rows now, so validity is a lookup rather than a list in this file.
async function parseDepartment(
  value: string,
  admin: ReturnType<typeof createAdminClient>
): Promise<{ department: Department | null } | { error: string }> {
  if (!value || value === UNASSIGNED) return { department: null };
  const { data, error } = await admin
    .from("departments")
    .select("id")
    .eq("id", value)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Choose a department from the list" };
  return { department: data.id as Department };
}

function generateTempPassword() {
  // 16 chars from a set without ambiguous characters.
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

const inviteSchema = z.object({
  // An address outside the office domain would be rejected at login, so refuse
  // to create the account in the first place.
  email: z
    .email("Enter a valid email address")
    .refine(isAllowedEmail, `The email must end with ${ALLOWED_EMAIL_DOMAIN}`),
  full_name: z.string().trim().min(1, "Full name is required").max(120),
  role: z.enum(ROLES),
});

export async function inviteUser(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const auth = await requireUserManager();
  if ("error" in auth) return auth;

  const parsed = inviteSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    full_name: formData.get("full_name"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const grantError = guardGrantedRole(auth.profile, parsed.data.role);
  if (grantError) return { error: grantError };

  const admin = createAdminClient();
  const departmentResult = await parseDepartment(
    String(formData.get("department") ?? UNASSIGNED),
    admin
  );
  if ("error" in departmentResult) return departmentResult;

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

  // Every profile is created as staff with no department by the database
  // trigger. Assign both only here, behind the service-role client and the
  // admin guard.
  const { data: updatedProfile, error: roleError } = await admin
    .from("profiles")
    .update({
      role: parsed.data.role,
      department: departmentResult.department,
    })
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
  const auth = await requireUserManager();
  if ("error" in auth) return auth;
  const me = auth.profile;

  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "") as AppRole;
  if (!userId || !(ROLES as readonly string[]).includes(role)) {
    return { error: "Invalid request" };
  }
  if (userId === me.id) {
    return { error: "You cannot change your own role" };
  }

  const grantError = guardGrantedRole(me, role);
  if (grantError) return { error: grantError };

  const admin = createAdminClient();
  const targetError = await guardTarget(me, userId, admin);
  if (targetError) return { error: targetError };

  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { success: "Role updated" };
}

export async function updateUserDepartment(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  // Unlike the role, one may set their own department — it grants no privilege,
  // and everyone belongs to a department the same as anyone else.
  const auth = await requireUserManager();
  if ("error" in auth) return auth;

  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { error: "Invalid request" };

  const admin = createAdminClient();
  const targetError = await guardTarget(auth.profile, userId, admin);
  if (targetError) return { error: targetError };

  const parsed = await parseDepartment(
    String(formData.get("department") ?? UNASSIGNED),
    admin
  );
  if ("error" in parsed) return parsed;

  const { error } = await admin
    .from("profiles")
    .update({ department: parsed.department })
    .eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { success: "Department updated" };
}

const createDepartmentSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, "Enter a department name")
    .max(60, "Department name is too long"),
  short: z.string().trim().max(24, "Short name is too long"),
});

export async function createDepartment(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const auth = await requireUserManager();
  if ("error" in auth) return auth;

  const parsed = createDepartmentSchema.safeParse({
    label: formData.get("label"),
    short: String(formData.get("short") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const id = departmentId(parsed.data.label);
  // The id is frozen once a profile stores it, so a name that generates nothing
  // usable has to be refused now rather than corrected later.
  if (!/^[a-z][a-z0-9_]{1,48}$/.test(id)) {
    return {
      error: "Use a name with at least two letters or numbers",
    };
  }

  const admin = createAdminClient();
  const { data: clash, error: clashError } = await admin
    .from("departments")
    .select("id, label")
    .or(`id.eq.${id},label.ilike.${parsed.data.label}`)
    .maybeSingle();
  if (clashError) return { error: clashError.message };
  if (clash) return { error: `${clash.label} already exists` };

  // New departments sort after the eight seeded ones, in creation order.
  const { data: last } = await admin
    .from("departments")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await admin.from("departments").insert({
    id,
    label: parsed.data.label,
    short: parsed.data.short || parsed.data.label,
    sort_order: (last?.sort_order ?? 0) + 10,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  revalidatePath("/dashboard");
  return { success: `${parsed.data.label} added` };
}

export async function resetUserPassword(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  // The one power a Head of Department does not inherit from Admin.
  const me = await getProfile();
  if (!canResetPasswords(me.role)) {
    return { error: "You do not have permission to reset passwords" };
  }

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
  const auth = await requireUserManager();
  if ("error" in auth) return auth;
  const me = auth.profile;

  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { error: "Invalid request" };
  if (userId === me.id) return { error: "You cannot delete your own account" };

  const admin = createAdminClient();
  const targetError = await guardTarget(me, userId, admin);
  if (targetError) return { error: targetError };

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
