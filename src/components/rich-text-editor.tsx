"use client";

import { useState, useSyncExternalStore } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RICH_HEADING_LEVELS,
  richTextToDoc,
  type RichDoc,
  type RichValue,
} from "@/lib/rich-text";

// The editor behind each section of a monthly activity report.
//
// The author gets buttons and keyboard shortcuts — no markup, no syntax on
// screen. What leaves here is the document tree described in
// src/lib/rich-text.ts, carried in a hidden input so the form keeps posting
// plain FormData and the server action keeps reading it by field name.
//
// The schema below is deliberately small. Everything switched off is switched
// off *in the schema* rather than merely left out of the toolbar, which is what
// makes it a constraint instead of a suggestion: ProseMirror drops nodes it has
// no schema for while parsing, so a paste out of Word arrives as words rather
// than as somebody's font sizes and heading colours. The server re-checks the
// same allowlist on write — this is the author's convenience, not the boundary.

// Shortcut text for the tooltips, in the reader's own platform's terms. Read
// once on the client; on the server pass it renders the Ctrl form, which the
// first client render corrects before anyone can hover.
function useModKey() {
  const mac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false
  );
  return mac ? { mod: "⌘", alt: "⌥" } : { mod: "Ctrl+", alt: "Alt+" };
}

// One control in the toolbar. 36px, inside a group whose 2px padding and the
// 2px gaps between groups keep neighbours from crowding each other's target.
//
// onMouseDown is prevented so pressing a button never takes focus from the
// text: the selection the author made is the selection the command acts on,
// and the caret stays where it was instead of blinking out and back.
function ToolbarButton({
  icon: Icon,
  label,
  shortcut,
  active,
  disabled,
  onClick,
  children,
}: {
  icon?: LucideIcon;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  // A text button ("Heading") rather than a glyph.
  children?: React.ReactNode;
}) {
  return (
    <button
      // Without this the browser treats it as a submit button and clicking
      // Bold files the report.
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      aria-label={children ? undefined : label}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-keyshortcuts={shortcut
        ?.replace("⌘", "Meta+")
        .replace("⌥", "Alt+")
        .replace("Ctrl+", "Control+")}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-2 transition-colors duration-150",
        children && "px-3 text-[0.875rem] font-semibold",
        "text-muted-foreground hover:bg-card hover:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        "active:bg-foreground/10 active:duration-75",
        "disabled:pointer-events-none disabled:opacity-35",
        // Pressed reads as the liquid tabs' selection: ink, so a glance at
        // the toolbar says what the caret is sitting in.
        active && "bg-foreground text-background hover:bg-foreground hover:text-background"
      )}
    >
      {Icon ? <Icon className="size-[1.125rem]" aria-hidden /> : null}
      {children}
    </button>
  );
}

// A run of related buttons on one soft pill, so the toolbar reads as four
// small sets — style, emphasis, lists, history — rather than ten loose icons
// separated by hairlines.
function ToolbarGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex items-center gap-0.5 rounded-full bg-muted/70 p-0.5",
        className
      )}
    >
      {children}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md bg-muted px-1.5 py-0.5 font-sans text-[0.75rem] font-semibold text-foreground">
      {children}
    </kbd>
  );
}

