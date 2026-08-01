import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  relationshipActivities,
  relationshipContacts,
  relationshipOpportunities,
  type RelationshipActivity,
  type RelationshipContact,
  type RelationshipOpportunity,
} from "@/db/schema";
import { listSamplePlacementWorkspaces } from "@/lib/sample-placements";
import { listShowroomRequestWorkspaces } from "@/lib/showroom-requests";

export const RELATIONSHIP_CONTACT_TYPES = [
  "editor",
  "stylist",
  "buyer",
  "talent_team",
  "influencer",
  "media",
  "partner",
  "production",
  "other",
] as const;

export const RELATIONSHIP_TIERS = [
  "priority",
  "core",
  "developing",
  "dormant",
] as const;

export const RELATIONSHIP_CONTACT_STATUSES = [
  "active",
  "paused",
  "archived",
] as const;

export const RELATIONSHIP_CONTACTABILITY = [
  "unknown",
  "business_context",
  "opted_in",
  "do_not_contact",
] as const;

export const RELATIONSHIP_CHANNELS = [
  "email",
  "phone",
  "messaging",
  "in_person",
  "none",
] as const;

export const RELATIONSHIP_SOURCE_TYPES = [
  "manual",
  "showroom_request",
  "sample_loan",
  "placement",
  "publication",
  "other",
] as const;

export const RELATIONSHIP_OPPORTUNITY_KINDS = [
  "editorial",
  "dressing",
  "buyer",
  "press",
  "partnership",
  "event",
  "content",
  "other",
] as const;

export const RELATIONSHIP_OPPORTUNITY_STAGES = [
  "signal",
  "qualified",
  "ready",
  "conversation",
  "sample",
  "active",
  "won",
  "lost",
  "on_hold",
] as const;

export const RELATIONSHIP_PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
] as const;

export const RELATIONSHIP_ACTIVITY_KINDS = [
  "note",
  "email",
  "call",
  "meeting",
  "introduction",
  "sample",
  "coverage",
  "follow_up",
  "other",
] as const;

export const RELATIONSHIP_ACTIVITY_CHANNELS = [
  "email",
  "phone",
  "messaging",
  "in_person",
  "internal",
] as const;

export const RELATIONSHIP_ACTIVITY_DIRECTIONS = [
  "inbound",
  "outbound",
  "internal",
] as const;

export const RELATIONSHIP_ACTIVITY_STATUSES = [
  "planned",
  "completed",
  "cancelled",
] as const;

export type RelationshipContactType =
  (typeof RELATIONSHIP_CONTACT_TYPES)[number];
export type RelationshipTier = (typeof RELATIONSHIP_TIERS)[number];
export type RelationshipContactStatus =
  (typeof RELATIONSHIP_CONTACT_STATUSES)[number];
export type RelationshipContactability =
  (typeof RELATIONSHIP_CONTACTABILITY)[number];
export type RelationshipChannel = (typeof RELATIONSHIP_CHANNELS)[number];
export type RelationshipSourceType =
  (typeof RELATIONSHIP_SOURCE_TYPES)[number];
export type RelationshipOpportunityKind =
  (typeof RELATIONSHIP_OPPORTUNITY_KINDS)[number];
export type RelationshipOpportunityStage =
  (typeof RELATIONSHIP_OPPORTUNITY_STAGES)[number];
export type RelationshipPriority =
  (typeof RELATIONSHIP_PRIORITIES)[number];
export type RelationshipActivityKind =
  (typeof RELATIONSHIP_ACTIVITY_KINDS)[number];
export type RelationshipActivityChannel =
  (typeof RELATIONSHIP_ACTIVITY_CHANNELS)[number];
export type RelationshipActivityDirection =
  (typeof RELATIONSHIP_ACTIVITY_DIRECTIONS)[number];
export type RelationshipActivityStatus =
  (typeof RELATIONSHIP_ACTIVITY_STATUSES)[number];

export type RelationshipCandidate = {
  id: string;
  name: string;
  organization: string;
  roleTitle: string;
  contactType: RelationshipContactType;
  email: string;
  market: string;
  contactability: RelationshipContactability;
  sourceType: RelationshipSourceType;
  sourceId: string;
  sourceLabel: string;
  lastSeenAt: string;
  signalCount: number;
};

