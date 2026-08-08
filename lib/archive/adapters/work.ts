import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { works, type Work } from "@/db/schema";
import { mediaUrl } from "@/lib/works";
import type { PublicArchiveAdapter } from "../types";

export type PublicWorkDTO = {
  id: string;
  title: string;
  collection: string;
  lookNumber: string;
  description: string;
  altText: string;
  imageUrl: string;
  status: "published";
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
  href: string;
};

export class WorkPublicAdapter
  implements PublicArchiveAdapter<Work, PublicWorkDTO>
{
  type = "work" as const;

  async loadPublishable(sourceId: string): Promise<PublicWorkDTO | null> {
    const db = await getDb();
    const [record] = await db
      .select()
      .from(works)
      .where(eq(works.id, sourceId))
      .limit(1);

    if (!record || record.status !== "published") {
      return null;
    }

    return this.toPublicDocument(record);
  }

  toPublicDocument(source: Work): PublicWorkDTO {
    return {
      id: source.id,
      title: source.title,
      collection: source.collection,
      lookNumber: source.lookNumber,
      description: source.description,
      altText: source.altText,
      imageUrl: mediaUrl(source.imageKey),
      status: "published",
      sortOrder: source.sortOrder,
      publishedAt: source.publishedAt,
      createdAt: source.createdAt,
      href: `/works/${encodeURIComponent(source.id)}`,
    };
  }
}

export const workPublicAdapter = new WorkPublicAdapter();
