"use client";

import { useCallback, useRef } from "react";
import { ChartPieIcon } from "@/components/ui/chart-pie";
import { FilePenLineIcon } from "@/components/ui/file-pen-line";
import { FileTextIcon } from "@/components/ui/file-text";
import { FolderKanbanIcon } from "@/components/ui/folder-kanban";
import { LayoutGridIcon } from "@/components/ui/layout-grid";
import { SquarePenIcon } from "@/components/ui/square-pen";
import { UserIcon } from "@/components/ui/user";
import { UsersIcon } from "@/components/ui/users";

// The navigation's glyphs, shared by the rail and the phone's tab bar so the
// same destination is never two different pictures depending on the width of
// the screen.
//
// One key per row rather than one per picture. The rail used to spend a single
// LayoutDashboard on both "Dashboard" and "Projects dashboard", and a single
// FilePlus2 on both report forms — legible while the labels are there to
// separate them, and the reason the phone could not drop those labels. Eight
// rows, eight glyphs.
export type NavIconKey =
  | "dashboard"
  | "projects"
  | "projectsDashboard"
  | "projectReport"
  | "reports"
  | "newReport"
  | "users"
  | "profile";

interface IconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

type AnimatedIcon = React.ForwardRefExoticComponent<
  React.HTMLAttributes<HTMLDivElement> & { size?: number } & React.RefAttributes<IconHandle>
>;

// The animated registry has no building, no layout-dashboard and no
// circle-user, so three of these are the nearest distinct stand-in rather than
// the glyph the static rail used to carry.
export const NAV_ICONS: Record<NavIconKey, AnimatedIcon> = {
  dashboard: LayoutGridIcon as AnimatedIcon,
  projects: FolderKanbanIcon as AnimatedIcon,
  projectsDashboard: ChartPieIcon as AnimatedIcon,
  projectReport: FilePenLineIcon as AnimatedIcon,
  reports: FileTextIcon as AnimatedIcon,
  newReport: SquarePenIcon as AnimatedIcon,
  users: UsersIcon as AnimatedIcon,
  profile: UserIcon as AnimatedIcon,
};

// These icons ship with their own hover handlers bound to the icon's 16px box.
// In a nav row that box is a twelfth of what the pointer is actually over, so
// attaching a ref — which switches the component into controlled mode and
// disables those handlers — and driving it from the row is what makes the whole
// row the trigger. It is also the only way to drive one at all on a phone,
// where there is no hover to bind to.
//
// Reduced motion is read at event time rather than cached, matching CountUp:
// the setting can change while the page is open.
export function useNavIcon() {
  const ref = useRef<IconHandle>(null);

  const play = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    ref.current?.startAnimation();
  }, []);

  // Returns the glyph to rest, for a pointer leaving mid-animation.
  const reset = useCallback(() => {
    ref.current?.stopAnimation();
  }, []);

  return { ref, play, reset };
}
