import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  outreachCampaigns,
  outreachRecipients,
  type Collection,
  type OutreachCampaign,
  type OutreachRecipient,
  type Publication,
  type RelationshipContact,
  type RelationshipOpportunity,
} from "@/db/schema";
import { listAllCollections } from "@/lib/collections";
import { listAllPublications } from "@/lib/publications";
import {
  listAllRelationshipContacts,
  listAllRelationshipOpportunities,
} from "@/lib/relationships";
import { listAllShowrooms } from "@/lib/showrooms";

export const OUTREACH_OBJECTIVES = [
  "collection_launch",
  "press_preview",
  "showroom_invitation",
  "editorial_pitch",
  "buyer_follow_up",
  "event_follow_up",
  "partnership",
  "other",
] as const;

export const OUTREACH_CAMPAIGN_STATUSES = [
  "draft",
  "review",
  "ready",
  "active",
  "paused",
  "completed",
  "archived",
] as const;

export const OUTREACH_LANGUAGES = ["zh", "en", "bilingual"] as const;

export const OUTREACH_RECIPIENT_STATUSES = [
  "proposed",
  "blocked",
  "approved",
  "drafted",
  "recorded_sent",
  "replied",
  "skipped",
] as const;

export const OUTREACH_ELIGIBILITY = [
  "eligible",
  "missing_channel",
  "consent_unknown",
  "do_not_contact",
  "inactive",
] as const;

export type OutreachObjective = (typeof OUTREACH_OBJECTIVES)[number];
export type OutreachCampaignStatus =
  (typeof OUTREACH_CAMPAIGN_STATUSES)[number];
export type OutreachLanguage = (typeof OUTREACH_LANGUAGES)[number];
export type OutreachRecipientStatus =
  (typeof OUTREACH_RECIPIENT_STATUSES)[number];
export type OutreachEligibility = (typeof OUTREACH_ELIGIBILITY)[number];

export type OutreachContactOption = {
  id: string;
  contactCode: string;
  name: string;
  organization: string;
  roleTitle: string;
  contactType: string;
  tier: string;
  market: string;
  email: string;
  phone: string;
  preferredChannel: string;
  contactability: string;
  status: string;
  eligibility: OutreachEligibility;
  eligibilityReason: string;
  opportunities: Array<{
    id: string;
    code: string;
    title: string;
    stage: RelationshipOpportunity["stage"];
  }>;
};

export type OutreachResourceOption = {
  id: string;
  label: string;
  meta: string;
  status: string;
};

export type OutreachRecipientWorkspace = {
  recipient: OutreachRecipient;
  contact: RelationshipContact;
  opportunity: RelationshipOpportunity | null;
  opportunities: Array<{
    id: string;
    code: string;
    title: string;
    stage: RelationshipOpportunity["stage"];
  }>;
  eligibility: OutreachEligibility;
  eligibilityReason: string;
  canInitiate: boolean;
};

export type OutreachCampaignWorkspace = {
  campaign: OutreachCampaign;
  collection: Collection | null;
  publication: Publication | null;
  showroom: OutreachResourceOption | null;
  recipients: OutreachRecipientWorkspace[];
  metrics: {
    recipientCount: number;
    eligibleCount: number;
    pendingApprovalCount: number;
    approvedCount: number;
    draftedCount: number;
    sentCount: number;
    replyCount: number;
    blockedCount: number;
  };
  blockers: string[];
  readiness: number;
};

export type OutreachBreakdown = {
  key: string;
  count: number;
  share: number;
};

export type OutreachOverview = {
  generatedAt: string;
  metrics: {
    campaignCount: number;
    liveCampaignCount: number;
    recipientCount: number;
    contactPoolCount: number;
    pendingApprovalCount: number;
    draftReadyCount: number;
    recordedSentCount: number;
    replyCount: number;
    blockedRecipientCount: number;
    responseRate: number;
  };
  campaigns: OutreachCampaignWorkspace[];
  contacts: OutreachContactOption[];
  resources: {
    collections: OutreachResourceOption[];
    publications: OutreachResourceOption[];
    showrooms: OutreachResourceOption[];
  };
  breakdowns: {
    contactTypes: OutreachBreakdown[];
    markets: OutreachBreakdown[];
    tiers: OutreachBreakdown[];
  };
};

