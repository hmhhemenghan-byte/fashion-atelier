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
  getRelationshipContact,
  getRelationshipOpportunity,
  RELATIONSHIP_ACTIVITY_CHANNELS,
  RELATIONSHIP_ACTIVITY_DIRECTIONS,
  RELATIONSHIP_ACTIVITY_KINDS,
  RELATIONSHIP_ACTIVITY_STATUSES,
  type RelationshipActivityChannel,
  type RelationshipActivityDirection,
  type RelationshipActivityKind,
  type RelationshipActivityStatus,
} from "@/lib/relationships";

export const dynamic = "force-dynamic";

type CreatePayload = {
  contactId?: string;
  opportunityId?: string;
  kind?: RelationshipActivityKind;
  channel?: RelationshipActivityChannel;
  direction?: RelationshipActivityDirection;
  status?: RelationshipActivityStatus;
  subject?: string;
  notes?: string;
  dueAt?: string | null;
  occurredAt?: string | null;
};

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as CreatePayload;
    const contactId = cleanRelationshipText(payload.contactId, 160);
    if (!contactId || !(await getRelationshipContact(contactId))) {
      return Response.json(
        { error: "请选择有效联系人。" },
        { status: 400 },
      );
    }
    const opportunityId = cleanRelationshipText(payload.opportunityId, 160);
    if (opportunityId) {
      const opportunity = await getRelationshipOpportunity(opportunityId);
      if (!opportunity || opportunity.contactId !== contactId) {
        return Response.json(
          { error: "所选机会不属于当前联系人。" },
          { status: 400 },
        );
      }
    }
    const subject = cleanRelationshipText(payload.subject, 240);
    if (!subject) {
      return Response.json(
        { error: "请填写互动或待办主题。" },
        { status: 400 },
      );
    }
    const kind = payload.kind ?? "note";
    const channel = payload.channel ?? "internal";
    const direction = payload.direction ?? "internal";
    const status = payload.status ?? "planned";
    if (!RELATIONSHIP_ACTIVITY_KINDS.includes(kind)) {
      return Response.json({ error: "互动类型无效。" }, { status: 400 });
    }
    if (!RELATIONSHIP_ACTIVITY_CHANNELS.includes(channel)) {
      return Response.json({ error: "互动渠道无效。" }, { status: 400 });
    }
    if (!RELATIONSHIP_ACTIVITY_DIRECTIONS.includes(direction)) {
      return Response.json({ error: "互动方向无效。" }, { status: 400 });
    }
    if (!RELATIONSHIP_ACTIVITY_STATUSES.includes(status)) {
      return Response.json({ error: "互动状态无效。" }, { status: 400 });
    }
    const dueAt = normalizeRelationshipDateTime(payload.dueAt);
    const explicitOccurredAt = normalizeRelationshipDateTime(
      payload.occurredAt,
    );
    if (payload.dueAt && !dueAt) {
      return Response.json({ error: "待办时间无效。" }, { status: 400 });
    }
    if (payload.occurredAt && !explicitOccurredAt) {
      return Response.json({ error: "互动时间无效。" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const occurredAt =
      explicitOccurredAt ?? (status === "completed" ? now : null);
    const values: NewRelationshipActivity = {
      id: crypto.randomUUID(),
      contactId,
      opportunityId: opportunityId || null,
      kind,
      channel,
      direction,
      status,
      subject,
      notes: cleanRelationshipText(payload.notes, 5000),
      dueAt,
      occurredAt,
      completedAt: status === "completed" ? now : null,
      createdBy: auth.user.email,
      createdAt: now,
      updatedAt: now,
    };
    const db = await getDb();
    const [activity] = await db
      .insert(relationshipActivities)
      .values(values)
      .returning();
    if (status === "completed") {
      await db
        .update(relationshipContacts)
        .set({ lastContactAt: occurredAt ?? now, updatedAt: now })
        .where(eq(relationshipContacts.id, contactId));
    }
    return Response.json({ activity }, { status: 201 });
  } catch (error) {
    return relationshipApiError(error, "保存互动记录失败，请稍后重试。");
  }
}