export function RichTextEditor({
  name,
  id,
  defaultValue,
  placeholder,
}: {
  name: string;
  id: string;
  defaultValue?: RichValue;
  placeholder?: string;
}) {
  // Seeded before the editor mounts, so the hidden input carries the report's
  // existing text from the first render. A form submitted before hydration
  // finishes saves what was already there rather than blanking the section.
  const [doc, setDoc] = useState<RichDoc>(() => richTextToDoc(defaultValue));

  const editor = useEditor({
    // Required under SSR: rendering the editor during the server pass throws a
    // hydration mismatch, because ProseMirror builds its own DOM.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [...RICH_HEADING_LEVELS] },
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        // The gap cursor is the blinking horizontal bar ProseMirror parks
        // beside the caret. It earns its place in a schema holding things a
        // text cursor cannot sit inside — an image, a code block, a horizontal
        // rule — by giving you somewhere to click before or after them. This
        // schema has none of those, all three being off above, so it can only
        // ever draw a stray line next to the cursor. Tiptap injects the CSS for
        // it at runtime, so there is no stylesheet to override; the extension
        // itself has to go.
        gapcursor: false,
        // A link needs its href checked — `javascript:` is a valid one — and
        // nobody has asked to put links in a monthly report. Off until they do.
        link: false,
        strike: false,
        underline: false,
        trailingNode: false,
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "",
        // Off by default, which would show the prompt only in whichever
        // section has focus and leave the other five as unexplained empty
        // boxes.
        showOnlyCurrent: false,
      }),
    ],
    // An empty document has no block at all, and the placeholder is drawn on
    // the first block — so an untouched section showed a blank box with no
    // prompt. One empty paragraph gives it somewhere to draw. It posts as
    // empty all the same: emptiness is judged on the text, not the tree.
    content: doc.content?.length
      ? doc
      : { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: {
        id,
        // Body size, the same as the report page renders it, so what the
        // author types is what the reviewer reads.
        class: "rich-text rich-text-input px-4 py-3 text-[1.0625rem] leading-[1.55]",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => setDoc(editor.getJSON() as RichDoc),
  });

  // The toolbar's pressed states. useEditorState rather than re-rendering on
  // every transaction — that option still exists but is documented as legacy
  // and slated for removal.
  const { mod, alt } = useModKey();
  const active = useEditorState({
    editor,
    // Null until the editor mounts — immediatelyRender is off, so the first
    // render happens without one and every button starts unpressed.
    selector: ({ editor }) => ({
      // Pressed states only where the caret is. Six editors down one form
      // each showing "Body" in ink was six identical dark pills saying
      // nothing; in the one being typed into, they say where the caret is.
      focused: editor?.isFocused ?? false,
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      h2: editor?.isActive("heading", { level: 2 }) ?? false,
      h3: editor?.isActive("heading", { level: 3 }) ?? false,
      bullet: editor?.isActive("bulletList") ?? false,
      ordered: editor?.isActive("orderedList") ?? false,
      // Indenting only means something inside a list, and the first item of a
      // list has nothing above it to nest under — ProseMirror knows both, so
      // the buttons ask rather than guess.
      canIndent: editor?.can().sinkListItem("listItem") ?? false,
      canOutdent: editor?.can().liftListItem("listItem") ?? false,
      canUndo: editor?.can().undo() ?? false,
      canRedo: editor?.can().redo() ?? false,
    }),
  });
  const focused = active?.focused ?? false;
  const body = focused && !active?.h2 && !active?.h3;

  return (
    // A quiet focus: a darker edge and a soft halo, not the brand-red ring the
    // inputs wear. Six editors sit down this form, and a red frame jumping
    // between them read as an error each time the author moved on.
    <div className="group/editor rounded-2xl border bg-card transition-[border-color,box-shadow] duration-200 focus-within:border-foreground/25 focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--foreground)_6%,transparent)]">
      {/* Sticky under the app's header, so a long section never scrolls its
          own formatting controls out of reach while the author is typing at
          the bottom of it. */}
      <div
        role="toolbar"
        aria-label="Formatting"
        aria-controls={id}
        className="sticky top-16 z-[1] flex flex-wrap items-center gap-1.5 rounded-t-2xl border-b bg-card/90 px-2 py-2 backdrop-blur"
      >
        {/* Named styles rather than "H2" and "H3": the people filing these
            reports are not thinking in heading levels, and "Body" is the way
            back that the old toolbar never offered — you had to find the
            pressed H button and press it again. */}
        <ToolbarGroup label="Text style">
          <ToolbarButton
            label="Body text"
            shortcut={`${mod}${alt}0`}
            active={body}
            onClick={() => editor?.chain().focus().setParagraph().run()}
          >
            Body
          </ToolbarButton>
          <ToolbarButton
            label="Heading"
            shortcut={`${mod}${alt}2`}
            active={focused && (active?.h2 ?? false)}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            Heading
          </ToolbarButton>
          <ToolbarButton
            label="Subheading"
            shortcut={`${mod}${alt}3`}
            active={focused && (active?.h3 ?? false)}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            Subheading
          </ToolbarButton>
        </ToolbarGroup>

        <ToolbarGroup label="Emphasis">
          <ToolbarButton
            icon={Bold}
            label="Bold"
            shortcut={`${mod}B`}
            active={focused && (active?.bold ?? false)}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            icon={Italic}
            label="Italic"
            shortcut={`${mod}I`}
            active={focused && (active?.italic ?? false)}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          />
        </ToolbarGroup>

        <ToolbarGroup label="Lists">
          <ToolbarButton
            icon={List}
            label="Bulleted list"
            shortcut={`${mod}Shift+8`}
            active={focused && (active?.bullet ?? false)}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            icon={ListOrdered}
            label="Numbered list"
            shortcut={`${mod}Shift+7`}
            active={focused && (active?.ordered ?? false)}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          />
          {/* Tab and Shift+Tab have always done this — the schema nests
              without being asked. The buttons are here because nobody
              discovers Tab, and an author who cannot find it writes a flat
              list instead. Dimmed outside a list, where they mean nothing. */}
          <ToolbarButton
            icon={IndentIncrease}
            label="Indent"
            shortcut="Tab"
            disabled={!active?.canIndent}
            onClick={() =>
              editor?.chain().focus().sinkListItem("listItem").run()
            }
          />
          <ToolbarButton
            icon={IndentDecrease}
            label="Outdent"
            shortcut="Shift+Tab"
            disabled={!active?.canOutdent}
            onClick={() =>
              editor?.chain().focus().liftListItem("listItem").run()
            }
          />
        </ToolbarGroup>

        {/* Undo was always on the keyboard and nowhere on screen. On a phone,
            where there is no keyboard shortcut, it was not there at all. */}
        <ToolbarGroup label="History" className="ml-auto">
          <ToolbarButton
            icon={Undo2}
            label="Undo"
            shortcut={`${mod}Z`}
            disabled={!active?.canUndo}
            onClick={() => editor?.chain().focus().undo().run()}
          />
          <ToolbarButton
            icon={Redo2}
            label="Redo"
            shortcut={`${mod}Shift+Z`}
            disabled={!active?.canRedo}
            onClick={() => editor?.chain().focus().redo().run()}
          />
        </ToolbarGroup>
      </div>

      <EditorContent editor={editor} />

      {/* The shortcuts that are typed rather than pressed, shown only while
          this editor has focus — where they are useful, and nowhere else. */}
      <p className="type-caption hidden border-t px-4 py-2 text-muted-foreground group-focus-within/editor:block">
        Start a line with <Kbd>-</Kbd> for a bullet or <Kbd>1.</Kbd> for a
        numbered list. <Kbd>Tab</Kbd> nests a bullet under the one above.
      </p>

      {/* What the form actually posts. The editor is a control the browser knows
          nothing about, so the document rides along as JSON under the field name
          the server action already reads. */}
      <input type="hidden" name={name} value={JSON.stringify(doc)} />
    </div>
  );
}
