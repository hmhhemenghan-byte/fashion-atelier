import { eq } from "drizzle-orm";
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
} from "@/lib/relationship-input";
import {
  getRelationshipOpportunity,
  RELATIONSHIP_OPPORTUNITY_KINDS,
  RELATIONSHIP_OPPORTUNITY_STAGES,
  RELATIONSHIP_PRIORITIES,
  type RelationshipOpportunityKind,
  type RelationshipOpportunityStage,
  type RelationshipPriority,
} from "@/lib/relationships";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  title?: string;
  kind?: RelationshipOpportunityKind;
  stage?: RelationshipOpportunityStage;
  priority?: RelationshipPriority;
  collection?: string;
  market?: string;
  summary?: string;
  nextAction?: string;
  nextActionAt?: string | null;
  outcome?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getRelationshipOpportunity(id);
    if (!current) {
      return Response.json({ error: "机会不存在。" }, { status: 404 });
    }
    const payload = (await request.json()) as UpdatePayload;
    const now = new Date().toISOString();
    const update: Partial<NewRelationshipOpportunity> = { updatedAt: now };
    let changed = false;
    if (payload.title !== undefined) {
      const value = cleanRelationshipText(payload.title, 240);
      if (!value) {
        return Response.json(
          { error: "机会名称不能为空。" },
          { status: 400 },
        );
      }
      update.title = value;
      changed = true;
    }
    if (payload.kind !== undefined) {
      if (!RELATIONSHIP_OPPORTUNITY_KINDS.includes(payload.kind)) {
        return Response.json({ error: "机会类型无效。" }, { status: 400 });
      }
      update.kind = payload.kind;
      changed = true;
    }
    if (payload.stage !== undefined) {
      if (!RELATIONSHIP_OPPORTUNITY_STAGES.includes(payload.stage)) {
        return Response.json({ error: "机会阶段无效。" }, { status: 400 });
      }
      update.stage = payload.stage;
      update.closedAt = ["won", "lost"].includes(payload.stage) ? now : null;
      changed = true;
    }
    if (payload.priority !== undefined) {
      if (!RELATIONSHIP_PRIORITIES.includes(payload.priority)) {
        return Response.json({ error: "机会优先级无效。" }, { status: 400 });
      }
      update.priority = payload.priority;
      changed = true;
    }
    for (const [key, maxLength] of [
      ["collection", 240],
      ["market", 160],
      ["summary", 4000],
      ["nextAction", 500],
      ["outcome", 2000],
    ] as const) {
      if (payload[key] !== undefined) {
        update[key] = cleanRelationshipText(payload[key], maxLength);
        changed = true;
      }
    }
    if (payload.nextActionAt !== undefined) {
      const value = normalizeRelationshipDateTime(payload.nextActionAt);
      if (payload.nextActionAt && !value) {
        return Response.json({ error: "下一步时间无效。" }, { status: 400 });
      }
      update.nextActionAt = value;
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }
    const db = await getDb();
    const [opportunity] = await db
      .update(relationshipOpportunities)
      .set(update)
      .where(eq(relationshipOpportunities.id, id))
      .returning();
    return Response.json({ opportunity });
  } catch (error) {
    return relationshipApiError(error, "更新机会失败，请稍后重试。");
  }
}
