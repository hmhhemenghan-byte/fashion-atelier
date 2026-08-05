import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  exhibitionRecoveries,
  exhibitionRecoveryChecks,
  exhibitionRecoveryImages,
  type ExhibitionRecovery,
  type ExhibitionRecoveryCheck,
  type ExhibitionRecoveryImage,
} from "@/db/schema";
import { buildExhibitionWatchOverview } from "@/lib/exhibition-watch";
import { mediaUrl } from "@/lib/works";

export const EXHIBITION_RECOVERY_STATUSES = ["intake", "stabilizing", "in_review", "released", "referred", "void"] as const;
export const EXHIBITION_RECOVERY_DECISIONS = ["pending", "return_to_storage", "rest_then_store", "conservation_review", "quarantine"] as const;
export const EXHIBITION_RECOVERY_CHECK_RESULTS = ["pending", "pass", "attention", "blocked", "na"] as const;
export const EXHIBITION_RECOVERY_IMAGE_ANGLES = ["intake", "unpacking", "condition", "support", "packing", "storage", "other"] as const;
export const EXHIBITION_RECOVERY_IMAGE_STATUSES = ["active", "removed"] as const;

export const DEFAULT_EXHIBITION_RECOVERY_CHECKS = [
  { category: "custody", title: "撤展交接与身份", requirement: "确认作品、展期监测、撤展时间和接收责任人一致。" },
  { category: "packing", title: "包装与运输状态", requirement: "记录外包装、内衬、固定方式与运输到达状态。" },
  { category: "condition", title: "展后品相复查", requirement: "将离场与开场状态进行人工对照，记录新增变化。" },
  { category: "support", title: "支撑拆除与受力释放", requirement: "确认模特台、填充与固定件按顺序拆除且未造成新损伤。" },
  { category: "stabilization", title: "静置、隔离与养护分流", requirement: "确认是否需要环境适应、隔离或养护复核。" },
  { category: "storage", title: "保存位置与回库条件", requirement: "确认包装、支撑、位置和保存边界适合长期存放。" },
] as const;

export type ExhibitionRecoveryStatus = (typeof EXHIBITION_RECOVERY_STATUSES)[number];
export type ExhibitionRecoveryDecision = (typeof EXHIBITION_RECOVERY_DECISIONS)[number];
export type ExhibitionRecoveryCheckResult = (typeof EXHIBITION_RECOVERY_CHECK_RESULTS)[number];
export type ExhibitionRecoveryImageAngle = (typeof EXHIBITION_RECOVERY_IMAGE_ANGLES)[number];
export type ExhibitionRecoveryImageStatus = (typeof EXHIBITION_RECOVERY_IMAGE_STATUSES)[number];

export type ExhibitionRecoveryWorkspace = {
  recovery: ExhibitionRecovery;
  watch: Awaited<ReturnType<typeof buildExhibitionWatchOverview>>["watches"][number] | null;
  checks: ExhibitionRecoveryCheck[];
  images: Array<ExhibitionRecoveryImage & { imageUrl: string }>;
  summary: {
    passedChecks: number;
    attentionChecks: number;
    blockedChecks: number;
    pendingChecks: number;
    activeImages: number;
    missingFields: string[];
    releaseReady: boolean;
    stabilizationDue: boolean;
  };
};

export type ExhibitionRecoveryOverview = {
  generatedAt: string;
  metrics: { total: number; stabilizing: number; inReview: number; released: number; referred: number; attention: number };
  recoveries: ExhibitionRecoveryWorkspace[];
  references: {
    deinstalledWatches: Array<{
      exhibitionWatchId: string;
      watchCode: string;
      planCode: string;
      assetCode: string;
      workTitle: string;
      venue: string;
      deinstalledAt: string;
      deinstallationCondition: string;
      returnLocation: string;
    }>;
  };
};

export async function listAllExhibitionRecoveries(limit = 8000) {
  const db = await getDb();
  return db.select().from(exhibitionRecoveries).orderBy(desc(exhibitionRecoveries.updatedAt)).limit(limit);
}

export async function listAllExhibitionRecoveryChecks(limit = 48000) {
  const db = await getDb();
  return db.select().from(exhibitionRecoveryChecks)
    .orderBy(asc(exhibitionRecoveryChecks.exhibitionRecoveryId), asc(exhibitionRecoveryChecks.sortOrder)).limit(limit);
}

