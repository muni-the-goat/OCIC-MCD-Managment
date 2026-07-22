import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { DepartmentRecord } from "@/lib/departments";

// Departments live in a table as of migration 0013, so the list is data rather
// than a constant. cache() dedupes the read across a single request — several
// server components on one page each need it.
export const getDepartments = cache(async (): Promise<DepartmentRecord[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("departments")
    .select("id, label, short, sort_order")
    .order("sort_order")
    .order("label");
  return (data ?? []) as DepartmentRecord[];
});
