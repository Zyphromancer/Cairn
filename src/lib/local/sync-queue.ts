"use client";

import { localDB } from "./db";
import { updateBlockContent, moveBlock } from "@/app/actions/blocks";
import { updatePage, movePage, toggleFavorite, trashPage, restorePage } from "@/app/actions/pages";

// Fire-and-forget mutations only: local state is already updated
// optimistically before these are called, and nothing downstream needs
// their return value (unlike createBlock/createPage, which hand back a
// real id the UI needs immediately — those stay direct, un-queued calls;
// true offline creation would need client-generated ids, deferred).
const registry = {
  updateBlockContent,
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
