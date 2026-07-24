"use server";

import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Shaped to match UserActionState (error | success), so the shared
// useActionToasts hook surfaces the result without a second variant.
export type ProfileActionState =
  | { error: string }
  | { success: string }
  | null;

const schema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    next: z.string().min(8, "New password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((data) => data.next === data.confirm, {
    message: "The new passwords do not match",
    path: ["confirm"],
  })
  .refine((data) => data.next !== data.current, {
    message: "Choose a password different from your current one",
    path: ["next"],
  });

// A user changing their own password. Deliberately re-checks the current
// password first: updateUser trusts the session alone, so without this a
// hijacked or borrowed session could set a new password and lock the owner out.
export async function changePassword(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const profile = await getProfile();

  const parsed = schema.safeParse({
    current: String(formData.get("current") ?? ""),
    next: String(formData.get("next") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();

  // Re-authenticate with the current password. signInWithPassword on the same
  // account only refreshes the session; a wrong password is the real check.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: parsed.data.current,
  });
  if (reauthError) {
    return { error: "Your current password is incorrect" };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.next,
  });
  if (error) return { error: error.message };

  return { success: "Password updated" };
}
