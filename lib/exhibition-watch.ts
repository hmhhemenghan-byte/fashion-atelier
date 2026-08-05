import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  exhibitionWatchImages,
  exhibitionWatchObservations,
  exhibitionWatches,
  type ExhibitionWatch,
  type ExhibitionWatchImage,
  type ExhibitionWatchObservation,
} from "@/db/schema";
import { buildExhibitionOverview } from "@/lib/exhibition-readiness";
import { mediaUrl } from "@/lib/works";

export const EXHIBITION_WATCH_STATUSES = ["active", "paused", "deinstalled", "closed"] as const;
export const EXHIBITION_WATCH_DECISIONS = ["pending", "continue", "continue_with_limits", "pause", "deinstall_now"] as const;
export const WATCH_CONDITION_RESULTS = ["stable", "attention", "critical"] as const;
export const WATCH_PEST_RESULTS = ["none", "signs", "confirmed"] as const;
export const WATCH_INCIDENT_TYPES = ["none", "physical", "climate", "light", "security", "pest", "handling", "other"] as const;
export const WATCH_DISPOSITIONS = ["continue", "limit", "pause", "deinstall", "conservator_review"] as const;
export const WATCH_IMAGE_ANGLES = ["overall", "condition", "support", "environment", "incident", "deinstallation", "other"] as const;
export const WATCH_IMAGE_STATUSES = ["active", "removed"] as const;

export type ExhibitionWatchStatus = (typeof EXHIBITION_WATCH_STATUSES)[number];
export type ExhibitionWatchDecision = (typeof EXHIBITION_WATCH_DECISIONS)[number];
export type WatchConditionResult = (typeof WATCH_CONDITION_RESULTS)[number];
export type WatchPestResult = (typeof WATCH_PEST_RESULTS)[number];
export type WatchIncidentType = (typeof WATCH_INCIDENT_TYPES)[number];
export type WatchDisposition = (typeof WATCH_DISPOSITIONS)[number];
export type WatchImageAngle = (typeof WATCH_IMAGE_ANGLES)[number];
export type WatchImageStatus = (typeof WATCH_IMAGE_STATUSES)[number];

export type ExhibitionWatchWorkspace = {
  watch: ExhibitionWatch;
  plan: Awaited<ReturnType<typeof buildExhibitionOverview>>["plans"][number] | null;
  observations: ExhibitionWatchObservation[];
  images: Array<ExhibitionWatchImage & { imageUrl: string }>;
  summary: {
    observationCount: number;
    evidenceCount: number;
    due: boolean;
    latestAttention: boolean;
    outsideLimits: boolean;
    canClose: boolean;
  };
};

export type ExhibitionWatchOverview = {
  generatedAt: string;
  metrics: { total: number; active: number; due: number; attention: number; deinstalled: number };
  watches: ExhibitionWatchWorkspace[];
  references: { approvedPlans: Array<{ id: string; planCode: string; title: string; venue: string; assetCode: string; workTitle: string }> };
};

export async function listAllExhibitionWatches(limit = 8000) {
  const db = await getDb();
  return db.select().from(exhibitionWatches).orderBy(desc(exhibitionWatches.updatedAt)).limit(limit);
}

export async function listAllExhibitionWatchObservations(limit = 64000) {
  const db = await getDb();
  return db.select().from(exhibitionWatchObservations)
    .orderBy(asc(exhibitionWatchObservations.exhibitionWatchId), desc(exhibitionWatchObservations.observedAt)).limit(limit);
}

export async function listAllExhibitionWatchImages(limit = 48000) {
  const db = await getDb();
  return db.select().from(exhibitionWatchImages)
    .orderBy(asc(exhibitionWatchImages.exhibitionWatchId), asc(exhibitionWatchImages.sortOrder)).limit(limit);
}

export async function getExhibitionWatch(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(exhibitionWatches).where(eq(exhibitionWatches.id, id)).limit(1);
  return row ?? null;
}

export async function getExhibitionWatchObservation(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(exhibitionWatchObservations).where(eq(exhibitionWatchObservations.id, id)).limit(1);
  return row ?? null;
}

export async function getExhibitionWatchImage(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(exhibitionWatchImages).where(eq(exhibitionWatchImages.id, id)).limit(1);
  return row ?? null;
}

