import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  showroomWorks,
  showrooms,
  works,
  type Showroom,
} from "@/db/schema";

export const SHOWROOM_STATUSES = ["draft", "active", "closed"] as const;
export const SHOWROOM_SAMPLE_STATUSES = [
  "available",
  "on_request",
  "unavailable",
] as const;

export type ShowroomStatus = (typeof SHOWROOM_STATUSES)[number];
export type ShowroomSampleStatus =
  (typeof SHOWROOM_SAMPLE_STATUSES)[number];
export type ShowroomLineup = Awaited<ReturnType<typeof listShowroomWorks>>;
export type ShowroomWorkspace = {
  showroom: Showroom;
  items: ShowroomLineup;
  accessState: "draft" | "active" | "expired" | "closed";
};

export async function listAllShowrooms(limit = 100) {
  const db = await getDb();
  return db
    .select()
    .from(showrooms)
    .orderBy(desc(showrooms.updatedAt), desc(showrooms.createdAt))
    .limit(limit);
}

export async function listAllShowroomAssignments() {
  const db = await getDb();
  return db
    .select()
    .from(showroomWorks)
    .orderBy(
      asc(showroomWorks.showroomId),
      asc(showroomWorks.sortOrder),
      asc(showroomWorks.createdAt),
    );
}

export async function listShowroomWorks(showroomId: string) {
  const db = await getDb();
  return db
    .select({
      assignment: showroomWorks,
      work: works,
    })
    .from(showroomWorks)
    .innerJoin(works, eq(showroomWorks.workId, works.id))
    .where(eq(showroomWorks.showroomId, showroomId))
    .orderBy(
      asc(showroomWorks.sortOrder),
      desc(showroomWorks.featured),
      asc(showroomWorks.createdAt),
    );
}

export async function listShowroomWorkspaces(limit = 100) {
  const rows = await listAllShowrooms(limit);
  return Promise.all(
    rows.map(async (showroom) => ({
      showroom,
      items: await listShowroomWorks(showroom.id),
      accessState: getShowroomAccessState(showroom),
    })),
  );
}

export async function getShowroomById(id: string) {
  const db = await getDb();
  const [showroom] = await db
    .select()
    .from(showrooms)
    .where(eq(showrooms.id, id))
    .limit(1);
  return showroom ?? null;
}

export async function getShowroomBySlug(slug: string) {
  const db = await getDb();
  const [showroom] = await db
    .select()
    .from(showrooms)
    .where(eq(showrooms.slug, slug))
    .limit(1);
  return showroom ?? null;
}

export async function getShowroomWorkspaceBySlug(slug: string) {
  const showroom = await getShowroomBySlug(slug);
  if (!showroom) return null;
  return {
    showroom,
    items: await listShowroomWorks(showroom.id),
    accessState: getShowroomAccessState(showroom),
  } satisfies ShowroomWorkspace;
}

export function getShowroomAccessState(
  showroom: Showroom,
  now = new Date(),
): ShowroomWorkspace["accessState"] {
  if (showroom.status === "draft") return "draft";
  if (showroom.status === "closed") return "closed";
  if (
    showroom.expiresAt &&
    new Date(showroom.expiresAt).getTime() <= now.getTime()
  ) {
    return "expired";
  }
  return "active";
}

export async function verifyShowroomToken(
  showroom: Showroom,
  token: string | null | undefined,
) {
  if (!token || getShowroomAccessState(showroom) !== "active") return false;
  const candidate = await hashShowroomToken(token);
  return constantTimeEqual(candidate, showroom.accessTokenHash);
}

export async function createShowroomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return {
    token,
    hash: await hashShowroomToken(token),
    hint: token.slice(-6),
  };
}

export async function hashShowroomToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function normalizeShowroomSlug(value: string) {
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

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
