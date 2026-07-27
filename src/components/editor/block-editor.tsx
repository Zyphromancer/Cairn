"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { BlockView } from "./block-view";
import type { RichTextHandle } from "./rich-text";
import { SlashMenu, filterSlashOptions, type SlashOption } from "./slash-menu";
import type { MentionItem } from "./mention-list";
import {
  type BlockContent,
  type BlockRow,
  type BlockType,
  defaultContentFor,
  docToPlainText,
} from "@/lib/blocks/types";
import { matchMarkdownRule, type MarkdownRuleMatch } from "@/lib/blocks/markdown-rules";
import { positionBetween } from "@/lib/blocks/position";
import { createChildPage } from "@/app/actions/pages";
import { callWithQueue } from "@/lib/local/sync-queue";
import type { DropZone } from "@/components/sidebar/types";

type WorkspacePage = { id: string; title: string; icon: string | null };

// The most recent markdown-rule conversion, kept around just long enough
// for a single Cmd/Ctrl+Z to revert it (see handleUndoConversion). Cleared
// as soon as it's used, or as soon as the affected block is edited again —
// block-type conversion isn't part of TipTap's own undo history (it's an
// app-level change, not a ProseMirror doc change), so this is a one-shot
// substitute rather than a real undo stack entry.
type ConversionRecord = {
  blockId: string;
  prevType: BlockType;
  prevContent: BlockContent;
  // Set only for triggers (like "---") that also insert a trailing block
  // on conversion — undo needs to remove it again.
  extraBlockId?: string;
};

