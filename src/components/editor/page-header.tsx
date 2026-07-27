"use client";

import { useRef, useState, useTransition } from "react";
import { callWithQueue } from "@/lib/local/sync-queue";

export function PageHeader({
  pageId,
  initialTitle,
  initialIcon,
  visibility: initialVisibility,
}: {
  pageId: string;
  initialTitle: string;
  initialIcon: string | null;
  visibility: "private" | "workspace";
}) {
  const [title, setTitle] = useState(initialTitle);
  const [icon, setIcon] = useState(initialIcon);
  const [visibility, setVisibility] = useState(initialVisibility);
  const [, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleTitleSave(value: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      startTransition(() => {
        callWithQueue("updatePage", [pageId, { title: value }]);
      });
    }, 500);
  }

  return (
    <div className="flex flex-col gap-2 px-[var(--cairn-page-padding)] pt-10">
      <div className="flex items-center gap-2">
        <input
          value={icon ?? ""}
          onChange={(e) => {
            const value = e.target.value.slice(-2);
            setIcon(value || null);
            startTransition(() => {
              callWithQueue("updatePage", [pageId, { icon: value || null }]);
            });
          }}
          placeholder="＋"
          className="w-8 rounded-[var(--radius-cairn)] bg-transparent text-2xl outline-none hover:bg-surface"
          aria-label="Page icon"
        />
        <button
          type="button"
          onClick={() => {
            const next = visibility === "private" ? "workspace" : "private";
            setVisibility(next);
            startTransition(() => {
              callWithQueue("updatePage", [pageId, { visibility: next }]);
            });
          }}
          className="text-xs text-text-muted hover:text-text"
          title="Toggle private/workspace visibility"
        >
          {visibility === "private" ? "🔒 Private" : "🌐 Workspace"}
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          scheduleTitleSave(e.target.value);
        }}
        placeholder="Untitled"
        className="w-full bg-transparent font-[family-name:var(--font-display)] text-4xl font-semibold outline-none placeholder:text-text-muted"
      />
    </div>
  );
}
