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
  relationshipCode,
} from "@/lib/relationship-input";
import {
  buildRelationshipOverview,
  listAllRelationshipContacts,
  normalizedTags,
  RELATIONSHIP_CHANNELS,
  RELATIONSHIP_CONTACT_STATUSES,
  RELATIONSHIP_CONTACT_TYPES,
  RELATIONSHIP_CONTACTABILITY,
  RELATIONSHIP_SOURCE_TYPES,
  RELATIONSHIP_TIERS,
  relationshipActivitiesToCsv,
  relationshipContactsToCsv,
  relationshipOpportunitiesToCsv,
  type RelationshipChannel,
  type RelationshipContactStatus,
  type RelationshipContactType,
  type RelationshipContactability,
  type RelationshipSourceType,
  type RelationshipTier,
} from "@/lib/relationships";

export const dynamic = "force-dynamic";

type CreatePayload = {
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
  sourceType?: RelationshipSourceType;
  sourceId?: string;
  tags?: string | string[];
  notes?: string;
  lastContactAt?: string | null;
  nextFollowUpAt?: string | null;
};

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const overview = await buildRelationshipOverview();
    const url = new URL(request.url);
    const format = url.searchParams.get("format");
    const date = new Date().toISOString().slice(0, 10);
    if (format === "contacts") {
      return csvResponse(
        relationshipContactsToCsv(overview),
        `nera-relationships-${date}.csv`,
      );
    }
    if (format === "opportunities") {
      return csvResponse(
        relationshipOpportunitiesToCsv(overview),
        `nera-opportunities-${date}.csv`,
      );
    }
    if (format === "activities") {
      return csvResponse(
        relationshipActivitiesToCsv(overview),
        `nera-relationship-activities-${date}.csv`,
      );
    }
    if (format === "json") {
      return new Response(JSON.stringify(overview, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="nera-relationship-intelligence-${date}.json"`,
          "cache-control": "private, no-store",
        },
      });
    }
    return Response.json(
      { overview },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return relationshipApiError(
      error,
      "无法读取关系与机会工作台，请稍后重试。",
    );
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as CreatePayload;
    const name = cleanRelationshipText(payload.name, 180);
    if (!name) {
      return Response.json({ error: "请填写联系人姓名。" }, { status: 400 });
    }
    const email = cleanRelationshipText(payload.email, 240).toLowerCase();
    if (email && !isRelationshipEmail(email)) {
      return Response.json(
        { error: "请输入有效的联系邮箱。" },
        { status: 400 },
      );
    }
    const contactType = payload.contactType ?? "other";
    const preferredChannel = payload.preferredChannel ?? "email";
    const tier = payload.tier ?? "developing";
    const status = payload.status ?? "active";
    const contactability = payload.contactability ?? "unknown";
    const sourceType = payload.sourceType ?? "manual";
    if (!RELATIONSHIP_CONTACT_TYPES.includes(contactType)) {
      return Response.json({ error: "联系人类型无效。" }, { status: 400 });
    }
    if (!RELATIONSHIP_CHANNELS.includes(preferredChannel)) {
      return Response.json({ error: "偏好渠道无效。" }, { status: 400 });
    }
    if (!RELATIONSHIP_TIERS.includes(tier)) {
      return Response.json({ error: "关系层级无效。" }, { status: 400 });
    }
    if (!RELATIONSHIP_CONTACT_STATUSES.includes(status)) {
      return Response.json({ error: "联系人状态无效。" }, { status: 400 });
    }
    if (!RELATIONSHIP_CONTACTABILITY.includes(contactability)) {
      return Response.json({ error: "联系边界无效。" }, { status: 400 });
    }
    if (!RELATIONSHIP_SOURCE_TYPES.includes(sourceType)) {
      return Response.json({ error: "联系人来源无效。" }, { status: 400 });
    }
    const organization = cleanRelationshipText(payload.organization, 240);
    const existing = await listAllRelationshipContacts();
    const duplicate = existing.find(
      (contact) =>
        (email && contact.email.toLowerCase() === email) ||
        (contact.name.trim().toLowerCase() === name.toLowerCase() &&
          contact.organization.trim().toLowerCase() ===
            organization.toLowerCase()),
    );
    if (duplicate) {
      return Response.json(
        { error: `联系人已存在：${duplicate.contactCode}` },
        { status: 409 },
      );
    }
    const lastContactAt = normalizeRelationshipDateTime(payload.lastContactAt);
    const nextFollowUpAt = normalizeRelationshipDateTime(
      payload.nextFollowUpAt,
    );
    if (payload.lastContactAt && !lastContactAt) {
      return Response.json({ error: "最近联系时间无效。" }, { status: 400 });
    }
    if (payload.nextFollowUpAt && !nextFollowUpAt) {
      return Response.json({ error: "下次跟进时间无效。" }, { status: 400 });
    }

    const now = new Date();
    const timestamp = now.toISOString();
    const values: NewRelationshipContact = {
      id: crypto.randomUUID(),
      contactCode: relationshipCode("REL", now),
      name,
      organization,
      roleTitle: cleanRelationshipText(payload.roleTitle, 180),
      contactType,
      email,
      phone: cleanRelationshipText(payload.phone, 100),
      market: cleanRelationshipText(payload.market, 160),
      city: cleanRelationshipText(payload.city, 160),
      preferredChannel,
      tier,
      status,
      contactability,
      sourceType,
      sourceId: cleanRelationshipText(payload.sourceId, 160),
      tagsJson: JSON.stringify(normalizedTags(payload.tags)),
      notes: cleanRelationshipText(payload.notes, 4000),
      lastContactAt,
      nextFollowUpAt,
      createdBy: auth.user.email,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const db = await getDb();
    const [contact] = await db
      .insert(relationshipContacts)
      .values(values)
      .returning();
    return Response.json({ contact }, { status: 201 });
  } catch (error) {
    return relationshipApiError(error, "保存联系人失败，请稍后重试。");
  }
}

function csvResponse(body: string, filename: string) {
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
