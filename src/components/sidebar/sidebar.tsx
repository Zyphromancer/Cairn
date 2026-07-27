"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageTree } from "./page-tree";
import type { PageRow as PageRowData } from "./types";
import { createPage, deletePagePermanently } from "@/app/actions/pages";
import { callWithQueue } from "@/lib/local/sync-queue";
import { positionBetween } from "@/lib/blocks/position";

function SectionHeader({
  label,
  onAdd,
}: {
  label: string;
  onAdd?: () => void;
}) {
  return (
    <div className="group flex items-center justify-between px-2 pt-4 pb-1">
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
        {label}
      </span>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="text-text-muted hover:text-text"
          aria-label={`New page in ${label}`}
        >
          +
        </button>
      )}
    </div>
  );
}

export function Sidebar({
  workspace,
  pages,
  favoritePageIds,
  currentUserId,
}: {
  workspace: { id: string; name: string; icon: string | null; slug: string };
  pages: PageRowData[];
  favoritePageIds: string[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [trashOpen, setTrashOpen] = useState(false);
  const favoriteSet = useMemo(() => new Set(favoritePageIds), [favoritePageIds]);

  const activePages = pages.filter((p) => !p.archived_at);
  const trashedPages = pages.filter((p) => p.archived_at);

  const privateRootIds = activePages
    .filter(
      (p) =>
        p.visibility === "private" &&
        p.created_by === currentUserId &&
        (p.parent_page_id === null || isOrphanOf(p, activePages)),
    )
    .map((p) => p.id);

  const workspaceRootIds = activePages
    .filter(
      (p) =>
        p.visibility === "workspace" &&
        (p.parent_page_id === null || isOrphanOf(p, activePages)),
    )
    .map((p) => p.id);

  function isOrphanOf(page: PageRowData, all: PageRowData[]) {
    if (page.parent_page_id === null) return false;
    return !all.some((p) => p.id === page.parent_page_id);
  }

  async function addRootPage(visibility: "private" | "workspace") {
    const roots = activePages.filter((p) => p.parent_page_id === null);
    const position = positionBetween(
      roots.length ? Math.max(...roots.map((p) => p.position)) : null,
      null,
    );
    const page = await createPage({ workspaceId: workspace.id, position, visibility });
    router.push(`/w/${workspace.slug}/p/${page.id}`);
  }

  return (
    <nav className="flex w-[var(--cairn-sidebar-width)] shrink-0 flex-col overflow-y-auto border-r border-border bg-surface px-2 py-3">
      <Link
        href={`/w/${workspace.slug}`}
        className="flex items-center gap-2 px-2 py-1 text-sm hover:text-accent"
      >
        <span>{workspace.icon ?? "◆"}</span>
        <span className="truncate font-medium">{workspace.name}</span>
      </Link>

      {favoritePageIds.length > 0 && (
        <>
          <SectionHeader label="Favorites" />
          <PageTree
            slug={workspace.slug}
            workspaceId={workspace.id}
            allPages={activePages}
            rootIds={favoritePageIds.filter((id) => activePages.some((p) => p.id === id))}
            favoritePageIds={favoriteSet}
            visibility="workspace"
          />
        </>
      )}

      <SectionHeader label="Private" onAdd={() => addRootPage("private")} />
      <PageTree
        slug={workspace.slug}
        workspaceId={workspace.id}
        allPages={activePages}
        rootIds={privateRootIds}
        favoritePageIds={favoriteSet}
        visibility="private"
      />

      <SectionHeader label="Workspace" onAdd={() => addRootPage("workspace")} />
      <PageTree
        slug={workspace.slug}
        workspaceId={workspace.id}
        allPages={activePages}
        rootIds={workspaceRootIds}
        favoritePageIds={favoriteSet}
        visibility="workspace"
      />

      <div className="mt-4 border-t border-border pt-2">
        <button
          type="button"
          onClick={() => setTrashOpen((v) => !v)}
          className="w-full px-2 py-1 text-left text-xs font-medium uppercase tracking-wide text-text-muted hover:text-text"
        >
          {trashOpen ? "▾" : "▸"} Trash{trashedPages.length ? ` (${trashedPages.length})` : ""}
        </button>
        {trashOpen && (
          <ul className="flex flex-col gap-1 px-2 py-1">
            {trashedPages.length === 0 && (
              <li className="text-xs text-text-muted">Empty</li>
            )}
            {trashedPages.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-xs">
                <span className="truncate text-text-muted">
                  {p.icon ?? "📄"} {p.title || "Untitled"}
                </span>
                <span className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="text-text-muted hover:text-text"
                    onClick={() =>
                      startTransition(() => {
                        callWithQueue("restorePage", [p.id]).then(() => router.refresh());
                      })
                    }
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    className="text-text-muted hover:text-warning"
                    onClick={() => {
                      if (!confirm(`Permanently delete "${p.title || "Untitled"}"?`)) return;
                      startTransition(() => {
                        deletePagePermanently(p.id).then(() => router.refresh());
                      });
                    }}
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}
