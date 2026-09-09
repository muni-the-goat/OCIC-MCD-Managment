"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ICONS, useNavIcon, type NavIconKey } from "@/components/nav-icon";
import {
  canOpenUsersPage,
  livesOnProjectsOnly,
  seesProjectReports,
} from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: NavIconKey;
}

// One row of the rail. Its own component because each row holds a ref to its
// glyph, and a hook cannot be called inside the map that builds them.
function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const { ref, play, reset } = useNavIcon();
  const Icon = NAV_ICONS[item.icon];

  return (
    <Link
      href={item.href}
      // The hover lives on the row, not on the 16px glyph inside it. Bound
      // here, the animation answers the pointer arriving anywhere on the row,
      // which is the target the reader is actually aiming at.
      onMouseEnter={play}
      onMouseLeave={reset}
      onFocus={play}
      onBlur={reset}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon ref={ref} size={16} className="flex shrink-0" aria-hidden />
      {item.label}
    </Link>
  );
}

export function AppNav({ role }: { role: AppRole }) {
  const pathname = usePathname();

  // A VP Assistant has no marketing reporting to reach, so offering them a
  // Dashboard, a Reports list and a New report form would be three links to
  // pages that would show them nothing. Their nav is the projects side and
  // their profile, which is the whole of their job here.
  const projectsOnly = livesOnProjectsOnly(role);

  // The rail carries every destination. The phone's tab bar in
  // mobile-tab-bar.tsx carries five of them and drops the create actions —
  // the two lists differ on purpose, so a new page needs a decision in both.
  const items: NavItem[] = projectsOnly
    ? [
        { href: "/projects/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/projects", label: "Projects", icon: "projects" },
        { href: "/projects/new", label: "Project report", icon: "projectReport" },
        // A Vice President keeps account management, so the Users link
        // survives the projects-only nav on its own predicate. A VP Assistant
        // fails canOpenUsersPage() and simply does not see it.
        ...(canOpenUsersPage(role)
          ? [{ href: "/admin/users", label: "Users", icon: "users" as const }]
          : []),
        { href: "/profile", label: "Profile", icon: "profile" },
      ]
    : [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        // An Admin reads both sides, so both dashboards are named rather than
        // one of them being "Dashboard" and the other a page you have to know
        // about. The project report form is named here for the same reason: it
        // was reachable only through a button on the projects dashboard, so an
        // Admin standing on their own dashboard had no way to file a project
        // report and no sign that one existed.
        ...(seesProjectReports(role)
          ? [
              { href: "/projects", label: "Projects", icon: "projects" as const },
              {
                href: "/projects/dashboard",
                label: "Projects dashboard",
                icon: "projectsDashboard" as const,
              },
              {
                href: "/projects/new",
                label: "Project report",
                icon: "projectReport" as const,
              },
            ]
          : []),
        { href: "/reports", label: "Reports", icon: "reports" },
        { href: "/reports/new", label: "New report", icon: "newReport" },
        ...(canOpenUsersPage(role)
          ? [{ href: "/admin/users", label: "Users", icon: "users" as const }]
          : []),
        { href: "/profile", label: "Profile", icon: "profile" },
      ];

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        // "/projects" must not light up while on "/projects/new", the same way
        // "/reports" already steps aside for "/reports/new" — a parent that
        // stays highlighted under its own child makes the nav lie about where
        // you are.
        const active =
          item.href === "/reports"
            ? pathname === "/reports" || /^\/reports\/(?!new)/.test(pathname)
            : item.href === "/projects"
              ? pathname === "/projects"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return <NavLink key={item.href} item={item} active={active} />;
      })}
    </nav>
  );
}
