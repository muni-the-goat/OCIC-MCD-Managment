// The formatted text inside a monthly activity report's sections.
//
// Stored as a document tree rather than as HTML, and the reason is the read
// path. HTML put back onto a page is instructions the browser runs, so storing
// it puts every reader one sanitiser misconfiguration away from executing
// whatever an author pasted — in the browser of the Head of Department opening
// their report. A tree is a description, not instructions. Nothing in it can
// execute, the renderer builds the page from the handful of node types named
// below, and anything it does not recognise is skipped.
//
// So there is no sanitiser to configure and keep correct, and no
// dangerouslySetInnerHTML anywhere in the codebase. The allowlist here is the
// whole boundary, and the editor's schema, the server-side normaliser and the
// renderer all read it from this file so that the three cannot drift apart.

export const RICH_MARKS = ["bold", "italic"] as const;
export type RichMarkName = (typeof RICH_MARKS)[number];

// Two levels, and neither is h1. These headings sit *inside* a section that
// already has one on the page, so an author cannot outrank the label above
// their own text.
export const RICH_HEADING_LEVELS = [2, 3] as const;
export type RichHeadingLevel = (typeof RICH_HEADING_LEVELS)[number];

export const RICH_ELEMENTS = [
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "hardBreak",
] as const;
export type RichElementName = (typeof RICH_ELEMENTS)[number];

export interface RichTextNode {
  type: "text";
  text: string;
  marks?: { type: RichMarkName }[];
}

export interface RichElementNode {
  type: RichElementName;
  attrs?: { level?: RichHeadingLevel };
  content?: RichNode[];
}

export type RichNode = RichTextNode | RichElementNode;

export interface RichDoc {
  type: "doc";
  content?: RichNode[];
}

// What a section holds. The string arm is not debt waiting on a migration:
// every report filed before the editor existed carries one, they render exactly
// as they always have, and rewriting that history would change stored records
// of what people actually wrote in order to tidy a type.
export type RichValue = string | RichDoc;

export const EMPTY_DOC: RichDoc = { type: "doc", content: [] };

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeMarks(input: unknown): { type: RichMarkName }[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<RichMarkName>();
  for (const raw of input) {
    const mark = asRecord(raw);
    const type = mark?.type;
    if (typeof type === "string" && (RICH_MARKS as readonly string[]).includes(type)) {
      seen.add(type as RichMarkName);
    }
  }
  return [...seen].map((type) => ({ type }));
}

function normalizeLevel(attrs: unknown): RichHeadingLevel {
  const level = asRecord(attrs)?.level;
  return (RICH_HEADING_LEVELS as readonly unknown[]).includes(level)
    ? (level as RichHeadingLevel)
    : RICH_HEADING_LEVELS[0];
}

function normalizeNodes(input: unknown): RichNode[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((raw): RichNode[] => {
    const node = asRecord(raw);
    const type = node?.type;
    if (!node || typeof type !== "string") return [];

    if (type === "text") {
      const text = typeof node.text === "string" ? node.text : "";
      if (text === "") return [];
      const marks = normalizeMarks(node.marks);
      return [marks.length > 0 ? { type: "text", text, marks } : { type: "text", text }];
    }

    if (type === "hardBreak") return [{ type: "hardBreak" }];

    if (!(RICH_ELEMENTS as readonly string[]).includes(type)) return [];
    const name = type as RichElementName;

    const content = normalizeNodes(node.content);
    // An empty paragraph is a deliberate blank line and survives. An empty
    // list or heading is the editor's leftovers and does not.
    if (content.length === 0 && name !== "paragraph") return [];

    const element: RichElementNode = { type: name };
    if (name === "heading") element.attrs = { level: normalizeLevel(node.attrs) };
    if (content.length > 0) element.content = content;
    return [element];
  });
}

// The server-side guarantee, applied on write.
//
// It rebuilds the document from scratch out of nodes, marks and attributes this
// file names, rather than inspecting the submitted one for things to remove.
// The distinction matters: a filter has to anticipate what is dangerous, and a
// rebuild only has to know what is allowed. Anything unrecognised — a pasted
// style, a script, a node type from a future version of the editor — is not
// stripped so much as never copied across.
//
// The editor's schema does the same job in the browser, but that is a
// convenience for the author, not a boundary: the server action accepts a POST
// from anywhere.
export function normalizeRichText(value: unknown): RichValue {
  if (typeof value === "string") return value.trim();

  const doc = asRecord(value);
  if (!doc || doc.type !== "doc") return "";

  const content = normalizeNodes(doc.content);
  // A document of nothing is stored as the empty string, so "is this section
  // filled in" stays one question with one answer rather than two shapes
  // meaning the same thing.
  return content.length === 0 ? "" : { type: "doc", content };
}

function nodesToText(nodes: readonly RichNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return node.text;
      if (node.type === "hardBreak") return "\n";
      return `${nodesToText(node.content ?? [])}\n`;
    })
    .join("");
}

// The words with the formatting taken off — for the summary preview, which has
// one line to work with, and for asking whether a section is empty.
export function richTextToPlain(value: RichValue | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return nodesToText(value.content ?? []).trim();
}

// What the required-summary check has to ask now. A field the author cleared
// still arrives as a document — one empty paragraph — and testing the stored
// value for truthiness would call that filled in.
export function isRichTextEmpty(value: RichValue | null | undefined): boolean {
  return richTextToPlain(value).trim().length === 0;
}

// What the editor opens with. A report written before the editor existed holds
// plain text, and its line breaks are the only structure it has — so each line
// becomes a paragraph rather than the whole thing arriving as one block with
// the breaks silently dropped.
export function richTextToDoc(value: RichValue | null | undefined): RichDoc {
  if (!value) return EMPTY_DOC;
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (trimmed === "") return EMPTY_DOC;

  return {
    type: "doc",
    content: trimmed.split("\n").map((line) =>
      line.trim() === ""
        ? { type: "paragraph" }
        : { type: "paragraph", content: [{ type: "text", text: line }] }
    ),
  };
}