export type RelationshipContactWorkspace = {
  contact: RelationshipContact;
  tags: string[];
  completeness: number;
  openOpportunityCount: number;
  lastActivityAt: string | null;
  nextActionAt: string | null;
  opportunities: RelationshipOpportunity[];
  activities: RelationshipActivity[];
};

export type RelationshipAgendaItem = {
  id: string;
  kind: "contact" | "opportunity" | "activity";
  contactId: string;
  contactName: string;
  opportunityId: string | null;
  title: string;
  detail: string;
  dueAt: string;
  overdue: boolean;
  priority: RelationshipPriority | "normal";
};

export type RelationshipOverview = {
  generatedAt: string;
  metrics: {
    contactCount: number;
    activeContactCount: number;
    openOpportunityCount: number;
    wonOpportunityCount: number;
    overdueCount: number;
    nextSevenDaysCount: number;
    recentTouchpointCount: number;
    profileCompleteness: number;
    opportunityWithoutNextActionCount: number;
    candidateCount: number;
  };
  pipeline: Array<{
    stage: RelationshipOpportunityStage;
    count: number;
  }>;
  breakdowns: {
    contactTypes: RelationshipBreakdown[];
    tiers: RelationshipBreakdown[];
    markets: RelationshipBreakdown[];
  };
  agenda: RelationshipAgendaItem[];
  contacts: RelationshipContactWorkspace[];
  opportunities: RelationshipOpportunity[];
  activities: RelationshipActivity[];
  candidates: RelationshipCandidate[];
};

export type RelationshipBreakdown = {
  key: string;
  count: number;
  share: number;
};

const closedOpportunityStages = new Set<RelationshipOpportunityStage>([
  "won",
  "lost",
]);
const DAY_MS = 24 * 60 * 60 * 1000;

export async function listAllRelationshipContacts(limit = 2000) {
  const db = await getDb();
  return db
    .select()
    .from(relationshipContacts)
    .orderBy(
      asc(relationshipContacts.status),
      asc(relationshipContacts.tier),
      desc(relationshipContacts.updatedAt),
    )
    .limit(limit);
}

export async function listAllRelationshipOpportunities(limit = 4000) {
  const db = await getDb();
  return db
    .select()
    .from(relationshipOpportunities)
    .orderBy(
      desc(relationshipOpportunities.updatedAt),
      desc(relationshipOpportunities.createdAt),
    )
    .limit(limit);
}

export async function listAllRelationshipActivities(limit = 6000) {
  const db = await getDb();
  return db
    .select()
    .from(relationshipActivities)
    .orderBy(
      desc(relationshipActivities.occurredAt),
      asc(relationshipActivities.dueAt),
      desc(relationshipActivities.createdAt),
    )
    .limit(limit);
}

export async function getRelationshipContact(id: string) {
  const db = await getDb();
  const [contact] = await db
    .select()
    .from(relationshipContacts)
    .where(eq(relationshipContacts.id, id))
    .limit(1);
  return contact ?? null;
}

export async function getRelationshipOpportunity(id: string) {
  const db = await getDb();
  const [opportunity] = await db
    .select()
    .from(relationshipOpportunities)
    .where(eq(relationshipOpportunities.id, id))
    .limit(1);
  return opportunity ?? null;
}

export async function getRelationshipActivity(id: string) {
  const db = await getDb();
  const [activity] = await db
    .select()
    .from(relationshipActivities)
    .where(eq(relationshipActivities.id, id))
    .limit(1);
  return activity ?? null;
}

