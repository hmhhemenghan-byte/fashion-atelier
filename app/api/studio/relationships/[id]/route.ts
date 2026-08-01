import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  relationshipContacts,
  type NewRelationshipContact,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanRelationshipText,
  isRelationshipEmail,
  normalizeRelationshipDateTime,
  relationshipApiError,
} from "@/lib/relationship-input";
import {
  getRelationshipContact,
  normalizedTags,
  RELATIONSHIP_CHANNELS,
  RELATIONSHIP_CONTACT_STATUSES,
  RELATIONSHIP_CONTACT_TYPES,
  RELATIONSHIP_CONTACTABILITY,
  RELATIONSHIP_TIERS,
  type RelationshipChannel,
  type RelationshipContactStatus,
  type RelationshipContactType,
  type RelationshipContactability,
  type RelationshipTier,
} from "@/lib/relationships";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  name?: string;
  organization?: string;
  roleTitle?: string;
  contactType?: RelationshipContactType;
  email?: string;
  phone?: string;
  market?: string;
  city?: string;
  preferredChannel?: RelationshipChannel;
  tier?: RelationshipTier;
  status?: RelationshipContactStatus;
  contactability?: RelationshipContactability;
  tags?: string | string[];
  notes?: string;
  lastContactAt?: string | null;
  nextFollowUpAt?: string | null;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    if (!(await getRelationshipContact(id))) {
      return Response.json({ error: "联系人不存在。" }, { status: 404 });
    }
    const payload = (await request.json()) as UpdatePayload;
    const update: Partial<NewRelationshipContact> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;

    if (payload.name !== undefined) {
      const value = cleanRelationshipText(payload.name, 180);
      if (!value) {
        return Response.json(
          { error: "联系人姓名不能为空。" },
          { status: 400 },
        );
      }
      update.name = value;
      changed = true;
    }
    for (const [key, maxLength] of [
      ["organization", 240],
      ["roleTitle", 180],
      ["phone", 100],
      ["market", 160],
      ["city", 160],
      ["notes", 4000],
    ] as const) {
      if (payload[key] !== undefined) {
        update[key] = cleanRelationshipText(payload[key], maxLength);
        changed = true;
      }
    }
    if (payload.email !== undefined) {
      const value = cleanRelationshipText(payload.email, 240).toLowerCase();
      if (value && !isRelationshipEmail(value)) {
        return Response.json(
          { error: "请输入有效的联系邮箱。" },
          { status: 400 },
        );
      }
      update.email = value;
      changed = true;
    }
    if (payload.contactType !== undefined) {
      if (!RELATIONSHIP_CONTACT_TYPES.includes(payload.contactType)) {
        return Response.json({ error: "联系人类型无效。" }, { status: 400 });
      }
      update.contactType = payload.contactType;
      changed = true;
    }
    if (payload.preferredChannel !== undefined) {
      if (!RELATIONSHIP_CHANNELS.includes(payload.preferredChannel)) {
        return Response.json({ error: "偏好渠道无效。" }, { status: 400 });
      }
      update.preferredChannel = payload.preferredChannel;
      changed = true;
    }
    if (payload.tier !== undefined) {
      if (!RELATIONSHIP_TIERS.includes(payload.tier)) {
        return Response.json({ error: "关系层级无效。" }, { status: 400 });
      }
      update.tier = payload.tier;
      changed = true;
    }
    if (payload.status !== undefined) {
      if (!RELATIONSHIP_CONTACT_STATUSES.includes(payload.status)) {
        return Response.json({ error: "联系人状态无效。" }, { status: 400 });
      }
      update.status = payload.status;
      changed = true;
    }
    if (payload.contactability !== undefined) {
      if (!RELATIONSHIP_CONTACTABILITY.includes(payload.contactability)) {
        return Response.json({ error: "联系边界无效。" }, { status: 400 });
      }
      update.contactability = payload.contactability;
      changed = true;
    }
    if (payload.tags !== undefined) {
      update.tagsJson = JSON.stringify(normalizedTags(payload.tags));
      changed = true;
    }
    if (payload.lastContactAt !== undefined) {
      const value = normalizeRelationshipDateTime(payload.lastContactAt);
      if (payload.lastContactAt && !value) {
        return Response.json({ error: "最近联系时间无效。" }, { status: 400 });
      }
      update.lastContactAt = value;
      changed = true;
    }
    if (payload.nextFollowUpAt !== undefined) {
      const value = normalizeRelationshipDateTime(payload.nextFollowUpAt);
      if (payload.nextFollowUpAt && !value) {
        return Response.json({ error: "下次跟进时间无效。" }, { status: 400 });
      }
      update.nextFollowUpAt = value;
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }

    const db = await getDb();
    const [contact] = await db
      .update(relationshipContacts)
      .set(update)
      .where(eq(relationshipContacts.id, id))
      .returning();
    return Response.json({ contact });
  } catch (error) {
    return relationshipApiError(error, "更新联系人失败，请稍后重试。");
  }
}
