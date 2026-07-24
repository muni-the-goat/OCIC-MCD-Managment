import { LogOut } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { OcicLogo } from "@/components/ocic-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      {/* self-start stops the flex row from stretching the rail to the height of
          the document. Without it, `sticky` has nothing to travel against and
          anything pinned to the rail's bottom lands below the fold on a long
          page — which is where the profile block used to sit. */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col self-start border-r bg-sidebar p-4 md:flex">
        <div className="mb-6 px-3">
          <OcicLogo width={132} height={56} priority className="mb-3" />
          <p className="text-sm font-semibold tracking-tight">MCD Management</p>
          <p className="text-xs text-muted-foreground">Office report tracker</p>
        </div>
        <AppNav role={profile.role} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Who you are signed in as stays on screen at every scroll position,
            on both layouts. The logo only appears here below md, where the
            rail that carries it is hidden. */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/85 px-4 py-2.5 backdrop-blur supports-backdrop-filter:bg-background/70">
          <OcicLogo width={92} height={39} priority className="md:hidden" />
          <div className="ml-auto flex min-w-0 items-center gap-2.5">
            <div className="hidden min-w-0 text-right leading-tight sm:block">
              <p className="truncate text-sm font-medium">
                {profile.full_name || profile.email}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {profile.email}
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {roleLabel(profile.role)}
            </Badge>
            <form action={logout}>
              <Button variant="ghost" size="sm" className="gap-2">
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Sign out</span>
                <span className="sr-only sm:hidden">Sign out</span>
              </Button>
            </form>
          </div>
        </header>
        <div className="border-b px-4 py-2 md:hidden">
          <AppNav role={profile.role} />
        </div>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
