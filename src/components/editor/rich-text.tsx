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
  /**
   * Pushes a doc into this editor's *live* document. Needed anywhere a
   * block's content is recomputed programmatically (splitting on
   * Enter, merging on Backspace) rather than typed — the `content`
   * prop only seeds the editor once at construction, so updating React
   * state alone leaves the already-mounted editor showing stale text.
   */
  setContent: (doc: JSONContent) => void;
  focusStart: () => void;
  focusEnd: () => void;
  /** Splits the doc at the current cursor position, preserving marks. */
  splitAtCursor: () => { before: JSONContent; after: JSONContent };
  /**
   * Appends another block's doc content onto the end of this one *and*
   * pushes the merged doc into this editor's live document. Updating
   * the `content` prop alone wouldn't do this — TipTap only reads
   * `content` at construction time, not on every re-render — so a
   * backspace-merge into an already-mounted block needs this rather
   * than just updating React state.
   */
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
    /**
     * True for blocks created client-side after the page already
     * hydrated (never part of the server-rendered payload, so there's
     * no SSR/hydration mismatch to guard against). Lets that editor's
     * ProseMirror view construct synchronously on mount instead of
     * deferring to an effect, which removes the one-tick window where
     * `autoFocus` can't take effect yet.
     */
    renderImmediately?: boolean;
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
    /**
     * Called on Cmd/Ctrl+Z before TipTap's own undo runs. Returns true if
     * it handled the undo itself (reverting a just-applied markdown-rule
     * conversion), in which case TipTap's native undo is skipped for this
     * keypress. Returns false to fall through to normal undo behavior.
     */
    onUndoConversion: () => boolean;
  }
>(function RichText(
  {
    content,
    placeholder,
    members,
    autoFocus,
    renderImmediately,
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
    onUndoConversion,
  },
  ref,
) {
  const slashMenuOpenRef = useRef(slashMenuOpen);
  slashMenuOpenRef.current = slashMenuOpen;
  const mentionActiveRef = useRef(false);

  const editor = useEditor({
    immediatelyRender: renderImmediately ?? false,
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

        if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
          if (onUndoConversion()) {
            event.preventDefault();
            return true;
          }
        }

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
    // clearContent's emitUpdate defaults to *true* in TipTap v3 — left
    // that way, clearing during a programmatic type conversion would
    // synchronously re-enter onUpdate/handleDocUpdate with the emptied
    // doc, scheduling a stale save and invalidating the one-shot
    // conversion-undo record. Every caller here clears as part of a
    // larger app-level state change that manages its own persistence,
    // so silent is the only correct mode.
    clearContent: () => editor?.commands.clearContent(false),
    setContent: (doc) => editor?.commands.setContent(doc, { emitUpdate: false }),
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
      const merged: JSONContent = {
        type: "doc",
        content: [{ type: "paragraph", content: [...currentInline, ...otherInline] }],
      };
      editor?.commands.setContent(merged, { emitUpdate: false });
      return merged;
    },
  }));

  return <EditorContent editor={editor} />;
});
