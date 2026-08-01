import { getDb } from "@/db";
import {
  outreachRecipients,
  type NewOutreachRecipient,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanOutreachText,
  outreachApiError,
} from "@/lib/outreach-input";
import {
  getOutreachCampaign,
  getOutreachEligibility,
  getOutreachRecipient,
  listAllOutreachRecipients,
} from "@/lib/outreach";
import {
  getRelationshipContact,
  getRelationshipOpportunity,
} from "@/lib/relationships";

export const dynamic = "force-dynamic";

type CreatePayload = {
  campaignId?: string;
  contactId?: string;
  opportunityId?: string;
  angle?: string;
};

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as CreatePayload;
    const campaignId = cleanOutreachText(payload.campaignId, 160);
    const contactId = cleanOutreachText(payload.contactId, 160);
    const [campaign, contact] = await Promise.all([
      getOutreachCampaign(campaignId),
      getRelationshipContact(contactId),
    ]);
    if (!campaign) {
      return Response.json({ error: "外联活动不存在。" }, { status: 404 });
    }
    if (!contact) {
      return Response.json({ error: "联系人不存在。" }, { status: 404 });
    }
    const eligibility = getOutreachEligibility(contact);
    if (eligibility === "do_not_contact") {
      return Response.json(
        { error: "该联系人已标记为“请勿主动联系”，不能加入外联活动。" },
        { status: 409 },
      );
    }
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
    const duplicate = (await listAllOutreachRecipients()).find(
      (recipient) =>
        recipient.campaignId === campaign.id &&
        recipient.contactId === contact.id,
    );
    if (duplicate) {
      return Response.json(
        { error: "该联系人已经在此活动中。" },
        { status: 409 },
      );
    }
    const now = new Date().toISOString();
    const values: NewOutreachRecipient = {
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      contactId: contact.id,
      opportunityId: opportunityId || null,
      status: eligibility === "eligible" ? "proposed" : "blocked",
      eligibilitySnapshot: eligibility,
      angle: cleanOutreachText(payload.angle, 1600),
      draftSubject: "",
      draftBody: "",
      approvalNote: "",
      approvedAt: null,
      sentAt: null,
      repliedAt: null,
      createdBy: auth.user.email,
      createdAt: now,
      updatedAt: now,
    };
    const db = await getDb();
    const [recipient] = await db
      .insert(outreachRecipients)
      .values(values)
      .returning();
    return Response.json(
      { recipient: await getOutreachRecipient(recipient.id) },
      { status: 201 },
    );
  } catch (error) {
    return outreachApiError(error, "添加外联对象失败，请稍后重试。");
  }
}
