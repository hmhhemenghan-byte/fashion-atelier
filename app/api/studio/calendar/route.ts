import { getDb } from "@/db";
import {
  editorialEvents,
  type NewEditorialEvent,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  EDITORIAL_CHANNELS,
  EDITORIAL_EVENT_STATUSES,
  EDITORIAL_EVENT_TYPES,
  EDITORIAL_PRIORITIES,
  editorialCalendarToIcs,
  getEditorialCalendarSnapshot,
  validateEditorialRelations,
  type EditorialChannel,
  type EditorialEventStatus,
  type EditorialEventType,
  type EditorialPriority,
} from "@/lib/editorial-calendar";

export const dynamic = "force-dynamic";

type EventPayload = {
  title?: string;
  eventType?: EditorialEventType;
  channel?: EditorialChannel;
  status?: EditorialEventStatus;
  priority?: EditorialPriority;
  startsAt?: string;
  endsAt?: string | null;
  timezone?: string;
  allDay?: boolean;
  location?: string;
  notes?: string;
  collectionId?: string | null;
  workId?: string | null;
  publicationId?: string | null;
};

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const snapshot = await getEditorialCalendarSnapshot();
    const format = new URL(request.url).searchParams.get("format");
    if (format === "ics") {
      return new Response(editorialCalendarToIcs(snapshot), {
        headers: {
          "content-type": "text/calendar; charset=utf-8",
          "content-disposition":
            'attachment; filename="nera-editorial-calendar.ics"',
          "cache-control": "no-store",
        },
      });
    }
    return Response.json({ snapshot });
  } catch {
    return Response.json(
      { error: "编辑日历尚未初始化，请完成新版部署后再试。" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as EventPayload;
    const title = cleanText(payload.title, 160);
    const startsAt = normalizeDateTime(payload.startsAt);
    const endsAt = normalizeDateTime(payload.endsAt);
    if (!title || !startsAt) {
      return Response.json(
        { error: "排期名称与开始时间为必填项。" },
        { status: 400 },
      );
    }
    if (payload.endsAt && !endsAt) {
      return Response.json(
        { error: "请输入有效的结束时间。" },
        { status: 400 },
      );
    }
    if (endsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
      return Response.json(
        { error: "结束时间不能早于开始时间。" },
        { status: 400 },
      );
    }

    const relations = await validateEditorialRelations({
      collectionId: nullableId(payload.collectionId),
      workId: nullableId(payload.workId),
      publicationId: nullableId(payload.publicationId),
    });
    if (relations.error) {
      return Response.json({ error: relations.error }, { status: 400 });
    }

    const status = pickValue(
      payload.status,
      EDITORIAL_EVENT_STATUSES,
      "planned",
    );
    const values: NewEditorialEvent = {
      id: crypto.randomUUID(),
      title,
      eventType: pickValue(
        payload.eventType,
        EDITORIAL_EVENT_TYPES,
        "internal",
      ),
      channel: pickValue(
        payload.channel,
        EDITORIAL_CHANNELS,
        "atelier",
      ),
      status,
      priority: pickValue(
        payload.priority,
        EDITORIAL_PRIORITIES,
        "standard",
      ),
      startsAt,
      endsAt,
      timezone: cleanText(payload.timezone, 80) || "Europe/Paris",
      allDay: Boolean(payload.allDay),
      location: cleanText(payload.location, 240),
      notes: cleanText(payload.notes, 4000),
      collectionId: relations.collectionId,
      workId: relations.workId,
      publicationId: relations.publicationId,
      createdBy: auth.user.email,
      completedAt:
        status === "completed" ? new Date().toISOString() : null,
    };

    const db = await getDb();
    const [event] = await db
      .insert(editorialEvents)
      .values(values)
      .returning();
    return Response.json({ event }, { status: 201 });
  } catch {
    return Response.json(
      { error: "创建排期失败，请稍后重试。" },
      { status: 500 },
    );
  }
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function nullableId(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 80)
    : null;
}

function normalizeDateTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function pickValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
) {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}
