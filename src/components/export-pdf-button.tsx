"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

// Print-to-PDF: the browser's own print dialog is what turns the page into a
// PDF, so this only has to trigger it. The clean letterhead layout that ends up
// in the file lives in PrintableBudgetReport plus the `@media print` rules in
// globals.css, which hide everything on the page except that region.
export function ExportPdfButton({ label = "Export PDF" }: { label?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={() => window.print()}
    >
      <Printer className="size-4" />
      {label}
    </Button>
  );
}
