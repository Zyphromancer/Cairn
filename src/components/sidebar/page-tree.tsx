"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageRow } from "./page-row";
import type { DropZone, PageRow as PageRowData } from "./types";
import { createPage } from "@/app/actions/pages";
import { callWithQueue } from "@/lib/local/sync-queue";
import { positionBetween } from "@/lib/blocks/position";

export function PageTree({
  slug,
  workspaceId,
  allPages,
  rootIds,
  favoritePageIds,
  visibility,
}: {
  slug: string;
  workspaceId: string;
  allPages: PageRowData[];
  rootIds: string[];
  favoritePageIds: Set<string>;
  visibility: "private" | "workspace";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, PageRowData[]>();
    for (const page of allPages) {
      const key = page.parent_page_id;
      const list = map.get(key) ?? [];
      list.push(page);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [allPages]);

  function siblingsOf(parentId: string | null) {
    return childrenByParent.get(parentId) ?? [];
  }

  function handleDrop(targetId: string, zone: DropZone) {
    if (!draggingId || draggingId === targetId) return;
    const target = allPages.find((p) => p.id === targetId);
    if (!target) return;

    if (zone === "inside") {
      const kids = siblingsOf(targetId);
      const position = positionBetween(kids.length ? kids[kids.length - 1].position : null, null);
      startTransition(() => {
        callWithQueue("movePage", [draggingId, { parentPageId: targetId, position }]).then(() => router.refresh());
      });
      setExpanded((prev) => new Set(prev).add(targetId));
      return;
    }

    const parentId = target.parent_page_id;
    const sibs = siblingsOf(parentId).filter((p) => p.id !== draggingId);
    const targetIndex = sibs.findIndex((p) => p.id === targetId);
    const before = zone === "before" ? sibs[targetIndex - 1] : sibs[targetIndex];
    const after = zone === "before" ? sibs[targetIndex] : sibs[targetIndex + 1];
    const position = positionBetween(before?.position ?? null, after?.position ?? null);

    startTransition(() => {
      callWithQueue("movePage", [draggingId, { parentPageId: parentId, position }]).then(() => router.refresh());
    });
  }

  async function handleAddChild(parentId: string) {
    const kids = siblingsOf(parentId);
    const position = positionBetween(kids.length ? kids[kids.length - 1].position : null, null);
    const page = await createPage({ workspaceId, parentPageId: parentId, position, visibility });
    setExpanded((prev) => new Set(prev).add(parentId));
    router.push(`/w/${slug}/p/${page.id}`);
  }

  function renderNode(page: PageRowData, depth: number): React.ReactNode {
    const kids = siblingsOf(page.id);
    const isExpanded = expanded.has(page.id);
    return (
      <div key={page.id}>
        <PageRow
          slug={slug}
          pageId={page.id}
          title={page.title}
          icon={page.icon}
          isFavorite={favoritePageIds.has(page.id)}
          hasChildren={kids.length > 0}
          expanded={isExpanded}
          depth={depth}
          onToggleExpand={() =>
            setExpanded((prev) => {
              const next = new Set(prev);
              if (next.has(page.id)) next.delete(page.id);
              else next.add(page.id);
              return next;
            })
          }
          onToggleFavorite={() =>
            startTransition(() => {
              callWithQueue("toggleFavorite", [page.id, !favoritePageIds.has(page.id)]).then(() => router.refresh());
            })
          }
          onAddChild={() => handleAddChild(page.id)}
          onTrash={() =>
            startTransition(() => {
              callWithQueue("trashPage", [page.id]).then(() => router.refresh());
            })
          }
          onDragStartPage={setDraggingId}
          onDropOnPage={handleDrop}
        />
        {isExpanded && kids.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  const roots = rootIds
    .map((id) => allPages.find((p) => p.id === id))
    .filter((p): p is PageRowData => !!p)
    .sort((a, b) => a.position - b.position);

  return <div>{roots.map((page) => renderNode(page, 0))}</div>;
}
