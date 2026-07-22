import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Every department shares one chip style, deliberately. Department is an
// attribute of a person, not a state of a report, and giving each its own hue
// would put categorical colours directly beside the Status column — the one
// place in those rows where colour already carries meaning. The set is also open
// now that departments are rows in a table, so per-department hues would run out
// the first time someone added a ninth.
//
// The one distinction worth drawing is assigned versus not: a filled chip is a
// real department, a dashed outline is an empty field. That makes the gaps
// scannable too, which matters while accounts are still unassigned.
//
// Takes a resolved label rather than an id, because resolving needs the
// department list and that is a server-side read.
export function DepartmentBadge({
  label,
  className,
}: {
  label: string | null;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        label
          ? "border-department-edge bg-department text-department-foreground"
          : "border-dashed border-input bg-transparent font-normal text-muted-foreground",
        className
      )}
    >
      {label ?? "Unassigned"}
    </Badge>
  );
}
