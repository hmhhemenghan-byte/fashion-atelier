import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  workProcessEntries,
  type WorkProcessEntry,
} from "@/db/schema";
import { mediaUrl } from "@/lib/works";

export async function listWorkProcessEntries(
  workId: string,
  includeDrafts = false,
) {
  const db = await getDb();
  const condition = includeDrafts
    ? eq(workProcessEntries.workId, workId)
    : and(
        eq(workProcessEntries.workId, workId),
        eq(workProcessEntries.status, "published"),
      );

  return db
    .select()
    .from(workProcessEntries)
    .where(condition)
    .orderBy(
      asc(workProcessEntries.sortOrder),
      asc(workProcessEntries.createdAt),
    );
}

export async function listAllWorkProcessEntries() {
  const db = await getDb();
  return db
    .select()
    .from(workProcessEntries)
    .orderBy(
      asc(workProcessEntries.workId),
      asc(workProcessEntries.sortOrder),
      asc(workProcessEntries.createdAt),
    );
}

export async function getWorkProcessEntry(workId: string, entryId: string) {
  const db = await getDb();
  const [entry] = await db
    .select()
    .from(workProcessEntries)
    .where(
      and(
        eq(workProcessEntries.id, entryId),
        eq(workProcessEntries.workId, workId),
      ),
    )
    .limit(1);
  return entry ?? null;
}

export function processImageUrl(entry: WorkProcessEntry) {
  return entry.imageKey ? mediaUrl(entry.imageKey) : null;
}
