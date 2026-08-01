import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  collections,
  collectionWorks,
  works,
  type Collection,
} from "@/db/schema";
import { mediaUrl } from "@/lib/works";

export async function listPublishedCollections(limit = 24) {
  const db = await getDb();
  return db
    .select()
    .from(collections)
    .where(eq(collections.status, "published"))
    .orderBy(
      desc(collections.featured),
      asc(collections.sortOrder),
      desc(collections.year),
      desc(collections.publishedAt),
    )
    .limit(limit);
}

export async function listAllCollections(limit = 100) {
  const db = await getDb();
  return db
    .select()
    .from(collections)
    .orderBy(
      desc(collections.featured),
      asc(collections.sortOrder),
      desc(collections.year),
      desc(collections.createdAt),
    )
    .limit(limit);
}

export async function listAllCollectionAssignments() {
  const db = await getDb();
  return db
    .select()
    .from(collectionWorks)
    .orderBy(
      asc(collectionWorks.collectionId),
      asc(collectionWorks.sortOrder),
      asc(collectionWorks.createdAt),
    );
}

export async function getCollectionById(id: string) {
  const db = await getDb();
  const [collection] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, id))
    .limit(1);
  return collection ?? null;
}

export async function getCollectionBySlug(slug: string) {
  const db = await getDb();
  const [collection] = await db
    .select()
    .from(collections)
    .where(eq(collections.slug, slug))
    .limit(1);
  return collection ?? null;
}

export async function getFeaturedCollection() {
  const db = await getDb();
  const [collection] = await db
    .select()
    .from(collections)
    .where(
      and(
        eq(collections.status, "published"),
        eq(collections.featured, true),
      ),
    )
    .orderBy(asc(collections.sortOrder), desc(collections.publishedAt))
    .limit(1);
  return collection ?? null;
}

export async function listCollectionWorks(
  collectionId: string,
  includeDrafts = false,
) {
  const db = await getDb();
  const condition = includeDrafts
    ? eq(collectionWorks.collectionId, collectionId)
    : and(
        eq(collectionWorks.collectionId, collectionId),
        eq(works.status, "published"),
      );

  return db
    .select({
      assignment: collectionWorks,
      work: works,
    })
    .from(collectionWorks)
    .innerJoin(works, eq(collectionWorks.workId, works.id))
    .where(condition)
    .orderBy(
      asc(collectionWorks.sortOrder),
      asc(collectionWorks.lookNumber),
      asc(works.sortOrder),
    );
}

export async function getCollectionNavigationForWork(
  workId: string,
  includeDrafts = false,
) {
  const db = await getDb();
  const condition = includeDrafts
    ? eq(collectionWorks.workId, workId)
    : and(
        eq(collectionWorks.workId, workId),
        eq(collections.status, "published"),
      );

  const [context] = await db
    .select({
      collection: collections,
      assignment: collectionWorks,
    })
    .from(collectionWorks)
    .innerJoin(collections, eq(collectionWorks.collectionId, collections.id))
    .where(condition)
    .orderBy(desc(collections.featured), asc(collections.sortOrder))
    .limit(1);

  if (!context) return null;
  const lineup = await listCollectionWorks(
    context.collection.id,
    includeDrafts,
  );
  const currentIndex = lineup.findIndex((item) => item.work.id === workId);
  if (currentIndex < 0) return null;

  return {
    collection: context.collection,
    assignment: context.assignment,
    previous: currentIndex > 0 ? lineup[currentIndex - 1].work : null,
    next:
      currentIndex < lineup.length - 1
        ? lineup[currentIndex + 1].work
        : null,
    position: currentIndex + 1,
    total: lineup.length,
  };
}

export function collectionHeroUrl(collection: Collection): string | null {
  return collection.heroImageKey ? mediaUrl(collection.heroImageKey) : null;
}

export function collectionLabel(collection: Collection) {
  return [collection.season, collection.year].filter(Boolean).join(" / ");
}

export function normalizeCollectionSlug(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}