export async function listAllOutreachCampaigns(limit = 2000) {
  const db = await getDb();
  return db
    .select()
    .from(outreachCampaigns)
    .orderBy(
      asc(outreachCampaigns.status),
      asc(outreachCampaigns.windowStartAt),
      desc(outreachCampaigns.updatedAt),
    )
    .limit(limit);
}

export async function listAllOutreachRecipients(limit = 8000) {
  const db = await getDb();
  return db
    .select()
    .from(outreachRecipients)
    .orderBy(
      desc(outreachRecipients.updatedAt),
      desc(outreachRecipients.createdAt),
    )
    .limit(limit);
}

export async function getOutreachCampaign(id: string) {
  const db = await getDb();
  const [campaign] = await db
    .select()
    .from(outreachCampaigns)
    .where(eq(outreachCampaigns.id, id))
    .limit(1);
  return campaign ?? null;
}

export async function getOutreachRecipient(id: string) {
  const db = await getDb();
  const [recipient] = await db
    .select()
    .from(outreachRecipients)
    .where(eq(outreachRecipients.id, id))
    .limit(1);
  return recipient ?? null;
}

export async function buildOutreachOverview(
  now = new Date(),
): Promise<OutreachOverview> {
  const [
    campaigns,
    recipients,
    contacts,
    opportunities,
    collections,
    publications,
    showrooms,
  ] = await Promise.all([
    listAllOutreachCampaigns(),
    listAllOutreachRecipients(),
    listAllRelationshipContacts(),
    listAllRelationshipOpportunities(),
    listAllCollections(1000),
    listAllPublications(1000),
    listAllShowrooms(1000),
  ]);

  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const opportunityById = new Map(
    opportunities.map((opportunity) => [opportunity.id, opportunity]),
  );
  const collectionById = new Map(
    collections.map((collection) => [collection.id, collection]),
  );
  const publicationById = new Map(
    publications.map((publication) => [publication.id, publication]),
  );
  const showroomById = new Map(
    showrooms.map((showroom) => [showroom.id, showroom]),
  );
  const opportunitiesByContact = groupBy(
    opportunities,
    (opportunity) => opportunity.contactId,
  );
  const recipientsByCampaign = groupBy(
    recipients,
    (recipient) => recipient.campaignId,
  );

  const contactOptions = contacts
    .map((contact) => {
      const eligibility = getOutreachEligibility(contact);
      return {
        id: contact.id,
        contactCode: contact.contactCode,
        name: contact.name,
        organization: contact.organization,
        roleTitle: contact.roleTitle,
        contactType: contact.contactType,
        tier: contact.tier,
        market: contact.market,
        email: contact.email,
        phone: contact.phone,
        preferredChannel: contact.preferredChannel,
        contactability: contact.contactability,
        status: contact.status,
        eligibility,
        eligibilityReason: outreachEligibilityReason(eligibility),
        opportunities: (opportunitiesByContact.get(contact.id) ?? [])
          .filter(
            (opportunity) =>
              !["won", "lost"].includes(opportunity.stage),
          )
          .map((opportunity) => ({
            id: opportunity.id,
            code: opportunity.opportunityCode,
            title: opportunity.title,
            stage: opportunity.stage,
          })),
      } satisfies OutreachContactOption;
    })
    .sort(
      (left, right) =>
        Number(right.eligibility === "eligible") -
          Number(left.eligibility === "eligible") ||
        contactTierWeight(left.tier) - contactTierWeight(right.tier) ||
        left.name.localeCompare(right.name),
    );

  const workspaces = campaigns
    .map((campaign) => {
      const collection = campaign.collectionId
        ? collectionById.get(campaign.collectionId) ?? null
        : null;
      const publication = campaign.publicationId
        ? publicationById.get(campaign.publicationId) ?? null
        : null;
      const linkedShowroom = campaign.showroomId
        ? showroomById.get(campaign.showroomId) ?? null
        : null;
      const showroom = linkedShowroom
        ? {
            id: linkedShowroom.id,
            label: linkedShowroom.title,
            meta: [linkedShowroom.audienceLabel, linkedShowroom.contactName]
              .filter(Boolean)
              .join(" · "),
            status: linkedShowroom.status,
          }
        : null;
      const campaignRecipients = (
        recipientsByCampaign.get(campaign.id) ?? []
      )
        .map((recipient) => {
          const contact = contactById.get(recipient.contactId);
          if (!contact) return null;
          const opportunity = recipient.opportunityId
            ? opportunityById.get(recipient.opportunityId) ?? null
            : null;
          const eligibility = getOutreachEligibility(contact);
          return {
            recipient,
            contact,
            opportunity,
            opportunities: (opportunitiesByContact.get(contact.id) ?? [])
              .filter(
                (candidate) => !["won", "lost"].includes(candidate.stage),
              )
              .map((candidate) => ({
                id: candidate.id,
                code: candidate.opportunityCode,
                title: candidate.title,
                stage: candidate.stage,
              })),
            eligibility,
            eligibilityReason: outreachEligibilityReason(eligibility),
            canInitiate: eligibility === "eligible",
          } satisfies OutreachRecipientWorkspace;
        })
        .filter(
          (
            recipient,
          ): recipient is OutreachRecipientWorkspace => recipient !== null,
        )
        .sort(compareRecipientWorkspace);
      const metrics = campaignMetrics(campaignRecipients);
      const blockers = campaignBlockers(
        campaign,
        campaignRecipients,
        now,
      );
      return {
        campaign,
        collection,
        publication,
        showroom,
        recipients: campaignRecipients,
        metrics,
        blockers,
        readiness: campaignReadiness(campaign, campaignRecipients, blockers),
      } satisfies OutreachCampaignWorkspace;
    })
    .sort(compareCampaignWorkspace);

  const eligibleContacts = contactOptions.filter(
    (contact) => contact.eligibility === "eligible",
  );
  const pendingApprovalCount = recipients.filter(
    (recipient) => recipient.status === "proposed",
  ).length;
  const recordedSentCount = recipients.filter(
    (recipient) => recipient.status === "recorded_sent",
  ).length;
  const replyCount = recipients.filter(
    (recipient) => recipient.status === "replied",
  ).length;
  const sentBase = recordedSentCount + replyCount;

  return {
    generatedAt: now.toISOString(),
    metrics: {
      campaignCount: campaigns.length,
      liveCampaignCount: campaigns.filter((campaign) =>
        ["ready", "active"].includes(campaign.status),
      ).length,
      recipientCount: recipients.length,
      contactPoolCount: eligibleContacts.length,
      pendingApprovalCount,
      draftReadyCount: recipients.filter(
        (recipient) => recipient.status === "drafted",
      ).length,
      recordedSentCount,
      replyCount,
      blockedRecipientCount: workspaces.reduce(
        (total, workspace) => total + workspace.metrics.blockedCount,
        0,
      ),
      responseRate:
        sentBase > 0 ? rounded((replyCount / sentBase) * 100, 1) : 0,
    },
    campaigns: workspaces,
    contacts: contactOptions,
    resources: {
      collections: collections.map((collection) => ({
        id: collection.id,
        label: collection.title,
        meta: [collection.season, collection.year].filter(Boolean).join(" "),
        status: collection.status,
      })),
      publications: publications.map((publication) => ({
        id: publication.id,
        label: publication.headline || publication.slug,
        meta: publication.releaseDate || publication.city,
        status: publication.status,
      })),
      showrooms: showrooms.map((showroom) => ({
        id: showroom.id,
        label: showroom.title,
        meta: [showroom.audienceLabel, showroom.contactName]
          .filter(Boolean)
          .join(" · "),
        status: showroom.status,
      })),
    },
    breakdowns: {
      contactTypes: breakdown(
        eligibleContacts.map((contact) => contact.contactType),
      ),
      markets: breakdown(
        eligibleContacts.map((contact) => contact.market || "未填写"),
      ),
      tiers: breakdown(eligibleContacts.map((contact) => contact.tier)),
    },
  };
}