export async function listAllExhibitionRecoveryImages(limit = 32000) {
  const db = await getDb();
  return db.select().from(exhibitionRecoveryImages)
    .orderBy(asc(exhibitionRecoveryImages.exhibitionRecoveryId), asc(exhibitionRecoveryImages.sortOrder)).limit(limit);
}

export async function getExhibitionRecovery(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(exhibitionRecoveries).where(eq(exhibitionRecoveries.id, id)).limit(1);
  return row ?? null;
}

export async function getExhibitionRecoveryCheck(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(exhibitionRecoveryChecks).where(eq(exhibitionRecoveryChecks.id, id)).limit(1);
  return row ?? null;
}

export async function getExhibitionRecoveryImage(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(exhibitionRecoveryImages).where(eq(exhibitionRecoveryImages.id, id)).limit(1);
  return row ?? null;
}

export async function buildExhibitionRecoveryOverview(now = new Date()): Promise<ExhibitionRecoveryOverview> {
  const [recoveries, checks, images, exhibition] = await Promise.all([
    listAllExhibitionRecoveries(),
    listAllExhibitionRecoveryChecks(),
    listAllExhibitionRecoveryImages(),
    buildExhibitionWatchOverview(now),
  ]);
  const watchById = new Map(exhibition.watches.map((item) => [item.watch.id, item]));
  const checksByRecovery = groupBy(checks, (item) => item.exhibitionRecoveryId);
  const imagesByRecovery = groupBy(images, (item) => item.exhibitionRecoveryId);
  const existingWatchIds = new Set(recoveries.map((item) => item.exhibitionWatchId));
  const nowMs = now.getTime();
  const workspaces = recoveries.map((recovery) => {
    const watch = watchById.get(recovery.exhibitionWatchId) ?? null;
    const linkedChecks = checksByRecovery.get(recovery.id) ?? [];
    const linkedImages = (imagesByRecovery.get(recovery.id) ?? []).map((image) => ({ ...image, imageUrl: mediaUrl(image.imageKey) }));
    const passedChecks = linkedChecks.filter((check) => ["pass", "na"].includes(check.result)).length;
    const attentionChecks = linkedChecks.filter((check) => check.result === "attention").length;
    const blockedChecks = linkedChecks.filter((check) => check.result === "blocked").length;
    const pendingChecks = linkedChecks.filter((check) => check.result === "pending").length;
    const activeImages = linkedImages.filter((image) => image.status === "active");
    const missingFields = exhibitionRecoveryMissingFields(recovery, activeImages);
    const directStorage = recovery.decision === "return_to_storage";
    const sourceValid = Boolean(watch && ["deinstalled", "closed"].includes(watch.watch.status));
    const stabilizationDue = recovery.status === "stabilizing" && Boolean(recovery.acclimatizationUntil) && new Date(recovery.acclimatizationUntil ?? "").getTime() <= nowMs;
    return {
      recovery,
      watch,
      checks: linkedChecks,
      images: linkedImages,
      summary: {
        passedChecks,
        attentionChecks,
        blockedChecks,
        pendingChecks,
        activeImages: activeImages.length,
        missingFields,
        releaseReady:
          sourceValid && missingFields.length === 0 && linkedChecks.length >= 6 && pendingChecks === 0 && blockedChecks === 0 &&
          recovery.decision !== "pending" && !["conservation_review", "quarantine"].includes(recovery.decision) &&
          (!directStorage || attentionChecks === 0) && !recovery.treatmentRequired &&
          (recovery.decision !== "rest_then_store" || Boolean(recovery.acclimatizationUntil && new Date(recovery.acclimatizationUntil).getTime() <= nowMs)),
        stabilizationDue,
      },
    } satisfies ExhibitionRecoveryWorkspace;
  });
  const attention = workspaces.filter((item) =>
    !["released", "referred", "void"].includes(item.recovery.status) &&
    (item.summary.blockedChecks > 0 || item.summary.stabilizationDue || item.recovery.treatmentRequired),
  ).length;
  return {
    generatedAt: now.toISOString(),
    metrics: {
      total: recoveries.length,
      stabilizing: recoveries.filter((item) => item.status === "stabilizing").length,
      inReview: recoveries.filter((item) => item.status === "in_review").length,
      released: recoveries.filter((item) => item.status === "released").length,
      referred: recoveries.filter((item) => item.status === "referred").length,
      attention,
    },
    recoveries: workspaces,
    references: {
      deinstalledWatches: exhibition.watches
        .filter(({ watch }) =>
          ["deinstalled", "closed"].includes(watch.status) &&
          Boolean(watch.deinstalledAt && watch.deinstallationCondition.trim() && watch.returnLocation.trim()) &&
          !existingWatchIds.has(watch.id),
        )
        .map(({ watch, plan }) => ({
          exhibitionWatchId: watch.id,
          watchCode: watch.watchCode,
          planCode: plan?.plan.planCode ?? "",
          assetCode: plan?.asset?.assetCode ?? "",
          workTitle: plan?.work?.title ?? plan?.asset?.workTitle ?? "",
          venue: plan?.plan.venue ?? "",
          deinstalledAt: watch.deinstalledAt ?? "",
          deinstallationCondition: watch.deinstallationCondition,
          returnLocation: watch.returnLocation,
        })),
    },
  };
}

