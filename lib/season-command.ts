import { listArchiveSnapshots } from "@/lib/archive-handoff";
import {
  getEditorialCalendarSnapshot,
  type EditorialCalendarItem,
} from "@/lib/editorial-calendar";
import {
  getEditorialOverview,
  type EditorialIssue,
} from "@/lib/editorial-operations";
import {
  listAllDesignReviewActions,
  listAllDesignReviews,
} from "@/lib/design-reviews";
import {
  listAllFittingIssues,
  listAllFittingSessions,
} from "@/lib/fittings";
import {
  listAllSampleSignoffChecks,
  listAllSampleSignoffs,
} from "@/lib/sample-signoffs";
import {
  listAllProductionReleaseChecks,
  listAllProductionReleases,
} from "@/lib/production-releases";
import { listAllProductionExceptions } from "@/lib/production-exceptions";
import {
  listAllMaterials,
  listAllWorkMaterials,
} from "@/lib/materials";
import {
  listAllTechPackConstructionNotes,
  listAllTechnicalPacks,
} from "@/lib/technical-packs";
import {
  listAllOutreachCampaigns,
  listAllOutreachRecipients,
} from "@/lib/outreach";
import {
  listAllRelationshipActivities,
  listAllRelationshipContacts,
  listAllRelationshipOpportunities,
} from "@/lib/relationships";
import { listAllSampleCommunications } from "@/lib/sample-correspondence";
import {
  listAllSampleAssets,
  listAllSampleAudits,
} from "@/lib/sample-inventory";
import { listAllSampleLoans } from "@/lib/sample-loans";
import { listAllSamplePlacements } from "@/lib/sample-placements";
import { listAllShowroomRequests } from "@/lib/showroom-requests";
import { listAllShowrooms } from "@/lib/showrooms";

export type SeasonCommandState = "clear" | "attention" | "active";
export type SeasonCommandUrgency =
  | "overdue"
  | "today"
  | "upcoming"
  | "attention";
export type SeasonCommandGroup =
  | "CREATE"
  | "PUBLISH"
  | "RELATION"
  | "OPERATIONS"
  | "ARCHIVE";

export type SeasonCollectionPulse = {
  id: string;
  title: string;
  season: string;
  year: number;
  status: "draft" | "published";
  lookCount: number;
  publishedLookCount: number;
  eventCount: number;
  nextEventAt: string | null;
  campaignCount: number;
  activeCampaignCount: number;
  pendingApprovalCount: number;
  readiness: number;
  checks: Array<{
    id: string;
    label: string;
    passed: boolean;
  }>;
  publication: {
    id: string;
    headline: string;
    status: "draft" | "scheduled" | "published";
    releaseAt: string | null;
  } | null;
};

export type SeasonCommandGate = {
  id: string;
  label: string;
  detail: string;
  passed: boolean;
  href: string;
};

export type SeasonCommandAgendaItem = {
  id: string;
  kind:
    | "editorial"
    | "calendar"
    | "showroom"
    | "loan"
    | "inventory"
    | "relationship"
    | "outreach"
    | "placement"
    | "review"
    | "material"
    | "technical"
    | "fitting"
    | "sampleSignoff"
    | "productionRelease"
    | "productionException";
  eyebrow: string;
  title: string;
  detail: string;
  dueAt: string | null;
  urgency: SeasonCommandUrgency;
  href: string;
  collectionId: string | null;
};

export type SeasonCommandModule = {
  phase: string;
  group: SeasonCommandGroup;
  label: string;
  english: string;
  href: string;
  value: number;
  unit: string;
  state: SeasonCommandState;
};

