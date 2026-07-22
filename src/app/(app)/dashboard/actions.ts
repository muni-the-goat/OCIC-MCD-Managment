"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProfile, isPrivileged } from "@/lib/auth";
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
  // Approving a budget is not the same as reading one: a Coordinator sees every
  // team's spend and the approved figure, and still does not set it.
  const profile = await getProfile();
  if (!isPrivileged(profile.role)) {
    return { error: "Only an Admin or the Head of Department can set the approved budget" };
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
