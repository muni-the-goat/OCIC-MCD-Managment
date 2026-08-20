"use client";

import { useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
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

function ToolbarButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      // Without this the browser treats it as a submit button and clicking
      // Bold files the report.
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded transition-colors",
        "text-muted-foreground hover:bg-muted hover:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active && "bg-secondary text-secondary-foreground"
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
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
    content: doc,
    editorProps: {
      attributes: {
        id,
        class: "rich-text rich-text-input px-3 py-2 text-sm",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => setDoc(editor.getJSON() as RichDoc),
  });

  // The toolbar's pressed states. useEditorState rather than re-rendering on
  // every transaction — that option still exists but is documented as legacy
  // and slated for removal.
  const active = useEditorState({
    editor,
    // Null until the editor mounts — immediatelyRender is off, so the first
    // render happens without one and every button starts unpressed.
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      h2: editor?.isActive("heading", { level: 2 }) ?? false,
      h3: editor?.isActive("heading", { level: 3 }) ?? false,
      bullet: editor?.isActive("bulletList") ?? false,
      ordered: editor?.isActive("orderedList") ?? false,
    }),
  });

  return (
    <div className="rounded-md border bg-transparent shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
      <div className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1">
        <ToolbarButton
          icon={Bold}
          label="Bold"
          active={active?.bold ?? false}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          icon={Italic}
          label="Italic"
          active={active?.italic ?? false}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <ToolbarButton
          icon={Heading2}
          label="Heading"
          active={active?.h2 ?? false}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />
        <ToolbarButton
          icon={Heading3}
          label="Subheading"
          active={active?.h3 ?? false}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 3 }).run()
          }
        />
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <ToolbarButton
          icon={List}
          label="Bulleted list"
          active={active?.bullet ?? false}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          icon={ListOrdered}
          label="Numbered list"
          active={active?.ordered ?? false}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        />
      </div>

      <EditorContent editor={editor} />

      {/* What the form actually posts. The editor is a control the browser knows
          nothing about, so the document rides along as JSON under the field name
          the server action already reads. */}
      <input type="hidden" name={name} value={JSON.stringify(doc)} />
    </div>
  );
}
