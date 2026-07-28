"use client";

import { useEffect } from "react";
import type { BlockType } from "@/lib/blocks/types";

export type SlashOption =
  | { kind: "type"; type: BlockType; level?: 1 | 2 | 3; label: string }
  | { kind: "page"; pageId: string; label: string };

const BLOCK_TYPE_OPTIONS: SlashOption[] = [
  { kind: "type", type: "paragraph", label: "Text" },
  { kind: "type", type: "heading", level: 1, label: "Heading 1" },
  { kind: "type", type: "heading", level: 2, label: "Heading 2" },
  { kind: "type", type: "heading", level: 3, label: "Heading 3" },
  { kind: "type", type: "bulleted_list_item", label: "Bulleted list" },
  { kind: "type", type: "numbered_list_item", label: "Numbered list" },
  { kind: "type", type: "to_do", label: "To-do" },
  { kind: "type", type: "toggle", label: "Toggle" },
  { kind: "type", type: "quote", label: "Quote" },
  { kind: "type", type: "callout", label: "Callout" },
  { kind: "type", type: "code", label: "Code" },
  { kind: "type", type: "divider", label: "Divider" },
];

export function filterSlashOptions(
  query: string,
  workspacePages: { id: string; title: string }[],
  excludePageId: string,
): SlashOption[] {
  const q = query.toLowerCase();
  const typeMatches = BLOCK_TYPE_OPTIONS.filter((o) => o.label.toLowerCase().includes(q));

  if (!q) {
    return [...typeMatches, { kind: "type", type: "child_page", label: "New page inside" }];
  }

  const pageMatches: SlashOption[] = workspacePages
    .filter((p) => p.id !== excludePageId && p.title.toLowerCase().includes(q))
    .slice(0, 5)
    .map((p) => ({ kind: "page", pageId: p.id, label: p.title || "Untitled" }));

  return [...typeMatches, ...pageMatches];
}

export function SlashMenu({
  options,
  selectedIndex,
  onSelect,
  onHoverIndex,
}: {
  options: SlashOption[];
  selectedIndex: number;
  onSelect: (option: SlashOption) => void;
  onHoverIndex: (index: number) => void;
}) {
  useEffect(() => {
    if (selectedIndex >= options.length) onHoverIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length]);

  if (options.length === 0) {
    return (
      <div className="w-56 rounded-[var(--radius-cairn)] border border-border bg-surface-alt px-3 py-2 text-sm text-text-muted">
        No matches
      </div>
    );
  }

  return (
    <div className="flex w-56 flex-col overflow-hidden rounded-[var(--radius-cairn)] border border-border bg-surface-alt py-1 text-sm shadow-none">
      {options.map((option, index) => (
        <button
          key={option.kind === "type" ? `${option.type}-${option.level ?? ""}` : option.pageId}
          type="button"
          onMouseEnter={() => onHoverIndex(index)}
          onClick={() => onSelect(option)}
          className={`px-3 py-1.5 text-left ${
            index === selectedIndex ? "bg-surface text-text" : "text-text-muted"
          }`}
        >
          {option.kind === "page" ? `🔗 ${option.label}` : option.label}
        </button>
      ))}
    </div>
  );
}
