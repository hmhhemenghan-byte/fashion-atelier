import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  exhibitionReadinessChecks,
  exhibitionReadinessImages,
  exhibitionReadinessPlans,
  type ExhibitionReadinessCheck,
  type ExhibitionReadinessImage,
  type ExhibitionReadinessPlan,
} from "@/db/schema";
import { listAllConservationReports } from "@/lib/conservation-reports";
import { listAllSampleAssets } from "@/lib/sample-inventory";
import { listAllWorks, mediaUrl } from "@/lib/works";

export const EXHIBITION_PLAN_STATUSES = [
  "draft",
  "in_review",
  "approved",
  "closed",
  "void",
] as const;
export const EXHIBITION_DECISIONS = [
  "pending",
  "ready",
  "ready_with_limits",
  "hold",
  "not_for_display",
] as const;
export const EXHIBITION_PURPOSES = [
  "exhibition",
  "editorial",
  "press",
  "presentation",
  "archive_view",
] as const;
export const EXHIBITION_DISPLAY_MODES = [
  "mannequin",
  "flat",
  "hanging",
  "case",
  "custom",
] as const;
export const EXHIBITION_CHECK_RESULTS = [
  "pending",
  "pass",
  "attention",
  "blocked",
  "na",
] as const;
export const EXHIBITION_IMAGE_ANGLES = [
  "overall",
  "mount",
  "front",
  "back",
  "detail",
  "installation",
  "environment",
  "other",
] as const;
export const EXHIBITION_IMAGE_STATUSES = ["active", "removed"] as const;

export const DEFAULT_EXHIBITION_CHECKS = [
  { category: "condition", title: "养护状态与展示准入", requirement: "确认来源养护报告、当前状态与所有使用限制仍然有效。" },
  { category: "support", title: "模特台、支撑与受力", requirement: "确认支撑材料、受力分布、填充与固定方式不会造成新的变形。" },
  { category: "light", title: "光照与累计曝光", requirement: "记录最高照度、紫外限制、展示时长与轮换安排。" },
  { category: "climate", title: "温湿度与展柜环境", requirement: "确认相对湿度、温度、通风及展柜材料满足方案限制。" },
  { category: "handling", title: "搬运、穿装与安装路径", requirement: "明确操作人数、顺序、工具、接触点和禁止动作。" },
  { category: "security", title: "公众距离与应急防护", requirement: "确认展柜、屏障、安保、消防与突发事件处置边界。" },
  { category: "deinstallation", title: "撤展与回库复查", requirement: "明确撤展时间、拆卸顺序、状态复查和回库交接责任。" },
] as const;

export type ExhibitionPlanStatus = (typeof EXHIBITION_PLAN_STATUSES)[number];
export type ExhibitionDecision = (typeof EXHIBITION_DECISIONS)[number];
export type ExhibitionPurpose = (typeof EXHIBITION_PURPOSES)[number];
export type ExhibitionDisplayMode = (typeof EXHIBITION_DISPLAY_MODES)[number];
export type ExhibitionCheckResult = (typeof EXHIBITION_CHECK_RESULTS)[number];
export type ExhibitionImageAngle = (typeof EXHIBITION_IMAGE_ANGLES)[number];
export type ExhibitionImageStatus = (typeof EXHIBITION_IMAGE_STATUSES)[number];

export type ExhibitionWorkspace = {
  plan: ExhibitionReadinessPlan;
  asset: {
    id: string;
    assetCode: string;
    workTitle: string;
    lookNumber: string;
    status: string;
    condition: string;
    currentLocation: string;
    imageUrl: string;
  } | null;
  work: { id: string; title: string; collection: string; lookNumber: string } | null;
  conservation: {
    id: string;
    reportCode: string;
    status: string;
    decision: string;
    overallCondition: string;
    handlingRestriction: string;
    nextReviewAt: string | null;
  } | null;
  checks: ExhibitionReadinessCheck[];
  images: Array<ExhibitionReadinessImage & { imageUrl: string }>;
  summary: {
    passedChecks: number;
    attentionChecks: number;
    blockedChecks: number;
    pendingChecks: number;
    activeImages: number;
    missingFields: string[];
    approvalReady: boolean;
    overdueDeinstall: boolean;
    upcomingUnapproved: boolean;
  };
};

export type ExhibitionOverview = {
  generatedAt: string;
  metrics: { total: number; inReview: number; approved: number; upcoming: number; attention: number };
  plans: ExhibitionWorkspace[];
  references: {
    sources: Array<{
      conservationReportId: string;
      sampleAssetId: string;
      reportCode: string;
      assetCode: string;
      workTitle: string;
      lookNumber: string;
      condition: string;
      decision: string;
      currentLocation: string;
      imageUrl: string;
      latestSequence: number;
    }>;
  };
};

export async function listAllExhibitionReadinessPlans(limit = 8000) {
  const db = await getDb();
  return db.select().from(exhibitionReadinessPlans)
    .orderBy(desc(exhibitionReadinessPlans.updatedAt), desc(exhibitionReadinessPlans.sequence))
    .limit(limit);
}

