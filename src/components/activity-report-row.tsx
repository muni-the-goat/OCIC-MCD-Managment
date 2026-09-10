import { ChevronRight, Download, ExternalLink, Paperclip } from "lucide-react";
import Link from "next/link";
import { DepartmentBadge } from "@/components/department-badge";
import { RichText } from "@/components/rich-text";
import { Button } from "@/components/ui/button";
import { MONTHLY_SECTIONS, type MonthlyContent } from "@/lib/types";

// One team's month, in the activity summary's list.
//
// The card used to print all six sections of every report in full, one after
// another. That was readable while a single report had been reviewed. Eight
// managers file these, and once the Coordinator works through the queue the
// same card would run to something like ten screens of prose above everything
// else on the dashboard — so a row now says who filed what, and opens.
//
// A component of its own so the row can be put in front of a browser without a
// session behind it: the summary that uses it is a server component holding a
// Supabase query, and the parts worth looking at here are the disclosure
// behaviour and the layout, neither of which needs data to be wrong.
export function ActivityReportRow({
  reportId,
  authorName,
  department,
  title,
  period,
  files,
  content,
}: {
  reportId: string;
  authorName: string;
  department: string | null;
  title: string;
  period: string;
  files: { id: string; file_name: string }[];
  content: MonthlyContent | null;
}) {
  return (
    <li>
              {/* <details> rather than a client component holding an open
                  flag. It is a disclosure widget, which is what this element
                  is for: keyboard and screen-reader behaviour come for free,
                  it works before hydration, and it keeps this card a pure
                  server component with no JavaScript shipped for it at all.
                  This card is not in any print path, so nothing needs it
                  forced open on paper. */}
              <details className="group">
                <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                  <ChevronRight
          className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
          aria-hidden
        />
        {/* Who filed it leads, because that is what a reviewer scans by.
            Above sm the title and period sit out on the right of the same line,
            so eight of these read down as a list. Below it there is no room for
            four things on one line — the name was wrapping mid-word and the
            title was being dropped — so they take a second line rather than
            disappearing. */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="font-heading text-base font-semibold">
              {authorName}
            </span>
            <DepartmentBadge label={department} />
            <span className="ml-auto hidden min-w-0 items-baseline gap-3 sm:flex">
              <span className="truncate text-sm text-muted-foreground">
                {title}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {period}
              </span>
            </span>
          </div>
          {/* The period is not repeated here. Every row in this card is the
              same month — the card's own heading says which — and authors put
              it in the title as well, so on a phone "Digital Team Report |
              January 2026 · January…" was truncating the title to make room for
              its third statement of the same fact. */}
          <p className="mt-0.5 truncate text-sm text-muted-foreground sm:hidden">
            {title}
          </p>
        </div>
        </summary>

                <div className="border-t px-4 py-4 sm:pl-11">
                  <dl className="space-y-4">
                    {MONTHLY_SECTIONS.map(({ key, label }) => (
                      <div key={key}>
                        <dt className="mb-1.5 font-heading text-lg font-semibold">
                          {label}
                        </dt>
                        {/* Formatted, the same as on the detail page. */}
                        <dd>
                          <RichText
                            value={content?.[key]}
                            className="text-muted-foreground"
                          />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </details>

              {/* Outside the <details>, so the documents are readable
                  without opening anything — they are the point of the
                  report now, and a click to reach them would undo that.
                  Outside also because a link inside a <summary> both
                  follows itself and toggles the row. */}
              <div className="flex flex-wrap items-center gap-2 px-4 pb-3 sm:pl-11">
                {files.length === 0 ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Paperclip className="size-3.5" aria-hidden="true" />
                    No documents attached.
                  </p>
                ) : (
                  files.map((file) => (
                    <Button
                      key={file.id}
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-7 max-w-full gap-1.5 text-xs"
                    >
                      <a
                        href={`/api/attachments/${file.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download className="size-3.5" />
                        <span className="truncate">{file.file_name}</span>
                      </a>
                    </Button>
                  ))
                )}
                <Link
                  href={`/reports/${reportId}`}
                  className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  Open report
                  <ExternalLink className="size-3" aria-hidden />
                </Link>
              </div>
            </li>
  );
}