export type SeasonCommandOverview = {
  generatedAt: string;
  focusCollectionId: string | null;
  collections: SeasonCollectionPulse[];
  metrics: {
    editorialScore: number;
    gateClearCount: number;
    gateTotalCount: number;
    attentionCount: number;
    nextSevenDays: number;
    activeShowrooms: number;
    liveLoans: number;
    openOpportunities: number;
    pendingApproval: number;
    publishedPlacements: number;
  };
  archive: {
    latestLabel: string | null;
    latestCreatedAt: string | null;
    schemaVersion: number | null;
  };
  gates: SeasonCommandGate[];
  agenda: SeasonCommandAgendaItem[];
  modules: SeasonCommandModule[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const CLOSED_LOAN_STATUSES = new Set(["returned", "closed", "cancelled"]);
const CLOSED_OPPORTUNITY_STAGES = new Set(["won", "lost"]);
const CLOSED_REVIEW_STATUSES = new Set(["closed", "cancelled"]);
const CLOSED_REVIEW_ACTION_STATUSES = new Set(["done", "cancelled"]);
const LIVE_CAMPAIGN_STATUSES = new Set(["ready", "active"]);

export async function buildSeasonCommandOverview(
  now = new Date(),
): Promise<SeasonCommandOverview> {
  const [
    editorial,
    calendar,
    showrooms,
    showroomRequests,
    loans,
    communications,
    assets,
    audits,
    placements,
    contacts,
    opportunities,
    activities,
    campaigns,
    recipients,
    designReviews,
    designReviewActions,
    materials,
    workMaterials,
    technicalPacks,
    technicalConstructionNotes,
    fittingSessions,
    fittingIssues,
    sampleSignoffs,
    sampleSignoffChecks,
    productionReleases,
    productionReleaseChecks,
    productionExceptions,
    archiveSnapshots,
  ] = await Promise.all([
    getEditorialOverview(),
    getEditorialCalendarSnapshot(now),
    listAllShowrooms(),
    listAllShowroomRequests(),
    listAllSampleLoans(),
    listAllSampleCommunications(),
    listAllSampleAssets(),
    listAllSampleAudits(),
    listAllSamplePlacements(),
    listAllRelationshipContacts(),
    listAllRelationshipOpportunities(),
    listAllRelationshipActivities(),
    listAllOutreachCampaigns(),
    listAllOutreachRecipients(),
    listAllDesignReviews(),
    listAllDesignReviewActions(),
    listAllMaterials(),
    listAllWorkMaterials(),
    listAllTechnicalPacks(),
    listAllTechPackConstructionNotes(),
    listAllFittingSessions(),
    listAllFittingIssues(),
    listAllSampleSignoffs(),
    listAllSampleSignoffChecks(),
    listAllProductionReleases(),
    listAllProductionReleaseChecks(),
    listAllProductionExceptions(),
    listArchiveSnapshots(1),
  ]);

  const nowMs = now.getTime();
  const sevenDaysAt = nowMs + 7 * DAY_MS;
  const fourteenDaysAt = nowMs + 14 * DAY_MS;
  const contactById = new Map(
    contacts.map((contact) => [contact.id, contact]),
  );
  const campaignById = new Map(
    campaigns.map((campaign) => [campaign.id, campaign]),
  );
  const collectionById = new Map(
    calendar.references.collections.map((collection) => [
      collection.id,
      collection,
    ]),
  );
  const workById = new Map(
    calendar.references.works.map((work) => [work.id, work]),
  );
  const materialById = new Map(
    materials.map((material) => [material.id, material]),
  );
  const technicalPackById = new Map(
    technicalPacks.map((pack) => [pack.id, pack]),
  );
  const fittingSessionById = new Map(
    fittingSessions.map((session) => [session.id, session]),
  );
  const sampleSignoffById = new Map(
    sampleSignoffs.map((signoff) => [signoff.id, signoff]),
  );
  const productionReleaseById = new Map(
    productionReleases.map((release) => [release.id, release]),
  );
  const collectionIdByWorkId = new Map(
    calendar.references.assignments.map((assignment) => [
      assignment.workId,
      assignment.collectionId,
    ]),
  );
  const assignmentsByCollection = groupBy(
    calendar.references.assignments,
    (assignment) => assignment.collectionId,
  );
  const eventsByCollection = groupBy(
    calendar.events.filter(
      (event): event is EditorialCalendarItem & {
        collection: NonNullable<EditorialCalendarItem["collection"]>;
      } => Boolean(event.collection),
    ),
    (event) => event.collection.id,
  );
  const campaignsByCollection = groupBy(
    campaigns.filter(
      (campaign): campaign is typeof campaign & {
        collectionId: string;
      } => Boolean(campaign.collectionId),
    ),
    (campaign) => campaign.collectionId,
  );
  const recipientsByCampaign = groupBy(
    recipients,
    (recipient) => recipient.campaignId,
  );
  const publicationByCollection = new Map(
    calendar.references.publications.map((publication) => [
      publication.collectionId,
      publication,
    ]),
  );

  const collections = calendar.references.collections.map((collection) => {
    const assignments =
      assignmentsByCollection.get(collection.id) ?? [];
    const collectionEvents = eventsByCollection.get(collection.id) ?? [];
    const collectionCampaigns =
      campaignsByCollection.get(collection.id) ?? [];
    const publication =
      publicationByCollection.get(collection.id) ?? null;
    const pendingApprovalCount = collectionCampaigns.reduce(
      (total, campaign) =>
        total +
        (recipientsByCampaign.get(campaign.id) ?? []).filter(
          (recipient) => recipient.status === "proposed",
        ).length,
      0,
    );
    const publishedLookCount = assignments.filter(
      (assignment) =>
        workById.get(assignment.workId)?.status === "published",
    ).length;
    const checks = [
      {
        id: "collection",
        label: "系列公开",
        passed: collection.status === "published",
      },
      {
        id: "lineup",
        label: "Look 已编排",
        passed: assignments.length > 0,
      },
      {
        id: "looks",
        label: "Look 已公开",
        passed:
          assignments.length > 0 &&
          publishedLookCount === assignments.length,
      },
      {
        id: "publication",
        label: "发布包已建立",
        passed: Boolean(publication),
      },
      {
        id: "release",
        label: "发布已安排",
        passed:
          publication?.status === "scheduled" ||
          publication?.status === "published",
      },
    ];
    const nextEventAt =
      collectionEvents.find(
        (event) =>
          !["completed", "cancelled"].includes(event.status) &&
          timestamp(event.startsAt) >= nowMs,
      )?.startsAt ?? null;

    return {
      id: collection.id,
      title: collection.title,
      season: collection.season,
      year: collection.year,
      status: collection.status,
      lookCount: assignments.length,
      publishedLookCount,
      eventCount: collectionEvents.length,
      nextEventAt,
      campaignCount: collectionCampaigns.length,
      activeCampaignCount: collectionCampaigns.filter((campaign) =>
        LIVE_CAMPAIGN_STATUSES.has(campaign.status),
      ).length,
      pendingApprovalCount,
      readiness: Math.round(
        (checks.filter((check) => check.passed).length / checks.length) *
          100,
      ),
      checks,
      publication: publication
        ? {
            id: publication.id,
            headline: publication.headline,
            status: publication.status,
            releaseAt: publication.releaseAt,
          }
        : null,
    } satisfies SeasonCollectionPulse;
  });

  const focusCollectionId =
    calendar.events.find(
      (event) =>
        event.collection &&
        ["launch", "press"].includes(event.eventType) &&
        !["completed", "cancelled"].includes(event.status) &&
        timestamp(event.startsAt) >= nowMs,
    )?.collection?.id ??
    collections[0]?.id ??
    null;

  const pendingRequests = showroomRequests.filter((request) =>
    ["submitted", "reviewing"].includes(request.status),
  );
  const liveLoans = loans.filter(
    (loan) => !CLOSED_LOAN_STATUSES.has(loan.status),
  );
  const overdueLoans = liveLoans.filter(
    (loan) =>
      Boolean(loan.expectedReturnAt) &&
      timestamp(loan.expectedReturnAt) < nowMs,
  );
  const openAudits = audits.filter((audit) =>
    ["counting", "review"].includes(audit.status),
  );
  const relationshipDueCount =
    contacts.filter(
      (contact) =>
        contact.status === "active" &&
        isDue(contact.nextFollowUpAt, nowMs),
    ).length +
    opportunities.filter(
      (opportunity) =>
        !CLOSED_OPPORTUNITY_STAGES.has(opportunity.stage) &&
        isDue(opportunity.nextActionAt, nowMs),
    ).length +
    activities.filter(
      (activity) =>
        activity.status === "planned" &&
        isDue(activity.dueAt, nowMs),
    ).length;
  const pendingApproval = recipients.filter(
    (recipient) => recipient.status === "proposed",
  );
  const criticalIssues = editorial.issues.filter(
    (issue) => issue.severity === "critical",
  );
  const activeDesignReviews = designReviews.filter(
    (review) => !CLOSED_REVIEW_STATUSES.has(review.status),
  );
  const openDesignReviewActions = designReviewActions.filter(
    (action) => !CLOSED_REVIEW_ACTION_STATUSES.has(action.status),
  );
  const overdueDesignReviews = activeDesignReviews.filter(
    (review) =>
      Boolean(review.scheduledAt) &&
      timestamp(review.scheduledAt) < nowMs,
  );
  const overdueDesignReviewActions = openDesignReviewActions.filter(
    (action) =>
      Boolean(action.dueAt) && timestamp(action.dueAt) < nowMs,
  );
  const criticalDesignReviewActions = openDesignReviewActions.filter(
    (action) => action.priority === "critical",
  );
  const reviseDesignReviews = activeDesignReviews.filter(
    (review) => review.decision === "revise",
  );
  const designReviewAttention =
    overdueDesignReviews.length +
    overdueDesignReviewActions.length +
    criticalDesignReviewActions.length +
    reviseDesignReviews.length;
  const materialApprovalConflicts = workMaterials.filter(
    (assignment) =>
      ["selected", "approved"].includes(assignment.status) &&
      materialById.get(assignment.materialId)?.status !== "approved",
  );
  const latestTechnicalPackByWorkId = new Map<
    string,
    (typeof technicalPacks)[number]
  >();
  technicalPacks.forEach((pack) => {
    const current = latestTechnicalPackByWorkId.get(pack.workId);
    if (
      !current ||
      pack.revision > current.revision ||
      (pack.revision === current.revision &&
        timestamp(pack.updatedAt) > timestamp(current.updatedAt))
    ) {
      latestTechnicalPackByWorkId.set(pack.workId, pack);
    }
  });
  const technicalPackConflicts = calendar.references.works.filter((work) => {
    if (work.status !== "published") return false;
    const pack = latestTechnicalPackByWorkId.get(work.id);
    return !pack || !["approved", "locked"].includes(pack.status);
  });
  const criticalTechnicalNotes = technicalConstructionNotes.filter(
    (note) => note.priority === "critical" && note.status === "open",
  );
  const reviewTechnicalPacks = technicalPacks.filter(
    (pack) => pack.status === "review",
  );
  const technicalAttention =
    technicalPackConflicts.length +
    criticalTechnicalNotes.length +
    reviewTechnicalPacks.length;
  const fittingSessionsByPack = groupBy(
    fittingSessions,
    (session) => session.technicalPackId,
  );
  const fittingPackConflicts = calendar.references.works.flatMap((work) => {
    if (work.status !== "published") return [];
    const pack = latestTechnicalPackByWorkId.get(work.id);
    if (!pack || !["approved", "locked"].includes(pack.status)) return [];
    const sessions = fittingSessionsByPack.get(pack.id) ?? [];
    const latest =
      [...sessions].sort(
        (left, right) =>
          right.round - left.round ||
          timestamp(right.updatedAt) - timestamp(left.updatedAt),
      )[0] ?? null;
    return latest && ["approved", "closed"].includes(latest.status)
      ? []
      : [{ work, pack, session: latest }];
  });
  const criticalFittingIssues = fittingIssues.filter(
    (issue) =>
      issue.severity === "critical" &&
      !["resolved", "removed"].includes(issue.status) &&
      fittingSessionById.get(issue.fittingSessionId)?.status !== "cancelled",
  );
  const reviewFittingSessions = fittingSessions.filter(
    (session) => session.status === "in_review",
  );
  const fittingAttention =
    fittingPackConflicts.length +
    criticalFittingIssues.length +
    reviewFittingSessions.length;
  const sampleSignoffsByPack = groupBy(
    sampleSignoffs,
    (signoff) => signoff.technicalPackId,
  );
  const sampleSignoffConflicts = calendar.references.works.flatMap((work) => {
    if (work.status !== "published") return [];
    const pack = latestTechnicalPackByWorkId.get(work.id);
    if (!pack || !["approved", "locked"].includes(pack.status)) return [];
    const fittings = fittingSessionsByPack.get(pack.id) ?? [];
    const fitting =
      [...fittings].sort(
        (left, right) =>
          right.round - left.round ||
          timestamp(right.updatedAt) - timestamp(left.updatedAt),
      )[0] ?? null;
    if (
      !fitting ||
      !["approved", "closed"].includes(fitting.status) ||
      fitting.decision !== "approve"
    ) {
      return [];
    }
    const signoffs = sampleSignoffsByPack.get(pack.id) ?? [];
    const signoff =
      [...signoffs].sort(
        (left, right) =>
          right.round - left.round ||
          timestamp(right.updatedAt) - timestamp(left.updatedAt),
      )[0] ?? null;
    return signoff && ["approved", "sealed"].includes(signoff.status)
      ? []
      : [{ work, pack, fitting, signoff }];
  });
  const failedSampleSignoffChecks = sampleSignoffChecks.filter((check) => {
    const signoff = sampleSignoffById.get(check.sampleSignoffId);
    return check.result === "fail" && signoff?.status !== "void";
  });
  const reviewSampleSignoffs = sampleSignoffs.filter(
    (signoff) => signoff.status === "in_review",
  );
  const sampleSignoffAttention =
    sampleSignoffConflicts.length +
    failedSampleSignoffChecks.length +
    reviewSampleSignoffs.length;
  const productionReleasesBySignoff = groupBy(
    productionReleases,
    (release) => release.sampleSignoffId,
  );
  const productionReleaseConflicts =
    calendar.references.works.flatMap((work) => {
      if (work.status !== "published") return [];
      const pack = latestTechnicalPackByWorkId.get(work.id);
      if (!pack || !["approved", "locked"].includes(pack.status)) return [];
      const signoffs = sampleSignoffsByPack.get(pack.id) ?? [];
      const signoff =
        [...signoffs].sort(
          (left, right) =>
            right.round - left.round ||
            timestamp(right.updatedAt) - timestamp(left.updatedAt),
        )[0] ?? null;
      if (!signoff || signoff.status !== "sealed") return [];
      const releases = productionReleasesBySignoff.get(signoff.id) ?? [];
      const release =
        [...releases].sort(
          (left, right) =>
            right.sequence - left.sequence ||
            timestamp(right.updatedAt) - timestamp(left.updatedAt),
        )[0] ?? null;
      return release?.status === "released"
        ? []
        : [{ work, signoff, release }];
    });
  const blockedProductionReleaseChecks = productionReleaseChecks.filter(
    (check) => {
      const release = productionReleaseById.get(check.productionReleaseId);
      return (
        check.result === "blocked" &&
        release &&
        !["void", "superseded"].includes(release.status)
      );
    },
  );
  const reviewProductionReleases = productionReleases.filter(
    (release) => release.status === "in_review",
  );
  const productionReleaseAttention =
    productionReleaseConflicts.length +
    blockedProductionReleaseChecks.length +
    reviewProductionReleases.length;
  const activeProductionExceptions = productionExceptions.filter(
    (record) => !["closed", "withdrawn"].includes(record.status),
  );
  const criticalProductionExceptions = activeProductionExceptions.filter(
    (record) => ["high", "critical"].includes(record.severity),
  );
  const overdueProductionExceptions = activeProductionExceptions.filter(
    (record) =>
      Boolean(record.dueAt) && timestamp(record.dueAt) < startOfDay(now),
  );
  const productionExceptionAttention = new Set([
    ...criticalProductionExceptions.map((record) => record.id),
    ...overdueProductionExceptions.map((record) => record.id),
  ]).size;

  const gates: SeasonCommandGate[] = [
    {
      id: "editorial-score",
      label: "编辑准备度",
      detail:
        editorial.score >= 85
          ? `当前 ${editorial.score}/100，达到发布检查线。`
          : `当前 ${editorial.score}/100，建议先完成编辑质量检查。`,
      passed: editorial.score >= 85,
      href: "#editorial-operations",
    },
    {
      id: "critical-issues",
      label: "关键内容缺口",
      detail:
        criticalIssues.length === 0
          ? "没有必须处理的内容缺口。"
          : `仍有 ${criticalIssues.length} 项必须处理。`,
      passed: criticalIssues.length === 0,
      href: "#editorial-operations",
    },
    {
      id: "design-reviews",
      label: "设计评审",
      detail:
        designReviewAttention === 0
          ? "没有逾期评审、关键修改或等待复审的设计结论。"
          : `有 ${designReviewAttention} 个评审信号需要设计师判断。`,
      passed: designReviewAttention === 0,
      href: "#design-review-board",
    },
    {
      id: "materials",
      label: "材料批准",
      detail:
        materialApprovalConflicts.length === 0
          ? "所有已选定 Look 用料均来自已批准材料。"
          : `有 ${materialApprovalConflicts.length} 条 Look 用料早于材料批准。`,
      passed: materialApprovalConflicts.length === 0,
      href: "#material-room",
    },
    {
      id: "technical-packs",
      label: "技术包批准",
      detail:
        technicalPackConflicts.length === 0 &&
        criticalTechnicalNotes.length === 0
          ? "所有已公开 Look 均有已批准技术包，且没有开放的关键工艺风险。"
          : `有 ${technicalPackConflicts.length} 个公开 Look 缺少已批准技术包，${criticalTechnicalNotes.length} 条关键工艺仍待确认。`,
      passed:
        technicalPackConflicts.length === 0 &&
        criticalTechnicalNotes.length === 0,
      href: "#technical-atelier",
    },
    {
      id: "fitting-approval",
      label: "试身审版",
      detail:
        fittingPackConflicts.length === 0 &&
        criticalFittingIssues.length === 0
          ? "所有已公开 Look 的最新技术包均有批准试身，且没有开放的关键版型问题。"
          : `有 ${fittingPackConflicts.length} 个已公开 Look 缺少当前修订的批准试身，${criticalFittingIssues.length} 个关键版型问题仍待解决。`,
      passed:
        fittingPackConflicts.length === 0 &&
        criticalFittingIssues.length === 0,
      href: "#fitting-room",
    },
    {
      id: "sample-signoff",
      label: "最终封样",
      detail:
        sampleSignoffConflicts.length === 0 &&
        failedSampleSignoffChecks.length === 0
          ? "所有已公开 Look 的当前批准修订均有最终封样，且没有失败核对。"
          : `有 ${sampleSignoffConflicts.length} 个已公开 Look 缺少当前修订的最终封样，${failedSampleSignoffChecks.length} 项封样核对失败。`,
      passed:
        sampleSignoffConflicts.length === 0 &&
        failedSampleSignoffChecks.length === 0,
      href: "#final-sample-gate",
    },
    {
      id: "production-release",
      label: "生产放行",
      detail:
        productionReleaseConflicts.length === 0 &&
        blockedProductionReleaseChecks.length === 0
          ? "所有已封存的当前最终样均有人工生产放行，且没有阻塞核对。"
          : `有 ${productionReleaseConflicts.length} 个当前封样尚未完成生产放行，${blockedProductionReleaseChecks.length} 项准备核对被阻塞。`,
      passed:
        productionReleaseConflicts.length === 0 &&
        blockedProductionReleaseChecks.length === 0,
      href: "#production-release-desk",
    },
    {
      id: "production-exception",
      label: "生产偏差闭环",
      detail:
        criticalProductionExceptions.length === 0 &&
        overdueProductionExceptions.length === 0
          ? "没有未关闭的高风险生产偏差或逾期复核。"
          : `有 ${criticalProductionExceptions.length} 条高风险偏差、${overdueProductionExceptions.length} 条逾期复核需要设计师处理。`,
      passed:
        criticalProductionExceptions.length === 0 &&
        overdueProductionExceptions.length === 0,
      href: "#production-change-control",
    },
    {
      id: "calendar",
      label: "关键排期",
      detail:
        calendar.summary.overdue === 0
          ? "没有逾期排期。"
          : `有 ${calendar.summary.overdue} 项排期已经逾期。`,
      passed: calendar.summary.overdue === 0,
      href: "#editorial-calendar",
    },
    {
      id: "showroom",
      label: "展厅回应",
      detail:
        pendingRequests.length === 0
          ? "所有专业请求均已分流。"
          : `有 ${pendingRequests.length} 条请求等待审核。`,
      passed: pendingRequests.length === 0,
      href: "#appointment-response",
    },
    {
      id: "loans",
      label: "样衣归还",
      detail:
        overdueLoans.length === 0
          ? "没有逾期未归还的借调。"
          : `有 ${overdueLoans.length} 单样衣已超过预计归还时间。`,
      passed: overdueLoans.length === 0,
      href: "#sample-fulfilment",
    },
    {
      id: "inventory",
      label: "库存盘点",
      detail:
        openAudits.length === 0
          ? "没有未完成的盘点会话。"
          : `有 ${openAudits.length} 次盘点仍在进行或复核。`,
      passed: openAudits.length === 0,
      href: "#sample-inventory",
    },
    {
      id: "relationships",
      label: "关系跟进",
      detail:
        relationshipDueCount === 0
          ? "没有已经到期的关系行动。"
          : `有 ${relationshipDueCount} 项关系行动已经到期。`,
      passed: relationshipDueCount === 0,
      href: "#relationship-intelligence",
    },
    {
      id: "outreach",
      label: "外联人工审核",
      detail:
        pendingApproval.length === 0
          ? "没有等待人工批准的外联对象。"
          : `有 ${pendingApproval.length} 位对象仍在提议队列。`,
      passed: pendingApproval.length === 0,
      href: "#campaign-outreach",
    },
  ];

  const agenda = buildAgenda({
    now,
    fourteenDaysAt,
    editorialIssues: editorial.issues,
    calendarEvents: calendar.events,
    pendingRequests,
    overdueLoans,
    openAudits,
    communications,
    placements,
    contacts,
    opportunities,
    activities,
    campaigns,
    recipients,
    designReviews,
    designReviewActions,
    materialApprovalConflicts,
    materialById,
    technicalPackConflicts,
    criticalTechnicalNotes,
    technicalPackById,
    fittingPackConflicts,
    criticalFittingIssues,
    fittingSessionById,
    sampleSignoffConflicts,
    failedSampleSignoffChecks,
    sampleSignoffById,
    productionReleaseConflicts,
    blockedProductionReleaseChecks,
    productionReleaseById,
    criticalProductionExceptions,
    overdueProductionExceptions,
    workById,
    collectionIdByWorkId,
    contactById,
    campaignById,
    collectionById,
  });
  const activeShowrooms = showrooms.filter(
    (showroom) =>
      showroom.status === "active" &&
      (!showroom.expiresAt || timestamp(showroom.expiresAt) > nowMs),
  ).length;
  const openOpportunities = opportunities.filter(
    (opportunity) =>
      !CLOSED_OPPORTUNITY_STAGES.has(opportunity.stage),
  ).length;
  const publishedPlacements = placements.filter(
    (placement) => placement.status === "published",
  ).length;
  const missingAssets = assets.filter(
    (asset) => asset.status === "missing",
  ).length;
  const followUpCommunications = communications.filter(
    (entry) =>
      entry.status !== "resolved" &&
      Boolean(entry.followUpAt) &&
      timestamp(entry.followUpAt) <= sevenDaysAt,
  ).length;
  const latestSnapshot = archiveSnapshots[0] ?? null;
  const modules = buildModules({
    editorial,
    calendar,
    collections,
    showrooms: showrooms.length,
    activeShowrooms,
    pendingRequests: pendingRequests.length,
    liveLoans: liveLoans.length,
    communications: communications.length,
    followUpCommunications,
    assets: assets.length,
    missingAssets,
    openAudits: openAudits.length,
    placements: placements.length,
    publishedPlacements,
    contacts: contacts.length,
    openOpportunities,
    relationshipDueCount,
    campaigns: campaigns.length,
    pendingApproval: pendingApproval.length,
    activeDesignReviews: activeDesignReviews.length,
    designReviewAttention,
    materials: materials.length,
    materialAttention: materialApprovalConflicts.length,
    technicalPacks: technicalPacks.length,
    technicalAttention,
    fittingSessions: fittingSessions.length,
    fittingAttention,
    sampleSignoffs: sampleSignoffs.length,
    sampleSignoffAttention,
    productionReleases: productionReleases.length,
    productionReleaseAttention,
    productionExceptions: productionExceptions.length,
    productionExceptionAttention,
    archiveSnapshots: archiveSnapshots.length,
  });

  return {
    generatedAt: now.toISOString(),
    focusCollectionId,
    collections,
    metrics: {
      editorialScore: editorial.score,
      gateClearCount: gates.filter((gate) => gate.passed).length,
      gateTotalCount: gates.length,
      attentionCount: agenda.filter(
        (item) => item.urgency !== "upcoming",
      ).length,
      nextSevenDays: calendar.summary.nextSevenDays,
      activeShowrooms,
      liveLoans: liveLoans.length,
      openOpportunities,
      pendingApproval: pendingApproval.length,
      publishedPlacements,
    },
    archive: {
      latestLabel: latestSnapshot?.label ?? null,
      latestCreatedAt: latestSnapshot?.createdAt ?? null,
      schemaVersion: latestSnapshot?.schemaVersion ?? null,
    },
    gates,
    agenda,
    modules,
  };
}

type AgendaInput = {
  now: Date;
  fourteenDaysAt: number;
  editorialIssues: EditorialIssue[];
  calendarEvents: EditorialCalendarItem[];
  pendingRequests: Awaited<ReturnType<typeof listAllShowroomRequests>>;
  overdueLoans: Awaited<ReturnType<typeof listAllSampleLoans>>;
  openAudits: Awaited<ReturnType<typeof listAllSampleAudits>>;
  communications: Awaited<ReturnType<typeof listAllSampleCommunications>>;
  placements: Awaited<ReturnType<typeof listAllSamplePlacements>>;
  contacts: Awaited<ReturnType<typeof listAllRelationshipContacts>>;
  opportunities: Awaited<
    ReturnType<typeof listAllRelationshipOpportunities>
  >;
  activities: Awaited<ReturnType<typeof listAllRelationshipActivities>>;
  campaigns: Awaited<ReturnType<typeof listAllOutreachCampaigns>>;
  recipients: Awaited<ReturnType<typeof listAllOutreachRecipients>>;
  designReviews: Awaited<ReturnType<typeof listAllDesignReviews>>;
  designReviewActions: Awaited<
    ReturnType<typeof listAllDesignReviewActions>
  >;
  materialApprovalConflicts: Awaited<
    ReturnType<typeof listAllWorkMaterials>
  >;
  materialById: Map<
    string,
    Awaited<ReturnType<typeof listAllMaterials>>[number]
  >;
  technicalPackConflicts: Awaited<
    ReturnType<typeof getEditorialCalendarSnapshot>
  >["references"]["works"];
  criticalTechnicalNotes: Awaited<
    ReturnType<typeof listAllTechPackConstructionNotes>
  >;
  technicalPackById: Map<
    string,
    Awaited<ReturnType<typeof listAllTechnicalPacks>>[number]
  >;
  fittingPackConflicts: Array<{
    work: Awaited<
      ReturnType<typeof getEditorialCalendarSnapshot>
    >["references"]["works"][number];
    pack: Awaited<ReturnType<typeof listAllTechnicalPacks>>[number];
    session:
      | Awaited<ReturnType<typeof listAllFittingSessions>>[number]
      | null;
  }>;
  criticalFittingIssues: Awaited<
    ReturnType<typeof listAllFittingIssues>
  >;
  fittingSessionById: Map<
    string,
    Awaited<ReturnType<typeof listAllFittingSessions>>[number]
  >;
  sampleSignoffConflicts: Array<{
    work: Awaited<
      ReturnType<typeof getEditorialCalendarSnapshot>
    >["references"]["works"][number];
    pack: Awaited<ReturnType<typeof listAllTechnicalPacks>>[number];
    fitting: Awaited<ReturnType<typeof listAllFittingSessions>>[number];
    signoff:
      | Awaited<ReturnType<typeof listAllSampleSignoffs>>[number]
      | null;
  }>;
  failedSampleSignoffChecks: Awaited<
    ReturnType<typeof listAllSampleSignoffChecks>
  >;
  sampleSignoffById: Map<
    string,
    Awaited<ReturnType<typeof listAllSampleSignoffs>>[number]
  >;
  productionReleaseConflicts: Array<{
    work: Awaited<
      ReturnType<typeof getEditorialCalendarSnapshot>
    >["references"]["works"][number];
    signoff: Awaited<ReturnType<typeof listAllSampleSignoffs>>[number];
    release:
      | Awaited<ReturnType<typeof listAllProductionReleases>>[number]
      | null;
  }>;
  blockedProductionReleaseChecks: Awaited<
    ReturnType<typeof listAllProductionReleaseChecks>
  >;
  productionReleaseById: Map<
    string,
    Awaited<ReturnType<typeof listAllProductionReleases>>[number]
  >;
  criticalProductionExceptions: Awaited<
    ReturnType<typeof listAllProductionExceptions>
  >;
  overdueProductionExceptions: Awaited<
    ReturnType<typeof listAllProductionExceptions>
  >;
  workById: Map<
    string,
    Awaited<
      ReturnType<typeof getEditorialCalendarSnapshot>
    >["references"]["works"][number]
  >;
  collectionIdByWorkId: Map<string, string>;
  contactById: Map<
    string,
    Awaited<ReturnType<typeof listAllRelationshipContacts>>[number]
  >;
  campaignById: Map<
    string,
    Awaited<ReturnType<typeof listAllOutreachCampaigns>>[number]
  >;
  collectionById: Map<
    string,
    Awaited<
      ReturnType<typeof getEditorialCalendarSnapshot>
    >["references"]["collections"][number]
  >;
};

function buildAgenda(input: AgendaInput): SeasonCommandAgendaItem[] {
  const nowMs = input.now.getTime();
  const sevenDaysAt = nowMs + 7 * DAY_MS;
  const items: SeasonCommandAgendaItem[] = [];
  const reviewById = new Map(
    input.designReviews.map((review) => [review.id, review]),
  );

  input.editorialIssues
    .filter((issue) => issue.severity !== "note")
    .slice(0, 6)
    .forEach((issue) => {
      items.push({
        id: `editorial-${issue.id}`,
        kind: "editorial",
        eyebrow:
          issue.severity === "critical" ? "EDITORIAL / 必须处理" : "EDITORIAL / 完善",
        title: issue.title,
        detail: issue.detail,
        dueAt: null,
        urgency: "attention",
        href: issue.href || "#editorial-operations",
        collectionId: null,
      });
    });

  input.designReviews
    .filter(
      (review) =>
        !CLOSED_REVIEW_STATUSES.has(review.status) &&
        Boolean(review.scheduledAt) &&
        timestamp(review.scheduledAt) <= input.fourteenDaysAt,
    )
    .slice(0, 6)
    .forEach((review) => {
      const collection = review.collectionId
        ? input.collectionById.get(review.collectionId)
        : null;
      items.push({
        id: `review-${review.id}`,
        kind: "review",
        eyebrow: `REVIEW / ${review.reviewType.replaceAll("_", " ")}`,
        title: review.title,
        detail: [
          review.reviewCode,
          collection?.title,
          review.reviewerName,
          review.decision === "revise" ? "等待复审" : "",
        ]
          .filter(Boolean)
          .join(" · "),
        dueAt: review.scheduledAt,
        urgency: urgencyForDate(review.scheduledAt, input.now),
        href: "#design-review-board",
        collectionId: review.collectionId,
      });
    });

  input.designReviewActions
    .filter((action) => {
      if (CLOSED_REVIEW_ACTION_STATUSES.has(action.status)) return false;
      const review = reviewById.get(action.reviewId);
      if (!review || CLOSED_REVIEW_STATUSES.has(review.status)) return false;
      return (
        action.priority === "critical" ||
        (Boolean(action.dueAt) &&
          timestamp(action.dueAt) <= sevenDaysAt)
      );
    })
    .slice(0, 8)
    .forEach((action) => {
      const review = reviewById.get(action.reviewId);
      if (!review) return;
      items.push({
        id: `review-action-${action.id}`,
        kind: "review",
        eyebrow:
          action.priority === "critical"
            ? "REVISION / 关键修改"
            : "REVISION / 待完成",
        title: action.title,
        detail: [review.reviewCode, review.title, action.ownerName]
          .filter(Boolean)
          .join(" · "),
        dueAt: action.dueAt,
        urgency: action.dueAt
          ? urgencyForDate(action.dueAt, input.now)
          : "attention",
        href: "#design-review-board",
        collectionId: review.collectionId,
      });
    });

  input.materialApprovalConflicts.slice(0, 6).forEach((assignment) => {
    const material = input.materialById.get(assignment.materialId);
    const work = input.workById.get(assignment.workId);
    items.push({
      id: `material-${assignment.id}`,
      kind: "material",
      eyebrow: "MATERIAL / 批准冲突",
      title: material?.name ?? "未找到的材料",
      detail: [
        work?.title,
        assignment.role.replaceAll("_", " "),
        "Look 已选定，材料尚未批准",
      ]
        .filter(Boolean)
        .join(" · "),
      dueAt: null,
      urgency: "attention",
      href: "#material-room",
      collectionId:
        input.collectionIdByWorkId.get(assignment.workId) ?? null,
    });
  });

  input.technicalPackConflicts.slice(0, 6).forEach((work) => {
    items.push({
      id: `technical-work-${work.id}`,
      kind: "technical",
      eyebrow: "TECH PACK / 批准缺口",
      title: work.title,
      detail: [
        work.lookNumber,
        work.collection,
        "公开 Look 尚无已批准的最新技术包",
      ]
        .filter(Boolean)
        .join(" · "),
      dueAt: null,
      urgency: "attention",
      href: "#technical-atelier",
      collectionId: input.collectionIdByWorkId.get(work.id) ?? null,
    });
  });

  input.criticalTechnicalNotes.slice(0, 6).forEach((note) => {
    const pack = input.technicalPackById.get(note.techPackId);
    const work = pack ? input.workById.get(pack.workId) : null;
    items.push({
      id: `technical-note-${note.id}`,
      kind: "technical",
      eyebrow: "CONSTRUCTION / 关键工艺",
      title: note.title,
      detail: [
        pack?.techPackCode,
        work?.title,
        "关键说明仍待人工确认",
      ]
        .filter(Boolean)
        .join(" · "),
      dueAt: null,
      urgency: "attention",
      href: "#technical-atelier",
      collectionId: pack
        ? input.collectionIdByWorkId.get(pack.workId) ?? null
        : null,
    });
  });

  input.fittingPackConflicts.slice(0, 6).forEach(({ work, pack, session }) => {
    items.push({
      id: `fitting-work-${work.id}`,
      kind: "fitting",
      eyebrow: "FITTING / 审版缺口",
      title: work.title,
      detail: [
        pack.techPackCode,
        session?.fittingCode,
        session ? "最新试身尚未批准" : "当前修订尚未建立试身",
      ]
        .filter(Boolean)
        .join(" · "),
      dueAt: session?.nextFittingAt ?? session?.fittingAt ?? null,
      urgency: "attention",
      href: "#fitting-room",
      collectionId: input.collectionIdByWorkId.get(work.id) ?? null,
    });
  });

  input.criticalFittingIssues.slice(0, 6).forEach((issue) => {
    const session = input.fittingSessionById.get(issue.fittingSessionId);
    const work = session ? input.workById.get(session.workId) : null;
    items.push({
      id: `fitting-issue-${issue.id}`,
      kind: "fitting",
      eyebrow: "FIT ISSUE / 关键修改",
      title: issue.area || issue.category.replaceAll("_", " "),
      detail: [
        session?.fittingCode,
        work?.title,
        issue.observation,
      ]
        .filter(Boolean)
        .join(" · "),
      dueAt: issue.dueAt,
      urgency: issue.dueAt
        ? urgencyForDate(issue.dueAt, input.now)
        : "attention",
      href: "#fitting-room",
      collectionId: session
        ? input.collectionIdByWorkId.get(session.workId) ?? null
        : null,
    });
  });

  input.sampleSignoffConflicts
    .slice(0, 6)
    .forEach(({ work, pack, fitting, signoff }) => {
      items.push({
        id: `sample-signoff-work-${work.id}`,
        kind: "sampleSignoff",
        eyebrow: "SAMPLE GATE / 封样缺口",
        title: work.title,
        detail: [
          pack.techPackCode,
          fitting.fittingCode,
          signoff?.signoffCode,
          signoff ? "最新封样尚未批准" : "当前修订尚未建立封样核对",
        ]
          .filter(Boolean)
          .join(" · "),
        dueAt: signoff?.reviewedAt ?? signoff?.receivedAt ?? null,
        urgency: "attention",
        href: "#final-sample-gate",
        collectionId: input.collectionIdByWorkId.get(work.id) ?? null,
      });
    });

  input.failedSampleSignoffChecks.slice(0, 8).forEach((check) => {
    const signoff = input.sampleSignoffById.get(check.sampleSignoffId);
    const work = signoff ? input.workById.get(signoff.workId) : null;
    items.push({
      id: `sample-signoff-check-${check.id}`,
      kind: "sampleSignoff",
      eyebrow: "SEAL CHECK / 核对失败",
      title: check.title,
      detail: [
        signoff?.signoffCode,
        work?.title,
        check.observation || check.requirement,
      ]
        .filter(Boolean)
        .join(" · "),
      dueAt: null,
      urgency: "attention",
      href: "#final-sample-gate",
      collectionId: signoff
        ? input.collectionIdByWorkId.get(signoff.workId) ?? null
        : null,
    });
  });

  input.productionReleaseConflicts
    .slice(0, 6)
    .forEach(({ work, signoff, release }) => {
      items.push({
        id: `production-release-work-${work.id}`,
        kind: "productionRelease",
        eyebrow: "RELEASE DESK / 放行缺口",
        title: work.title,
        detail: [
          signoff.sealCode,
          release?.releaseCode,
          release ? "生产放行尚未授权" : "已封样，尚未建立生产放行包",
        ]
          .filter(Boolean)
          .join(" · "),
        dueAt: release?.plannedWindowStart ?? null,
        urgency: "attention",
        href: "#production-release-desk",
        collectionId: input.collectionIdByWorkId.get(work.id) ?? null,
      });
    });

  input.blockedProductionReleaseChecks
    .slice(0, 8)
    .forEach((check) => {
      const release = input.productionReleaseById.get(
        check.productionReleaseId,
      );
      const work = release ? input.workById.get(release.workId) : null;
      items.push({
        id: `production-release-check-${check.id}`,
        kind: "productionRelease",
        eyebrow: "READINESS / 准备阻塞",
        title: check.title,
        detail: [
          release?.releaseCode,
          work?.title,
          check.observation || check.requirement,
        ]
          .filter(Boolean)
          .join(" · "),
        dueAt: release?.plannedWindowStart ?? null,
        urgency: "attention",
        href: "#production-release-desk",
        collectionId: release
          ? input.collectionIdByWorkId.get(release.workId) ?? null
          : null,
      });
    });

  const productionExceptionAgenda = new Map(
    [
      ...input.overdueProductionExceptions,
      ...input.criticalProductionExceptions,
    ].map((record) => [record.id, record]),
  );
  [...productionExceptionAgenda.values()].slice(0, 8).forEach((record) => {
    const release = input.productionReleaseById.get(
      record.productionReleaseId,
    );
    const work = input.workById.get(record.workId);
    const overdue =
      Boolean(record.dueAt) &&
      timestamp(record.dueAt) < startOfDay(input.now);
    items.push({
      id: `production-exception-${record.id}`,
      kind: "productionException",
      eyebrow: overdue
        ? "CHANGE CONTROL / 逾期复核"
        : "CHANGE CONTROL / 高风险偏差",
      title: record.title,
      detail: [
        record.exceptionCode,
        work?.title,
        release?.releaseCode,
        record.severity.toUpperCase(),
      ]
        .filter(Boolean)
        .join(" · "),
      dueAt: record.dueAt,
      urgency: overdue ? "overdue" : "attention",
      href: "#production-change-control",
      collectionId: input.collectionIdByWorkId.get(record.workId) ?? null,
    });
  });

  input.calendarEvents
    .filter((event) => {
      if (["completed", "cancelled"].includes(event.status)) return false;
      const startsAt = timestamp(event.startsAt);
      return event.health === "overdue" || startsAt <= input.fourteenDaysAt;
    })
    .slice(0, 8)
    .forEach((event) => {
      items.push({
        id: `calendar-${event.id}`,
        kind: "calendar",
        eyebrow: `CALENDAR / ${event.eventType.replaceAll("_", " ")}`,
        title: event.title,
        detail: [
          event.relationLabel,
          event.location,
          event.priority === "critical" ? "关键优先级" : "",
        ]
          .filter(Boolean)
          .join(" · "),
        dueAt: event.startsAt,
        urgency:
          event.health === "overdue"
            ? "overdue"
            : urgencyForDate(event.startsAt, input.now),
        href: "#editorial-calendar",
        collectionId: event.collection?.id ?? null,
      });
    });

  if (input.pendingRequests.length > 0) {
    items.push({
      id: "showroom-pending",
      kind: "showroom",
      eyebrow: "SHOWROOM / 待审核",
      title: `${input.pendingRequests.length} 条专业请求等待回应`,
      detail: "审核用途、时间、Look 与履约条件，再决定批准或婉拒。",
      dueAt: input.pendingRequests.at(-1)?.createdAt ?? null,
      urgency: "attention",
      href: "#appointment-response",
      collectionId: null,
    });
  }

  input.overdueLoans.slice(0, 4).forEach((loan) => {
    items.push({
      id: `loan-${loan.id}`,
      kind: "loan",
      eyebrow: "SAMPLE / 逾期归还",
      title: loan.loanCode,
      detail: "样衣已经超过预计归还时间，请核对物流与沟通记录。",
      dueAt: loan.expectedReturnAt,
      urgency: "overdue",
      href: "#sample-fulfilment",
      collectionId: null,
    });
  });

  if (input.openAudits.length > 0) {
    items.push({
      id: "inventory-open-audits",
      kind: "inventory",
      eyebrow: "INVENTORY / 盘点",
      title: `${input.openAudits.length} 次盘点尚未闭环`,
      detail: "完成扫描、复核差异并确认库位或缺失状态。",
      dueAt: input.openAudits[0]?.startedAt ?? null,
      urgency: "attention",
      href: "#sample-inventory",
      collectionId: null,
    });
  }

  input.communications
    .filter(
      (entry) =>
        entry.status !== "resolved" &&
        Boolean(entry.followUpAt) &&
        timestamp(entry.followUpAt) <= sevenDaysAt,
    )
    .slice(0, 3)
    .forEach((entry) => {
      items.push({
        id: `communication-${entry.id}`,
        kind: "loan",
        eyebrow: "CORRESPONDENCE / 跟进",
        title: entry.subject || "样衣沟通待跟进",
        detail: "依据已记录的事实完成外部沟通，再回到台账登记结果。",
        dueAt: entry.followUpAt,
        urgency: urgencyForDate(entry.followUpAt, input.now),
        href: "#sample-correspondence",
        collectionId: null,
      });
    });

  input.contacts
    .filter(
      (contact) =>
        contact.status === "active" &&
        Boolean(contact.nextFollowUpAt) &&
        timestamp(contact.nextFollowUpAt) <= sevenDaysAt,
    )
    .slice(0, 4)
    .forEach((contact) => {
      items.push({
        id: `contact-${contact.id}`,
        kind: "relationship",
        eyebrow: "RELATIONSHIP / 联系人",
        title: contact.name,
        detail: [contact.organization, contact.roleTitle]
          .filter(Boolean)
          .join(" · ") || "联系人跟进",
        dueAt: contact.nextFollowUpAt,
        urgency: urgencyForDate(contact.nextFollowUpAt, input.now),
        href: "#relationship-intelligence",
        collectionId: null,
      });
    });

  input.opportunities
    .filter(
      (opportunity) =>
        !CLOSED_OPPORTUNITY_STAGES.has(opportunity.stage) &&
        Boolean(opportunity.nextActionAt) &&
        timestamp(opportunity.nextActionAt) <= sevenDaysAt,
    )
    .slice(0, 4)
    .forEach((opportunity) => {
      const contact = input.contactById.get(opportunity.contactId);
      items.push({
        id: `opportunity-${opportunity.id}`,
        kind: "relationship",
        eyebrow: "OPPORTUNITY / 下一步",
        title: opportunity.title,
        detail: [contact?.name, opportunity.nextAction]
          .filter(Boolean)
          .join(" · "),
        dueAt: opportunity.nextActionAt,
        urgency: urgencyForDate(opportunity.nextActionAt, input.now),
        href: "#relationship-intelligence",
        collectionId: null,
      });
    });

  input.activities
    .filter(
      (activity) =>
        activity.status === "planned" &&
        Boolean(activity.dueAt) &&
        timestamp(activity.dueAt) <= sevenDaysAt,
    )
    .slice(0, 4)
    .forEach((activity) => {
      const contact = input.contactById.get(activity.contactId);
      items.push({
        id: `activity-${activity.id}`,
        kind: "relationship",
        eyebrow: "ACTIVITY / 待办",
        title: activity.subject,
        detail: [contact?.name, activity.kind.replaceAll("_", " ")]
          .filter(Boolean)
          .join(" · "),
        dueAt: activity.dueAt,
        urgency: urgencyForDate(activity.dueAt, input.now),
        href: "#relationship-intelligence",
        collectionId: null,
      });
    });

  const proposedByCampaign = countBy(
    input.recipients.filter((recipient) => recipient.status === "proposed"),
    (recipient) => recipient.campaignId,
  );
  proposedByCampaign.forEach((count, campaignId) => {
    const campaign = input.campaignById.get(campaignId);
    if (!campaign) return;
    items.push({
      id: `outreach-proposed-${campaignId}`,
      kind: "outreach",
      eyebrow: "OUTREACH / 人工批准",
      title: campaign.title,
      detail: `${count} 位对象等待逐位审核；联系边界仍由设计师决定。`,
      dueAt: campaign.windowStartAt,
      urgency: "attention",
      href: "#campaign-outreach",
      collectionId: campaign.collectionId,
    });
  });

  const draftedByCampaign = countBy(
    input.recipients.filter((recipient) => recipient.status === "drafted"),
    (recipient) => recipient.campaignId,
  );
  draftedByCampaign.forEach((count, campaignId) => {
    const campaign = input.campaignById.get(campaignId);
    if (!campaign) return;
    items.push({
      id: `outreach-drafted-${campaignId}`,
      kind: "outreach",
      eyebrow: "OUTREACH / 手动外发",
      title: campaign.title,
      detail: `${count} 份草稿已就绪；请在外部渠道发送后再登记事实。`,
      dueAt: campaign.windowStartAt,
      urgency: campaign.windowStartAt
        ? urgencyForDate(campaign.windowStartAt, input.now)
        : "attention",
      href: "#campaign-outreach",
      collectionId: campaign.collectionId,
    });
  });

  const openPlacementCount = input.placements.filter((placement) =>
    ["pending", "shot", "placed"].includes(placement.status),
  ).length;
  if (openPlacementCount > 0) {
    items.push({
      id: "placement-open",
      kind: "placement",
      eyebrow: "IMPACT / 成果闭环",
      title: `${openPlacementCount} 条成果仍在整理`,
      detail: "补齐日期、发布方、证据、Look 关系或最终落地状态。",
      dueAt: null,
      urgency: "attention",
      href: "#placement-impact",
      collectionId: null,
    });
  }

  return items
    .sort((left, right) => {
      const rank =
        urgencyRank(left.urgency) - urgencyRank(right.urgency);
      if (rank !== 0) return rank;
      const leftTime = left.dueAt ? timestamp(left.dueAt) : Infinity;
      const rightTime = right.dueAt ? timestamp(right.dueAt) : Infinity;
      return leftTime - rightTime || left.title.localeCompare(right.title);
    })
    .slice(0, 18);
}

type ModuleInput = {
  editorial: Awaited<ReturnType<typeof getEditorialOverview>>;
  calendar: Awaited<ReturnType<typeof getEditorialCalendarSnapshot>>;
  collections: SeasonCollectionPulse[];
  showrooms: number;
  activeShowrooms: number;
  pendingRequests: number;
  liveLoans: number;
  communications: number;
  followUpCommunications: number;
  assets: number;
  missingAssets: number;
  openAudits: number;
  placements: number;
  publishedPlacements: number;
  contacts: number;
  openOpportunities: number;
  relationshipDueCount: number;
  campaigns: number;
  pendingApproval: number;
  activeDesignReviews: number;
  designReviewAttention: number;
  materials: number;
  materialAttention: number;
  technicalPacks: number;
  technicalAttention: number;
  fittingSessions: number;
  fittingAttention: number;
  sampleSignoffs: number;
  sampleSignoffAttention: number;
  productionReleases: number;
  productionReleaseAttention: number;
  productionExceptions: number;
  productionExceptionAttention: number;
  archiveSnapshots: number;
};

function buildModules(input: ModuleInput): SeasonCommandModule[] {
  return [
    moduleItem("01", "CREATE", "系列系统", "COLLECTION", "#collection-system", input.collections.length, "SERIES", "active"),
    moduleItem("02", "CREATE", "数字型录", "LOOKBOOK", "#collection-system", input.collections.filter((collection) => collection.lookCount > 0).length, "BOOKS", "active"),
    moduleItem("03", "CREATE", "过程档案", "PROCESS", "#work-library", input.editorial.summary.process.total, "ENTRIES", input.editorial.summary.process.total > 0 ? "active" : "attention"),
    moduleItem("19", "CREATE", "设计评审", "REVIEW BOARD", "#design-review-board", input.activeDesignReviews, "OPEN", input.designReviewAttention > 0 ? "attention" : input.activeDesignReviews > 0 ? "active" : "clear"),
    moduleItem("20", "CREATE", "材料室", "MATERIAL ROOM", "#material-room", input.materials, "MATERIALS", input.materialAttention > 0 ? "attention" : input.materials > 0 ? "active" : "clear"),
    moduleItem("21", "CREATE", "技术工艺室", "TECHNICAL ATELIER", "#technical-atelier", input.technicalPacks, "PACKS", input.technicalAttention > 0 ? "attention" : input.technicalPacks > 0 ? "active" : "clear"),
    moduleItem("22", "CREATE", "试身审版室", "FITTING ROOM", "#fitting-room", input.fittingSessions, "SESSIONS", input.fittingAttention > 0 ? "attention" : input.fittingSessions > 0 ? "active" : "clear"),
    moduleItem("23", "CREATE", "封样签核台", "FINAL SAMPLE GATE", "#final-sample-gate", input.sampleSignoffs, "GATES", input.sampleSignoffAttention > 0 ? "attention" : input.sampleSignoffs > 0 ? "active" : "clear"),
    moduleItem("24", "CREATE", "生产放行台", "PRODUCTION RELEASE", "#production-release-desk", input.productionReleases, "PACKS", input.productionReleaseAttention > 0 ? "attention" : input.productionReleases > 0 ? "active" : "clear"),
    moduleItem("25", "CREATE", "生产变更控制", "CHANGE CONTROL", "#production-change-control", input.productionExceptions, "CASES", input.productionExceptionAttention > 0 ? "attention" : input.productionExceptions > 0 ? "active" : "clear"),
    moduleItem("04", "PUBLISH", "专业发布", "PUBLICATION", "#publication-center", input.editorial.summary.publications.total, "PACKS", input.editorial.summary.publications.ready > 0 ? "clear" : "attention"),
    moduleItem("05", "PUBLISH", "编辑运营", "EDITORIAL OPS", "#editorial-operations", input.editorial.score, "SCORE", input.editorial.score >= 85 ? "clear" : "attention"),
    moduleItem("06", "PUBLISH", "编辑日历", "CALENDAR", "#editorial-calendar", input.calendar.summary.nextSevenDays, "NEXT 7D", input.calendar.summary.overdue > 0 ? "attention" : "clear"),
    moduleItem("07", "ARCHIVE", "交接归档", "HANDOFF", "#archive-handoff", input.archiveSnapshots, "SNAPSHOT", input.archiveSnapshots > 0 ? "clear" : "attention"),
    moduleItem("08", "PUBLISH", "私享展厅", "SHOWROOM", "#private-showrooms", input.activeShowrooms, "ACTIVE", input.showrooms > 0 ? "active" : "attention"),
    moduleItem("09", "RELATION", "专业回应", "REQUESTS", "#appointment-response", input.pendingRequests, "PENDING", input.pendingRequests > 0 ? "attention" : "clear"),
    moduleItem("10", "RELATION", "样衣履约", "FULFILMENT", "#sample-fulfilment", input.liveLoans, "LIVE", input.liveLoans > 0 ? "active" : "clear"),
    moduleItem("11", "RELATION", "沟通留痕", "CORRESPONDENCE", "#sample-correspondence", input.communications, "LOGS", input.followUpCommunications > 0 ? "attention" : "clear"),
    moduleItem("12", "OPERATIONS", "实物盘点", "INVENTORY", "#sample-inventory", input.assets, "ASSETS", input.missingAssets + input.openAudits > 0 ? "attention" : "clear"),
    moduleItem("13", "OPERATIONS", "使用效能", "PERFORMANCE", "#sample-performance", input.assets, "TRACKED", input.assets > 0 ? "active" : "attention"),
    moduleItem("14", "OPERATIONS", "落地成果", "PLACEMENT", "#placement-impact", input.placements, "STORIES", input.placements > 0 ? "active" : "attention"),
    moduleItem("15", "OPERATIONS", "季度覆盖册", "COVERAGE", "#coverage-book", input.publishedPlacements, "PUBLISHED", input.publishedPlacements > 0 ? "clear" : "attention"),
    moduleItem("16", "RELATION", "关系与机会", "RELATIONSHIPS", "#relationship-intelligence", input.openOpportunities, "OPEN", input.relationshipDueCount > 0 ? "attention" : input.contacts > 0 ? "active" : "clear"),
    moduleItem("17", "RELATION", "专业外联", "OUTREACH", "#campaign-outreach", input.campaigns, "CAMPAIGNS", input.pendingApproval > 0 ? "attention" : input.campaigns > 0 ? "active" : "clear"),
  ];
}

function moduleItem(
  phase: string,
  group: SeasonCommandGroup,
  label: string,
  english: string,
  href: string,
  value: number,
  unit: string,
  state: SeasonCommandState,
): SeasonCommandModule {
  return { phase, group, label, english, href, value, unit, state };
}

function groupBy<T>(
  rows: T[],
  keyFor: (row: T) => string,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  rows.forEach((row) => {
    const key = keyFor(row);
    const current = map.get(key) ?? [];
    current.push(row);
    map.set(key, current);
  });
  return map;
}

function countBy<T>(
  rows: T[],
  keyFor: (row: T) => string,
): Map<string, number> {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const key = keyFor(row);
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return map;
}

function timestamp(value: string | null | undefined): number {
  if (!value) return Infinity;
  const normalized =
    value.includes(" ") && !value.includes("T")
      ? `${value.replace(" ", "T")}Z`
      : value;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : Infinity;
}

function startOfDay(now: Date): number {
  const value = new Date(now);
  value.setHours(0, 0, 0, 0);
  return value.getTime();
}

function isDue(
  value: string | null | undefined,
  nowMs: number,
): boolean {
  const parsed = timestamp(value);
  return Number.isFinite(parsed) && parsed < nowMs;
}

function urgencyForDate(
  value: string | null | undefined,
  now: Date,
): SeasonCommandUrgency {
  const parsed = timestamp(value);
  if (!Number.isFinite(parsed)) return "attention";
  if (parsed < now.getTime()) return "overdue";
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  if (parsed < tomorrow.getTime()) return "today";
  return "upcoming";
}

function urgencyRank(urgency: SeasonCommandUrgency): number {
  switch (urgency) {
    case "overdue":
      return 0;
    case "today":
      return 1;
    case "attention":
      return 2;
    default:
      return 3;
  }
}
