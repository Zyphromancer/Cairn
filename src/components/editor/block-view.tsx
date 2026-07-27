"use client";

import Link from "next/link";
import { forwardRef } from "react";
import type { JSONContent } from "@tiptap/react";
import { RichText, type RichTextHandle } from "./rich-text";
import type { MentionItem } from "./mention-list";
import type { BlockContent, BlockType } from "@/lib/blocks/types";

const HEADING_CLASS: Record<1 | 2 | 3, string> = {
  1: "text-2xl font-[family-name:var(--font-display)]",
  2: "text-xl font-[family-name:var(--font-display)]",
  3: "text-lg font-[family-name:var(--font-display)]",
};

type RichTextForwardProps = {
  members: MentionItem[];
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
};

export const BlockView = forwardRef<
  RichTextHandle,
  RichTextForwardProps & {
    type: BlockType;
    content: BlockContent;
    listIndex?: number;
    slug: string;
    linkedPage?: { title: string; icon: string | null };
    onToggleExpanded?: () => void;
    onToggleChecked?: () => void;
    onCodeChange?: (text: string) => void;
  }
>(function BlockView(
  {
    type,
    content,
    listIndex,
    slug,
    linkedPage,
    onToggleExpanded,
    onToggleChecked,
    onCodeChange,
    ...richTextProps
  },
  ref,
) {
  if (type === "divider") {
    return <hr className="my-2 border-border" />;
  }

  if (type === "page_link" || type === "child_page") {
    return (
      <Link
        href={`/w/${slug}/p/${content.pageId}`}
        className="flex items-center gap-2 rounded-[var(--radius-cairn)] border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-alt"
      >
        <span>{linkedPage?.icon ?? "📄"}</span>
        <span className="underline underline-offset-2">
          {linkedPage?.title || "Untitled"}
        </span>
      </Link>
    );
  }

  if (type === "code") {
    return (
      <pre className="overflow-x-auto rounded-[var(--radius-cairn)] border border-border bg-surface px-3 py-2 font-[family-name:var(--font-mono)] text-sm">
        <code
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onCodeChange?.(e.currentTarget.textContent ?? "")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              richTextProps.onEnter();
            }
            if (e.key === "Backspace" && e.currentTarget.textContent === "") {
              e.preventDefault();
              richTextProps.onBackspaceAtStart();
            }
          }}
        >
          {content.text}
        </code>
      </pre>
    );
  }

  const inner = (
    <RichText
      ref={ref}
      content={content.doc}
      placeholder={type === "paragraph" ? "Type '/' for commands…" : undefined}
      {...richTextProps}
    />
  );

  switch (type) {
    case "heading":
      return <div className={HEADING_CLASS[content.level ?? 1]}>{inner}</div>;
    case "bulleted_list_item":
      return (
        <div className="flex gap-2">
          <span className="select-none text-text-muted">•</span>
          <div className="flex-1">{inner}</div>
        </div>
      );
    case "numbered_list_item":
      return (
        <div className="flex gap-2">
          <span className="select-none text-text-muted">{(listIndex ?? 1) + "."}</span>
          <div className="flex-1">{inner}</div>
        </div>
      );
    case "to_do":
      return (
        <div className="flex gap-2">
          <input
            type="checkbox"
            checked={content.checked ?? false}
            onChange={onToggleChecked}
            className="mt-1.5 accent-accent"
          />
          <div className={`flex-1 ${content.checked ? "text-text-muted line-through" : ""}`}>
            {inner}
          </div>
        </div>
      );
    case "toggle":
      return (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onToggleExpanded}
            className="select-none text-text-muted"
            aria-label={content.expanded ? "Collapse" : "Expand"}
          >
            {content.expanded ? "▾" : "▸"}
          </button>
          <div className="flex-1">{inner}</div>
        </div>
      );
    case "quote":
      return <div className="border-l-2 border-accent pl-3 italic">{inner}</div>;
    case "callout":
      return (
        <div className="flex gap-2 rounded-[var(--radius-cairn)] bg-surface px-3 py-2">
          <span>{content.icon ?? "💡"}</span>
          <div className="flex-1">{inner}</div>
        </div>
      );
    default:
      return inner;
  }
});
