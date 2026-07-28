import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

export type MentionItem = { id: string; label: string };

export const MentionList = forwardRef<
  { onKeyDown: (event: { event: KeyboardEvent }) => boolean },
  { items: MentionItem[]; command: (item: MentionItem) => void }
>(function MentionList({ items, command }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => setSelectedIndex(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((i) => (i + items.length - 1) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => (i + 1) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === "Enter") {
        if (items[selectedIndex]) command(items[selectedIndex]);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="rounded-[var(--radius-cairn)] border border-border bg-surface-alt px-3 py-2 text-sm text-text-muted shadow-none">
        No matches
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius-cairn)] border border-border bg-surface-alt py-1 text-sm">
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          onClick={() => command(item)}
          className={`px-3 py-1.5 text-left ${
            index === selectedIndex ? "bg-surface text-text" : "text-text-muted"
          }`}
        >
          @{item.label}
        </button>
      ))}
    </div>
  );
});