export async function buildRelationshipOverview(
  now = new Date(),
): Promise<RelationshipOverview> {
  const [
    contacts,
    opportunities,
    activities,
    showroomRequests,
    placements,
  ] = await Promise.all([
    listAllRelationshipContacts(),
    listAllRelationshipOpportunities(),
    listAllRelationshipActivities(),
    listShowroomRequestWorkspaces(2000),
    listSamplePlacementWorkspaces(3000),
  ]);
  const contactById = new Map(
    contacts.map((contact) => [contact.id, contact]),
  );
  const opportunitiesByContact = groupBy(
    opportunities,
    (opportunity) => opportunity.contactId,
  );
  const activitiesByContact = groupBy(
    activities,
    (activity) => activity.contactId,
  );
  const openOpportunities = opportunities.filter(
    (opportunity) =>
      !closedOpportunityStages.has(
        opportunity.stage as RelationshipOpportunityStage,
      ),
  );
  const startOfToday = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const endOfNextSevenDays = startOfToday + 8 * DAY_MS - 1;
  const recentStart = now.getTime() - 30 * DAY_MS;
  const agenda = buildAgenda({
    contacts,
    opportunities: openOpportunities,
    activities,
    contactById,
    now,
  });
  const workspaces = contacts
    .map((contact) => {
      const contactOpportunities =
        opportunitiesByContact.get(contact.id) ?? [];
      const contactActivities = activitiesByContact.get(contact.id) ?? [];
      const nextDates = [
        contact.nextFollowUpAt,
        ...contactOpportunities
          .filter(
            (opportunity) =>
              !closedOpportunityStages.has(
                opportunity.stage as RelationshipOpportunityStage,
              ),
          )
          .map((opportunity) => opportunity.nextActionAt),
        ...contactActivities
          .filter((activity) => activity.status === "planned")
          .map((activity) => activity.dueAt),
      ].filter((value): value is string => Boolean(value));
      return {
        contact,
        tags: parseTags(contact.tagsJson),
        completeness: contactCompleteness(contact),
        openOpportunityCount: contactOpportunities.filter(
          (opportunity) =>
            !closedOpportunityStages.has(
              opportunity.stage as RelationshipOpportunityStage,
            ),
        ).length,
        lastActivityAt: latestDate([
          contact.lastContactAt,
          ...contactActivities.map(
            (activity) =>
              activity.occurredAt ??
              activity.completedAt ??
              activity.createdAt,
          ),
        ]),
        nextActionAt: earliestDate(nextDates),
        opportunities: contactOpportunities,
        activities: contactActivities,
      } satisfies RelationshipContactWorkspace;
    })
    .sort(
      (left, right) =>
        tierWeight(left.contact.tier) - tierWeight(right.contact.tier) ||
        compareNullableDates(left.nextActionAt, right.nextActionAt) ||
        left.contact.name.localeCompare(right.contact.name),
    );
  const candidates = buildCandidates({
    contacts,
    showroomRequests,
    placements,
  });

  return {
    generatedAt: now.toISOString(),
    metrics: {
      contactCount: contacts.length,
      activeContactCount: contacts.filter(
        (contact) => contact.status === "active",
      ).length,
      openOpportunityCount: openOpportunities.length,
      wonOpportunityCount: opportunities.filter(
        (opportunity) => opportunity.stage === "won",
      ).length,
      overdueCount: agenda.filter((item) => item.overdue).length,
      nextSevenDaysCount: agenda.filter((item) => {
        const timestamp = dateValue(item.dueAt);
        return (
          timestamp !== null &&
          timestamp >= startOfToday &&
          timestamp <= endOfNextSevenDays
        );
      }).length,
      recentTouchpointCount: activities.filter((activity) => {
        if (activity.status !== "completed") return false;
        const timestamp = dateValue(
          activity.occurredAt ?? activity.completedAt ?? activity.updatedAt,
        );
        return timestamp !== null && timestamp >= recentStart;
      }).length,
      profileCompleteness:
        contacts.length > 0
          ? rounded(
              contacts.reduce(
                (total, contact) => total + contactCompleteness(contact),
                0,
              ) / contacts.length,
              1,
            )
          : 0,
      opportunityWithoutNextActionCount: openOpportunities.filter(
        (opportunity) =>
          !opportunity.nextAction.trim() || !opportunity.nextActionAt,
      ).length,
      candidateCount: candidates.length,
    },
    pipeline: RELATIONSHIP_OPPORTUNITY_STAGES.map((stage) => ({
      stage,
      count: opportunities.filter((opportunity) => opportunity.stage === stage)
        .length,
    })),
    breakdowns: {
      contactTypes: breakdown(
        contacts.map((contact) => contact.contactType),
        contacts.length,
      ),
      tiers: breakdown(
        contacts.map((contact) => contact.tier),
        contacts.length,
      ),
      markets: breakdown(
        contacts.map((contact) => contact.market || "未填写"),
        contacts.length,
      ),
    },
    agenda,
    contacts: workspaces,
    opportunities,
    activities,
    candidates,
  };
}

