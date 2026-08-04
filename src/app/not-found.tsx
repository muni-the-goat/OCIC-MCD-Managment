import { BackLinks, ErrorState } from "@/components/error-state";

// The root not-found catches every URL matching no route at all, so this is
// where a mistyped address lands.
//
// In practice only a signed-in person ever reaches it: src/proxy.ts redirects
// anyone without a session to /login first, whatever the path. They still get
// no sidebar, because an unmatched URL is outside the (app) segment and it is
// that segment's layout which draws the rail — hence the explicit links out,
// which are the only navigation on this page.
export default function NotFound() {
  return (
    <main className="flex-1 p-4 md:p-8">
      <ErrorState
        icon="missing"
        title="Page not found"
        description="That address doesn't lead anywhere in MCD Management. The links below go back to somewhere that does."
        action={<BackLinks />}
      />
    </main>
  );
}
