import { BackLinks, ErrorState } from "@/components/error-state";

// Reached by notFound() in reports/[id] and reports/[id]/edit. Worth knowing
// what that actually means here: those pages call notFound() both when the row
// does not exist *and* when Row Level Security hides it, because the query
// returns nothing either way and the server cannot tell the two apart without
// asking a second, privileged question.
//
// That ambiguity is deliberate — "this report exists but is not yours" leaks
// the existence of other people's reports — so the copy below has to be true of
// both cases without hinting at which one happened.
export default function AppNotFound() {
  return (
    <ErrorState
      icon="missing"
      title="Report not found"
      description="This report either doesn't exist or isn't one you have access to. If someone sent you the link, ask them to check it."
      action={<BackLinks />}
    />
  );
}
