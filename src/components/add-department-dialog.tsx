"use client";

import { useActionState, useCallback, useState } from "react";
import { Building2 } from "lucide-react";
import {
  createDepartment,
  type UserActionState,
} from "@/app/(app)/admin/users/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToasts } from "@/components/use-action-toasts";
import { departmentId } from "@/lib/departments";
import { toast } from "sonner";

export function AddDepartmentDialog() {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [state, formAction, pending] = useActionState<UserActionState, FormData>(
    createDepartment,
    null
  );
  useActionToasts(
    state,
    useCallback((result: { success: string }) => {
      toast.success(result.success);
      setOpen(false);
      setLabel("");
    }, [])
  );

  const id = departmentId(label);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Building2 className="size-4" />
          Add department
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a department</DialogTitle>
          <DialogDescription>
            It becomes available immediately wherever a department is assigned or
            shown. Existing reports are unaffected until someone is moved into
            it.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state && "error" in state ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="department-label">Name</Label>
            <Input
              id="department-label"
              name="label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Corporate Communications"
              required
              maxLength={60}
              autoComplete="off"
            />
            {/* The id is what every profile stores, and it is frozen at
                creation — renaming the department later changes only the label.
                Showing it now is cheaper than explaining it afterwards. */}
            <p className="text-xs text-muted-foreground">
              {id ? (
                <>
                  Stored as <code className="font-mono">{id}</code>. This cannot
                  be changed later.
                </>
              ) : (
                "Used across reports, charts, and the Users page."
              )}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="department-short">Short name (optional)</Label>
            <Input
              id="department-short"
              name="short"
              placeholder="Corporate"
              maxLength={24}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Used only for column headers in the department × month spend table,
              where full names make it too wide to read. Defaults to the name.
            </p>
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Adding…" : "Add department"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
