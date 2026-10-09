// Shared shapes for the redesigned marketing pages' controls, so a menu on the
// Reports list, on the dashboard and in the report form are the same object.

// A menu in a filter row wears the liquid tabs' pill shape and white surface,
// so the row reads as one control set rather than pills beside form fields.
// The height is also set on the data attribute because the trigger writes its
// own h-9 there, and that selector would otherwise win.
//
// On a touch screen the menu is the native picker, and iOS zooms the page
// into any control set below 16px the moment it is tapped — so it is 16px
// there and nowhere else.
export const PILL_MENU =
  "h-10 data-[size=default]:h-10 rounded-full border-transparent bg-card px-4 shadow-none pointer-coarse:text-base";

// A field inside a form is a rounded rectangle, not a pill: it holds typed
// text, and a capsule around a sentence reads as a button. Select and input
// share it so a month menu and the year beside it line up. 16px: iOS zooms
// the whole page into any field set smaller the moment it is tapped.
export const FORM_FIELD =
  "h-11 data-[size=default]:h-11 rounded-xl bg-card text-base shadow-none";
