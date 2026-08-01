import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  editorialEvents,
  type Collection,
  type EditorialEvent,
  type Publication,
  type Work,
} from "@/db/schema";
import {
  getCollectionById,
  listAllCollectionAssignments,
  listAllCollections,
  listCollectionWorks,
} from "@/lib/collections";
import {
  getPublicationById,
  listAllPublications,
} from "@/lib/publications";
import { getWorkById, listAllWorks } from "@/lib/works";

export const EDITORIAL_EVENT_TYPES = [
  "design_review",
  "fitting",
  "shoot",
  "lookbook",
  "press",
  "launch",
  "internal",
] as const;

export const EDITORIAL_CHANNELS = [
  "atelier",
  "site",
  "press",
  "showroom",
  "social",
] as const;

export const EDITORIAL_EVENT_STATUSES = [
  "planned",
  "in_progress",
  "ready",
  "completed",
  "cancelled",
] as const;

export const EDITORIAL_PRIORITIES = [
  "standard",
  "high",
  "critical",
] as const;

export type EditorialEventType = (typeof EDITORIAL_EVENT_TYPES)[number];
export type EditorialChannel = (typeof EDITORIAL_CHANNELS)[number];
export type EditorialEventStatus =
  (typeof EDITORIAL_EVENT_STATUSES)[number];
export type EditorialPriority = (typeof EDITORIAL_PRIORITIES)[number];
export type EditorialEventHealth =
  | "overdue"
  | "upcoming"
  | "later"
  | "complete"
  | "cancelled";

export type CalendarCollection = Pick<
  Collection,
  "id" | "title" | "season" | "year" | "status"
>;

export type CalendarWork = Pick<
  Work,
  "id" | "title" | "lookNumber" | "collection" | "status"
>;

export type CalendarPublication = Pick<
  Publication,
  "id" | "headline" | "collectionId" | "status" | "releaseAt"
>;

export type CalendarAssignment = {
  collectionId: string;
  workId: string;
};

export type EditorialCalendarItem = Omit<
  EditorialEvent,
  "eventType" | "channel" | "status" | "priority"
> & {
  eventType: EditorialEventType;
  channel: EditorialChannel;
  status: EditorialEventStatus;
  priority: EditorialPriority;
  source: "calendar" | "publication";
  editable: boolean;
  health: EditorialEventHealth;
  relationLabel: string;
  relationHref: string | null;
  collection: CalendarCollection | null;
  work: CalendarWork | null;
  publication: CalendarPublication | null;
};

export type EditorialCalendarSnapshot = {
  generatedAt: string;
  events: EditorialCalendarItem[];
  references: {
    collections: CalendarCollection[];
    works: CalendarWork[];
    publications: CalendarPublication[];
    assignments: CalendarAssignment[];
  };
  summary: {
    total: number;
    upcoming: number;
    nextSevenDays: number;
    overdue: number;
    completed: number;
    thisMonth: number;
    automaticMilestones: number;
  };
};

export async function listEditorialEvents(limit = 500) {
  const db = await getDb();
  return db
    .select()
    .from(editorialEvents)
    .orderBy(
      asc(editorialEvents.startsAt),
      desc(editorialEvents.priority),
      desc(editorialEvents.createdAt),
    )
    .limit(limit);
}

export async function getEditorialEventById(id: string) {
  const db = await getDb();
  const [event] = await db
    .select()
    .from(editorialEvents)
    .where(eq(editorialEvents.id, id))
    .limit(1);
  return event ?? null;
}

export async function validateEditorialRelations(input: {
  collectionId: string | null;
  workId: string | null;
  publicationId: string | null;
}) {
  const [collection, work, publication] = await Promise.all([
    input.collectionId ? getCollectionById(input.collectionId) : null,
    input.workId ? getWorkById(input.workId) : null,
    input.publicationId ? getPublicationById(input.publicationId) : null,
  ]);
  if (input.collectionId && !collection) {
    return { error: "关联系列不存在。" } as const;
  }
  if (input.workId && !work) {
    return { error: "关联作品不存在。" } as const;
  }
  if (input.publicationId && !publication) {
    return { error: "关联发布包不存在。" } as const;
  }

  const collectionId =
    collection?.id ?? publication?.collectionId ?? input.collectionId;
  if (
    publication &&
    collectionId &&
    publication.collectionId !== collectionId
  ) {
    return { error: "发布包与所选系列不一致。" } as const;
  }
  if (work && collectionId) {
    const lineup = await listCollectionWorks(collectionId, true);
    if (!lineup.some((item) => item.work.id === work.id)) {
      return { error: "所选作品尚未加入该系列。" } as const;
    }
  }
  return {
    error: null,
    collectionId: collectionId ?? null,
    workId: work?.id ?? null,
    publicationId: publication?.id ?? null,
  } as const;
}