export function exhibitionRecoveryMissingFields(recovery: ExhibitionRecovery, images: Array<{ status: string }>) {
  const missing: string[] = [];
  if (!recovery.receivedAt) missing.push("接收时间");
  if (!recovery.handler.trim()) missing.push("接收负责人");
  if (!recovery.intakeLocation.trim()) missing.push("接收地点");
  if (!recovery.packingCondition.trim()) missing.push("包装状态");
  if (!recovery.transitCondition.trim()) missing.push("运输状态");
  if (!recovery.unpackingObservation.trim()) missing.push("开箱观察");
  if (!recovery.supportRemovalNote.trim()) missing.push("支撑拆除记录");
  if (!recovery.postDisplayCondition.trim()) missing.push("展后品相");
  if (!recovery.storageLocation.trim()) missing.push("保存位置");
  if (!recovery.recoveryNote.trim()) missing.push("人工结论");
  if (recovery.decision === "rest_then_store" && !recovery.acclimatizationUntil) missing.push("静置截止时间");
  if ((recovery.treatmentRequired || ["conservation_review", "quarantine"].includes(recovery.decision)) && !recovery.treatmentNote.trim()) missing.push("养护或隔离说明");
  if (images.filter((image) => image.status === "active").length === 0) missing.push("至少一张私密接收证据");
  return missing;
}

export function exhibitionRecoveriesToCsv(overview: ExhibitionRecoveryOverview) {
  return csv([["recovery_code", "watch_code", "asset_code", "work_title", "status", "decision", "received_at", "handler", "intake_location", "post_display_condition", "storage_location", "released_at"], ...overview.recoveries.map(({ recovery, watch }) => [recovery.recoveryCode, watch?.watch.watchCode ?? "", watch?.plan?.asset?.assetCode ?? "", watch?.plan?.work?.title ?? watch?.plan?.asset?.workTitle ?? "", recovery.status, recovery.decision, recovery.receivedAt ?? "", recovery.handler, recovery.intakeLocation, recovery.postDisplayCondition, recovery.storageLocation, recovery.releasedAt ?? ""])]);
}

export function exhibitionRecoveryChecksToCsv(overview: ExhibitionRecoveryOverview) {
  return csv([["recovery_code", "category", "title", "result", "critical", "observation"], ...overview.recoveries.flatMap(({ recovery, checks }) => checks.map((check) => [recovery.recoveryCode, check.category, check.title, check.result, check.critical ? "true" : "false", check.observation]))]);
}

export function exhibitionRecoveryImagesToCsv(overview: ExhibitionRecoveryOverview) {
  return csv([["recovery_code", "angle", "caption", "alt_text", "object_key", "content_type", "bytes", "status"], ...overview.recoveries.flatMap(({ recovery, images }) => images.map((image) => [recovery.recoveryCode, image.angle, image.caption, image.altText, image.imageKey, image.imageType, image.imageSize, image.status]))]);
}

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const grouped = new Map<string, T[]>();
  rows.forEach((row) => grouped.set(key(row), [...(grouped.get(key(row)) ?? []), row]));
  return grouped;
}

function csv(rows: Array<Array<string | number>>) {
  return rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
}