export async function listAllExhibitionReadinessChecks(limit = 56000) {
  const db = await getDb();
  return db.select().from(exhibitionReadinessChecks)
    .orderBy(asc(exhibitionReadinessChecks.exhibitionReadinessPlanId), asc(exhibitionReadinessChecks.sortOrder))
    .limit(limit);
}

export async function listAllExhibitionReadinessImages(limit = 32000) {
  const db = await getDb();
  return db.select().from(exhibitionReadinessImages)
    .orderBy(asc(exhibitionReadinessImages.exhibitionReadinessPlanId), asc(exhibitionReadinessImages.sortOrder))
    .limit(limit);
}

export async function getExhibitionReadinessPlan(id: string) {
  const db = await getDb();
  const [record] = await db.select().from(exhibitionReadinessPlans)
    .where(eq(exhibitionReadinessPlans.id, id)).limit(1);
  return record ?? null;
}

export async function getExhibitionReadinessCheck(id: string) {
  const db = await getDb();
  const [record] = await db.select().from(exhibitionReadinessChecks)
    .where(eq(exhibitionReadinessChecks.id, id)).limit(1);
  return record ?? null;
}

export async function getExhibitionReadinessImage(id: string) {
  const db = await getDb();
  const [record] = await db.select().from(exhibitionReadinessImages)
    .where(eq(exhibitionReadinessImages.id, id)).limit(1);
  return record ?? null;
}

export async function buildExhibitionOverview(now = new Date()): Promise<ExhibitionOverview> {
  const [plans, checks, images, reports, assets, works] = await Promise.all([
    listAllExhibitionReadinessPlans(),
    listAllExhibitionReadinessChecks(),
    listAllExhibitionReadinessImages(),
    listAllConservationReports(),
    listAllSampleAssets(),
    listAllWorks(4000),
  ]);
  const assetById = new Map(assets.map((item) => [item.id, item]));
  const workById = new Map(works.map((item) => [item.id, item]));
  const reportById = new Map(reports.map((item) => [item.id, item]));
  const checksByPlan = groupBy(checks, (item) => item.exhibitionReadinessPlanId);
  const imagesByPlan = groupBy(images, (item) => item.exhibitionReadinessPlanId);
  const plansByAsset = groupBy(plans, (item) => item.sampleAssetId);
  const nowMs = now.getTime();
  const fourteenDaysAt = nowMs + 14 * 24 * 60 * 60 * 1000;

  const workspaces = plans.map((plan) => {
    const asset = assetById.get(plan.sampleAssetId) ?? null;
    const work = plan.workId ? workById.get(plan.workId) ?? null : null;
    const conservation = reportById.get(plan.conservationReportId) ?? null;
    const linkedChecks = checksByPlan.get(plan.id) ?? [];
    const linkedImages = (imagesByPlan.get(plan.id) ?? []).map((image) => ({ ...image, imageUrl: mediaUrl(image.imageKey) }));
    const activeImages = linkedImages.filter((image) => image.status === "active");
    const passedChecks = linkedChecks.filter((check) => ["pass", "na"].includes(check.result)).length;
    const attentionChecks = linkedChecks.filter((check) => check.result === "attention").length;
    const blockedChecks = linkedChecks.filter((check) => check.result === "blocked").length;
    const pendingChecks = linkedChecks.filter((check) => check.result === "pending").length;
    const missingFields = exhibitionMissingFields(plan, activeImages);
    const installMs = timestamp(plan.installAt);
    return {
      plan,
      asset: asset ? {
        id: asset.id, assetCode: asset.assetCode, workTitle: asset.workTitle,
        lookNumber: asset.lookNumber, status: asset.status, condition: asset.condition,
        currentLocation: asset.currentLocation,
        imageUrl: asset.imageKey ? mediaUrl(asset.imageKey) : "",
      } : null,
      work: work ? { id: work.id, title: work.title, collection: work.collection, lookNumber: work.lookNumber } : null,
      conservation: conservation ? {
        id: conservation.id, reportCode: conservation.reportCode, status: conservation.status,
        decision: conservation.decision, overallCondition: conservation.overallCondition,
        handlingRestriction: conservation.handlingRestriction,
        nextReviewAt: conservation.nextReviewAt,
      } : null,
      checks: linkedChecks,
      images: linkedImages,
      summary: {
        passedChecks, attentionChecks, blockedChecks, pendingChecks,
        activeImages: activeImages.length,
        missingFields,
        approvalReady:
          missingFields.length === 0 && linkedChecks.length >= 7 && pendingChecks === 0 &&
          blockedChecks === 0 && plan.decision !== "pending" &&
          Boolean(conservation && ["approved", "closed"].includes(conservation.status)),
        overdueDeinstall: Boolean(plan.deinstallAt) && timestamp(plan.deinstallAt) < nowMs && plan.status === "approved",
        upcomingUnapproved:
          Boolean(plan.installAt) && installMs >= nowMs && installMs <= fourteenDaysAt &&
          !["approved", "closed", "void"].includes(plan.status),
      },
    } satisfies ExhibitionWorkspace;
  });

  return {
    generatedAt: now.toISOString(),
    metrics: {
      total: plans.length,
      inReview: plans.filter((item) => item.status === "in_review").length,
      approved: plans.filter((item) => item.status === "approved").length,
      upcoming: workspaces.filter((item) => item.summary.upcomingUnapproved).length,
      attention: workspaces.filter((item) => item.summary.overdueDeinstall || item.summary.blockedChecks > 0).length,
    },
    plans: workspaces,
    references: {
      sources: reports
        .filter((report) => ["approved", "closed"].includes(report.status))
        .flatMap((report) => {
          const asset = assetById.get(report.sampleAssetId);
          if (!asset || ["missing", "archived"].includes(asset.status)) return [];
          return [{
            conservationReportId: report.id,
            sampleAssetId: asset.id,
            reportCode: report.reportCode,
            assetCode: asset.assetCode,
            workTitle: asset.workTitle,
            lookNumber: asset.lookNumber,
            condition: report.overallCondition,
            decision: report.decision,
            currentLocation: asset.currentLocation,
            imageUrl: asset.imageKey ? mediaUrl(asset.imageKey) : "",
            latestSequence: (plansByAsset.get(asset.id) ?? []).reduce((latest, item) => Math.max(latest, item.sequence), 0),
          }];
        }),
    },
  };
}