export async function getEditorialCalendarSnapshot(
  now = new Date(),
): Promise<EditorialCalendarSnapshot> {
  const [
    eventRows,
    collectionRows,
    workRows,
    publicationRows,
    assignmentRows,
  ] =
    await Promise.all([
      listEditorialEvents(),
      listAllCollections(),
      listAllWorks(),
      listAllPublications(),
      listAllCollectionAssignments(),
    ]);

  const collections = collectionRows.map(toCalendarCollection);
  const works = workRows.map(toCalendarWork);
  const publications = publicationRows.map(toCalendarPublication);
  const assignments = assignmentRows.map((assignment) => ({
    collectionId: assignment.collectionId,
    workId: assignment.workId,
  }));
  const collectionById = new Map(
    collections.map((collection) => [collection.id, collection]),
  );
  const workById = new Map(works.map((work) => [work.id, work]));
  const publicationById = new Map(
    publications.map((publication) => [publication.id, publication]),
  );

  const savedItems = eventRows.map((event) =>
    enrichEvent(
      event,
      collectionById,
      workById,
      publicationById,
      now,
    ),
  );
  const linkedPublicationIds = new Set(
    eventRows
      .filter(
        (event) =>
          event.publicationId &&
          (event.eventType === "launch" || event.eventType === "press"),
      )
      .map((event) => event.publicationId as string),
  );
  const automaticMilestones = publicationRows
    .filter(
      (publication) =>
        Boolean(publication.releaseAt) &&
        !linkedPublicationIds.has(publication.id),
    )
    .map((publication) =>
      publicationMilestone(
        publication,
        collectionById,
        publicationById,
        now,
      ),
    );
  const events = [...savedItems, ...automaticMilestones].sort(
    (left, right) =>
      new Date(left.startsAt).getTime() -
        new Date(right.startsAt).getTime() ||
      priorityRank(right.priority) - priorityRank(left.priority),
  );

  const nowTime = now.getTime();
  const sevenDays = nowTime + 7 * 24 * 60 * 60 * 1000;
  const monthStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    1,
  );
  const monthEnd = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    1,
  );

  return {
    generatedAt: now.toISOString(),
    events,
    references: { collections, works, publications, assignments },
    summary: {
      total: events.length,
      upcoming: events.filter(
        (event) =>
          event.health === "upcoming" || event.health === "later",
      ).length,
      nextSevenDays: events.filter((event) => {
        const startsAt = new Date(event.startsAt).getTime();
        return (
          startsAt >= nowTime &&
          startsAt <= sevenDays &&
          !isClosed(event.status)
        );
      }).length,
      overdue: events.filter((event) => event.health === "overdue").length,
      completed: events.filter((event) => event.status === "completed")
        .length,
      thisMonth: events.filter((event) => {
        const startsAt = new Date(event.startsAt).getTime();
        return startsAt >= monthStart && startsAt < monthEnd;
      }).length,
      automaticMilestones: automaticMilestones.length,
    },
  };
}

