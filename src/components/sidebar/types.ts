export type PageRow = {
  id: string;
  parent_page_id: string | null;
  title: string;
  icon: string | null;
  visibility: "private" | "workspace";
  archived_at: string | null;
  position: number;
  created_by: string;
};

export type DropZone = "before" | "inside" | "after";
