// The projects pages read a year of every project's reports, so they take long
// enough that a click with no answer reads as a click that did not register.
//
// (app)/loading.tsx already existed, but it sits directly under the shared app
// layout — far above these routes, and on a client navigation Next only
// re-renders below the layout the two routes share. A boundary here, inside the
// projects segment, is the one these navigations actually enter.
//
// It draws the shape of the page rather than a spinner: the header, the filter
// row, and the cards beneath. The reader sees where the figures are about to
// be, which is a better answer to "did my click land" than a turning circle.
function Line({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-muted ${className}`} />;
}

export default function ProjectsLoading() {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true" aria-label="Loading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Line className="h-7 w-40" />
          <Line className="h-4 w-72" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Line className="h-9 w-52" />
          <Line className="h-9 w-52" />
          <Line className="h-9 w-56" />
          <Line className="h-9 w-28" />
        </div>
      </div>

      {[0, 1].map((card) => (
        <div key={card} className="space-y-4 rounded-2xl border p-6">
          <Line className="h-5 w-44" />
          <Line className="h-4 w-64" />
          <div className="space-y-2 pt-2">
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <Line key={row} className="h-9 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