export function relationshipContactsToCsv(overview: RelationshipOverview) {
  const columns = [
    "contactCode",
    "name",
    "organization",
    "role",
    "type",
    "email",
    "phone",
    "market",
    "city",
    "tier",
    "status",
    "contactability",
    "preferredChannel",
    "sourceType",
    "sourceId",
    "tags",
    "openOpportunities",
    "profileCompleteness",
    "lastContactAt",
    "nextFollowUpAt",
    "notes",
    "createdAt",
    "updatedAt",
  ] as const;
  const lines = [columns.map(csvCell).join(",")];
  overview.contacts.forEach((workspace) => {
    const { contact } = workspace;
    lines.push(
      [
        contact.contactCode,
        contact.name,
        contact.organization,
        contact.roleTitle,
        contact.contactType,
        contact.email,
        contact.phone,
        contact.market,
        contact.city,
        contact.tier,
        contact.status,
        contact.contactability,
        contact.preferredChannel,
        contact.sourceType,
        contact.sourceId,
        workspace.tags.join(" | "),
        workspace.openOpportunityCount,
        workspace.completeness,
        contact.lastContactAt,
        contact.nextFollowUpAt,
        contact.notes,
        contact.createdAt,
        contact.updatedAt,
      ]
        .map(csvCell)
        .join(","),
    );
  });
  return `\ufeff${lines.join("\r\n")}`;
}

export function relationshipOpportunitiesToCsv(
  overview: RelationshipOverview,
) {
  const contacts = new Map(
    overview.contacts.map(({ contact }) => [contact.id, contact]),
  );
  const columns = [
    "opportunityCode",
    "title",
    "contactCode",
    "contactName",
    "organization",
    "kind",
    "stage",
    "priority",
    "collection",
    "market",
    "sourceType",
    "sourceId",
    "summary",
    "nextAction",
    "nextActionAt",
    "outcome",
    "closedAt",
    "createdAt",
    "updatedAt",
  ] as const;
  const lines = [columns.map(csvCell).join(",")];
  overview.opportunities.forEach((opportunity) => {
    const contact = contacts.get(opportunity.contactId);
    lines.push(
      [
        opportunity.opportunityCode,
        opportunity.title,
        contact?.contactCode ?? "",
        contact?.name ?? "",
        contact?.organization ?? "",
        opportunity.kind,
        opportunity.stage,
        opportunity.priority,
        opportunity.collection,
        opportunity.market,
        opportunity.sourceType,
        opportunity.sourceId,
        opportunity.summary,
        opportunity.nextAction,
        opportunity.nextActionAt,
        opportunity.outcome,
        opportunity.closedAt,
        opportunity.createdAt,
        opportunity.updatedAt,
      ]
        .map(csvCell)
        .join(","),
    );
  });
  return `\ufeff${lines.join("\r\n")}`;
}

export function relationshipActivitiesToCsv(overview: RelationshipOverview) {
  const contacts = new Map(
    overview.contacts.map(({ contact }) => [contact.id, contact]),
  );
  const opportunities = new Map(
    overview.opportunities.map((opportunity) => [
      opportunity.id,
      opportunity,
    ]),
  );
  const columns = [
    "contactCode",
    "contactName",
    "opportunityCode",
    "opportunity",
    "kind",
    "channel",
    "direction",
    "status",
    "subject",
    "notes",
    "dueAt",
    "occurredAt",
    "completedAt",
    "createdAt",
    "updatedAt",
  ] as const;
  const lines = [columns.map(csvCell).join(",")];
  overview.activities.forEach((activity) => {
    const contact = contacts.get(activity.contactId);
    const opportunity = activity.opportunityId
      ? opportunities.get(activity.opportunityId)
      : null;
    lines.push(
      [
        contact?.contactCode ?? "",
        contact?.name ?? "",
        opportunity?.opportunityCode ?? "",
        opportunity?.title ?? "",
        activity.kind,
        activity.channel,
        activity.direction,
        activity.status,
        activity.subject,
        activity.notes,
        activity.dueAt,
        activity.occurredAt,
        activity.completedAt,
        activity.createdAt,
        activity.updatedAt,
      ]
        .map(csvCell)
        .join(","),
    );
  });
  return `\ufeff${lines.join("\r\n")}`;
}

export function normalizedTags(value: unknown) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,，\n]/)
      : [];
  return Array.from(
    new Set(
      raw
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 60))
        .filter(Boolean),
    ),
  ).slice(0, 20);
}