export function BlockEditor({
  pageId,
  workspaceId,
  slug,
  initialBlocks,
  members,
  workspacePages,
}: {
  pageId: string;
  workspaceId: string;
  slug: string;
  initialBlocks: BlockRow[];
  members: MentionItem[];
  workspacePages: WorkspacePage[];
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<BlockRow[]>(initialBlocks);
  // Only the very first paint (SSR + hydration) needs TipTap's deferred
  // (immediatelyRender: false) construction to avoid a hydration
  // mismatch. `hydrated` flips true on the next tick after mount — used
  // as `renderImmediately` for every RichText below. This covers not
  // just newly-created blocks but also existing ones that get remounted
  // later (turning a block into a different type changes its wrapper
  // JSX shape — e.g. plain vs. `<div className=...>` — which makes
  // React unmount/remount RichText instead of reusing it; that remount
  // happens well after hydration, so it's always safe to be immediate).
  const [hydrated, setHydrated] = useState(false);
  // The standard client-only-flag idiom (see React docs on hydration
  // mismatches) — deliberately a bare setState so it fires as early as
  // possible, one tick after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHydrated(true), []);
  const refs = useRef(new Map<string, RichTextHandle>());
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const lastConversionRef = useRef<ConversionRecord | null>(null);
  const [slashMenu, setSlashMenu] = useState<{
    blockId: string;
    options: SlashOption[];
    selectedIndex: number;
  } | null>(null);
  // Focus for a block that just (re)mounted — newly created, or an
  // existing block moved to a different React parent (indent/outdent
  // move it between sibling arrays, which remounts rather than reuses
  // the instance) — is handled via the `autoFocus` prop (TipTap's own
  // construction-time option; see rich-text.tsx for why an imperative
  // ref.focusStart() right after creation doesn't work). Focus for a
  // block that's already mounted and staying put (arrow nav, backspace
  // merge target) uses the ref directly instead, synchronously.
  const [autoFocusTarget, setAutoFocusTarget] = useState<{
    id: string;
    mode: "start" | "end";
  } | null>(null);
  function requestAutoFocus(id: string, mode: "start" | "end" = "start") {
    setAutoFocusTarget({ id, mode });
  }
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const pagesById = useMemo(() => {
    const map = new Map<string, WorkspacePage>();
    for (const p of workspacePages) map.set(p.id, p);
    return map;
  }, [workspacePages]);

  const hasRequestedInitialBlock = useRef(false);
  useEffect(() => {
    // Guarded against React StrictMode's double effect invocation in dev,
    // which would otherwise create two empty first blocks.
    if (blocks.length === 0 && !hasRequestedInitialBlock.current) {
      hasRequestedInitialBlock.current = true;
      const initialBlock: BlockRow = {
        id: crypto.randomUUID(),
        parent_block_id: null,
        type: "paragraph",
        content: defaultContentFor("paragraph"),
        position: 0,
      };
      setBlocks([initialBlock]);
      callWithQueue("createBlock", [
        {
          id: initialBlock.id,
          pageId,
          type: "paragraph",
          position: 0,
          content: initialBlock.content,
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const childrenOf = useCallback(
    (parentId: string | null) =>
      blocks.filter((b) => b.parent_block_id === parentId).sort((a, b) => a.position - b.position),
    [blocks],
  );

  const numbering = useMemo(() => {
    const map = new Map<string, number>();
    function walkSiblings(parentId: string | null) {
      const kids = blocks
        .filter((b) => b.parent_block_id === parentId)
        .sort((a, b) => a.position - b.position);
      let running = 0;
      for (const kid of kids) {
        if (kid.type === "numbered_list_item") {
          running += 1;
          map.set(kid.id, running);
        } else {
          running = 0;
        }
        walkSiblings(kid.id);
      }
    }
    walkSiblings(null);
    return map;
  }, [blocks]);

  const visibleOrder = useMemo(() => {
    const order: BlockRow[] = [];
    function walk(parentId: string | null) {
      const kids = blocks
        .filter((b) => b.parent_block_id === parentId)
        .sort((a, b) => a.position - b.position);
      for (const kid of kids) {
        order.push(kid);
        const showChildren = kid.type !== "toggle" || kid.content.expanded !== false;
        if (showChildren) walk(kid.id);
      }
    }
    walk(null);
    return order;
  }, [blocks]);

  function updateLocal(id: string, patch: Partial<BlockRow>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function scheduleContentSave(id: string, content: BlockContent) {
    const timers = saveTimers.current;
    const existing = timers.get(id);
    if (existing) clearTimeout(existing);
    timers.set(
      id,
      setTimeout(() => {
        callWithQueue("updateBlockContent", [id, content]);
        timers.delete(id);
      }, 500),
    );
  }

  function flushContentSave(id: string, content: BlockContent) {
    const timers = saveTimers.current;
    const existing = timers.get(id);
    if (existing) {
      clearTimeout(existing);
      timers.delete(id);
    }
    callWithQueue("updateBlockContent", [id, content]);
  }

  function handleDocUpdate(block: BlockRow, doc: JSONContent) {
    // Any edit to a block invalidates a pending one-shot undo-conversion
    // for *that* block — once the user keeps typing, Cmd+Z should mean
    // "undo the typing" again, not "revert the earlier conversion".
    if (lastConversionRef.current?.blockId === block.id) {
      lastConversionRef.current = null;
    }

    const content = { ...block.content, doc };
    updateLocal(block.id, { content });

    // Markdown input rules only apply to plain paragraph blocks, and only
    // when the trigger is the block's *entire* text — see markdown-rules.ts
    // for why that's sufficient to guarantee "position 0 of an otherwise
    // empty block, never mid-text". Code blocks never reach here at all
    // (they use onCodeChange, not onUpdate/handleDocUpdate).
    if (block.type === "paragraph") {
      const match = matchMarkdownRule(docToPlainText(doc));
      if (match) {
        handleMarkdownRuleMatch(block, content, match);
        return;
      }
    }

    scheduleContentSave(block.id, content);
  }

  function handleMarkdownRuleMatch(block: BlockRow, literalContent: BlockContent, match: MarkdownRuleMatch) {
    const timers = saveTimers.current;
    const existing = timers.get(block.id);
    if (existing) {
      clearTimeout(existing);
      timers.delete(block.id);
    }

    const record: ConversionRecord = { blockId: block.id, prevType: block.type, prevContent: literalContent };
    lastConversionRef.current = record;

    refs.current.get(block.id)?.clearContent();

    const newContent: BlockContent = {
      ...defaultContentFor(match.type),
      ...(match.type === "heading" ? { level: match.level } : {}),
      ...(match.type === "to_do" ? { checked: match.checked } : {}),
    };
    updateLocal(block.id, { type: match.type, content: newContent });
    callWithQueue("turnIntoBlock", [block.id, match.type, newContent]);
    requestAutoFocus(block.id, "start");

    if (match.type === "divider") {
      const newBlock = insertAfter({ ...block, type: "divider" }, "paragraph");
      requestAutoFocus(newBlock.id, "start");
      record.extraBlockId = newBlock.id;
    }
  }

  function handleUndoConversion(block: BlockRow): boolean {
    const record = lastConversionRef.current;
    if (!record || (record.blockId !== block.id && record.extraBlockId !== block.id)) return false;
    lastConversionRef.current = null;

    if (record.extraBlockId) {
      setBlocks((current) => current.filter((b) => b.id !== record.extraBlockId));
      callWithQueue("deleteBlock", [record.extraBlockId]);
    }

    updateLocal(record.blockId, { type: record.prevType, content: record.prevContent });
    callWithQueue("turnIntoBlock", [record.blockId, record.prevType, record.prevContent]);
    requestAutoFocus(record.blockId, "end");
    return true;
  }

  // Generates the new block's id on the client and adds it to local state
  // synchronously (same tick) instead of waiting on a createBlock round
  // trip. Enter needs to be able to focus the new block immediately —
  // typing right after Enter would otherwise race the network and land
  // in the old block while the new one doesn't exist yet.
  function insertAfter(block: BlockRow, type: BlockType, content?: BlockContent): BlockRow {
    const siblings = childrenOf(block.parent_block_id);
    const idx = siblings.findIndex((b) => b.id === block.id);
    const after = siblings[idx + 1];
    const position = positionBetween(block.position, after?.position ?? null);
    const newBlock: BlockRow = {
      id: crypto.randomUUID(),
      parent_block_id: block.parent_block_id,
      type,
      content: content ?? defaultContentFor(type),
      position,
    };
    setBlocks((prev) => [...prev, newBlock]);
    callWithQueue("createBlock", [
      {
        id: newBlock.id,
        pageId,
        type,
        position,
        parentBlockId: block.parent_block_id,
        content: newBlock.content,
      },
    ]);
    return newBlock;
  }

  function handleEnter(block: BlockRow) {
    const handle = refs.current.get(block.id);
    if (!handle) return;
    const { before, after } = handle.splitAtCursor();
    const beforeContent = { ...block.content, doc: before };
    handle.setContent(before);
    updateLocal(block.id, { content: beforeContent });
    flushContentSave(block.id, beforeContent);

    const continuesType: BlockType[] = ["bulleted_list_item", "numbered_list_item", "to_do"];
    const nextType: BlockType = continuesType.includes(block.type) ? block.type : "paragraph";
    const nextContent = { ...defaultContentFor(nextType), doc: after };

    const newBlock = insertAfter(block, nextType, nextContent);
    requestAutoFocus(newBlock.id, "start");
  }

  function handleBackspaceAtStart(block: BlockRow) {
    const idx = visibleOrder.findIndex((b) => b.id === block.id);
    const prev = idx > 0 ? visibleOrder[idx - 1] : null;
    if (!prev) return;
    if (visibleOrder.length === 1) return;

    const handle = refs.current.get(block.id);
    const prevHandle = refs.current.get(prev.id);
    const isEmpty = handle?.isEmpty() ?? true;

    if (!isEmpty && prevHandle) {
      const merged = prevHandle.appendDoc(handle!.getDoc());
      const mergedContent = { ...prev.content, doc: merged };
      updateLocal(prev.id, { content: mergedContent });
      flushContentSave(prev.id, mergedContent);
    }

    setBlocks((current) => current.filter((b) => b.id !== block.id));
    callWithQueue("deleteBlock", [block.id]);
    // prev is already mounted, so focus it directly rather than going
    // through the autoFocus (construction-time) mechanism.
    prevHandle?.focusEnd();
  }

  function handleArrowUp(block: BlockRow) {
    const idx = visibleOrder.findIndex((b) => b.id === block.id);
    const prev = idx > 0 ? visibleOrder[idx - 1] : null;
    if (prev) refs.current.get(prev.id)?.focusEnd();
  }

  function handleArrowDown(block: BlockRow) {
    const idx = visibleOrder.findIndex((b) => b.id === block.id);
    const next = idx >= 0 && idx < visibleOrder.length - 1 ? visibleOrder[idx + 1] : null;
    if (next) refs.current.get(next.id)?.focusStart();
  }

  function handleIndent(block: BlockRow) {
    const siblings = childrenOf(block.parent_block_id);
    const idx = siblings.findIndex((b) => b.id === block.id);
    if (idx <= 0) return;
    const newParent = siblings[idx - 1];
    const newSiblings = childrenOf(newParent.id);
    const position = positionBetween(
      newSiblings.length ? newSiblings[newSiblings.length - 1].position : null,
      null,
    );
    updateLocal(block.id, { parent_block_id: newParent.id, position });
    callWithQueue("moveBlock", [block.id, { parentBlockId: newParent.id, position }]);
    // Moving to a different parent's children array is a different React
    // parent, so this remounts the block (loses focus/cursor) rather
    // than reuse the instance — re-arm focus so the user can keep typing.
    requestAutoFocus(block.id, "end");
  }

  function handleOutdent(block: BlockRow) {
    if (!block.parent_block_id) return;
    const parent = blocks.find((b) => b.id === block.parent_block_id);
    if (!parent) return;
    const grandSiblings = childrenOf(parent.parent_block_id);
    const parentIdx = grandSiblings.findIndex((b) => b.id === parent.id);
    const after = grandSiblings[parentIdx + 1];
    const position = positionBetween(parent.position, after?.position ?? null);
    updateLocal(block.id, { parent_block_id: parent.parent_block_id, position });
    callWithQueue("moveBlock", [block.id, { parentBlockId: parent.parent_block_id, position }]);
    requestAutoFocus(block.id, "end");
  }

  function handleDrop(targetId: string, zone: DropZone) {
    if (!draggingId || draggingId === targetId) return;
    const target = blocks.find((b) => b.id === targetId);
    const dragging = blocks.find((b) => b.id === draggingId);
    if (!target || !dragging) return;

    if (zone === "inside") {
      const kids = childrenOf(targetId);
      const position = positionBetween(kids.length ? kids[kids.length - 1].position : null, null);
      updateLocal(draggingId, { parent_block_id: targetId, position });
      callWithQueue("moveBlock", [draggingId, { parentBlockId: targetId, position }]);
      return;
    }

    const parentId = target.parent_block_id;
    const sibs = childrenOf(parentId).filter((b) => b.id !== draggingId);
    const targetIndex = sibs.findIndex((b) => b.id === targetId);
    const before = zone === "before" ? sibs[targetIndex - 1] : sibs[targetIndex];
    const after = zone === "before" ? sibs[targetIndex] : sibs[targetIndex + 1];
    const position = positionBetween(before?.position ?? null, after?.position ?? null);
    updateLocal(draggingId, { parent_block_id: parentId, position });
    callWithQueue("moveBlock", [draggingId, { parentBlockId: parentId, position }]);
  }

  function openSlashMenu(block: BlockRow, query: string) {
    const options = filterSlashOptions(query, workspacePages, pageId);
    setSlashMenu({ blockId: block.id, options, selectedIndex: 0 });
  }

  async function handleSlashSelect(block: BlockRow, option: SlashOption) {
    setSlashMenu(null);
    const handle = refs.current.get(block.id);

    if (option.kind === "page") {
      handle?.clearContent();
      const content = { pageId: option.pageId };
      updateLocal(block.id, { type: "page_link", content });
      callWithQueue("turnIntoBlock", [block.id, "page_link", content]);
      const newBlock = insertAfter({ ...block, type: "page_link" }, "paragraph");
      requestAutoFocus(newBlock.id, "start");
      return;
    }

    if (option.type === "child_page") {
      setBlocks((current) => current.filter((b) => b.id !== block.id));
      callWithQueue("deleteBlock", [block.id]);
      const page = await createChildPage({ pageId, workspaceId, blockPosition: block.position });
      router.push(`/w/${slug}/p/${page.id}`);
      return;
    }

    handle?.clearContent();
    const content = { ...defaultContentFor(option.type), ...(option.level ? { level: option.level } : {}) };
    updateLocal(block.id, { type: option.type, content });
    callWithQueue("turnIntoBlock", [block.id, option.type, content]);
    // Re-arm autoFocus for the converted block itself: many type changes
    // (paragraph -> heading/list/todo/toggle/quote/callout) alter its
    // wrapper JSX shape, which remounts RichText rather than reusing the
    // instance, dropping focus. Harmless no-op if it wasn't remounted —
    // autoFocus is a construction-time option TipTap only reads once.
    requestAutoFocus(block.id, "start");

    if (option.type === "divider") {
      const newBlock = insertAfter({ ...block, type: "divider" }, "paragraph");
      requestAutoFocus(newBlock.id, "start");
    }
  }

  function handleSlashKeyDown(block: BlockRow, event: KeyboardEvent): boolean {
    if (!slashMenu || slashMenu.blockId !== block.id) return false;
    if (event.key === "ArrowDown") {
      setSlashMenu({
        ...slashMenu,
        selectedIndex: (slashMenu.selectedIndex + 1) % Math.max(slashMenu.options.length, 1),
      });
      return true;
    }
    if (event.key === "ArrowUp") {
      setSlashMenu({
        ...slashMenu,
        selectedIndex:
          (slashMenu.selectedIndex - 1 + slashMenu.options.length) %
          Math.max(slashMenu.options.length, 1),
      });
      return true;
    }
    if (event.key === "Enter") {
      const option = slashMenu.options[slashMenu.selectedIndex];
      if (option) handleSlashSelect(block, option);
      return true;
    }
    if (event.key === "Escape") {
      setSlashMenu(null);
      return true;
    }
    return false;
  }

  function renderBlock(block: BlockRow): React.ReactNode {
    const linkedPage = block.content.pageId ? pagesById.get(block.content.pageId) : undefined;
    const kids = childrenOf(block.id);
    const showChildren = block.type !== "toggle" || block.content.expanded !== false;

    return (
      <div key={block.id} className="relative">
        <BlockRowDropZone
          onDragStartBlock={setDraggingId}
          onDropOnBlock={handleDrop}
          blockId={block.id}
        >
          <BlockView
            ref={(handle) => {
              if (handle) refs.current.set(block.id, handle);
              else refs.current.delete(block.id);
            }}
            type={block.type}
            content={block.content}
            listIndex={numbering.get(block.id)}
            slug={slug}
            linkedPage={linkedPage}
            members={members}
            autoFocus={block.id === autoFocusTarget?.id ? autoFocusTarget.mode : false}
            renderImmediately={hydrated}
            slashMenuOpen={slashMenu?.blockId === block.id}
            onUpdate={(doc) => handleDocUpdate(block, doc)}
            onCodeChange={(text) => {
              const content = { ...block.content, text };
              updateLocal(block.id, { content });
              scheduleContentSave(block.id, content);
            }}
            onEnter={() => handleEnter(block)}
            onBackspaceAtStart={() => handleBackspaceAtStart(block)}
            onArrowUp={() => handleArrowUp(block)}
            onArrowDown={() => handleArrowDown(block)}
            onIndent={() => handleIndent(block)}
            onOutdent={() => handleOutdent(block)}
            onSlashQueryChange={(query) => {
              if (query === null) {
                if (slashMenu?.blockId === block.id) setSlashMenu(null);
              } else {
                openSlashMenu(block, query);
              }
            }}
            onSlashKeyDown={(event) => handleSlashKeyDown(block, event)}
            onUndoConversion={() => handleUndoConversion(block)}
            onToggleExpanded={() => {
              const content = { ...block.content, expanded: !(block.content.expanded !== false) };
              updateLocal(block.id, { content });
              flushContentSave(block.id, content);
            }}
            onToggleChecked={() => {
              const content = { ...block.content, checked: !block.content.checked };
              updateLocal(block.id, { content });
              flushContentSave(block.id, content);
            }}
          />
        </BlockRowDropZone>
        {slashMenu?.blockId === block.id && (
          <div className="absolute left-0 top-full z-10 mt-1">
            <SlashMenu
              options={slashMenu.options}
              selectedIndex={slashMenu.selectedIndex}
              onSelect={(option) => handleSlashSelect(block, option)}
              onHoverIndex={(index) => setSlashMenu((s) => (s ? { ...s, selectedIndex: index } : s))}
            />
          </div>
        )}
        {showChildren && kids.length > 0 && (
          <div className="ml-5 border-l border-border pl-2">{kids.map((kid) => renderBlock(kid))}</div>
        )}
      </div>
    );
  }

  const topLevel = childrenOf(null);

  return (
    <div className="flex flex-col gap-0.5">
      {topLevel.map((block) => renderBlock(block))}
    </div>
  );
}

function BlockRowDropZone({
  blockId,
  onDragStartBlock,
  onDropOnBlock,
  children,
}: {
  blockId: string;
  onDragStartBlock: (id: string) => void;
  onDropOnBlock: (id: string, zone: DropZone) => void;
  children: React.ReactNode;
}) {
  const [zone, setZone] = useState<DropZone | null>(null);

  return (
    <div
      className="group/block relative flex gap-1"
      onDragOver={(e) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientY - rect.top) / rect.height;
        setZone(ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside");
      }}
      onDragLeave={() => setZone(null)}
      onDrop={(e) => {
        e.preventDefault();
        if (zone) onDropOnBlock(blockId, zone);
        setZone(null);
      }}
    >
      {zone === "before" && <div className="absolute inset-x-0 top-0 h-px bg-accent" />}
      {zone === "after" && <div className="absolute inset-x-0 bottom-0 h-px bg-accent" />}
      <span
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          onDragStartBlock(blockId);
        }}
        className="mt-1 hidden h-4 w-4 shrink-0 cursor-grab select-none text-text-muted group-hover/block:block"
      >
        ⠿
      </span>
      <div
        className={`min-w-0 flex-1 ${zone === "inside" ? "rounded-[var(--radius-cairn)] outline outline-1 outline-accent" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}
