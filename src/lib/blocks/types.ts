import { z } from "zod";
import type { JSONContent } from "@tiptap/react";

// The block types this editor actually renders. Media/embeds/tables/
// columns/synced blocks/TOC/breadcrumb/button are deferred — see
// PROGRESS.md — so they're deliberately not listed here yet.
export const BLOCK_TYPES = [
  "paragraph",
  "heading",
  "bulleted_list_item",
  "numbered_list_item",
  "to_do",
  "toggle",
  "quote",
  "callout",
  "divider",
  "code",
  "page_link",
  "child_page",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

// Text-bearing blocks store their inline content as a TipTap document for
// a single paragraph node (`{ type: "doc", content: [{ type: "paragraph",
// content: [...] }] }`) under `doc` — using TipTap's own JSON format
// directly means no lossy custom rich-text serialization. `doc`'s runtime
// shape is validated loosely (it comes straight from TipTap) but typed
// precisely as JSONContent for callers.
export const blockContentSchema = z.object({
  doc: z.any().optional(),
  text: z.string().optional(),
  checked: z.boolean().optional(),
  expanded: z.boolean().optional(),
  icon: z.string().optional(),
  language: z.string().optional(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  pageId: z.string().uuid().optional(),
});

export type BlockContent = Omit<z.infer<typeof blockContentSchema>, "doc"> & {
  doc?: JSONContent;
};

export type BlockRow = {
  id: string;
  parent_block_id: string | null;
  type: BlockType;
  content: BlockContent;
  position: number;
};

export function emptyDoc(): JSONContent {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function defaultContentFor(type: BlockType): BlockContent {
  switch (type) {
    case "heading":
      return { doc: emptyDoc(), level: 1 };
    case "to_do":
      return { doc: emptyDoc(), checked: false };
    case "toggle":
      return { doc: emptyDoc(), expanded: true };
    case "callout":
      return { doc: emptyDoc(), icon: "💡" };
    case "code":
      return { text: "", language: "plaintext" };
    case "divider":
    case "page_link":
    case "child_page":
      return {};
    default:
      return { doc: emptyDoc() };
  }
}

// Plain-text extraction for search/previews, walking a TipTap doc's text
// nodes. Deliberately not exhaustive of every possible node type.
export function docToPlainText(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  const node = doc as { type?: string; text?: string; content?: unknown[] };
  if (node.type === "text") return node.text ?? "";
  if (Array.isArray(node.content)) {
    return node.content.map(docToPlainText).join("");
  }
  return "";
}
