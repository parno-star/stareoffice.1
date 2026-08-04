import type { Id } from "@/convex/_generated/dataModel.d.ts";

export type ArticlePreview = {
  _id: Id<"wikiArticles">;
  _creationTime: number;
  spaceId: Id<"wikiSpaces">;
  title: string;
  summary: string | null;
  tags: Array<string>;
  status: string;
  viewCount: number;
  lastEditedAt: string;
  authorId: Id<"users">;
  authorName: string | null;
  authorAvatar: string | null;
  spaceName: string | null;
  spaceIcon: string | null;
  spaceColor: string | null;
};
