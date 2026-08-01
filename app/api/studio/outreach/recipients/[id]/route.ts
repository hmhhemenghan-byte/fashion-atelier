import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  outreachRecipients,
  relationshipActivities,
  relationshipContacts,
  type NewOutreachRecipient,
  type NewRelationshipActivity,
  type RelationshipContact,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanOutreachText,
  outreachApiError,
} from "@/lib/outreach-input";
import {
  composeOutreachDraft,
  getOutreachCampaign,
  getOutreachEligibility,
  getOutreachRecipient,
  OUTREACH_RECIPIENT_STATUSES,
  type OutreachRecipientStatus,
} from "@/lib/outreach";
import {
  getRelationshipContact,
  getRelationshipOpportunity,
} from "@/lib/relationships";
import { getCollectionById } from "@/lib/collections";
import { getPublicationById } from "@/lib/publications";
import { getShowroomById } from "@/lib/showrooms";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  status?: OutreachRecipientStatus;
  opportunityId?: string | null;
  angle?: string;
  draftSubject?: string;
  draftBody?: string;
  approvalNote?: string;
  generateDraft?: boolean;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getOutreachRecipient(id);
    if (!current) {
      return Response.json({ error: "外联对象不存在。" }, { status: 404 });
    }
    const [campaign, contact] = await Promise.all([
      getOutreachCampaign(current.campaignId),
      getRelationshipContact(current.contactId),
    ]);
    if (!campaign || !contact) {
      return Response.json(
        { error: "活动或联系人已不存在。" },
        { status: 409 },
      );
    }
    const payload = (await request.json()) as UpdatePayload;
    const eligibility = getOutreachEligibility(contact);
    const now = new Date().toISOString();
    const update: Partial<NewOutreachRecipient> = {
      eligibilitySnapshot: eligibility,
      updatedAt: now,
    };
    let changed = false;

    if (payload.opportunityId !== undefined) {
      const opportunityId = cleanOutreachText(payload.opportunityId, 160);
      if (opportunityId) {
        const opportunity = await getRelationshipOpportunity(opportunityId);
        if (!opportunity || opportunity.contactId !== contact.id) {
          return Response.json(
            { error: "所选机会不属于当前联系人。" },
            { status: 400 },
          );
        }
      }
      update.opportunityId = opportunityId || null;
      changed = true;
    }
    for (const [key, maxLength] of [
      ["angle", 1600],
      ["draftSubject", 300],
      ["draftBody", 8000],
      ["approvalNote", 1600],
    ] as const) {
      if (payload[key] !== undefined) {
        update[key] = cleanOutreachText(payload[key], maxLength);
        changed = true;
      }
    }

    if (payload.generateDraft) {
      if (eligibility !== "eligible") {
        return Response.json(
          { error: "联系边界或渠道未确认，不能生成主动外联草稿。" },
          { status: 409 },
        );
      }
      if (!["approved", "drafted"].includes(current.status)) {
        return Response.json(
          { error: "请先由设计师人工批准该对象，再生成外联草稿。" },
          { status: 409 },
        );
      }
      const [collection, publication, showroom] = await Promise.all([
        campaign.collectionId
          ? getCollectionById(campaign.collectionId)
          : null,
        campaign.publicationId
          ? getPublicationById(campaign.publicationId)
          : null,
        campaign.showroomId ? getShowroomById(campaign.showroomId) : null,
      ]);
      const draft = composeOutreachDraft({
        campaign,
        contact,
        collectionTitle: collection?.title,
        publicationHeadline: publication?.headline,
        showroomTitle: showroom?.title,
        angle:
          payload.angle !== undefined
            ? cleanOutreachText(payload.angle, 1600)
            : current.angle,
      });
      update.draftSubject = draft.subject;
      update.draftBody = draft.body;
      update.status = "drafted";
      changed = true;
    }

    let activity: NewRelationshipActivity | null = null;
    if (payload.status !== undefined && !payload.generateDraft) {
      if (!OUTREACH_RECIPIENT_STATUSES.includes(payload.status)) {
        return Response.json({ error: "对象状态无效。" }, { status: 400 });
      }
      if (!isRecipientTransitionAllowed(current.status, payload.status)) {
        return Response.json(
          { error: "该状态变更不符合人工审核顺序。" },
          { status: 409 },
        );
      }
      if (
        ["approved", "drafted", "recorded_sent"].includes(payload.status) &&
        eligibility !== "eligible"
      ) {
        return Response.json(
          { error: "联系边界或渠道未确认，不能批准主动外联。" },
          { status: 409 },
        );
      }
      if (
        payload.status === "recorded_sent" &&
        !["approved", "drafted", "recorded_sent"].includes(current.status)
      ) {
        return Response.json(
          { error: "请先人工批准或完成草稿，再记录外部发送。" },
          { status: 409 },
        );
      }
      if (
        payload.status === "replied" &&
        !["recorded_sent", "replied"].includes(current.status)
      ) {
        return Response.json(
          { error: "只有已记录外部发送的对象才能标记回复。" },
          { status: 409 },
        );
      }
      update.status = payload.status;
      if (payload.status === "approved" && current.status !== "approved") {
        update.approvedAt = now;
      }
      if (
        payload.status === "recorded_sent" &&
        current.status !== "recorded_sent"
      ) {
        const opportunityId =
          payload.opportunityId !== undefined
            ? update.opportunityId ?? null
            : current.opportunityId;
        const draftSubject =
          (typeof update.draftSubject === "string"
            ? update.draftSubject.trim()
            : "") ||
          current.draftSubject.trim() ||
          campaign.subjectLine;
        update.sentAt = now;
        activity = createCampaignActivity({
          campaignTitle: campaign.title,
          campaignCode: campaign.campaignCode,
          contactId: contact.id,
          opportunityId,
          preferredChannel: contact.preferredChannel,
          subject: draftSubject,
          direction: "outbound",
          actor: auth.user.email,
          now,
        });
      }
      if (payload.status === "replied" && current.status !== "replied") {
        const opportunityId =
          payload.opportunityId !== undefined
            ? update.opportunityId ?? null
            : current.opportunityId;
        update.repliedAt = now;
        activity = createCampaignActivity({
          campaignTitle: campaign.title,
          campaignCode: campaign.campaignCode,
          contactId: contact.id,
          opportunityId,
          preferredChannel: contact.preferredChannel,
          subject: `REPLY / ${campaign.title}`,
          direction: "inbound",
          actor: auth.user.email,
          now,
        });
      }
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }

    const db = await getDb();
    const updateRecipient = db
      .update(outreachRecipients)
      .set(update)
      .where(eq(outreachRecipients.id, id));
    if (activity) {
      await db.batch([
        updateRecipient,
        db.insert(relationshipActivities).values(activity),
        db
          .update(relationshipContacts)
          .set({ lastContactAt: now, updatedAt: now })
          .where(eq(relationshipContacts.id, contact.id)),
      ]);
    } else {
      await updateRecipient;
    }
    return Response.json({
      recipient: await getOutreachRecipient(id),
    });
  } catch (error) {
    return outreachApiError(error, "更新外联对象失败，请稍后重试。");
  }
}

