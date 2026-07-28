import {
  type AnyPgColumn,
  doublePrecision,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const workspaceRole = pgEnum("workspace_role", [
  "owner",
  "admin",
  "member",
  "guest",
]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  icon: text("icon"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: workspaceRole("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("workspace_members_workspace_id_user_id_key").on(
      table.workspaceId,
      table.userId,
    ),
  ],
);

export const pageVisibility = pgEnum("page_visibility", ["private", "workspace"]);

export const pages = pgTable("pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  parentPageId: uuid("parent_page_id").references((): AnyPgColumn => pages.id, {
    onDelete: "cascade",
  }),
  title: text("title").notNull().default(""),
  icon: text("icon"),
  coverUrl: text("cover_url"),
  visibility: pageVisibility("visibility").notNull().default("workspace"),
  position: doublePrecision("position").notNull().default(0),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pageFavorites = pgTable(
  "page_favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.pageId] })],
);

export const blocks = pgTable("blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  pageId: uuid("page_id")
    .notNull()
    .references(() => pages.id, { onDelete: "cascade" }),
  parentBlockId: uuid("parent_block_id").references((): AnyPgColumn => blocks.id, {
    onDelete: "cascade",
  }),
  type: text("type").notNull(),
  content: jsonb("content").notNull().default({}),
  position: doublePrecision("position").notNull().default(0),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pagesRelations = relations(pages, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [pages.workspaceId],
    references: [workspaces.id],
  }),
  parent: one(pages, {
    fields: [pages.parentPageId],
    references: [pages.id],
    relationName: "pageParent",
  }),
  children: many(pages, { relationName: "pageParent" }),
  blocks: many(blocks),
  favorites: many(pageFavorites),
}));

export const pageFavoritesRelations = relations(pageFavorites, ({ one }) => ({
  page: one(pages, { fields: [pageFavorites.pageId], references: [pages.id] }),
  user: one(profiles, { fields: [pageFavorites.userId], references: [profiles.id] }),
}));

export const blocksRelations = relations(blocks, ({ one, many }) => ({
  page: one(pages, { fields: [blocks.pageId], references: [pages.id] }),
  parent: one(blocks, {
    fields: [blocks.parentBlockId],
    references: [blocks.id],
    relationName: "blockParent",
  }),
  children: many(blocks, { relationName: "blockParent" }),
}));

export const profilesRelations = relations(profiles, ({ many }) => ({
  memberships: many(workspaceMembers),
  workspacesCreated: many(workspaces),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  creator: one(profiles, {
    fields: [workspaces.createdBy],
    references: [profiles.id],
  }),
  members: many(workspaceMembers),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(profiles, {
    fields: [workspaceMembers.userId],
    references: [profiles.id],
  }),
}));
