"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canSetBudgetApproval, getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type BudgetApprovalState = { error: string } | { success: string } | null;

const schema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  // Accepts what people actually paste out of a spreadsheet — "$150,000.00" —
  // rather than making them strip the formatting the figure arrives with.
  amount: z
    .string()
    .transform((value) => value.replace(/[^0-9.]/g, ""))
    .refine((value) => value !== "" && Number.isFinite(Number(value)), {
      message: "Enter the approved amount",
    })
    .transform((value) => Number(value))
    .refine((value) => value >= 0 && value <= 999_999_999, {
      message: "Enter an amount between 0 and 999,999,999",
    }),
});

export async function setBudgetApproval(
  _prev: BudgetApprovalState,
  formData: FormData
): Promise<BudgetApprovalState> {
  // The Head of Department alone, Admin included in the exclusion. This is the
  // one action in the app an Admin cannot take: approving a budget is financial
  // authority, not administrative authority. The write uses the service-role
  // client, which bypasses RLS, so this check is the enforcement — there is no
  // second layer behind it.
  const profile = await getProfile();
  if (!canSetBudgetApproval(profile.role)) {
    return {
      error: "Only the Head of Department can set the approved budget",
    };
  }

  const parsed = schema.safeParse({
    year: formData.get("year"),
    amount: String(formData.get("amount") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid amount" };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("budget_approvals").upsert(
    {
      year: parsed.data.year,
      amount: parsed.data.amount,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    },
    { onConflict: "year" }
  );
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: `Approved budget for FY ${parsed.data.year} saved` };
}
