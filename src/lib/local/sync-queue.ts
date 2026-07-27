"use client";

import { localDB } from "./db";
import {
  createBlock,
  deleteBlock,
  updateBlockContent,
  moveBlock,
  turnIntoBlock,
} from "@/app/actions/blocks";
import { updatePage, movePage, toggleFavorite, trashPage, restorePage } from "@/app/actions/pages";

// Fire-and-forget mutations only: local state is already updated
// optimistically before these are called, and nothing downstream needs
// their return value. createBlock is safe to queue because block ids are
// generated client-side (see block-editor.tsx's insertAfter) — the
// caller never needs the server's response. createPage/createChildPage
// still need a live round trip since page ids come from the server and
// drive an immediate navigation.
const registry = {
  createBlock,
  deleteBlock,
  updateBlockContent,
  turnIntoBlock,
  moveBlock,
  updatePage,
  movePage,
  toggleFavorite,
  trashPage,
  restorePage,
};

type Registry = typeof registry;

export async function callWithQueue<K extends keyof Registry>(
  type: K,
  args: Parameters<Registry[K]>,
): Promise<void> {
  try {
    await (registry[type] as (...a: Parameters<Registry[K]>) => Promise<unknown>)(...args);
  } catch {
    await localDB?.pendingWrites.add({ type, args, createdAt: Date.now() });
  }
}

export async function flushQueue() {
  if (!localDB) return;
  const pending = await localDB.pendingWrites.orderBy("createdAt").toArray();
  for (const item of pending) {
    try {
      const fn = registry[item.type as keyof Registry] as (...a: unknown[]) => Promise<unknown>;
      await fn(...item.args);
      await localDB.pendingWrites.delete(item.id!);
    } catch {
      // Still failing (offline, or a real error) — stop here so writes
      // for the same block/page don't get replayed out of order.
      break;
    }
  }
}

export function initSyncQueue() {
  if (typeof window === "undefined") return;
  window.addEventListener("online", flushQueue);
  void flushQueue();
  const interval = setInterval(() => void flushQueue(), 30_000);
  return () => {
    window.removeEventListener("online", flushQueue);
    clearInterval(interval);
  };
}