function createCampaignActivity(input: {
  campaignTitle: string;
  campaignCode: string;
  contactId: string;
  opportunityId: string | null;
  preferredChannel: RelationshipContact["preferredChannel"];
  subject: string;
  direction: "inbound" | "outbound";
  actor: string;
  now: string;
}): NewRelationshipActivity {
  const channel: NonNullable<NewRelationshipActivity["channel"]> =
    input.preferredChannel === "none"
      ? "internal"
      : input.preferredChannel;
  const kind: NonNullable<NewRelationshipActivity["kind"]> =
    channel === "email"
      ? "email"
      : channel === "phone"
        ? "call"
        : channel === "in_person"
          ? "meeting"
          : "other";
  return {
    id: crypto.randomUUID(),
    contactId: input.contactId,
    opportunityId: input.opportunityId,
    kind,
    channel,
    direction: input.direction,
    status: "completed",
    subject: input.subject || `${input.campaignCode} / ${input.campaignTitle}`,
    notes: `CAMPAIGN / ${input.campaignCode} / ${input.campaignTitle}`,
    dueAt: null,
    occurredAt: input.now,
    completedAt: input.now,
    createdBy: input.actor,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

function isRecipientTransitionAllowed(
  current: OutreachRecipientStatus,
  next: OutreachRecipientStatus,
) {
  if (current === next) return true;
  const transitions: Record<
    OutreachRecipientStatus,
    OutreachRecipientStatus[]
  > = {
    proposed: ["approved", "blocked", "skipped"],
    blocked: ["proposed", "approved", "skipped"],
    approved: ["proposed", "drafted", "skipped"],
    drafted: ["approved", "recorded_sent", "skipped"],
    recorded_sent: ["replied"],
    replied: [],
    skipped: ["proposed", "approved"],
  };
  return transitions[current].includes(next);
}
