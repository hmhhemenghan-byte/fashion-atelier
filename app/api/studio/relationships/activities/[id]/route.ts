import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  relationshipActivities,
  relationshipContacts,
  type NewRelationshipActivity,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanRelationshipText,
  normalizeRelationshipDateTime,
  relationshipApiError,
} from "@/lib/relationship-input";
import {
  getRelationshipActivity,
  RELATIONSHIP_ACTIVITY_STATUSES,
  type RelationshipActivityStatus,
} from "@/lib/relationships";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  status?: RelationshipActivityStatus;
  subject?: string;
  notes?: string;
  dueAt?: string | null;
  occurredAt?: string | null;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getRelationshipActivity(id);
    if (!current) {
      return Response.json({ error: "互动记录不存在。" }, { status: 404 });
    }
    const payload = (await request.json()) as UpdatePayload;
    const now = new Date().toISOString();
    const update: Partial<NewRelationshipActivity> = { updatedAt: now };
    let changed = false;
    if (payload.status !== undefined) {
      if (!RELATIONSHIP_ACTIVITY_STATUSES.includes(payload.status)) {
        return Response.json({ error: "互动状态无效。" }, { status: 400 });
      }
      update.status = payload.status;
      update.completedAt = payload.status === "completed" ? now : null;
      if (payload.status === "completed" && !current.occurredAt) {
        update.occurredAt = now;
      }
      changed = true;
    }
    if (payload.subject !== undefined) {
      const value = cleanRelationshipText(payload.subject, 240);
      if (!value) {
        return Response.json({ error: "主题不能为空。" }, { status: 400 });
      }
      update.subject = value;
      changed = true;
    }
    if (payload.notes !== undefined) {
      update.notes = cleanRelationshipText(payload.notes, 5000);
      changed = true;
    }
    if (payload.dueAt !== undefined) {
      const value = normalizeRelationshipDateTime(payload.dueAt);
      if (payload.dueAt && !value) {
        return Response.json({ error: "待办时间无效。" }, { status: 400 });
      }
      update.dueAt = value;
      changed = true;
    }
    if (payload.occurredAt !== undefined) {
      const value = normalizeRelationshipDateTime(payload.occurredAt);
      if (payload.occurredAt && !value) {
        return Response.json({ error: "互动时间无效。" }, { status: 400 });
      }
      update.occurredAt = value;
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }
    const db = await getDb();
    const [activity] = await db
      .update(relationshipActivities)
      .set(update)
      .where(eq(relationshipActivities.id, id))
      .returning();
    if (activity.status === "completed") {
      await db
        .update(relationshipContacts)
        .set({
          lastContactAt:
            activity.occurredAt ?? activity.completedAt ?? now,
          updatedAt: now,
        })
        .where(eq(relationshipContacts.id, activity.contactId));
    }
    return Response.json({ activity });
  } catch (error) {
    return relationshipApiError(error, "更新互动记录失败，请稍后重试。");
  }
}
