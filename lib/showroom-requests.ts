import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  showroomRequestItems,
  showroomRequests,
  showrooms,
  type ShowroomRequest,
  type ShowroomRequestItem,
} from "@/db/schema";

export const SHOWROOM_REQUEST_STATUSES = [
  "submitted",
  "reviewing",
  "approved",
  "declined",
  "completed",
  "cancelled",
] as const;

export const SHOWROOM_REQUEST_ROLES = [
  "buyer",
  "stylist",
  "editorial",
  "talent",
  "other",
] as const;

export const SHOWROOM_REQUEST_PURPOSES = [
  "editorial_shoot",
  "red_carpet",
  "fitting",
  "buyer_review",
  "event",
  "other",
] as const;

export type ShowroomRequestStatus =
  (typeof SHOWROOM_REQUEST_STATUSES)[number];
export type ShowroomRequestRole = (typeof SHOWROOM_REQUEST_ROLES)[number];
export type ShowroomRequestPurpose =
  (typeof SHOWROOM_REQUEST_PURPOSES)[number];

export type ShowroomRequestWorkspace = {
  request: ShowroomRequest;
  showroom: {
    id: string;
    slug: string;
    title: string;
    audienceLabel: string;
  };
  items: ShowroomRequestItem[];
};

export async function listAllShowroomRequests(limit = 1000) {
  const db = await getDb();
  return db
    .select()
    .from(showroomRequests)
    .orderBy(desc(showroomRequests.createdAt))
    .limit(limit);
}

export async function listAllShowroomRequestItems() {
  const db = await getDb();
  return db
    .select()
    .from(showroomRequestItems)
    .orderBy(
      asc(showroomRequestItems.requestId),
      asc(showroomRequestItems.sortOrder),
      asc(showroomRequestItems.createdAt),
    );
}

export async function listShowroomRequestWorkspaces(limit = 250) {
  const db = await getDb();
  const rows = await db
    .select({
      request: showroomRequests,
      showroom: {
        id: showrooms.id,
        slug: showrooms.slug,
        title: showrooms.title,
        audienceLabel: showrooms.audienceLabel,
      },
    })
    .from(showroomRequests)
    .innerJoin(showrooms, eq(showroomRequests.showroomId, showrooms.id))
    .orderBy(desc(showroomRequests.createdAt))
    .limit(limit);

  if (rows.length === 0) return [] satisfies ShowroomRequestWorkspace[];

  const items = await db
    .select()
    .from(showroomRequestItems)
    .where(
      inArray(
        showroomRequestItems.requestId,
        rows.map((row) => row.request.id),
      ),
    )
    .orderBy(
      asc(showroomRequestItems.requestId),
      asc(showroomRequestItems.sortOrder),
    );
  const itemsByRequest = new Map<string, ShowroomRequestItem[]>();
  items.forEach((item) => {
    const current = itemsByRequest.get(item.requestId) ?? [];
    current.push(item);
    itemsByRequest.set(item.requestId, current);
  });

  return rows.map((row) => ({
    ...row,
    items: itemsByRequest.get(row.request.id) ?? [],
  })) satisfies ShowroomRequestWorkspace[];
}

export async function getShowroomRequestWorkspace(id: string) {
  const db = await getDb();
  const [row] = await db
    .select({
      request: showroomRequests,
      showroom: {
        id: showrooms.id,
        slug: showrooms.slug,
        title: showrooms.title,
        audienceLabel: showrooms.audienceLabel,
      },
    })
    .from(showroomRequests)
    .innerJoin(showrooms, eq(showroomRequests.showroomId, showrooms.id))
    .where(eq(showroomRequests.id, id))
    .limit(1);
  if (!row) return null;

  const dbItems = await db
    .select()
    .from(showroomRequestItems)
    .where(eq(showroomRequestItems.requestId, id))
    .orderBy(asc(showroomRequestItems.sortOrder));
  return { ...row, items: dbItems } satisfies ShowroomRequestWorkspace;
}

export function showroomRequestsToCsv(
  workspaces: ShowroomRequestWorkspace[],
) {
  const columns = [
    "reference",
    "status",
    "submittedAt",
    "showroom",
    "requester",
    "email",
    "organization",
    "role",
    "purpose",
    "project",
    "neededFrom",
    "neededUntil",
    "deliveryCity",
    "lookNumber",
    "lookTitle",
    "sampleStatus",
    "itemNote",
    "requestNotes",
    "internalNotes",
  ] as const;
  const lines = [columns.map(csvCell).join(",")];

  workspaces.forEach(({ request, showroom, items }) => {
    const detailRows = items.length > 0 ? items : [null];
    detailRows.forEach((item) => {
      lines.push(
        [
          request.referenceCode,
          request.status,
          request.createdAt,
          showroom.title,
          request.requesterName,
          request.requesterEmail,
          request.organization,
          request.requesterRole,
          request.purpose,
          request.projectTitle,
          request.neededFrom,
          request.neededUntil,
          request.deliveryCity,
          item?.lookNumber ?? "",
          item?.workTitle ?? "",
          item?.sampleStatus ?? "",
          item?.itemNote ?? "",
          request.notes,
          request.internalNotes,
        ]
          .map(csvCell)
          .join(","),
      );
    });
  });

  return `\ufeff${lines.join("\r\n")}`;
}

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