export function getOutreachEligibility(
  contact: RelationshipContact,
): OutreachEligibility {
  if (contact.status !== "active") return "inactive";
  if (contact.contactability === "do_not_contact") return "do_not_contact";
  if (contact.contactability === "unknown") return "consent_unknown";
  if (
    contact.preferredChannel === "none" ||
    (!contact.email &&
      !contact.phone &&
      contact.preferredChannel !== "in_person")
  ) {
    return "missing_channel";
  }
  return "eligible";
}

export function outreachEligibilityReason(value: OutreachEligibility) {
  return (
    {
      eligible: "联系边界与渠道已确认",
      missing_channel: "缺少可用联系渠道",
      consent_unknown: "联系边界尚未确认",
      do_not_contact: "请勿主动联系",
      inactive: "联系人已暂停或归档",
    } satisfies Record<OutreachEligibility, string>
  )[value];
}

export function composeOutreachDraft(input: {
  campaign: OutreachCampaign;
  contact: RelationshipContact;
  collectionTitle?: string;
  publicationHeadline?: string;
  showroomTitle?: string;
  angle?: string;
}) {
  const subject =
    input.campaign.subjectLine.trim() ||
    `NÉRA ATELIER / ${input.collectionTitle || input.campaign.title}`;
  const chinese = [
    `${input.contact.name}，你好：`,
    "",
    `想与你分享 NÉRA ATELIER 的${input.collectionTitle ? `「${input.collectionTitle}」` : `「${input.campaign.title}」`}。`,
    input.campaign.coreMessage,
    input.angle ? `此次沟通重点：${input.angle}` : "",
    input.publicationHeadline
      ? `相关发布资料：${input.publicationHeadline}`
      : "",
    input.showroomTitle
      ? `我们已准备私享展厅「${input.showroomTitle}」；访问链接将在发送前由设计师手动补充。`
      : "",
    input.campaign.callToAction,
    input.campaign.embargoAt
      ? `资料请保密至 ${formatDraftDate(input.campaign.embargoAt)}。`
      : "",
    "",
    "NÉRA ATELIER",
  ]
    .filter((line, index, lines) => line || lines[index - 1])
    .join("\n")
    .trim();
  const english = [
    `Hello ${input.contact.name},`,
    "",
    `I would like to share ${input.collectionTitle || input.campaign.title} from NÉRA ATELIER.`,
    input.campaign.coreMessage,
    input.angle ? `A relevant angle for you: ${input.angle}` : "",
    input.publicationHeadline
      ? `Press material: ${input.publicationHeadline}`
      : "",
    input.showroomTitle
      ? `A private showroom, “${input.showroomTitle},” is prepared for this conversation. The designer will add its access link manually before sending.`
      : "",
    input.campaign.callToAction,
    input.campaign.embargoAt
      ? `Please hold this material until ${formatDraftDate(input.campaign.embargoAt)}.`
      : "",
    "",
    "NÉRA ATELIER",
  ]
    .filter((line, index, lines) => line || lines[index - 1])
    .join("\n")
    .trim();
  const body =
    input.campaign.language === "zh"
      ? chinese
      : input.campaign.language === "en"
        ? english
        : `${chinese}\n\n—\n\n${english}`;
  return { subject, body };
}

