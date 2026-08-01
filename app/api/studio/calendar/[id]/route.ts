import { eq } from "drizzle-orm";
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
  getEditorialEventById,
  validateEditorialRelations,
  type EditorialChannel,
  type EditorialEventStatus,
  type EditorialEventType,
  type EditorialPriority,
} from "@/lib/editorial-calendar";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

type EventPatch = {
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

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  try {
    const current = await getEditorialEventById(id);
    if (!current) {
      return Response.json({ error: "排期不存在。" }, { status: 404 });
    }
    const payload = (await request.json()) as EventPatch;
    const update: Partial<NewEditorialEvent> = {
      updatedAt: new Date().toISOString(),
    };

    if (payload.title !== undefined) {
      update.title = cleanText(payload.title, 160);
      if (!update.title) {
        return Response.json(
          { error: "排期名称不能为空。" },
          { status: 400 },
        );
      }
    }
    if (payload.eventType !== undefined) {
      if (!EDITORIAL_EVENT_TYPES.includes(payload.eventType)) {
        return Response.json(
          { error: "排期类型无效。" },
          { status: 400 },
        );
      }
      update.eventType = payload.eventType;
    }
    if (payload.channel !== undefined) {
      if (!EDITORIAL_CHANNELS.includes(payload.channel)) {
        return Response.json(
          { error: "发布渠道无效。" },
          { status: 400 },
        );
      }
      update.channel = payload.channel;
    }
    if (payload.status !== undefined) {
      if (!EDITORIAL_EVENT_STATUSES.includes(payload.status)) {
        return Response.json(
          { error: "排期状态无效。" },
          { status: 400 },
        );
      }
      update.status = payload.status;
      update.completedAt =
        payload.status === "completed"
          ? current.completedAt ?? new Date().toISOString()
          : null;
    }
    if (payload.priority !== undefined) {
      if (!EDITORIAL_PRIORITIES.includes(payload.priority)) {
        return Response.json(
          { error: "优先级无效。" },
          { status: 400 },
        );
      }
      update.priority = payload.priority;
    }
    if (payload.startsAt !== undefined) {
      const startsAt = normalizeDateTime(payload.startsAt);
      if (!startsAt) {
        return Response.json(
          { error: "请输入有效的开始时间。" },
          { status: 400 },
        );
      }
      update.startsAt = startsAt;
    }
    if (payload.endsAt !== undefined) {
      update.endsAt = normalizeDateTime(payload.endsAt);
      if (payload.endsAt && !update.endsAt) {
        return Response.json(
          { error: "请输入有效的结束时间。" },
          { status: 400 },
        );
      }
    }
    if (payload.timezone !== undefined) {
      update.timezone =
        cleanText(payload.timezone, 80) || "Europe/Paris";
    }
    if (payload.allDay !== undefined) {
      update.allDay = Boolean(payload.allDay);
    }
    if (payload.location !== undefined) {
      update.location = cleanText(payload.location, 240);
    }
    if (payload.notes !== undefined) {
      update.notes = cleanText(payload.notes, 4000);
    }

    const startsAt = update.startsAt ?? current.startsAt;
    const endsAt =
      payload.endsAt !== undefined ? update.endsAt : current.endsAt;
    if (
      endsAt &&
      new Date(endsAt).getTime() < new Date(startsAt).getTime()
    ) {
      return Response.json(
        { error: "结束时间不能早于开始时间。" },
        { status: 400 },
      );
    }

    const relations = await validateEditorialRelations({
      collectionId:
        payload.collectionId !== undefined
          ? nullableId(payload.collectionId)
          : current.collectionId,
      workId:
        payload.workId !== undefined
          ? nullableId(payload.workId)
          : current.workId,
      publicationId:
        payload.publicationId !== undefined
          ? nullableId(payload.publicationId)
          : current.publicationId,
    });
    if (relations.error) {
      return Response.json({ error: relations.error }, { status: 400 });
    }
    update.collectionId = relations.collectionId;
    update.workId = relations.workId;
    update.publicationId = relations.publicationId;

    const db = await getDb();
    const [event] = await db
      .update(editorialEvents)
      .set(update)
      .where(eq(editorialEvents.id, id))
      .returning();
    return Response.json({ event });
  } catch {
    return Response.json(
      { error: "保存排期失败，请稍后重试。" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  try {
    const db = await getDb();
    const [deleted] = await db
      .delete(editorialEvents)
      .where(eq(editorialEvents.id, id))
      .returning({ id: editorialEvents.id });
    if (!deleted) {
      return Response.json({ error: "排期不存在。" }, { status: 404 });
    }
    return Response.json({ deleted: true });
  } catch {
    return Response.json(
      { error: "删除排期失败，请稍后重试。" },
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
