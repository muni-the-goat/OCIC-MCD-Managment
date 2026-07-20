"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FilePlus2,
  Files,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/types";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  reports: Files,
  new: FilePlus2,
  users: Users,
};

export function AppNav({ role }: { role: AppRole }) {
  const pathname = usePathname();

  const items = [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/reports", label: "Reports", icon: "reports" },
    { href: "/reports/new", label: "New report", icon: "new" },
    ...(role === "admin" || role === "coordinator"
      ? [{ href: "/admin/users", label: "Users", icon: "users" }]
      : []),
  ];

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active =
          item.href === "/reports"
            ? pathname === "/reports" || /^\/reports\/(?!new)/.test(pathname)
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