export function outreachCampaignsToCsv(overview: OutreachOverview) {
  const columns = [
    "campaignCode",
    "title",
    "objective",
    "status",
    "language",
    "collection",
    "publication",
    "showroom",
    "market",
    "subjectLine",
    "coreMessage",
    "callToAction",
    "embargoAt",
    "windowStartAt",
    "windowEndAt",
    "recipients",
    "eligible",
    "approved",
    "drafted",
    "recordedSent",
    "replied",
    "readiness",
    "notes",
    "createdAt",
    "updatedAt",
  ];
  const lines = [columns.map(csvCell).join(",")];
  overview.campaigns.forEach((workspace) => {
    const { campaign, metrics } = workspace;
    lines.push(
      [
        campaign.campaignCode,
        campaign.title,
        campaign.objective,
        campaign.status,
        campaign.language,
        workspace.collection?.title ?? "",
        workspace.publication?.headline ?? "",
        workspace.showroom?.label ?? "",
        campaign.market,
        campaign.subjectLine,
        campaign.coreMessage,
        campaign.callToAction,
        campaign.embargoAt,
        campaign.windowStartAt,
        campaign.windowEndAt,
        metrics.recipientCount,
        metrics.eligibleCount,
        metrics.approvedCount,
        metrics.draftedCount,
        metrics.sentCount,
        metrics.replyCount,
        workspace.readiness,
        campaign.notes,
        campaign.createdAt,
        campaign.updatedAt,
      ]
        .map(csvCell)
        .join(","),
    );
  });
  return `\ufeff${lines.join("\r\n")}`;
}

