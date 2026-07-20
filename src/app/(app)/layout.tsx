import { LogOut } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { OcicLogo } from "@/components/ocic-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getProfile } from "@/lib/auth";
import { roleLabel } from "@/lib/types";
import { logout } from "@/app/login/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar p-4 md:flex">
        <div className="mb-6 px-3">
          <OcicLogo width={132} height={56} priority className="mb-3" />
          <p className="text-sm font-semibold tracking-tight">MCD Management</p>
          <p className="text-xs text-muted-foreground">Office report tracker</p>
        </div>
        <AppNav role={profile.role} />
        <div className="mt-auto space-y-3">
          <Separator />
          <div className="px-3">
            <p className="truncate text-sm font-medium">
              {profile.full_name || profile.email}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {profile.email}
            </p>
            <Badge variant="secondary" className="mt-1">
              {roleLabel(profile.role)}
            </Badge>
          </div>
          <form action={logout}>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-4 py-3 md:hidden">
          <OcicLogo width={92} height={39} priority />
          <form action={logout}>
            <Button variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </header>
        <div className="border-b px-4 py-2 md:hidden">
          <AppNav role={profile.role} />
        </div>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
