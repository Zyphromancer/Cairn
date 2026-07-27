"use client";

import { useState, type DragEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DropZone } from "./types";

export function PageRow({
  slug,
  pageId,
  title,
  icon,
  isFavorite,
  hasChildren,
  expanded,
  depth,
  onToggleExpand,
  onToggleFavorite,
  onAddChild,
  onTrash,
  onDragStartPage,
  onDropOnPage,
}: {
  slug: string;
  pageId: string;
  title: string;
  icon: string | null;
  isFavorite: boolean;
  hasChildren: boolean;
  expanded: boolean;
  depth: number;
  onToggleExpand: () => void;
  onToggleFavorite: () => void;
  onAddChild: () => void;
  onTrash: () => void;
  onDragStartPage: (pageId: string) => void;
  onDropOnPage: (targetPageId: string, zone: DropZone) => void;
}) {
  const pathname = usePathname();
  const isActive = pathname === `/w/${slug}/p/${pageId}`;
  const [dropZone, setDropZone] = useState<DropZone | null>(null);

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;
    const zone: DropZone = ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside";
    setDropZone(zone);
  }

  return (
    <div
      className="group relative flex items-center gap-1 rounded-[var(--radius-cairn)] px-1 py-1 text-sm hover:bg-surface"
      style={{ paddingLeft: `${depth * 14 + 4}px` }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStartPage(pageId);
      }}
      onDragOver={handleDragOver}
      onDragLeave={() => setDropZone(null)}
      onDrop={(e) => {
        e.preventDefault();
        if (dropZone) onDropOnPage(pageId, dropZone);
        setDropZone(null);
      }}
    >
      {dropZone === "before" && (
        <div className="absolute inset-x-2 top-0 h-px bg-accent" />
      )}
      {dropZone === "after" && (
        <div className="absolute inset-x-2 bottom-0 h-px bg-accent" />
      )}
      <button
        type="button"
        onClick={onToggleExpand}
        className={`h-4 w-4 shrink-0 text-text-muted ${hasChildren ? "" : "invisible"}`}
        aria-label={expanded ? "Collapse" : "Expand"}
      >
        {expanded ? "▾" : "▸"}
      </button>
      <Link
        href={`/w/${slug}/p/${pageId}`}
        className={`flex min-w-0 flex-1 items-center gap-1.5 truncate ${
          isActive ? "text-text" : "text-text-muted hover:text-text"
        } ${dropZone === "inside" ? "rounded-[var(--radius-cairn)] outline outline-1 outline-accent" : ""}`}
      >
        <span className="shrink-0">{icon ?? "📄"}</span>
        <span className="truncate">{title || "Untitled"}</span>
      </Link>
      <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
        <button
          type="button"
          onClick={onToggleFavorite}
          className={isFavorite ? "text-accent" : "text-text-muted hover:text-text"}
          aria-label="Toggle favorite"
          title="Favorite"
        >
          ★
        </button>
        <button
          type="button"
          onClick={onAddChild}
          className="text-text-muted hover:text-text"
          aria-label="Add child page"
          title="Add a page inside"
        >
          +
        </button>
        <button
          type="button"
          onClick={onTrash}
          className="text-text-muted hover:text-warning"
          aria-label="Move to trash"
          title="Move to trash"
        >
          ⋯
        </button>
      </div>
    </div>
  );
}