export function outreachRecipientsToCsv(overview: OutreachOverview) {
  const columns = [
    "campaignCode",
    "campaign",
    "contactCode",
    "name",
    "organization",
    "contactType",
    "tier",
    "market",
    "preferredChannel",
    "contactability",
    "eligibility",
    "status",
    "opportunity",
    "angle",
    "draftSubject",
    "draftBody",
    "approvalNote",
    "approvedAt",
    "sentAt",
    "repliedAt",
    "createdAt",
    "updatedAt",
  ];
  const lines = [columns.map(csvCell).join(",")];
  overview.campaigns.forEach((workspace) => {
    workspace.recipients.forEach((recipient) => {
      lines.push(
        [
          workspace.campaign.campaignCode,
          workspace.campaign.title,
          recipient.contact.contactCode,
          recipient.contact.name,
          recipient.contact.organization,
          recipient.contact.contactType,
          recipient.contact.tier,
          recipient.contact.market,
          recipient.contact.preferredChannel,
          recipient.contact.contactability,
          recipient.eligibility,
          recipient.recipient.status,
          recipient.opportunity?.title ?? "",
          recipient.recipient.angle,
          recipient.recipient.draftSubject,
          recipient.recipient.draftBody,
          recipient.recipient.approvalNote,
          recipient.recipient.approvedAt,
          recipient.recipient.sentAt,
          recipient.recipient.repliedAt,
          recipient.recipient.createdAt,
          recipient.recipient.updatedAt,
        ]
          .map(csvCell)
          .join(","),
      );
    });
  });
  return `\ufeff${lines.join("\r\n")}`;
}

function campaignMetrics(recipients: OutreachRecipientWorkspace[]) {
  return {
    recipientCount: recipients.length,
    eligibleCount: recipients.filter(
      (recipient) => recipient.eligibility === "eligible",
    ).length,
    pendingApprovalCount: recipients.filter(
      (recipient) => recipient.recipient.status === "proposed",
    ).length,
    approvedCount: recipients.filter(
      (recipient) => recipient.recipient.status === "approved",
    ).length,
    draftedCount: recipients.filter(
      (recipient) => recipient.recipient.status === "drafted",
    ).length,
    sentCount: recipients.filter(
      (recipient) => recipient.recipient.status === "recorded_sent",
    ).length,
    replyCount: recipients.filter(
      (recipient) => recipient.recipient.status === "replied",
    ).length,
    blockedCount: recipients.filter(
      (recipient) =>
        recipient.eligibility !== "eligible" ||
        recipient.recipient.status === "blocked",
    ).length,
  };
}

function campaignBlockers(
  campaign: OutreachCampaign,
  recipients: OutreachRecipientWorkspace[],
  now: Date,
) {
  const blockers: string[] = [];
  if (!campaign.subjectLine.trim()) blockers.push("补充统一主题");
  if (!campaign.coreMessage.trim()) blockers.push("补充核心信息");
  if (!campaign.callToAction.trim()) blockers.push("补充明确行动请求");
  if (
    !campaign.collectionId &&
    !campaign.publicationId &&
    !campaign.showroomId
  ) {
    blockers.push("关联至少一项系列、发布包或私享展厅");
  }
  if (recipients.length === 0) blockers.push("选择至少一位联系人");
  if (
    recipients.length > 0 &&
    recipients.every((recipient) => recipient.eligibility !== "eligible")
  ) {
    blockers.push("当前对象均不具备主动联系条件");
  }
  if (
    recipients.some(
      (recipient) =>
        recipient.recipient.status === "proposed" &&
        recipient.eligibility === "eligible",
    )
  ) {
    blockers.push("仍有对象等待人工批准");
  }
  if (
    recipients.some(
      (recipient) =>
        recipient.eligibility !== "eligible" &&
        !["blocked", "skipped", "recorded_sent", "replied"].includes(
          recipient.recipient.status,
        ),
    )
  ) {
    blockers.push("已进入流程的对象中存在新的联系边界阻断");
  }
  const start = dateValue(campaign.windowStartAt);
  const end = dateValue(campaign.windowEndAt);
  const embargo = dateValue(campaign.embargoAt);
  if (start !== null && end !== null && end < start) {
    blockers.push("外联窗口结束时间早于开始时间");
  }
  if (embargo !== null && start !== null && embargo > start) {
    blockers.push("保密截止晚于外联窗口开始");
  }
  if (
    campaign.status === "active" &&
    end !== null &&
    end < now.getTime()
  ) {
    blockers.push("活动仍在进行，但外联窗口已结束");
  }
  return blockers;
}

