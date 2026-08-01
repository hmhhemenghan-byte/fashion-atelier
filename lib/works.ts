import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workImages, works } from "@/db/schema";

export async function listPublishedWorks(limit = 12) {
  const db = await getDb();
  return db
    .select()
    .from(works)
    .where(eq(works.status, "published"))
    .orderBy(asc(works.sortOrder), desc(works.publishedAt), desc(works.createdAt))
    .limit(limit);
}

export async function listAllWorks(limit = 100) {
  const db = await getDb();
  return db
    .select()
    .from(works)
    .orderBy(asc(works.sortOrder), desc(works.createdAt))
    .limit(limit);
}

export async function getWorkById(id: string) {
  const db = await getDb();
  const [work] = await db.select().from(works).where(eq(works.id, id)).limit(1);
  return work ?? null;
}

export async function listWorkImages(workId: string) {
  const db = await getDb();
  return db
    .select()
    .from(workImages)
    .where(eq(workImages.workId, workId))
    .orderBy(asc(workImages.sortOrder), asc(workImages.createdAt));
}

export async function listAllWorkImages() {
  const db = await getDb();
  return db
    .select()
    .from(workImages)
    .orderBy(asc(workImages.workId), asc(workImages.sortOrder), asc(workImages.createdAt));
}

export function mediaUrl(imageKey: string): string {
  return `/api/media/${imageKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}
