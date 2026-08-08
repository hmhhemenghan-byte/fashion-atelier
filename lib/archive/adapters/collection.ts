import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { collections, type Collection } from "@/db/schema";
import { collectionHeroUrl } from "@/lib/collections";
import type { PublicArchiveAdapter } from "../types";

export type PublicCollectionDTO = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  season: string;
  year: number;
  statement: string;
  heroImageUrl: string | null;
  heroAltText: string;
  status: "published";
  featured: boolean;
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
  href: string;
};

export class CollectionPublicAdapter
  implements PublicArchiveAdapter<Collection, PublicCollectionDTO>
{
  type = "collection" as const;

  async loadPublishable(sourceId: string): Promise<PublicCollectionDTO | null> {
    const db = await getDb();
    const [record] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, sourceId))
      .limit(1);

    if (!record || record.status !== "published") {
      return null;
    }

    return this.toPublicDocument(record);
  }

  toPublicDocument(source: Collection): PublicCollectionDTO {
    return {
      id: source.id,
      slug: source.slug,
      title: source.title,
      subtitle: source.subtitle,
      season: source.season,
      year: source.year,
      statement: source.statement,
      heroImageUrl: collectionHeroUrl(source),
      heroAltText: source.heroAltText,
      status: "published",
      featured: Boolean(source.featured),
      sortOrder: source.sortOrder,
      publishedAt: source.publishedAt,
      createdAt: source.createdAt,
      href: `/collections/${encodeURIComponent(source.slug)}`,
    };
  }
}

export const collectionPublicAdapter = new CollectionPublicAdapter();