export async function buildExhibitionWatchOverview(now = new Date()): Promise<ExhibitionWatchOverview> {
  const [watches, observations, images, exhibition] = await Promise.all([
    listAllExhibitionWatches(), listAllExhibitionWatchObservations(), listAllExhibitionWatchImages(), buildExhibitionOverview(now),
  ]);
  const planById = new Map(exhibition.plans.map((item) => [item.plan.id, item]));
  const existingPlanIds = new Set(watches.map((item) => item.exhibitionReadinessPlanId));
  const obsByWatch = groupBy(observations, (item) => item.exhibitionWatchId);
  const imagesByWatch = groupBy(images, (item) => item.exhibitionWatchId);
  const nowMs = now.getTime();
  const workspaces = watches.map((watch) => {
    const plan = planById.get(watch.exhibitionReadinessPlanId) ?? null;
    const linkedObservations = obsByWatch.get(watch.id) ?? [];
    const linkedImages = (imagesByWatch.get(watch.id) ?? []).map((image) => ({ ...image, imageUrl: mediaUrl(image.imageKey) }));
    const latest = linkedObservations[0] ?? null;
    const baseline = watch.lastObservedAt || watch.openedAt;
    const dueAt = new Date(baseline).getTime() + watch.monitoringIntervalHours * 3_600_000;
    const outsideLimits = Boolean(latest && plan && readingOutsidePlan(latest, plan.plan));
    const latestAttention = Boolean(latest && (
      latest.conditionResult !== "stable" || latest.supportResult !== "stable" || latest.pestResult !== "none" ||
      latest.incidentType !== "none" || ["pause", "deinstall", "conservator_review"].includes(latest.disposition) || outsideLimits
    ));
    return {
      watch,
      plan,
      observations: linkedObservations,
      images: linkedImages,
      summary: {
        observationCount: linkedObservations.length,
        evidenceCount: linkedImages.filter((item) => item.status === "active").length,
        due: ["active", "paused"].includes(watch.status) && dueAt < nowMs,
        latestAttention,
        outsideLimits,
        canClose: watch.status === "deinstalled" && linkedObservations.length > 0 && Boolean(watch.deinstallationCondition.trim() && watch.returnLocation.trim() && watch.decisionNote.trim()),
      },
    } satisfies ExhibitionWatchWorkspace;
  });
  return {
    generatedAt: now.toISOString(),
    metrics: {
      total: watches.length,
      active: watches.filter((item) => item.status === "active").length,
      due: workspaces.filter((item) => item.summary.due).length,
      attention: workspaces.filter((item) => item.summary.latestAttention).length,
      deinstalled: watches.filter((item) => item.status === "deinstalled").length,
    },
    watches: workspaces,
    references: {
      approvedPlans: exhibition.plans.filter((item) => item.plan.status === "approved" && !existingPlanIds.has(item.plan.id)).map((item) => ({
        id: item.plan.id,
        planCode: item.plan.planCode,
        title: item.plan.title,
        venue: item.plan.venue,
        assetCode: item.asset?.assetCode ?? "",
        workTitle: item.work?.title ?? item.asset?.workTitle ?? "",
      })),
    },
  };
}

export function readingOutsidePlan(observation: ExhibitionWatchObservation, plan: { maxLux: number; uvLimit: number; rhMin: number; rhMax: number; tempMin: number; tempMax: number }) {
  const temperature = observation.temperatureTenth === null ? null : observation.temperatureTenth / 10;
  return (observation.lux !== null && observation.lux > plan.maxLux) ||
    (observation.uv !== null && observation.uv > plan.uvLimit) ||
    (observation.rh !== null && (observation.rh < plan.rhMin || observation.rh > plan.rhMax)) ||
    (temperature !== null && (temperature < plan.tempMin || temperature > plan.tempMax));
}

export function exhibitionWatchesToCsv(overview: ExhibitionWatchOverview) {
  return csv([["watch_code", "plan_code", "status", "decision", "interval_hours", "steward", "last_observed_at", "deinstalled_at"], ...overview.watches.map(({ watch, plan }) => [watch.watchCode, plan?.plan.planCode ?? "", watch.status, watch.decision, watch.monitoringIntervalHours, watch.steward, watch.lastObservedAt ?? "", watch.deinstalledAt ?? ""])]);
}

export function exhibitionWatchObservationsToCsv(overview: ExhibitionWatchOverview) {
  return csv([["watch_code", "observed_at", "lux", "uv", "rh", "temperature_c", "condition", "support", "pest", "incident", "disposition", "observation", "action_taken"], ...overview.watches.flatMap(({ watch, observations }) => observations.map((item) => [watch.watchCode, item.observedAt, item.lux ?? "", item.uv ?? "", item.rh ?? "", item.temperatureTenth === null ? "" : item.temperatureTenth / 10, item.conditionResult, item.supportResult, item.pestResult, item.incidentType, item.disposition, item.observation, item.actionTaken]))]);
}

export function exhibitionWatchImagesToCsv(overview: ExhibitionWatchOverview) {
  return csv([["watch_code", "observation_id", "angle", "caption", "alt_text", "object_key", "content_type", "bytes", "status"], ...overview.watches.flatMap(({ watch, images }) => images.map((item) => [watch.watchCode, item.observationId ?? "", item.angle, item.caption, item.altText, item.imageKey, item.imageType, item.imageSize, item.status]))]);
}

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const grouped = new Map<string, T[]>();
  rows.forEach((row) => grouped.set(key(row), [...(grouped.get(key(row)) ?? []), row]));
  return grouped;
}

function csv(rows: Array<Array<string | number>>) {
  return rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
}
