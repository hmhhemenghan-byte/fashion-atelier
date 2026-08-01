import { getDb } from "@/db";
import {
  relationshipOpportunities,
  type NewRelationshipOpportunity,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanRelationshipText,
  normalizeRelationshipDateTime,
  relationshipApiError,
  relationshipCode,
} from "@/lib/relationship-input";
import {
  getRelationshipContact,
  RELATIONSHIP_OPPORTUNITY_KINDS,
  RELATIONSHIP_OPPORTUNITY_STAGES,
  RELATIONSHIP_PRIORITIES,
  RELATIONSHIP_SOURCE_TYPES,
  type RelationshipOpportunityKind,
  type RelationshipOpportunityStage,
  type RelationshipPriority,
  type RelationshipSourceType,
} from "@/lib/relationships";

export const dynamic = "force-dynamic";

type CreatePayload = {
  contactId?: string;
  title?: string;
  kind?: RelationshipOpportunityKind;
  stage?: RelationshipOpportunityStage;
  priority?: RelationshipPriority;
  collection?: string;
  market?: string;
  sourceType?: RelationshipSourceType;
  sourceId?: string;
  summary?: string;
  nextAction?: string;
  nextActionAt?: string | null;
  outcome?: string;
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
    const title = cleanRelationshipText(payload.title, 240);
    if (!title) {
      return Response.json({ error: "请填写机会名称。" }, { status: 400 });
    }
    const kind = payload.kind ?? "editorial";
    const stage = payload.stage ?? "signal";
    const priority = payload.priority ?? "normal";
    const sourceType = payload.sourceType ?? "manual";
    if (!RELATIONSHIP_OPPORTUNITY_KINDS.includes(kind)) {
      return Response.json({ error: "机会类型无效。" }, { status: 400 });
    }
    if (!RELATIONSHIP_OPPORTUNITY_STAGES.includes(stage)) {
      return Response.json({ error: "机会阶段无效。" }, { status: 400 });
    }
    if (!RELATIONSHIP_PRIORITIES.includes(priority)) {
      return Response.json({ error: "机会优先级无效。" }, { status: 400 });
    }
    if (!RELATIONSHIP_SOURCE_TYPES.includes(sourceType)) {
      return Response.json({ error: "机会来源无效。" }, { status: 400 });
    }
    const nextActionAt = normalizeRelationshipDateTime(
      payload.nextActionAt,
    );
    if (payload.nextActionAt && !nextActionAt) {
      return Response.json({ error: "下一步时间无效。" }, { status: 400 });
    }
    const now = new Date();
    const timestamp = now.toISOString();
    const values: NewRelationshipOpportunity = {
      id: crypto.randomUUID(),
      opportunityCode: relationshipCode("OPP", now),
      contactId,
      title,
      kind,
      stage,
      priority,
      collection: cleanRelationshipText(payload.collection, 240),
      market: cleanRelationshipText(payload.market, 160),
      sourceType,
      sourceId: cleanRelationshipText(payload.sourceId, 160),
      summary: cleanRelationshipText(payload.summary, 4000),
      nextAction: cleanRelationshipText(payload.nextAction, 500),
      nextActionAt,
      outcome: cleanRelationshipText(payload.outcome, 2000),
      closedAt: ["won", "lost"].includes(stage) ? timestamp : null,
      createdBy: auth.user.email,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const db = await getDb();
    const [opportunity] = await db
      .insert(relationshipOpportunities)
      .values(values)
      .returning();
    return Response.json({ opportunity }, { status: 201 });
  } catch (error) {
    return relationshipApiError(error, "保存机会失败，请稍后重试。");
  }
}