function campaignReadiness(
  campaign: OutreachCampaign,
  recipients: OutreachRecipientWorkspace[],
  blockers: string[],
) {
  const checks = [
    Boolean(campaign.title),
    Boolean(campaign.subjectLine),
    Boolean(campaign.coreMessage),
    Boolean(campaign.callToAction),
    Boolean(campaign.collectionId || campaign.publicationId || campaign.showroomId),
    recipients.some((recipient) => recipient.eligibility === "eligible"),
    recipients.some((recipient) =>
      ["approved", "drafted", "recorded_sent", "replied"].includes(
        recipient.recipient.status,
      ),
    ),
    blockers.every(
      (blocker) =>
        ![
          "外联窗口结束时间早于开始时间",
          "保密截止晚于外联窗口开始",
        ].includes(blocker),
    ),
  ];
  return rounded((checks.filter(Boolean).length / checks.length) * 100, 1);
}

function compareCampaignWorkspace(
  left: OutreachCampaignWorkspace,
  right: OutreachCampaignWorkspace,
) {
  return (
    campaignStatusWeight(left.campaign.status) -
      campaignStatusWeight(right.campaign.status) ||
    compareNullableDates(
      left.campaign.windowStartAt,
      right.campaign.windowStartAt,
    ) ||
    right.campaign.updatedAt.localeCompare(left.campaign.updatedAt)
  );
}

function compareRecipientWorkspace(
  left: OutreachRecipientWorkspace,
  right: OutreachRecipientWorkspace,
) {
  return (
    recipientStatusWeight(left.recipient.status) -
      recipientStatusWeight(right.recipient.status) ||
    contactTierWeight(left.contact.tier) - contactTierWeight(right.contact.tier) ||
    left.contact.name.localeCompare(right.contact.name)
  );
}

function campaignStatusWeight(value: string) {
  return (
    {
      active: 0,
      ready: 1,
      review: 2,
      draft: 3,
      paused: 4,
      completed: 5,
      archived: 6,
    }[value] ?? 7
  );
}

function recipientStatusWeight(value: string) {
  return (
    {
      proposed: 0,
      approved: 1,
      drafted: 2,
      recorded_sent: 3,
      replied: 4,
      blocked: 5,
      skipped: 6,
    }[value] ?? 7
  );
}

function contactTierWeight(value: string) {
  return (
    {
      priority: 0,
      core: 1,
      developing: 2,
      dormant: 3,
    }[value] ?? 4
  );
}

function groupBy<T>(rows: T[], keyFor: (row: T) => string) {
  const groups = new Map<string, T[]>();
  rows.forEach((row) => {
    const key = keyFor(row);
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  });
  return groups;
}

function breakdown(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((rawValue) => {
    const value = rawValue.trim() || "未填写";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return Array.from(counts, ([key, count]) => ({
    key,
    count,
    share: values.length > 0 ? rounded((count / values.length) * 100, 1) : 0,
  })).sort(
    (left, right) =>
      right.count - left.count || left.key.localeCompare(right.key),
  );
}

function compareNullableDates(left: string | null, right: string | null) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return (dateValue(left) ?? 0) - (dateValue(right) ?? 0);
}

function dateValue(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatDraftDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function rounded(value: number, digits: number) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