function buildAgenda(input: {
  contacts: RelationshipContact[];
  opportunities: RelationshipOpportunity[];
  activities: RelationshipActivity[];
  contactById: Map<string, RelationshipContact>;
  now: Date;
}) {
  const items: RelationshipAgendaItem[] = [];
  input.contacts.forEach((contact) => {
    if (contact.status !== "active" || !contact.nextFollowUpAt) return;
    items.push({
      id: `contact:${contact.id}`,
      kind: "contact",
      contactId: contact.id,
      contactName: contact.name,
      opportunityId: null,
      title: "关系跟进",
      detail: contact.organization || contact.roleTitle || "联系人计划",
      dueAt: contact.nextFollowUpAt,
      overdue: isOverdue(contact.nextFollowUpAt, input.now),
      priority: contact.tier === "priority" ? "high" : "normal",
    });
  });
  input.opportunities.forEach((opportunity) => {
    if (!opportunity.nextActionAt) return;
    const contact = input.contactById.get(opportunity.contactId);
    items.push({
      id: `opportunity:${opportunity.id}`,
      kind: "opportunity",
      contactId: opportunity.contactId,
      contactName: contact?.name ?? "未找到联系人",
      opportunityId: opportunity.id,
      title: opportunity.nextAction || opportunity.title,
      detail: opportunity.title,
      dueAt: opportunity.nextActionAt,
      overdue: isOverdue(opportunity.nextActionAt, input.now),
      priority: opportunity.priority as RelationshipPriority,
    });
  });
  input.activities.forEach((activity) => {
    if (activity.status !== "planned" || !activity.dueAt) return;
    const contact = input.contactById.get(activity.contactId);
    items.push({
      id: `activity:${activity.id}`,
      kind: "activity",
      contactId: activity.contactId,
      contactName: contact?.name ?? "未找到联系人",
      opportunityId: activity.opportunityId,
      title: activity.subject,
      detail: activity.notes,
      dueAt: activity.dueAt,
      overdue: isOverdue(activity.dueAt, input.now),
      priority: "normal",
    });
  });
  return items.sort(
    (left, right) =>
      Number(right.overdue) - Number(left.overdue) ||
      (dateValue(left.dueAt) ?? Number.MAX_SAFE_INTEGER) -
        (dateValue(right.dueAt) ?? Number.MAX_SAFE_INTEGER),
  );
}

function buildCandidates(input: {
  contacts: RelationshipContact[];
  showroomRequests: Awaited<ReturnType<typeof listShowroomRequestWorkspaces>>;
  placements: Awaited<ReturnType<typeof listSamplePlacementWorkspaces>>;
}) {
  const raw: RelationshipCandidate[] = [];
  input.showroomRequests.forEach(({ request, showroom }) => {
    raw.push({
      id: `showroom_request:${request.id}`,
      name: request.requesterName,
      organization: request.organization,
      roleTitle: request.requesterRole,
      contactType: contactTypeForRequestRole(request.requesterRole),
      email: request.requesterEmail,
      market: request.deliveryCity,
      contactability: request.consent ? "business_context" : "unknown",
      sourceType: "showroom_request",
      sourceId: request.id,
      sourceLabel: `${showroom.title} · ${request.projectTitle}`,
      lastSeenAt: request.updatedAt,
      signalCount: 1,
    });
  });
  input.placements.forEach(({ placement }) => {
    if (!["placed", "published"].includes(placement.status)) return;
    const name = placement.voiceName || placement.outletName;
    if (!name) return;
    raw.push({
      id: `placement:${placement.id}`,
      name,
      organization:
        placement.voiceName && placement.outletName
          ? placement.outletName
          : "",
      roleTitle: placement.voiceType,
      contactType: contactTypeForVoice(placement.voiceType),
      email: "",
      market: placement.market || placement.country,
      contactability: "unknown",
      sourceType: "placement",
      sourceId: placement.id,
      sourceLabel: `${placement.placementCode} · ${placement.title}`,
      lastSeenAt: placement.placementDate ?? placement.updatedAt,
      signalCount: 1,
    });
  });

  const merged = new Map<string, RelationshipCandidate>();
  raw.forEach((candidate) => {
    const key = identityKey(candidate);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, candidate);
      return;
    }
    const currentTime = dateValue(current.lastSeenAt) ?? 0;
    const candidateTime = dateValue(candidate.lastSeenAt) ?? 0;
    const latest = candidateTime > currentTime ? candidate : current;
    merged.set(key, {
      ...latest,
      email: latest.email || current.email || candidate.email,
      organization:
        latest.organization ||
        current.organization ||
        candidate.organization,
      market: latest.market || current.market || candidate.market,
      contactability:
        current.contactability === "business_context" ||
        candidate.contactability === "business_context"
          ? "business_context"
          : latest.contactability,
      signalCount: current.signalCount + candidate.signalCount,
    });
  });

  const existingKeys = new Set(
    input.contacts.flatMap((contact) => contactIdentityKeys(contact)),
  );
  return Array.from(merged.values())
    .filter(
      (candidate) =>
        !contactIdentityKeys(candidate).some((key) => existingKeys.has(key)),
    )
    .sort(
      (left, right) =>
        right.signalCount - left.signalCount ||
        (dateValue(right.lastSeenAt) ?? 0) -
          (dateValue(left.lastSeenAt) ?? 0) ||
        left.name.localeCompare(right.name),
    );
}

