import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  richTextToPlain,
  type RichNode,
  type RichValue,
} from "@/lib/rich-text";

// A monthly activity report's formatted text, put back on the page.
//
// It walks the stored document and builds React elements from it. There is no
// dangerouslySetInnerHTML here and there is none anywhere else in the app,
// which is the whole point of storing a tree instead of HTML: nothing an author
// can type or paste ends up as markup the browser is asked to interpret. A node
// type this function does not have a case for is skipped, so the set of tags
// that can reach the page is exactly the set written below.
//
// Server-safe by construction — no hooks, no client directive — so it renders
// on the detail page and inside a print document alike.

function marked(node: Extract<RichNode, { type: "text" }>): ReactNode {
  const marks = new Set(node.marks?.map((mark) => mark.type));
  let out: ReactNode = node.text;
  // Italic inside bold rather than the other way round; with both applied the
  // nesting order is invisible, and fixing one order stops the two rendering
  // differently depending on the sequence the author clicked them in.
  if (marks.has("italic")) out = <em>{out}</em>;
  if (marks.has("bold")) out = <strong>{out}</strong>;
  return out;
}

function renderNodes(nodes: readonly RichNode[] | undefined): ReactNode {
  if (!nodes || nodes.length === 0) return null;

  return nodes.map((node, index) => {
    const key = index;

    switch (node.type) {
      case "text":
        return <Fragment key={key}>{marked(node)}</Fragment>;
      case "hardBreak":
        return <br key={key} />;
      case "paragraph":
        return <p key={key}>{renderNodes(node.content)}</p>;
      // Two levels below the section's own heading, not at it. The detail page
      // gives every section an h3, so a heading the author typed inside the
      // text renders as h4/h5 and the document outline stays in order.
      case "heading":
        return node.attrs?.level === 3 ? (
          <h5 key={key}>{renderNodes(node.content)}</h5>
        ) : (
          <h4 key={key}>{renderNodes(node.content)}</h4>
        );
      case "bulletList":
        return <ul key={key}>{renderNodes(node.content)}</ul>;
      case "orderedList":
        return <ol key={key}>{renderNodes(node.content)}</ol>;
      case "listItem":
        return <li key={key}>{renderNodes(node.content)}</li>;
    }
  });
}

export function RichText({
  value,
  className,
  emptyLabel = "—",
}: {
  value: RichValue | null | undefined;
  className?: string;
  emptyLabel?: string;
}) {
  // Asked of the text rather than of the stored value: a section the author
  // cleared still arrives as a document holding one empty paragraph, and
  // rendering that would leave a blank gap where the em dash belongs.
  if (richTextToPlain(value).trim() === "") {
    return <p className={cn("text-sm text-muted-foreground", className)}>{emptyLabel}</p>;
  }

  // A report written before the editor existed. Its line breaks are the only
  // structure it has, and pre-wrap is what has always preserved them.
  if (typeof value === "string") {
    return (
      <p className={cn("whitespace-pre-wrap text-sm", className)}>{value}</p>
    );
  }

  return (
    <div className={cn("rich-text text-sm", className)}>
      {renderNodes(value?.content)}
    </div>
  );
}
