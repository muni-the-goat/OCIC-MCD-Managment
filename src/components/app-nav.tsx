"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CircleUser,
  FilePlus2,
  Files,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  canOpenUsersPage,
  livesOnProjectsOnly,
  seesProjectReports,
} from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/types";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  reports: Files,
  new: FilePlus2,
  users: Users,
  profile: CircleUser,
  projects: Building2,
};

export function AppNav({ role }: { role: AppRole }) {
  const pathname = usePathname();

  // A VP Assistant has no marketing reporting to reach, so offering them a
  // Dashboard, a Reports list and a New report form would be three links to
  // pages that would show them nothing. Their nav is the projects side and
  // their profile, which is the whole of their job here.
  const projectsOnly = livesOnProjectsOnly(role);

  const items = projectsOnly
    ? [
        { href: "/projects", label: "Projects", icon: "projects" },
        { href: "/projects/new", label: "Project report", icon: "new" },
        // A Vice President keeps account management, so the Users link
        // survives the projects-only nav on its own predicate. A VP Assistant
        // fails canOpenUsersPage() and simply does not see it.
        ...(canOpenUsersPage(role)
          ? [{ href: "/admin/users", label: "Users", icon: "users" }]
          : []),
        { href: "/profile", label: "Profile", icon: "profile" },
      ]
    : [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        ...(seesProjectReports(role)
          ? [{ href: "/projects", label: "Projects", icon: "projects" }]
          : []),
        { href: "/reports", label: "Reports", icon: "reports" },
        { href: "/reports/new", label: "New report", icon: "new" },
        ...(canOpenUsersPage(role)
          ? [{ href: "/admin/users", label: "Users", icon: "users" }]
          : []),
        { href: "/profile", label: "Profile", icon: "profile" },
      ];

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
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
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
