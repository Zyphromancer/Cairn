"use client";

import { useEffect } from "react";
import { initSyncQueue } from "@/lib/local/sync-queue";

export function SyncQueueInit() {
  useEffect(() => initSyncQueue(), []);
  return null;
}
