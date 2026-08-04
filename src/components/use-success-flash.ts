"use client";

import { useEffect, useState } from "react";

// True for a moment after a Server Action returns a success, so a button can
// show a checkmark and then quietly go back to being a button.
//
// The dwell is 1.8s. Short enough that it never blocks a second attempt, long
// enough to be seen by someone who looked away as they clicked — under about a
// second the checkmark reads as a flicker rather than an answer.
//
// `flashing` is derived, not stored. The only thing held in state is *which
// result has already been shown* — everything else falls out of it during
// render. That ordering matters for more than tidiness: an error arriving after
// a success stops the checkmark automatically, because the new state simply
// isn't a success, rather than because some effect remembered to clear it.
//
// useActionState hands back the same object on every unrelated re-render, so
// identity is what separates "the action just returned" from "React
// re-rendered for another reason" and keeps the flash from repeating forever.
//
// The one setState lives inside the timeout, which is a callback rather than
// the effect body — synchronous setState in an effect causes the cascading
// render that react-hooks/set-state-in-effect exists to catch.
export function useSuccessFlash(state: unknown, ms = 1800) {
  const [dismissed, setDismissed] = useState<unknown>(null);

  const succeeded =
    typeof state === "object" && state !== null && "success" in state;
  const flashing = succeeded && state !== dismissed;

  useEffect(() => {
    if (!flashing) return;
    const timer = setTimeout(() => setDismissed(state), ms);
    return () => clearTimeout(timer);
  }, [flashing, state, ms]);

  return flashing;
}
