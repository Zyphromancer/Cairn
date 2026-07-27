"use client";

import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { createMentionSuggestion } from "./mention-suggestion";
import type { MentionItem } from "./mention-list";
import { emptyDoc } from "@/lib/blocks/types";

export type RichTextHandle = {
  getDoc: () => JSONContent;
  getText: () => string;
  isEmpty: () => boolean;
  clearContent: () => void;
  focusStart: () => void;
  focusEnd: () => void;
  /** Splits the doc at the current cursor position, preserving marks. */
  splitAtCursor: () => { before: JSONContent; after: JSONContent };
  /** Appends another block's doc content onto the end of this one. */
  appendDoc: (doc: JSONContent) => JSONContent;
};

export const RichText = forwardRef<
  RichTextHandle,
  {
    content?: JSONContent;
    placeholder?: string;
    members: MentionItem[];
    /**
     * Passed straight through to TipTap's own `autofocus` construction
     * option — not called imperatively after mount. With
     * `immediatelyRender: false`, a brand-new editor's real ProseMirror
     * view isn't constructed synchronously, so an imperative
     * `ref.focusStart()` right after creating a block is a silent no-op;
     * TipTap applies `autofocus` itself once the view actually exists.
     */
    autoFocus?: "start" | "end" | false;
    slashMenuOpen: boolean;
    onUpdate: (doc: JSONContent) => void;
    onEnter: () => void;
    onBackspaceAtStart: () => void;
    onArrowUp: () => void;
    onArrowDown: () => void;
    onIndent: () => void;
    onOutdent: () => void;
    onSlashQueryChange: (query: string | null) => void;
    onSlashKeyDown: (event: KeyboardEvent) => boolean;
  }
>(function RichText(
  {
    content,
    placeholder,
    members,
    autoFocus,
    slashMenuOpen,
    onUpdate,
    onEnter,
    onBackspaceAtStart,
    onArrowUp,
    onArrowDown,
    onIndent,
    onOutdent,
    onSlashQueryChange,
    onSlashKeyDown,
  },
  ref,
) {
  const slashMenuOpenRef = useRef(slashMenuOpen);
  slashMenuOpenRef.current = slashMenuOpen;
  const mentionActiveRef = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    content: content ?? emptyDoc(),
    autofocus: autoFocus ?? false,
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        link: { openOnClick: false },
      }),
      Mention.configure({
        HTMLAttributes: { class: "text-accent" },
        suggestion: createMentionSuggestion(members, mentionActiveRef),
      }),
    ],
    editorProps: {
      attributes: {
        class: "outline-none",
        "data-placeholder": placeholder ?? "",
      },
      handleKeyDown(view, event) {
        if (slashMenuOpenRef.current && mentionActiveRef.current === false) {
          if (["ArrowUp", "ArrowDown", "Enter", "Escape"].includes(event.key)) {
            const handled = onSlashKeyDown(event);
            if (handled) return true;
          }
        }

        const { $from, empty } = view.state.selection;

        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          onEnter();
          return true;
        }
        if (event.key === "Backspace" && empty && $from.parentOffset === 0) {
          event.preventDefault();
          onBackspaceAtStart();
          return true;
        }
        if (event.key === "Tab" && !event.shiftKey) {
          event.preventDefault();
          onIndent();
          return true;
        }
        if (event.key === "Tab" && event.shiftKey) {
          event.preventDefault();
          onOutdent();
          return true;
        }
        if (event.key === "ArrowUp" && empty && view.endOfTextblock("up")) {
          event.preventDefault();
          onArrowUp();
          return true;
        }
        if (event.key === "ArrowDown" && empty && view.endOfTextblock("down")) {
          event.preventDefault();
          onArrowDown();
          return true;
        }
        return false;
      },
    },
    onUpdate({ editor }) {
      const text = editor.getText();
      onSlashQueryChange(text.startsWith("/") ? text.slice(1) : null);
      onUpdate(editor.getJSON());
    },
  });

  useImperativeHandle(ref, () => ({
    getDoc: () => editor?.getJSON() ?? emptyDoc(),
    getText: () => editor?.getText() ?? "",
    isEmpty: () => (editor?.getText() ?? "").length === 0,
    clearContent: () => editor?.commands.clearContent(),
    focusStart: () => editor?.commands.focus("start"),
    focusEnd: () => editor?.commands.focus("end"),
    splitAtCursor: () => {
      if (!editor) return { before: emptyDoc(), after: emptyDoc() };
      const { doc, selection } = editor.state;
      const pos = selection.from;
      const beforeJSON = doc.slice(0, pos).toJSON();
      const afterJSON = doc.slice(pos, doc.content.size).toJSON();
      return {
        before: { type: "doc", content: beforeJSON?.content ?? [{ type: "paragraph" }] },
        after: { type: "doc", content: afterJSON?.content ?? [{ type: "paragraph" }] },
      };
    },
    appendDoc: (otherDoc) => {
      const current = editor?.getJSON() ?? emptyDoc();
      const currentInline: JSONContent[] =
        current.content?.flatMap((n): JSONContent[] => n.content ?? []) ?? [];
      const otherInline: JSONContent[] =
        otherDoc.content?.flatMap((n): JSONContent[] => n.content ?? []) ?? [];
      return {
        type: "doc",
        content: [{ type: "paragraph", content: [...currentInline, ...otherInline] }],
      };
    },
  }));

  return <EditorContent editor={editor} />;
});
