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

// A labelled run of rows. The label is optional: it is only worth printing
// when the rail holds more than one kind of work, which is the Admin's rail
// alone. Everyone else gets the same grouping as space, without the words.
interface NavGroup {
  label?: string;
  items: NavItem[];
}

// One row of the rail. Its own component because each row holds a ref to its
// glyph, and a hook cannot be called inside the map that builds them.
//
// The current page is a tint, not a fill. The brand red is also the colour of
// every primary button and of Reject, and a solid red row on every screen made
// "where you are" the loudest thing in the window. Selection in a sidebar is
// wayfinding, not an action, so it takes the quieter of the two treatments.
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
        "flex min-h-9 items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-primary/10 font-semibold text-primary"
          : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
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
  const account: NavGroup = {
    label: "Account",
    items: [
      // A Vice President keeps account management, so the Users link
      // survives the projects-only nav on its own predicate. A VP Assistant
      // fails canOpenUsersPage() and simply does not see it.
      ...(canOpenUsersPage(role)
        ? [{ href: "/admin/users", label: "Users", icon: "users" as const }]
        : []),
      { href: "/profile", label: "Profile", icon: "profile" },
    ],
  };

  // The projects side, named the same and in the same order wherever it
  // appears, so an Admin and a Vice President are pointing at the same rows.
  const projects: NavItem[] = [
    { href: "/projects", label: "Projects", icon: "projects" },
    {
      href: "/projects/dashboard",
      label: projectsOnly ? "Dashboard" : "Projects dashboard",
      icon: projectsOnly ? "dashboard" : "projectsDashboard",
    },
    { href: "/projects/new", label: "Project report", icon: "projectReport" },
  ];

  const groups: NavGroup[] = projectsOnly
    ? [
        // Dashboard first: it is this role's home, as "/" sends them there.
        { items: [projects[1], projects[0], projects[2]] },
        account,
      ]
    : [
        {
          label: "Marketing",
          items: [
            { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
            { href: "/reports", label: "Reports", icon: "reports" },
            { href: "/reports/new", label: "New report", icon: "newReport" },
          ],
        },
        // An Admin reads both sides, so both are named rather than one of them
        // being a page you have to know about. The project report form is named
        // here for the same reason: an Admin standing on their own dashboard
        // otherwise had no way to file a project report and no sign one existed.
        ...(seesProjectReports(role)
          ? [{ label: "Projects", items: projects }]
          : []),
        account,
      ];
  // Headings only earn their place when there is more than one kind of work
  // to tell apart. With one, they would label the obvious.
  const showLabels = groups.length > 2;

  const isActive = (href: string) =>
    // "/projects" must not light up while on "/projects/new", the same way
    // "/reports" already steps aside for "/reports/new" — a parent that stays
    // highlighted under its own child makes the nav lie about where you are.
    href === "/reports"
      ? pathname === "/reports" || /^\/reports\/(?!new)/.test(pathname)
      : href === "/projects"
        ? pathname === "/projects"
        : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="flex flex-col gap-5">
      {groups.map((group, index) => (
        <div
          key={group.label ?? index}
          role="group"
          aria-label={group.label}
          className="flex flex-col gap-0.5"
        >
          {showLabels && group.label ? (
            <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">
              {group.label}
            </p>
          ) : null}
          {group.items.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>
      ))}
    </nav>
  );
}
