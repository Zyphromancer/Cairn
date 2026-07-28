import Dexie, { type Table } from "dexie";

export interface PendingWrite {
  id?: number;
  type: string;
  args: unknown[];
  createdAt: number;
}

class CairnLocalDB extends Dexie {
  pendingWrites!: Table<PendingWrite, number>;

  constructor() {
    super("cairn-local");
    this.version(1).stores({
      pendingWrites: "++id, type, createdAt",
    });
  }
}

// Dexie needs IndexedDB, which doesn't exist during SSR.
export const localDB = typeof window !== "undefined" ? new CairnLocalDB() : null;