function contactCompleteness(contact: RelationshipContact) {
  const checks = [
    Boolean(contact.name),
    Boolean(contact.organization || contact.roleTitle),
    Boolean(contact.email || contact.phone),
    Boolean(contact.market || contact.city),
    contact.contactType !== "other",
    contact.contactability !== "unknown",
    parseTags(contact.tagsJson).length > 0 || Boolean(contact.notes),
    Boolean(contact.nextFollowUpAt || contact.lastContactAt),
  ];
  return rounded(
    (checks.filter(Boolean).length / checks.length) * 100,
    1,
  );
}

function contactTypeForRequestRole(value: string): RelationshipContactType {
  if (value === "buyer") return "buyer";
  if (value === "stylist") return "stylist";
  if (value === "editorial") return "editor";
  if (value === "talent") return "talent_team";
  return "other";
}

function contactTypeForVoice(value: string): RelationshipContactType {
  if (value === "media") return "media";
  if (value === "celebrity") return "talent_team";
  if (value === "influencer") return "influencer";
  if (value === "partner") return "partner";
  return "other";
}

function identityKey(value: {
  email: string;
  name: string;
  organization: string;
}) {
  return (
    normalizeEmail(value.email) ||
    `${normalizeText(value.name)}::${normalizeText(value.organization)}`
  );
}

function contactIdentityKeys(value: {
  email: string;
  name: string;
  organization: string;
}) {
  return [
    normalizeEmail(value.email),
    `${normalizeText(value.name)}::${normalizeText(value.organization)}`,
  ].filter(Boolean);
}

function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase();
}

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function parseTags(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return normalizedTags(parsed);
  } catch {
    return [];
  }
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

function breakdown(values: string[], denominator: number) {
  const groups = new Map<string, number>();
  values.forEach((rawValue) => {
    const value = rawValue.trim() || "未填写";
    groups.set(value, (groups.get(value) ?? 0) + 1);
  });
  return Array.from(groups, ([key, count]) => ({
    key,
    count,
    share:
      denominator > 0 ? rounded((count / denominator) * 100, 1) : 0,
  })).sort(
    (left, right) =>
      right.count - left.count || left.key.localeCompare(right.key),
  );
}

function earliestDate(values: string[]) {
  return [...values].sort(
    (left, right) =>
      (dateValue(left) ?? Number.MAX_SAFE_INTEGER) -
      (dateValue(right) ?? Number.MAX_SAFE_INTEGER),
  )[0] ?? null;
}

function latestDate(values: Array<string | null>) {
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort(
        (left, right) =>
          (dateValue(right) ?? 0) - (dateValue(left) ?? 0),
      )[0] ?? null
  );
}

function compareNullableDates(left: string | null, right: string | null) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return (dateValue(left) ?? 0) - (dateValue(right) ?? 0);
}

function isOverdue(value: string, now: Date) {
  const timestamp = dateValue(value);
  return timestamp !== null && timestamp < now.getTime();
}

function dateValue(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function tierWeight(value: string) {
  return (
    {
      priority: 0,
      core: 1,
      developing: 2,
      dormant: 3,
    }[value] ?? 4
  );
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