export function exhibitionMissingFields(
  plan: ExhibitionReadinessPlan,
  images: Array<{ status: string }>,
) {
  const missing: string[] = [];
  if (!plan.title.trim()) missing.push("方案标题");
  if (!plan.venue.trim()) missing.push("展示地点");
  if (!plan.mountingMethod.trim()) missing.push("安装方式");
  if (!plan.supportRequirements.trim()) missing.push("支撑要求");
  if (!plan.dressingInstructions.trim()) missing.push("穿装说明");
  if (!plan.handlingTeam.trim()) missing.push("操作团队");
  if (!plan.securityBarrier.trim()) missing.push("安全屏障");
  if (!plan.emergencyInstructions.trim()) missing.push("应急说明");
  if (!plan.approvalNote.trim()) missing.push("人工决定依据");
  if (["ready", "ready_with_limits"].includes(plan.decision)) {
    if (!plan.installAt) missing.push("安装时间");
    if (!plan.deinstallAt) missing.push("撤展时间");
    if (plan.installAt && plan.deinstallAt && timestamp(plan.deinstallAt) <= timestamp(plan.installAt)) {
      missing.push("有效展示时间窗口");
    }
  }
  if (plan.rhMin > plan.rhMax) missing.push("有效湿度范围");
  if (plan.tempMin > plan.tempMax) missing.push("有效温度范围");
  if (images.filter((image) => image.status === "active").length === 0) missing.push("至少一张私密试装证据");
  return missing;
}

export function exhibitionPlansToCsv(overview: ExhibitionOverview) {
  return toCsv([
    ["plan_code", "asset_code", "work_title", "conservation_report", "status", "decision", "venue", "purpose", "display_mode", "install_at", "deinstall_at", "max_lux", "rh_range", "max_display_days"],
    ...overview.plans.map(({ plan, asset, work, conservation }) => [
      plan.planCode, asset?.assetCode ?? "", work?.title ?? asset?.workTitle ?? "",
      conservation?.reportCode ?? "", plan.status, plan.decision, plan.venue,
      plan.purpose, plan.displayMode, plan.installAt ?? "", plan.deinstallAt ?? "",
      plan.maxLux, `${plan.rhMin}-${plan.rhMax}`, plan.maxDisplayDays,
    ]),
  ]);
}

export function exhibitionChecksToCsv(overview: ExhibitionOverview) {
  return toCsv([
    ["plan_code", "category", "title", "result", "critical", "observation"],
    ...overview.plans.flatMap(({ plan, checks }) => checks.map((check) => [
      plan.planCode, check.category, check.title, check.result, check.critical ? "yes" : "no", check.observation,
    ])),
  ]);
}

export function exhibitionImagesToCsv(overview: ExhibitionOverview) {
  return toCsv([
    ["plan_code", "angle", "caption", "alt_text", "object_key", "content_type", "bytes", "status"],
    ...overview.plans.flatMap(({ plan, images }) => images.map((image) => [
      plan.planCode, image.angle, image.caption, image.altText, image.imageKey,
      image.imageType, image.imageSize, image.status,
    ])),
  ]);
}

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const grouped = new Map<string, T[]>();
  rows.forEach((row) => {
    const value = key(row);
    grouped.set(value, [...(grouped.get(value) ?? []), row]);
  });
  return grouped;
}

function timestamp(value: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toCsv(rows: Array<Array<string | number>>) {
  return rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
}
