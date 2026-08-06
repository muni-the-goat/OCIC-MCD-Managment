"use client";

import { useSyncExternalStore } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// One dropdown, two widgets: the phone gets the operating system's picker, the
// desktop keeps the designed list.
//
// Asked for by the Vice President's office after iOS 26 started drawing native
// pickers in its own glass material. Both readings were right — the picker is
// the control a phone user knows, with the system's own wheel and touch
// targets, and the OS-drawn list on a laptop would drop the app's type and
// colour for whatever Windows or macOS felt like. So the choice is made per
// device rather than once for everybody.
//
// The options are data rather than children, because a call site that wrote its
// list twice — once as <option>, once as <SelectItem> — would eventually be
// edited in one place only. There is exactly one list here.

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectOptionGroup {
  // A group with no label is a run of loose options above the labelled ones,
  // which is how "All categories" sits above the tiers.
  label?: string;
  options: SelectOption[];
}

// Below Tailwind's `md`. The same line the rest of the app changes layout at,
// so a viewport that is showing the mobile layout is showing the mobile picker.
const MOBILE_QUERY = "(max-width: 767px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// The server cannot know the viewport, so it renders the desktop control and a
// phone swaps after hydration. The two share a trigger style, so the swap is
// invisible: same height, same border, same type. Rendering both and hiding one
// in CSS would avoid even that, at the cost of two controls in the document for
// every dropdown — two ids, two form fields, and a screen reader reading the
// list twice.
function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false
  );
}

function toGroups(
  options: SelectOption[] | SelectOptionGroup[]
): SelectOptionGroup[] {
  if (options.length === 0) return [];
  return "value" in options[0]
    ? [{ options: options as SelectOption[] }]
    : (options as SelectOptionGroup[]);
}

export function ResponsiveSelect({
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  id,
  disabled,
  placeholder,
  className,
  size = "default",
  "aria-label": ariaLabel,
}: {
  options: SelectOption[] | SelectOptionGroup[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  // Set where the value is posted with a form rather than read from state.
  name?: string;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  size?: "sm" | "default";
  "aria-label"?: string;
}) {
  const isMobile = useIsMobile();
  const groups = toGroups(options);

  if (isMobile) {
    return (
      <select
        id={id}
        name={name}
        disabled={disabled}
        aria-label={ariaLabel}
        // Uncontrolled where the caller is uncontrolled, so a form field keeps
        // behaving like a form field.
        {...(value === undefined ? { defaultValue } : { value })}
        onChange={(event) => onValueChange?.(event.target.value)}
        className={cn(
          // The trigger's shape, so switching between the two is not switching
          // between two designs.
          //
          // No vertical padding, unlike the trigger it copies. The trigger is a
          // flex box and centres its own text; a native select is not, so a
          // fixed height with py-2 left 14px of content box for a 20px line and
          // clipped every label through the middle. The height centres the text
          // on its own.
          "rounded-md border border-input bg-transparent pr-2 pl-2.5 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
          size === "sm" ? "h-8" : "h-9",
          className
        )}
      >
        {placeholder && value === undefined && defaultValue === undefined ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {groups.map((group, index) =>
          group.label ? (
            // iOS draws these headings in its picker, so the three tiers stay
            // three tiers.
            <optgroup key={group.label} label={group.label}>
              {group.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ) : (
            group.options.map((option) => (
              <option key={`${index}:${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))
          )
        )}
      </select>
    );
  }

  return (
    <Select
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      name={name}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        size={size}
        className={className}
        aria-label={ariaLabel}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {groups.map((group, index) =>
          group.label ? (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : (
            group.options.map((option) => (
              <SelectItem key={`${index}:${option.value}`} value={option.value}>
                {option.label}
              </SelectItem>
            ))
          )
        )}
      </SelectContent>
    </Select>
  );
}
