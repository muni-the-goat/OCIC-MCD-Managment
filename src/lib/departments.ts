import type { Department } from "@/lib/types";

// Pure department helpers, free of any server import so client components can
// use them. The reader that actually hits the table is in
// src/lib/departments-server.ts — same split as roles.ts vs auth.ts, and for the
// same reason: importing the server module from a client component would drag
// the Supabase server client into the browser bundle.

export interface DepartmentRecord {
  id: Department;
  label: string;
  // Short form, for the department × month matrix headers only. Never use it
  // where a department stands on its own — "Brand" and "Product" are not names.
  short: string;
  sort_order: number;
}

export function departmentLabel(
  department: Department | null | undefined,
  departments: DepartmentRecord[]
) {
  if (!department) return null;
  // A department that no longer exists still reads as something rather than as
  // nothing — the id is at least a clue, and null means "never assigned".
  return (
    departments.find((entry) => entry.id === department)?.label ?? department
  );
}

// Turns a typed name into the frozen id stored on every profile. The Add
// department dialog previews the result, so this has to run in the browser too.
export function departmentId(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}
