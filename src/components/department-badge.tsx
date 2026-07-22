import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { departmentLabel, type Department } from "@/lib/types";

// Every department shares one chip style, deliberately. Department is an
// attribute of a person, not a state of a report, and giving each of the eight
// its own hue would put eight categorical colours directly beside the Status
// column — the one place in these rows where colour already carries meaning.
// Eight hues also cannot be told apart under colour-vision deficiency, so the
// colour would be decoration that some readers cannot use.
//
// The one distinction worth drawing is assigned versus not: a filled chip is a
// real department, a dashed outline is an empty field. That makes the gaps
// scannable too, which matters while most accounts are still unassigned.
export function DepartmentBadge({
  department,
  className,
}: {
  department: Department | null | undefined;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        department
          ? "border-department-edge bg-department text-department-foreground"
          : "border-dashed border-input bg-transparent font-normal text-muted-foreground",
        className
      )}
    >
      {departmentLabel(department)}
    </Badge>
  );
}