export function editorialCalendarToIcs(
  snapshot: EditorialCalendarSnapshot,
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NERA ATELIER//Editorial Calendar//ZH-CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:NÉRA ATELIER / EDITORIAL CALENDAR",
  ];

  snapshot.events
    .filter((event) => event.status !== "cancelled")
    .forEach((event) => {
      const description = [
        event.notes,
        event.relationLabel ? `关联：${event.relationLabel}` : "",
        `渠道：${event.channel}`,
        `状态：${event.status}`,
      ]
        .filter(Boolean)
        .join("\\n");
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${escapeIcs(`${event.id}@nera-atelier`)}`);
      lines.push(`DTSTAMP:${toIcsDate(snapshot.generatedAt)}`);
      if (event.allDay) {
        lines.push(`DTSTART;VALUE=DATE:${toIcsDay(event.startsAt)}`);
        if (event.endsAt) {
          lines.push(`DTEND;VALUE=DATE:${toIcsDay(event.endsAt)}`);
        }
      } else {
        lines.push(`DTSTART:${toIcsDate(event.startsAt)}`);
        if (event.endsAt) {
          lines.push(`DTEND:${toIcsDate(event.endsAt)}`);
        }
      }
      lines.push(`SUMMARY:${escapeIcs(event.title)}`);
      if (description) lines.push(`DESCRIPTION:${escapeIcs(description)}`);
      if (event.location) {
        lines.push(`LOCATION:${escapeIcs(event.location)}`);
      }
      lines.push(
        `STATUS:${
          event.status === "completed"
            ? "COMPLETED"
            : event.status === "cancelled"
              ? "CANCELLED"
              : "CONFIRMED"
        }`,
      );
      lines.push("END:VEVENT");
    });
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function getEditorialEventHealth(
  event: Pick<EditorialCalendarItem, "startsAt" | "status">,
  now = new Date(),
): EditorialEventHealth {
  if (event.status === "completed") return "complete";
  if (event.status === "cancelled") return "cancelled";
  const startsAt = new Date(event.startsAt).getTime();
  if (!Number.isFinite(startsAt)) return "later";
  if (startsAt < now.getTime()) return "overdue";
  if (startsAt <= now.getTime() + 7 * 24 * 60 * 60 * 1000) {
    return "upcoming";
  }
  return "later";
}

function enrichEvent(
  event: EditorialEvent,
  collectionById: Map<string, CalendarCollection>,
  workById: Map<string, CalendarWork>,
  publicationById: Map<string, CalendarPublication>,
  now: Date,
): EditorialCalendarItem {
  const collection = event.collectionId
    ? collectionById.get(event.collectionId) ?? null
    : null;
  const work = event.workId ? workById.get(event.workId) ?? null : null;
  const publication = event.publicationId
    ? publicationById.get(event.publicationId) ?? null
    : null;
  const relation = relationDetails(collection, work, publication);
  return {
    ...event,
    eventType: event.eventType as EditorialEventType,
    channel: event.channel as EditorialChannel,
    status: event.status as EditorialEventStatus,
    priority: event.priority as EditorialPriority,
    source: "calendar",
    editable: true,
    health: getEditorialEventHealth(
      {
        startsAt: event.startsAt,
        status: event.status as EditorialEventStatus,
      },
      now,
    ),
    relationLabel: relation.label,
    relationHref: relation.href,
    collection,
    work,
    publication,
  };
}

function publicationMilestone(
  publication: Publication,
  collectionById: Map<string, CalendarCollection>,
  publicationById: Map<string, CalendarPublication>,
  now: Date,
): EditorialCalendarItem {
  const status: EditorialEventStatus =
    publication.status === "published"
      ? "completed"
      : publication.status === "scheduled"
        ? "ready"
        : "planned";
  const collection =
    collectionById.get(publication.collectionId) ?? null;
  const reference = publicationById.get(publication.id) ?? null;
  const startsAt = publication.releaseAt as string;
  const relation = relationDetails(collection, null, reference);
  return {
    id: `publication:${publication.id}`,
    title: publication.headline,
    eventType: "launch",
    channel: "press",
    status,
    priority: "high",
    startsAt,
    endsAt: null,
    timezone: "UTC",
    allDay: false,
    location: publication.city,
    notes: "由发布中心的定时发布时间自动同步。",
    collectionId: publication.collectionId,
    workId: null,
    publicationId: publication.id,
    createdBy: publication.createdBy,
    completedAt: publication.publishedAt,
    createdAt: publication.createdAt,
    updatedAt: publication.updatedAt,
    source: "publication",
    editable: false,
    health: getEditorialEventHealth({ startsAt, status }, now),
    relationLabel: relation.label,
    relationHref: relation.href,
    collection,
    work: null,
    publication: reference,
  };
}

function relationDetails(
  collection: CalendarCollection | null,
  work: CalendarWork | null,
  publication: CalendarPublication | null,
) {
  if (publication) {
    return {
      label: `发布包 / ${publication.headline}`,
      href: `#publication-${publication.id}`,
    };
  }
  if (work) {
    return {
      label: `${work.lookNumber || "LOOK"} / ${work.title}`,
      href: `#work-${work.id}`,
    };
  }
  if (collection) {
    return {
      label: `系列 / ${collection.title}`,
      href: `#collection-${collection.id}`,
    };
  }
  return { label: "ATELIER / 独立排期", href: null };
}

function toCalendarCollection(collection: Collection): CalendarCollection {
  return {
    id: collection.id,
    title: collection.title,
    season: collection.season,
    year: collection.year,
    status: collection.status,
  };
}

function toCalendarWork(work: Work): CalendarWork {
  return {
    id: work.id,
    title: work.title,
    lookNumber: work.lookNumber,
    collection: work.collection,
    status: work.status,
  };
}

function toCalendarPublication(
  publication: Publication,
): CalendarPublication {
  return {
    id: publication.id,
    headline: publication.headline,
    collectionId: publication.collectionId,
    status: publication.status,
    releaseAt: publication.releaseAt,
  };
}

function isClosed(status: EditorialEventStatus) {
  return status === "completed" || status === "cancelled";
}

function priorityRank(priority: EditorialPriority) {
  return priority === "critical" ? 3 : priority === "high" ? 2 : 1;
}

function toIcsDate(value: string) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function toIcsDay(value: string) {
  return new Date(value).toISOString().slice(0, 10).replace(/-/g, "");
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
