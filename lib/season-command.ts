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
  listAllProductionAcceptanceChecks,
  listAllProductionAcceptances,
} from "@/lib/production-acceptances";
import {
  listAllProvenanceDossierChecks,
  listAllProvenanceDossiers,
} from "@/lib/provenance-dossiers";
import {
  listAllConservationReportChecks,
  listAllConservationReports,
} from "@/lib/conservation-reports";
import {
  listAllExhibitionReadinessChecks,
  listAllExhibitionReadinessPlans,
} from "@/lib/exhibition-readiness";
import {
  listAllExhibitionWatches,
  listAllExhibitionWatchObservations,
  readingOutsidePlan,
} from "@/lib/exhibition-watch";
import {
  listAllExhibitionRecoveries,
  listAllExhibitionRecoveryChecks,
} from "@/lib/exhibition-recovery";
import { buildCuratorialOverview, type CuratorialWorkspace } from "@/lib/archive-curation";
import { buildInterpretationOverview, type InterpretationWorkspace } from "@/lib/exhibition-interpretation";
import { buildExhibitionDeliveryOverview, type ExhibitionDeliveryWorkspace } from "@/lib/exhibition-delivery";
import { buildExhibitionInstallationOverview, type ExhibitionInstallationWorkspace } from "@/lib/exhibition-installation";
import { buildExhibitionOpeningOverview, type ExhibitionOpeningWorkspace } from "@/lib/exhibition-opening";
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
    | "productionException"
    | "productionAcceptance"
    | "provenanceDossier"
    | "conservation"
    | "exhibition"
    | "exhibitionWatch"
    | "exhibitionRecovery"
    | "curation"
    | "interpretation"
    | "exhibitionDelivery"
    | "exhibitionInstallation"
    | "exhibitionOpening";
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
    productionAcceptances,
    productionAcceptanceChecks,
    provenanceDossiers,
    provenanceDossierChecks,
    conservationReports,
    conservationReportChecks,
    exhibitionPlans,
    exhibitionChecks,
    exhibitionWatches,
    exhibitionWatchObservations,
    exhibitionRecoveries,
    exhibitionRecoveryChecks,
    curation,
    interpretation,
    exhibitionDelivery,
    exhibitionInstallation,
    exhibitionOpening,
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
    listAllProductionAcceptances(),
    listAllProductionAcceptanceChecks(),
    listAllProvenanceDossiers(),
    listAllProvenanceDossierChecks(),
    listAllConservationReports(),
    listAllConservationReportChecks(),
    listAllExhibitionReadinessPlans(),
    listAllExhibitionReadinessChecks(),
    listAllExhibitionWatches(),
    listAllExhibitionWatchObservations(),
    listAllExhibitionRecoveries(),
    listAllExhibitionRecoveryChecks(),
    buildCuratorialOverview(now),
    buildInterpretationOverview(now),
    buildExhibitionDeliveryOverview(now),
    buildExhibitionInstallationOverview(now),
    buildExhibitionOpeningOverview(now),
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
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
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
  const productionAcceptanceByRelease = groupBy(
    productionAcceptances,
    (acceptance) => acceptance.productionReleaseId,
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
  const productionAcceptanceConflicts = productionReleases.flatMap(
    (release) => {
      if (release.status !== "released" || !release.authorizationCode) return [];
      const linked = productionAcceptanceByRelease.get(release.id) ?? [];
      return linked.some((acceptance) => acceptance.status === "accepted")
        ? []
        : [{ release, latest: linked[0] ?? null }];
    },
  );
  const failedProductionAcceptanceChecks = productionAcceptanceChecks.filter(
    (check) => {
      const acceptance = productionAcceptances.find(
        (item) => item.id === check.productionAcceptanceId,
      );
      return (
        check.result === "fail" &&
        acceptance &&
        !["rejected", "void"].includes(acceptance.status)
      );
    },
  );
  const productionAcceptanceAttention =
    productionAcceptanceConflicts.length +
    failedProductionAcceptanceChecks.length;
  const provenanceDossiersByAcceptance = groupBy(
    provenanceDossiers,
    (dossier) => dossier.productionAcceptanceId,
  );
  const provenanceDossierConflicts = productionAcceptances.flatMap(
    (acceptance) => {
      if (acceptance.status !== "accepted" || !acceptance.acceptanceSeal) return [];
      const linked = provenanceDossiersByAcceptance.get(acceptance.id) ?? [];
      return linked.some((dossier) => dossier.status === "published")
        ? []
        : [{ acceptance, latest: linked[0] ?? null }];
    },
  );
  const provenanceDossierById = new Map(
    provenanceDossiers.map((dossier) => [dossier.id, dossier]),
  );
  const failedProvenanceDossierChecks = provenanceDossierChecks.filter(
    (check) => {
      const dossier = provenanceDossierById.get(check.provenanceDossierId);
      return (
        check.result === "fail" &&
        dossier &&
        !["retired", "void"].includes(dossier.status)
      );
    },
  );
  const provenanceDossierAttention =
    provenanceDossierConflicts.length + failedProvenanceDossierChecks.length;
  const activeConservationReports = conservationReports.filter(
    (report) => !["closed", "void"].includes(report.status),
  );
  const activeConservationReportById = new Map(
    activeConservationReports.map((report) => [report.id, report]),
  );
  const criticalConservationChecks = conservationReportChecks.filter(
    (check) =>
      activeConservationReportById.has(check.conservationReportId) &&
      ["high", "critical"].includes(check.severity) &&
      !["resolved", "na"].includes(check.result),
  );
  const overdueConservationReports = activeConservationReports.filter(
    (report) =>
      Boolean(report.nextReviewAt) &&
      timestamp(report.nextReviewAt) < startOfDay(now),
  );
  const conservationAttention = new Set([
    ...criticalConservationChecks.map((check) => check.conservationReportId),
    ...overdueConservationReports.map((report) => report.id),
  ]).size;
  const activeExhibitionPlans = exhibitionPlans.filter(
    (plan) => !["closed", "void"].includes(plan.status),
  );
  const activeExhibitionPlanById = new Map(
    activeExhibitionPlans.map((plan) => [plan.id, plan]),
  );
  const blockedExhibitionChecks = exhibitionChecks.filter(
    (check) =>
      activeExhibitionPlanById.has(check.exhibitionReadinessPlanId) &&
      check.result === "blocked" &&
      check.critical,
  );
  const upcomingUnapprovedExhibitionPlans = activeExhibitionPlans.filter(
    (plan) =>
      Boolean(plan.installAt) &&
      timestamp(plan.installAt) >= nowMs &&
      timestamp(plan.installAt) <= fourteenDaysAt &&
      plan.status !== "approved",
  );
  const overdueExhibitionPlans = exhibitionPlans.filter(
    (plan) =>
      plan.status === "approved" &&
      Boolean(plan.deinstallAt) &&
      timestamp(plan.deinstallAt) < nowMs,
  );
  const exhibitionAttention = new Set([
    ...blockedExhibitionChecks.map((check) => check.exhibitionReadinessPlanId),
    ...upcomingUnapprovedExhibitionPlans.map((plan) => plan.id),
    ...overdueExhibitionPlans.map((plan) => plan.id),
  ]).size;
  const exhibitionPlanById = new Map(exhibitionPlans.map((plan) => [plan.id, plan]));
  const watchByPlanId = new Map(exhibitionWatches.map((watch) => [watch.exhibitionReadinessPlanId, watch]));
  const latestObservationByWatch = new Map<string, (typeof exhibitionWatchObservations)[number]>();
  exhibitionWatchObservations.forEach((observation) => {
    const current = latestObservationByWatch.get(observation.exhibitionWatchId);
    if (!current || timestamp(observation.observedAt) > timestamp(current.observedAt)) latestObservationByWatch.set(observation.exhibitionWatchId, observation);
  });
  const missingExhibitionWatches = exhibitionPlans.filter((plan) =>
    plan.status === "approved" && ["ready", "ready_with_limits"].includes(plan.decision) &&
    Boolean(plan.installAt) && timestamp(plan.installAt) <= nowMs &&
    (!plan.deinstallAt || timestamp(plan.deinstallAt) >= nowMs) && !watchByPlanId.has(plan.id),
  );
  const overdueExhibitionWatches = exhibitionWatches.filter((watch) => {
    if (!["active", "paused"].includes(watch.status)) return false;
    return timestamp(watch.lastObservedAt || watch.openedAt) + watch.monitoringIntervalHours * 3_600_000 < nowMs;
  });
  const attentionExhibitionWatches = exhibitionWatches.filter((watch) => {
    if (!["active", "paused"].includes(watch.status)) return false;
    const latest = latestObservationByWatch.get(watch.id);
    const plan = exhibitionPlanById.get(watch.exhibitionReadinessPlanId);
    return Boolean(latest && (latest.conditionResult !== "stable" || latest.supportResult !== "stable" || latest.pestResult !== "none" || latest.incidentType !== "none" || ["pause", "deinstall", "conservator_review"].includes(latest.disposition) || (plan && readingOutsidePlan(latest, plan))));
  });
  const exhibitionWatchAttention = new Set([
    ...missingExhibitionWatches.map((plan) => plan.id),
    ...overdueExhibitionWatches.map((watch) => watch.id),
    ...attentionExhibitionWatches.map((watch) => watch.id),
  ]).size;
  const recoveryByWatchId = new Map(exhibitionRecoveries.map((recovery) => [recovery.exhibitionWatchId, recovery]));
  const exhibitionRecoveryConflicts = exhibitionWatches
    .filter((watch) => ["deinstalled", "closed"].includes(watch.status))
    .map((watch) => ({ watch, recovery: recoveryByWatchId.get(watch.id) ?? null }))
    .filter(({ recovery }) => !recovery || !["released", "referred", "void"].includes(recovery.status));
  const activeRecoveryIds = new Set(exhibitionRecoveries.filter((recovery) => !["released", "referred", "void"].includes(recovery.status)).map((recovery) => recovery.id));
  const blockedExhibitionRecoveryChecks = exhibitionRecoveryChecks.filter((check) => activeRecoveryIds.has(check.exhibitionRecoveryId) && check.critical && check.result === "blocked");
  const dueExhibitionRecoveries = exhibitionRecoveries.filter((recovery) => recovery.status === "stabilizing" && Boolean(recovery.acclimatizationUntil) && timestamp(recovery.acclimatizationUntil) <= nowMs);
  const exhibitionRecoveryAttention = new Set([
    ...exhibitionRecoveryConflicts.map(({ watch }) => watch.id),
    ...blockedExhibitionRecoveryChecks.map((check) => check.exhibitionRecoveryId),
    ...dueExhibitionRecoveries.map((recovery) => recovery.id),
  ]).size;
  const curatorialAttentionProjects = curation.projects.filter((item) =>
    !["approved", "closed", "void"].includes(item.project.status) &&
    (item.summary.blocked > 0 || item.project.decision === "revise" || item.project.status === "in_review" && !item.summary.approvalReady),
  );
  const interpretationAttentionPackages = interpretation.packages.filter((item) =>
    !["approved", "closed", "void"].includes(item.package.status) &&
    ((item.package.status === "in_review" && !item.summary.approvalReady) || item.package.decision === "revise"),
  );
  const exhibitionDeliveryAttentionPackages = exhibitionDelivery.packages.filter((item) =>
    !["approved", "closed", "void"].includes(item.package.status) &&
    ((item.package.status === "in_review" && !item.summary.approvalReady) || item.package.decision === "revise"),
  );
  const exhibitionInstallationAttentionGates = exhibitionInstallation.gates.filter((item) =>
    !["approved", "closed", "void"].includes(item.gate.status) &&
    (item.summary.upcomingUnapproved || item.gate.decision === "rework" || item.summary.attentionChecks + item.summary.blockedChecks > 0 || item.gate.status === "in_review" && !item.summary.approvalReady),
  );
  const exhibitionOpeningAttentionGates = exhibitionOpening.gates.filter((item) =>
    !["approved", "closed", "void"].includes(item.gate.status) &&
    (item.summary.upcomingUnapproved || item.gate.decision === "rework" || item.summary.attentionItems + item.summary.blockedItems > 0 || item.gate.status === "in_review" && !item.summary.approvalReady),
  );

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
      id: "production-acceptance",
      label: "成衣实物验收",
      detail:
        productionAcceptanceConflicts.length === 0 &&
        failedProductionAcceptanceChecks.length === 0
          ? "所有有效 NERA-GO 均有人工成衣验收，且没有开放的失败核对。"
          : `有 ${productionAcceptanceConflicts.length} 个生产放行尚未形成通过验收，${failedProductionAcceptanceChecks.length} 项实物核对失败。`,
      passed:
        productionAcceptanceConflicts.length === 0 &&
        failedProductionAcceptanceChecks.length === 0,
      href: "#production-acceptance",
    },
    {
      id: "provenance-dossier",
      label: "溯源档案发布",
      detail:
        provenanceDossierConflicts.length === 0 &&
        failedProvenanceDossierChecks.length === 0
          ? "所有已验收实物版本均有人工发布的溯源档案，且没有失败的公开核对。"
          : `有 ${provenanceDossierConflicts.length} 个已验收版本尚未形成公开档案，${failedProvenanceDossierChecks.length} 项公开核对失败。`,
      passed:
        provenanceDossierConflicts.length === 0 &&
        failedProvenanceDossierChecks.length === 0,
      href: "#provenance-dossier",
    },
    {
      id: "conservation",
      label: "作品养护状态",
      detail:
        criticalConservationChecks.length === 0 &&
        overdueConservationReports.length === 0
          ? "没有未解决的高风险养护问题或逾期复查。"
          : `有 ${criticalConservationChecks.length} 项高风险养护问题、${overdueConservationReports.length} 份逾期复查需要人工处理。`,
      passed:
        criticalConservationChecks.length === 0 &&
        overdueConservationReports.length === 0,
      href: "#conservation-atelier",
    },
    {
      id: "exhibition-readiness",
      label: "展陈安全放行",
      detail:
        blockedExhibitionChecks.length === 0 &&
        upcomingUnapprovedExhibitionPlans.length === 0 &&
        overdueExhibitionPlans.length === 0
          ? "没有关键展陈阻塞、临近未批准安装或逾期撤展。"
          : `有 ${blockedExhibitionChecks.length} 项关键条件阻塞、${upcomingUnapprovedExhibitionPlans.length} 个临近安装尚未批准、${overdueExhibitionPlans.length} 个方案已逾期撤展。`,
      passed:
        blockedExhibitionChecks.length === 0 &&
        upcomingUnapprovedExhibitionPlans.length === 0 &&
        overdueExhibitionPlans.length === 0,
      href: "#exhibition-readiness",
    },
    {
      id: "exhibition-watch",
      label: "展期监测闭环",
      detail:
        missingExhibitionWatches.length === 0 && overdueExhibitionWatches.length === 0 && attentionExhibitionWatches.length === 0
          ? "所有在展作品均已进入监测，没有逾期检查或未处理的最新异常。"
          : `有 ${missingExhibitionWatches.length} 个在展方案尚未开启监测、${overdueExhibitionWatches.length} 条监测逾期、${attentionExhibitionWatches.length} 条最新观察需要人工判断。`,
      passed: missingExhibitionWatches.length === 0 && overdueExhibitionWatches.length === 0 && attentionExhibitionWatches.length === 0,
      href: "#exhibition-watch",
    },
    {
      id: "exhibition-recovery",
      label: "展后复原闭环",
      detail:
        exhibitionRecoveryConflicts.length === 0 && blockedExhibitionRecoveryChecks.length === 0 && dueExhibitionRecoveries.length === 0
          ? "所有已撤展作品均已形成回库、转养护或作废的人工冻结结论。"
          : `有 ${exhibitionRecoveryConflicts.length} 件撤展作品尚未闭环、${blockedExhibitionRecoveryChecks.length} 项关键复原核对阻塞、${dueExhibitionRecoveries.length} 件作品已到静置复核时间。`,
      passed: exhibitionRecoveryConflicts.length === 0 && blockedExhibitionRecoveryChecks.length === 0 && dueExhibitionRecoveries.length === 0,
      href: "#exhibition-recovery",
    },
    {
      id: "archive-curation",
      label: "档案策展评审",
      detail: curatorialAttentionProjects.length === 0
        ? "没有受实物状态阻塞或等待修改的开放策展评审。"
        : `有 ${curatorialAttentionProjects.length} 个策展项目需要补齐选择依据、处理实物边界或重新判断。`,
      passed: curatorialAttentionProjects.length === 0,
      href: "#archive-curation",
    },
    {
      id: "exhibition-interpretation",
      label: "展览释读评审",
      detail: interpretationAttentionPackages.length === 0
        ? "没有等待补齐事实、权利或无障碍文字的开放释读评审。"
        : `有 ${interpretationAttentionPackages.length} 个释读修订需要补齐文字事实或重新判断。`,
      passed: interpretationAttentionPackages.length === 0,
      href: "#exhibition-interpretation",
    },
    {
      id: "exhibition-delivery",
      label: "展览交付签核",
      detail: exhibitionDeliveryAttentionPackages.length === 0
        ? "没有等待校样、补齐交接事实或重新判断的开放交付包。"
        : `有 ${exhibitionDeliveryAttentionPackages.length} 个展览交付包需要完成校样或重新判断。`,
      passed: exhibitionDeliveryAttentionPackages.length === 0,
      href: "#exhibition-delivery",
    },
    {
      id: "exhibition-installation",
      label: "展览装校验收",
      detail: exhibitionInstallationAttentionGates.length === 0
        ? "没有临近开放、等待整改或缺少现场证据的装校签核。"
        : `有 ${exhibitionInstallationAttentionGates.length} 个现场装校签核需要复验或人工判断。`,
      passed: exhibitionInstallationAttentionGates.length === 0,
      href: "#exhibition-installation",
    },
    {
      id: "exhibition-opening",
      label: "展览开放签核",
      detail: exhibitionOpeningAttentionGates.length === 0
        ? "没有临近开放、作品未就绪或等待人工决定的开放总签核。"
        : `有 ${exhibitionOpeningAttentionGates.length} 个开放总签核需要补齐作品事实或重新判断。`,
      passed: exhibitionOpeningAttentionGates.length === 0,
      href: "#exhibition-opening",
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
    productionAcceptanceConflicts,
    failedProductionAcceptanceChecks,
    productionAcceptances,
    provenanceDossierConflicts,
    failedProvenanceDossierChecks,
    provenanceDossiers,
    criticalConservationChecks,
    overdueConservationReports,
    conservationReports,
    assetById,
    blockedExhibitionChecks,
    upcomingUnapprovedExhibitionPlans,
    overdueExhibitionPlans,
    exhibitionPlans,
    missingExhibitionWatches,
    overdueExhibitionWatches,
    attentionExhibitionWatches,
    exhibitionWatches,
    latestObservationByWatch,
    exhibitionRecoveryConflicts,
    blockedExhibitionRecoveryChecks,
    dueExhibitionRecoveries,
    curatorialAttentionProjects,
    interpretationAttentionPackages,
    exhibitionDeliveryAttentionPackages,
    exhibitionInstallationAttentionGates,
    exhibitionOpeningAttentionGates,
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
    productionAcceptances: productionAcceptances.length,
    productionAcceptanceAttention,
    provenanceDossiers: provenanceDossiers.length,
    provenanceDossierAttention,
    conservationReports: conservationReports.length,
    conservationAttention,
    exhibitionPlans: exhibitionPlans.length,
    exhibitionAttention,
    exhibitionWatches: exhibitionWatches.length,
    exhibitionWatchAttention,
    exhibitionRecoveries: exhibitionRecoveries.length,
    exhibitionRecoveryAttention,
    curatorialProjects: curation.metrics.total,
    curatorialAttention: curatorialAttentionProjects.length,
    interpretationPackages: interpretation.metrics.total,
    interpretationAttention: interpretationAttentionPackages.length,
    exhibitionDeliveryPackages: exhibitionDelivery.metrics.total,
    exhibitionDeliveryAttention: exhibitionDeliveryAttentionPackages.length,
    exhibitionInstallationGates: exhibitionInstallation.metrics.total,
    exhibitionInstallationAttention: exhibitionInstallationAttentionGates.length,
    exhibitionOpeningGates: exhibitionOpening.metrics.total,
    exhibitionOpeningAttention: exhibitionOpeningAttentionGates.length,
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
  productionAcceptanceConflicts: Array<{
    release: Awaited<ReturnType<typeof listAllProductionReleases>>[number];
    latest:
      | Awaited<ReturnType<typeof listAllProductionAcceptances>>[number]
      | null;
  }>;
  failedProductionAcceptanceChecks: Awaited<
    ReturnType<typeof listAllProductionAcceptanceChecks>
  >;
  productionAcceptances: Awaited<
    ReturnType<typeof listAllProductionAcceptances>
  >;
  provenanceDossierConflicts: Array<{
    acceptance: Awaited<ReturnType<typeof listAllProductionAcceptances>>[number];
    latest:
      | Awaited<ReturnType<typeof listAllProvenanceDossiers>>[number]
      | null;
  }>;
  failedProvenanceDossierChecks: Awaited<
    ReturnType<typeof listAllProvenanceDossierChecks>
  >;
  provenanceDossiers: Awaited<ReturnType<typeof listAllProvenanceDossiers>>;
  criticalConservationChecks: Awaited<
    ReturnType<typeof listAllConservationReportChecks>
  >;
  overdueConservationReports: Awaited<
    ReturnType<typeof listAllConservationReports>
  >;
  conservationReports: Awaited<ReturnType<typeof listAllConservationReports>>;
  blockedExhibitionChecks: Awaited<
    ReturnType<typeof listAllExhibitionReadinessChecks>
  >;
  upcomingUnapprovedExhibitionPlans: Awaited<
    ReturnType<typeof listAllExhibitionReadinessPlans>
  >;
  overdueExhibitionPlans: Awaited<
    ReturnType<typeof listAllExhibitionReadinessPlans>
  >;
  exhibitionPlans: Awaited<ReturnType<typeof listAllExhibitionReadinessPlans>>;
  missingExhibitionWatches: Awaited<ReturnType<typeof listAllExhibitionReadinessPlans>>;
  overdueExhibitionWatches: Awaited<ReturnType<typeof listAllExhibitionWatches>>;
  attentionExhibitionWatches: Awaited<ReturnType<typeof listAllExhibitionWatches>>;
  exhibitionWatches: Awaited<ReturnType<typeof listAllExhibitionWatches>>;
  latestObservationByWatch: Map<string, Awaited<ReturnType<typeof listAllExhibitionWatchObservations>>[number]>;
  exhibitionRecoveryConflicts: Array<{
    watch: Awaited<ReturnType<typeof listAllExhibitionWatches>>[number];
    recovery: Awaited<ReturnType<typeof listAllExhibitionRecoveries>>[number] | null;
  }>;
  blockedExhibitionRecoveryChecks: Awaited<ReturnType<typeof listAllExhibitionRecoveryChecks>>;
  dueExhibitionRecoveries: Awaited<ReturnType<typeof listAllExhibitionRecoveries>>;
  curatorialAttentionProjects: CuratorialWorkspace[];
  interpretationAttentionPackages: InterpretationWorkspace[];
  exhibitionDeliveryAttentionPackages: ExhibitionDeliveryWorkspace[];
  exhibitionInstallationAttentionGates: ExhibitionInstallationWorkspace[];
  exhibitionOpeningAttentionGates: ExhibitionOpeningWorkspace[];
  assetById: Map<
    string,
    Awaited<ReturnType<typeof listAllSampleAssets>>[number]
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

  input.productionAcceptanceConflicts
    .slice(0, 6)
    .forEach(({ release, latest }) => {
      const work = input.workById.get(release.workId);
      items.push({
        id: `production-acceptance-${release.id}`,
        kind: "productionAcceptance",
        eyebrow: "EDITION ACCEPTANCE / 实物缺口",
        title: work?.title ?? release.releaseCode,
        detail: [
          release.authorizationCode,
          latest?.acceptanceCode,
          latest ? "当前验收尚未通过" : "尚未建立成衣验收",
        ]
          .filter(Boolean)
          .join(" · "),
        dueAt: latest?.receivedAt ?? release.plannedWindowEnd,
        urgency: "attention",
        href: "#production-acceptance",
        collectionId: input.collectionIdByWorkId.get(release.workId) ?? null,
      });
    });

  const acceptanceById = new Map(
    input.productionAcceptances.map((acceptance) => [acceptance.id, acceptance]),
  );
  input.failedProductionAcceptanceChecks.slice(0, 8).forEach((check) => {
    const acceptance = acceptanceById.get(check.productionAcceptanceId);
    const work = acceptance ? input.workById.get(acceptance.workId) : null;
    items.push({
      id: `production-acceptance-check-${check.id}`,
      kind: "productionAcceptance",
      eyebrow: "PHYSICAL CHECK / 核对失败",
      title: check.title,
      detail: [
        acceptance?.acceptanceCode,
        work?.title,
        check.observation || check.requirement,
      ]
        .filter(Boolean)
        .join(" · "),
      dueAt: acceptance?.inspectedAt ?? acceptance?.receivedAt ?? null,
      urgency: "attention",
      href: "#production-acceptance",
      collectionId: acceptance
        ? input.collectionIdByWorkId.get(acceptance.workId) ?? null
        : null,
    });
  });

  input.provenanceDossierConflicts.slice(0, 6).forEach(({ acceptance, latest }) => {
    const work = input.workById.get(acceptance.workId);
    items.push({
      id: `provenance-dossier-${acceptance.id}`,
      kind: "provenanceDossier",
      eyebrow: "PROVENANCE DOSSIER / 公开档案缺口",
      title: work?.title ?? acceptance.acceptanceCode,
      detail: [
        acceptance.acceptanceSeal,
        latest?.dossierCode,
        latest ? "当前修订尚未发布" : "尚未建立溯源档案",
      ]
        .filter(Boolean)
        .join(" · "),
      dueAt: latest?.reviewedAt ?? acceptance.acceptedAt,
      urgency: "attention",
      href: "#provenance-dossier",
      collectionId: input.collectionIdByWorkId.get(acceptance.workId) ?? null,
    });
  });

  const provenanceDossierById = new Map(
    input.provenanceDossiers.map((dossier) => [dossier.id, dossier]),
  );
  input.failedProvenanceDossierChecks.slice(0, 8).forEach((check) => {
    const dossier = provenanceDossierById.get(check.provenanceDossierId);
    const work = dossier ? input.workById.get(dossier.workId) : null;
    items.push({
      id: `provenance-dossier-check-${check.id}`,
      kind: "provenanceDossier",
      eyebrow: "PUBLIC CHECK / 公开核对失败",
      title: check.title,
      detail: [
        dossier?.dossierCode,
        work?.title,
        check.observation || check.requirement,
      ]
        .filter(Boolean)
        .join(" · "),
      dueAt: dossier?.reviewedAt ?? null,
      urgency: "attention",
      href: "#provenance-dossier",
      collectionId: dossier
        ? input.collectionIdByWorkId.get(dossier.workId) ?? null
        : null,
    });
  });

  input.overdueConservationReports.slice(0, 8).forEach((report) => {
    const asset = input.assetById.get(report.sampleAssetId);
    const work = report.workId ? input.workById.get(report.workId) : null;
    items.push({
      id: `conservation-review-${report.id}`,
      kind: "conservation",
      eyebrow: "CONSERVATION / 复查逾期",
      title: work?.title ?? asset?.workTitle ?? report.reportCode,
      detail: [report.reportCode, asset?.assetCode, report.conditionSummary]
        .filter(Boolean)
        .join(" · "),
      dueAt: report.nextReviewAt,
      urgency: "overdue",
      href: "#conservation-atelier",
      collectionId: report.workId
        ? input.collectionIdByWorkId.get(report.workId) ?? null
        : null,
    });
  });

  const conservationReportById = new Map(
    input.conservationReports.map((report) => [report.id, report]),
  );
  input.criticalConservationChecks.slice(0, 8).forEach((check) => {
    const report = conservationReportById.get(check.conservationReportId);
    const asset = report ? input.assetById.get(report.sampleAssetId) : null;
    const work = report?.workId ? input.workById.get(report.workId) : null;
    items.push({
      id: `conservation-check-${check.id}`,
      kind: "conservation",
      eyebrow: "CONDITION CHECK / 高风险养护",
      title: check.title,
      detail: [
        report?.reportCode,
        work?.title ?? asset?.workTitle,
        check.observation || check.requirement,
      ]
        .filter(Boolean)
        .join(" · "),
      dueAt: report?.nextReviewAt ?? null,
      urgency: "attention",
      href: "#conservation-atelier",
      collectionId: report?.workId
        ? input.collectionIdByWorkId.get(report.workId) ?? null
        : null,
    });
  });

  [...input.overdueExhibitionPlans, ...input.upcomingUnapprovedExhibitionPlans]
    .slice(0, 8)
    .forEach((plan) => {
      const asset = input.assetById.get(plan.sampleAssetId);
      const work = plan.workId ? input.workById.get(plan.workId) : null;
      const overdue = input.overdueExhibitionPlans.some((item) => item.id === plan.id);
      items.push({
        id: `exhibition-plan-${plan.id}`,
        kind: "exhibition",
        eyebrow: overdue ? "EXHIBITION / 撤展逾期" : "EXHIBITION / 安装待放行",
        title: plan.title || work?.title || asset?.workTitle || plan.planCode,
        detail: [plan.planCode, plan.venue, overdue ? "等待撤展关闭" : "安装前尚未批准"]
          .filter(Boolean)
          .join(" · "),
        dueAt: overdue ? plan.deinstallAt : plan.installAt,
        urgency: overdue ? "overdue" : "attention",
        href: "#exhibition-readiness",
        collectionId: plan.workId
          ? input.collectionIdByWorkId.get(plan.workId) ?? null
          : null,
      });
    });

  const exhibitionPlanById = new Map(
    input.exhibitionPlans.map((plan) => [plan.id, plan]),
  );
  input.blockedExhibitionChecks.slice(0, 8).forEach((check) => {
    const plan = exhibitionPlanById.get(check.exhibitionReadinessPlanId);
    const work = plan?.workId ? input.workById.get(plan.workId) : null;
    items.push({
      id: `exhibition-check-${check.id}`,
      kind: "exhibition",
      eyebrow: "DISPLAY CHECK / 关键条件阻塞",
      title: check.title,
      detail: [plan?.planCode, work?.title, check.observation || check.requirement]
        .filter(Boolean)
        .join(" · "),
      dueAt: plan?.installAt ?? null,
      urgency: "attention",
      href: "#exhibition-readiness",
      collectionId: plan?.workId
        ? input.collectionIdByWorkId.get(plan.workId) ?? null
        : null,
    });
  });

  input.missingExhibitionWatches.slice(0, 6).forEach((plan) => {
    const asset = input.assetById.get(plan.sampleAssetId);
    const work = plan.workId ? input.workById.get(plan.workId) : null;
    items.push({
      id: `exhibition-watch-missing-${plan.id}`,
      kind: "exhibitionWatch",
      eyebrow: "EXHIBITION WATCH / 监测未开启",
      title: plan.title || work?.title || asset?.workTitle || plan.planCode,
      detail: [plan.planCode, plan.venue, "作品已进入展示窗口但尚未建立现场监测"].filter(Boolean).join(" · "),
      dueAt: plan.installAt,
      urgency: "attention",
      href: "#exhibition-watch",
      collectionId: plan.workId ? input.collectionIdByWorkId.get(plan.workId) ?? null : null,
    });
  });

  [...input.overdueExhibitionWatches, ...input.attentionExhibitionWatches]
    .slice(0, 8)
    .forEach((watch) => {
      const plan = input.exhibitionPlans.find((item) => item.id === watch.exhibitionReadinessPlanId);
      const asset = input.assetById.get(watch.sampleAssetId);
      const work = plan?.workId ? input.workById.get(plan.workId) : null;
      const overdue = input.overdueExhibitionWatches.some((item) => item.id === watch.id);
      const latest = input.latestObservationByWatch.get(watch.id);
      items.push({
        id: `exhibition-watch-${watch.id}`,
        kind: "exhibitionWatch",
        eyebrow: overdue ? "EXHIBITION WATCH / 检查逾期" : "EXHIBITION WATCH / 现场异常",
        title: plan?.title || work?.title || asset?.workTitle || watch.watchCode,
        detail: [watch.watchCode, plan?.venue, latest?.observation || (overdue ? "已超过人工设定的检查间隔" : "最新观察需要人工处置")].filter(Boolean).join(" · "),
        dueAt: overdue ? watch.lastObservedAt || watch.openedAt : latest?.observedAt ?? null,
        urgency: overdue ? "overdue" : "attention",
        href: "#exhibition-watch",
        collectionId: plan?.workId ? input.collectionIdByWorkId.get(plan.workId) ?? null : null,
      });
    });

  input.exhibitionRecoveryConflicts.slice(0, 8).forEach(({ watch, recovery }) => {
    const plan = input.exhibitionPlans.find((item) => item.id === watch.exhibitionReadinessPlanId);
    const asset = input.assetById.get(watch.sampleAssetId);
    const work = plan?.workId ? input.workById.get(plan.workId) : null;
    items.push({
      id: `exhibition-recovery-${recovery?.id ?? watch.id}`,
      kind: "exhibitionRecovery",
      eyebrow: recovery ? "EXHIBITION RECOVERY / 复原未闭环" : "EXHIBITION RECOVERY / 撤展待接收",
      title: plan?.title || work?.title || asset?.workTitle || watch.watchCode,
      detail: [watch.watchCode, recovery?.recoveryCode, recovery ? "等待回库或转养护的人工结论" : "撤展后尚未建立接收与复原记录"].filter(Boolean).join(" · "),
      dueAt: recovery?.acclimatizationUntil ?? watch.deinstalledAt,
      urgency: recovery?.status === "stabilizing" && recovery.acclimatizationUntil && timestamp(recovery.acclimatizationUntil) <= nowMs ? "today" : "attention",
      href: "#exhibition-recovery",
      collectionId: plan?.workId ? input.collectionIdByWorkId.get(plan.workId) ?? null : null,
    });
  });

  input.blockedExhibitionRecoveryChecks.slice(0, 6).forEach((check) => {
    items.push({
      id: `exhibition-recovery-check-${check.id}`,
      kind: "exhibitionRecovery",
      eyebrow: "RECOVERY CHECK / 关键复原阻塞",
      title: check.title,
      detail: check.observation || check.requirement,
      dueAt: null,
      urgency: "attention",
      href: "#exhibition-recovery",
      collectionId: null,
    });
  });

  input.curatorialAttentionProjects.slice(0, 8).forEach((workspace) => {
    items.push({
      id: `curation-${workspace.project.id}`,
      kind: "curation",
      eyebrow: workspace.summary.blocked > 0 ? "ARCHIVE CURATION / 实物边界阻塞" : "ARCHIVE CURATION / 等待策展判断",
      title: workspace.project.title,
      detail: [workspace.project.projectCode, workspace.project.curator, workspace.summary.blocked > 0 ? `${workspace.summary.blocked} 件纳入作品当前不宜展示` : workspace.summary.missingFields.slice(0, 3).join("、")].filter(Boolean).join(" · "),
      dueAt: workspace.project.openingAt,
      urgency: workspace.summary.blocked > 0 ? "attention" : urgencyForDate(workspace.project.openingAt, input.now),
      href: "#archive-curation",
      collectionId: null,
    });
  });

  input.interpretationAttentionPackages.slice(0, 8).forEach((workspace) => {
    items.push({
      id: `interpretation-${workspace.package.id}`,
      kind: "interpretation",
      eyebrow: "EXHIBITION INTERPRETATION / 等待文字判断",
      title: workspace.package.title || workspace.project?.title || workspace.package.packageCode,
      detail: [workspace.package.packageCode, workspace.package.editor, workspace.summary.missingFields.slice(0, 3).join("、")].filter(Boolean).join(" · "),
      dueAt: null,
      urgency: "attention",
      href: "#exhibition-interpretation",
      collectionId: null,
    });
  });

  input.exhibitionDeliveryAttentionPackages.slice(0, 8).forEach((workspace) => {
    items.push({
      id: `exhibition-delivery-${workspace.package.id}`,
      kind: "exhibitionDelivery",
      eyebrow: "EXHIBITION DELIVERY / 等待交付校样",
      title: workspace.package.masterTitle || workspace.interpretation?.title || workspace.package.deliveryCode,
      detail: [workspace.package.deliveryCode, workspace.package.ownerName, `${workspace.summary.readyCount}/${workspace.summary.expectedCount} READY`, workspace.summary.missingFields.slice(0, 2).join("、")].filter(Boolean).join(" · "),
      dueAt: workspace.package.deliveryAt,
      urgency: urgencyForDate(workspace.package.deliveryAt, input.now),
      href: "#exhibition-delivery",
      collectionId: null,
    });
  });

  input.exhibitionInstallationAttentionGates.slice(0, 8).forEach((workspace) => {
    items.push({
      id: `exhibition-installation-${workspace.gate.id}`,
      kind: "exhibitionInstallation",
      eyebrow: "EXHIBITION INSTALLATION / 等待现场验收",
      title: workspace.delivery?.masterTitle || workspace.gate.gateCode,
      detail: [workspace.gate.gateCode, workspace.gate.leadName, `${workspace.summary.passedChecks}/${workspace.summary.expectedChecks} PASS`, workspace.summary.missingFields.slice(0, 2).join("、")].filter(Boolean).join(" · "),
      dueAt: workspace.gate.openingAt,
      urgency: urgencyForDate(workspace.gate.openingAt, input.now),
      href: "#exhibition-installation",
      collectionId: null,
    });
  });

  input.exhibitionOpeningAttentionGates.slice(0, 8).forEach((workspace) => {
    items.push({
      id: `exhibition-opening-${workspace.gate.id}`,
      kind: "exhibitionOpening",
      eyebrow: "EXHIBITION OPENING / 等待开放授权",
      title: workspace.project?.project.title || workspace.gate.openingCode,
      detail: [workspace.gate.openingCode, workspace.gate.openingLead, `${workspace.summary.readyItems}/${workspace.summary.expectedItems} READY`, workspace.summary.missingFields.slice(0, 2).join("、")].filter(Boolean).join(" · "),
      dueAt: workspace.gate.plannedOpeningAt,
      urgency: urgencyForDate(workspace.gate.plannedOpeningAt, input.now),
      href: "#exhibition-opening",
      collectionId: null,
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
  productionAcceptances: number;
  productionAcceptanceAttention: number;
  provenanceDossiers: number;
  provenanceDossierAttention: number;
  conservationReports: number;
  conservationAttention: number;
  exhibitionPlans: number;
  exhibitionAttention: number;
  exhibitionWatches: number;
  exhibitionWatchAttention: number;
  exhibitionRecoveries: number;
  exhibitionRecoveryAttention: number;
  curatorialProjects: number;
  curatorialAttention: number;
  interpretationPackages: number;
  interpretationAttention: number;
  exhibitionDeliveryPackages: number;
  exhibitionDeliveryAttention: number;
  exhibitionInstallationGates: number;
  exhibitionInstallationAttention: number;
  exhibitionOpeningGates: number;
  exhibitionOpeningAttention: number;
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
    moduleItem("26", "CREATE", "成衣验收台", "EDITION ACCEPTANCE", "#production-acceptance", input.productionAcceptances, "RECEIPTS", input.productionAcceptanceAttention > 0 ? "attention" : input.productionAcceptances > 0 ? "active" : "clear"),
    moduleItem("27", "PUBLISH", "成衣溯源档案", "PROVENANCE DOSSIER", "#provenance-dossier", input.provenanceDossiers, "DOSSIERS", input.provenanceDossierAttention > 0 ? "attention" : input.provenanceDossiers > 0 ? "clear" : "active"),
    moduleItem("28", "ARCHIVE", "作品养护室", "CONSERVATION", "#conservation-atelier", input.conservationReports, "REPORTS", input.conservationAttention > 0 ? "attention" : input.conservationReports > 0 ? "clear" : "active"),
    moduleItem("29", "PUBLISH", "展陈准备室", "EXHIBITION READINESS", "#exhibition-readiness", input.exhibitionPlans, "PLANS", input.exhibitionAttention > 0 ? "attention" : input.exhibitionPlans > 0 ? "clear" : "active"),
    moduleItem("30", "ARCHIVE", "展期监测台", "EXHIBITION WATCH", "#exhibition-watch", input.exhibitionWatches, "WATCHES", input.exhibitionWatchAttention > 0 ? "attention" : input.exhibitionWatches > 0 ? "clear" : "active"),
    moduleItem("31", "ARCHIVE", "展后复原室", "EXHIBITION RECOVERY", "#exhibition-recovery", input.exhibitionRecoveries, "RECOVERIES", input.exhibitionRecoveryAttention > 0 ? "attention" : input.exhibitionRecoveries > 0 ? "clear" : "active"),
    moduleItem("32", "CREATE", "档案策展室", "ARCHIVE CURATION", "#archive-curation", input.curatorialProjects, "PROJECTS", input.curatorialAttention > 0 ? "attention" : input.curatorialProjects > 0 ? "clear" : "active"),
    moduleItem("33", "PUBLISH", "展览释读室", "EXHIBITION INTERPRETATION", "#exhibition-interpretation", input.interpretationPackages, "PACKAGES", input.interpretationAttention > 0 ? "attention" : input.interpretationPackages > 0 ? "clear" : "active"),
    moduleItem("34", "PUBLISH", "展览交付台", "EXHIBITION DELIVERY", "#exhibition-delivery", input.exhibitionDeliveryPackages, "PACKAGES", input.exhibitionDeliveryAttention > 0 ? "attention" : input.exhibitionDeliveryPackages > 0 ? "clear" : "active"),
    moduleItem("35", "PUBLISH", "展览装校签核台", "INSTALLATION GATE", "#exhibition-installation", input.exhibitionInstallationGates, "GATES", input.exhibitionInstallationAttention > 0 ? "attention" : input.exhibitionInstallationGates > 0 ? "clear" : "active"),
    moduleItem("36", "PUBLISH", "展览开放总签核", "OPENING GATE", "#exhibition-opening", input.exhibitionOpeningGates, "GATES", input.exhibitionOpeningAttention > 0 ? "attention" : input.exhibitionOpeningGates > 0 ? "clear" : "active"),
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
