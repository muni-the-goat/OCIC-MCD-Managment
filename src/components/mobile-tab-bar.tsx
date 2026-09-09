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

// The phone's navigation. Deliberately not the same list as the rail in
// AppNav: a rail can afford eight labelled rows, a tab bar holds five before
// the labels stop fitting. Two rules get it there, and both are visible below.
//
//   1. Create actions are not destinations. "New report" and "New project
//      report" are buttons on the pages they belong to — /reports, the
//      dashboard, /projects/dashboard — so a tab that lands on a blank form is
//      a slot spent on something the page already offers.
//   2. An Admin is the only role carrying both sides of the office at once.
//      The side they oversee rather than work in compresses to one tab.
//
// Adding a page? It needs a decision here as well as in AppNav — the two lists
// differ on purpose, so neither can be derived from the other.
interface Tab {
  href: string;
  label: string;
  icon: NavIconKey;
  // Which routes light this tab. Written per tab rather than as one rule,
  // because the same path means different things to different roles: for a VP
  // /projects/dashboard is their Dashboard, and for an Admin it is Projects.
  active: (pathname: string) => boolean;
}

function tabsFor(role: AppRole): Tab[] {
  const users: Tab[] = canOpenUsersPage(role)
    ? [
        {
          href: "/admin/users",
          label: "Users",
          icon: "users",
          active: (path) => path.startsWith("/admin/users"),
        },
      ]
    : [];
  const profile: Tab = {
    // Last slot. The rightmost tab is where a thumb goes looking for an
    // account, on every platform that has one.
    href: "/profile",
    label: "Profile",
    icon: "profile",
    active: (path) => path.startsWith("/profile"),
  };

  if (livesOnProjectsOnly(role)) {
    return [
      {
        href: "/projects/dashboard",
        label: "Dashboard",
        icon: "dashboard",
        active: (path) => path === "/projects/dashboard",
      },
      {
        // The table, plus the form reached from it. Not merged into the
        // dashboard the way an Admin's is: the projects side is the whole of
        // this role's app, and collapsing it would leave a two-tab bar.
        href: "/projects",
        label: "Projects",
        icon: "projects",
        active: (path) => path === "/projects" || path.startsWith("/projects/new"),
      },
      ...users,
      profile,
    ];
  }

  return [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: "dashboard",
      active: (path) => path === "/dashboard",
    },
    // One tab for the entire projects side, landing on its dashboard — which
    // is already the only page carrying a "New project report" button, so it
    // was the front door before it was the tab.
    ...(seesProjectReports(role)
      ? [
          {
            href: "/projects/dashboard",
            label: "Projects",
            icon: "projects" as const,
            active: (path: string) => path.startsWith("/projects"),
          },
        ]
      : []),
    {
      // "/reports/new" lights this tab rather than nothing. The rail excludes
      // it, because there it would fight the rail's own "New report" row; here
      // there is no such row, and a bar with no lit tab reads as broken.
      href: "/reports",
      label: "Reports",
      icon: "reports",
      active: (path) => path.startsWith("/reports"),
    },
    ...users,
    profile,
  ];
}

function TabLink({ tab, active }: { tab: Tab; active: boolean }) {
  const { ref, play } = useNavIcon();
  const Icon = NAV_ICONS[tab.icon];

  return (
    <Link
      href={tab.href}
      // Pointer down, not hover — there is none here — and not arrival either.
      // Every route behind these tabs is dynamic and can take a few hundred
      // milliseconds, and an acknowledgement that waits for the server is not
      // an acknowledgement of the touch. No reset on the way out: the tap is
      // over by the time the finger lifts.
      onPointerDown={play}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      <Icon ref={ref} size={22} className="flex shrink-0" aria-hidden />
      <span className="max-w-full truncate font-label text-[10px] font-medium leading-none">
        {tab.label}
      </span>
    </Link>
  );
}

export function MobileTabBar({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const tabs = tabsFor(role);

  return (
    <nav
      aria-label="Primary"
      // z-30: above the page, below the dialogs and selects at z-50. The
      // header sits at z-20 and they never meet.
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden"
      // The inset is padding rather than height, so the bar's own row keeps its
      // full touch target and the home indicator gets its clearance beneath it.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex h-(--tab-bar-height) items-stretch">
        {tabs.map((tab) => (
          <li key={tab.href} className="flex min-w-0 flex-1">
            <TabLink tab={tab} active={tab.active(pathname)} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
