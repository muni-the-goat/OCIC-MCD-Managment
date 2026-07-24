import { ChangePasswordForm } from "@/components/change-password-form";
import { DepartmentBadge } from "@/components/department-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProfile } from "@/lib/auth";
import { departmentLabel } from "@/lib/departments";
import { getDepartments } from "@/lib/departments-server";
import { roleLabel } from "@/lib/types";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const profile = await getProfile();
  const departments = await getDepartments();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your profile</h1>
        <p className="text-sm text-muted-foreground">
          Your account details and password.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Your role and department are set by an administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Name
            </p>
            <p className="text-sm font-medium">{profile.full_name || "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Email
            </p>
            <p className="text-sm font-medium">{profile.email}</p>
          </div>
          <div className="space-y-1">
            <p className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Role
            </p>
            <Badge variant="secondary">{roleLabel(profile.role)}</Badge>
          </div>
          <div className="space-y-1">
            <p className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Department
            </p>
            <DepartmentBadge
              label={departmentLabel(profile.department, departments)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            If you signed in with the temporary password from your invite, set
            your own here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
