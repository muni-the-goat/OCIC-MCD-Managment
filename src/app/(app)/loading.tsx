import { LumaSpin } from "@/components/ui/luma-spin";

// Shown by Next.js while a navigation into any (app) page resolves on the server
// — moving between Dashboard, Reports and Users. Centred in the content area, not
// the viewport, so the sidebar and header stay put while the page loads.
export default function AppLoading() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <LumaSpin />
    </div>
  );
}
