import { ChevronRight, Download, ExternalLink, Paperclip } from "lucide-react";
import Link from "next/link";
import { DepartmentBadge } from "@/components/department-badge";
import { RichText } from "@/components/rich-text";
import { Button } from "@/components/ui/button";
import { MONTHLY_SECTIONS, type MonthlyContent } from "@/lib/types";

// One team's month, in the activity summary's list.
//
// The card used to print all eight sections of every reviewed report in full,
// one after another. That reads well while one report has been reviewed, which
// is where the office is now. Eight managers file these, so the same card grows
// to about ten screens of prose as the queue clears — hence a row that says who
// filed what, and opens.
//
// The layout below is arranged around one question: what is this row for? It is
// scanned, down a list of eight, for two things — whose month this is, and the
// document they filed. Everything is placed to serve that and nothing else.
//
//   Identity   the line you scan. Name first, department beside it, and the
//              report's own title pushed to the far end where it stays out of
//              the way of the scan but is there when you need it.
//
//   Actions    a band of its own below, with real space above it. The two
//              things you can do with a report — take its document, or go and
//              read it — belong together, so they sit together with a hairline
//              between them rather than at opposite edges of the row. A gap
//              that wide reads as "unrelated", which they are not.
//
// A component of its own so the row can be put in front of a real browser
// without a session behind it. The summary that uses it is a server component
// wrapped around a Supabase query, and what is worth looking at here — the
// disclosure, the spacing, the behaviour under a finger — needs no data.
export function ActivityReportRow({
  reportId,
  authorName,
  department,
  title,
  files,
  content,
}: {
  reportId: string;
  authorName: string;
  department: string | null;
  title: string;
  files: { id: string; file_name: string }[];
  content: MonthlyContent | null;
}) {
  return (
    <li className="px-4 py-3.5">
      {/* <details> rather than a client component holding an open flag. It is a
          disclosure widget and this is the element for it: keyboard and
          screen-reader behaviour come for free, it works before hydration, and
          the card stays a pure server component shipping no JavaScript. This
          card is in no print path, so nothing needs forcing open on paper. */}
      <details className="group">
        {/* The negative margin lets the hover and press states paint a rounded
            surface slightly wider than the text without moving anything, so the
            highlight reads as the row lighting up rather than as a box drawn
            around the words.

            Press feedback is on pointer-down and it is instant: :active fires
            before the click the disclosure listens to, so the row acknowledges
            the finger before it does anything. 100ms down, 200ms back — a
            press should feel immediate and a release should settle. */}
        <summary
          className="-mx-2 flex cursor-pointer list-none items-start gap-2.5 rounded-lg px-2 py-1.5 transition-[background-color,transform] duration-200 ease-out hover:bg-muted/60 active:scale-[0.995] active:bg-muted active:duration-100 motion-reduce:transition-[background-color] motion-reduce:active:scale-100 [&::-webkit-details-marker]:hidden"
        >
          <span
            className="mt-0.5 grid size-5 shrink-0 place-items-center text-muted-foreground transition-transform duration-200 ease-out group-open:rotate-90 motion-reduce:transition-none"
            aria-hidden
          >
            <ChevronRight className="size-4" />
          </span>

          {/* The identity is its own flex row so it can wrap. Without a
              wrapping container basis-full below has nothing to break into:
              flattened onto the summary itself, at 390px the name split across
              two lines with the badge landing on top of it. */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
          {/* Slightly negative tracking on the name only. At 16px semibold the
              default spacing reads loose against the 14px text beside it;
              the muted title stays at normal tracking, which is where small
              text wants to be. */}
          <span className="font-heading text-base font-semibold tracking-[-0.01em]">
            {authorName}
          </span>
          <DepartmentBadge label={department} />

          {/* One element for both layouts rather than a copy hidden at each
              breakpoint. basis-full puts it on its own line where there is no
              room for four things across; from sm it goes back to sitting on
              the end of the identity line.

              The period is not printed here. Every row in this card is the same
              month, the card's own heading says which, and authors put it in
              the title as well — three statements of January 2026 in one row,
              and on a phone the third was truncating the title to make room for
              itself. */}
          <span className="min-w-0 basis-full truncate text-sm text-muted-foreground sm:ml-auto sm:basis-auto sm:text-right">
            {title}
          </span>
          </div>
        </summary>

        {/* Materialises rather than appearing. The panel's height snaps — that
            is what <details> does without JavaScript — so the content settling
            four pixels into place is what makes the open read as one movement
            instead of a jump. Nothing overshoots: a tap carries no momentum, so
            there is none to hand on. */}
        <div className="mt-4 motion-safe:animate-disclose sm:pl-[30px]">
          <dl className="space-y-4">
            {MONTHLY_SECTIONS.map(({ key, label }) => (
              <div key={key}>
                <dt className="mb-1.5 font-heading text-lg font-semibold tracking-[-0.01em]">
                  {label}
                </dt>
                {/* Formatted, the same as on the detail page. */}
                <dd>
                  <RichText value={content?.[key]} className="text-muted-foreground" />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </details>

      {/* Outside the <details>, so the documents are readable without opening
          anything — since the structured fields were dropped they are most of
          what a report is, and putting them behind a click would undo the point
          of this card. Outside also because a link inside a <summary> both
          follows itself and toggles the row.

          mt-3 is the space the identity line needs above this: enough that the
          two read as separate bands, not so much that they stop being one row.
          The pl matches the chevron's width plus its gap exactly, so the band
          starts under the name rather than near it. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 sm:pl-[30px]">
        {files.length === 0 ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Paperclip className="size-3.5" aria-hidden="true" />
            No documents attached
          </p>
        ) : (
          files.map((file) => (
            <Button
              key={file.id}
              asChild
              variant="outline"
              size="sm"
              className="h-7 max-w-[min(100%,24rem)] gap-1.5 text-xs font-normal"
            >
              <a
                href={`/api/attachments/${file.id}`}
                target="_blank"
                rel="noreferrer"
              >
                <Download className="size-3.5 text-muted-foreground" />
                <span className="truncate">{file.file_name}</span>
              </a>
            </Button>
          ))
        )}

        {/* A hairline, not an auto gap. The documents and the report are two
            kinds of the same thing — what you can do with this row — so they
            are separated by the smallest mark that says "different kind", and
            kept close enough to read as one group. */}
        {/* Only where the band is a single line. Once the chips wrap onto
            their own rows the rule has nothing left to separate and strands
            itself on a line of its own — the wrapping already does the
            separating. */}
        <span className="hidden h-3.5 w-px shrink-0 bg-border sm:block" aria-hidden />

        <Link
          href={`/reports/${reportId}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Open report
          <ExternalLink className="size-3" aria-hidden />
        </Link>
      </div>
    </li>
  );
}
