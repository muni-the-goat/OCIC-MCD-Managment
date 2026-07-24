"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// `document` only exists on the client, and the snapshot differs between server
// (false) and client (true), so React commits the portal after hydration without
// a mismatch — the hydration-safe alternative to a setState-in-effect mount flag.
const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

// Renders its children as a direct child of <body>, so the print document sits
// as a sibling of the app shell rather than nested deep inside it. That lets the
// print stylesheet `display:none` the whole shell and leave the document in
// normal flow — an absolutely-positioned region instead leaves its hidden
// siblings occupying height, which padded the PDF out with blank trailing pages.
export function PrintPortal({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();
  if (!mounted) return null;
  return createPortal(children, document.body);
}
