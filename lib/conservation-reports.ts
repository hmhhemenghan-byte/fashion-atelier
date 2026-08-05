import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  conservationReportChecks,
  conservationReportImages,
  conservationReports,
  type ConservationReport,
  type ConservationReportCheck,
  type ConservationReportImage,
} from "@/db/schema";
import { listAllProvenanceDossiers } from "@/lib/provenance-dossiers";
import { listAllSampleAssets } from "@/lib/sample-inventory";
import { listAllWorks, mediaUrl } from "@/lib/works";

export const CONSERVATION_REPORT_STATUSES = [
  "draft",
  "in_review",
  "approved",
  "closed",
  "void",
] as const;
export const CONSERVATION_REPORT_DECISIONS = [
  "pending",
  "monitor",
  "treat",
  "ready_for_use",
  "archive",
] as const;
export const CONSERVATION_CONDITIONS = [
  "not_checked",
  "excellent",
  "good",
  "worn",
  "damaged",
  "critical",
] as const;
export const CONSERVATION_CHECK_RESULTS = [
  "pending",
  "stable",
  "attention",
  "treatment",
  "resolved",
  "na",
] as const;
export const CONSERVATION_SEVERITIES = [
  "none",
  "low",
  "medium",
  "high",
  "critical",
] as const;
export const CONSERVATION_IMAGE_ANGLES = [
  "overall",
  "front",
  "back",
  "interior",
  "detail",
  "label",
  "damage",
  "other",
] as const;
export const CONSERVATION_IMAGE_STATUSES = ["active", "removed"] as const;

export const DEFAULT_CONSERVATION_CHECKS = [
  {
    category: "structure",
    title: "整体结构与廓形",
    requirement: "检查承力结构、版型平衡、变形与支撑状态。",
  },
  {
    category: "surface",
    title: "面料表面与色彩",
    requirement: "检查污渍、褪色、磨损、起球、脆化与表面变化。",
  },
  {
    category: "seams",
    title: "缝线与内部结构",
    requirement: "检查缝线、里布、衬布、加固与内部受力位置。",
  },
  {
    category: "fastenings",
    title: "开合与五金",
    requirement: "检查拉链、纽扣、钩扣、磁吸及其他活动部件。",
  },
  {
    category: "trim",
    title: "装饰与特殊部件",
    requirement: "检查刺绣、珠饰、羽饰、涂层、薄膜与可拆部件。",
  },
  {
    category: "labels",
    title: "标识与档案身份",
    requirement: "检查品牌、尺码、洗护与内部档案标识的完整性。",
  },
] as const;

export type ConservationReportStatus =
  (typeof CONSERVATION_REPORT_STATUSES)[number];
export type ConservationReportDecision =
  (typeof CONSERVATION_REPORT_DECISIONS)[number];
export type ConservationCondition =
  (typeof CONSERVATION_CONDITIONS)[number];
export type ConservationCheckResult =
  (typeof CONSERVATION_CHECK_RESULTS)[number];
export type ConservationSeverity =
  (typeof CONSERVATION_SEVERITIES)[number];
export type ConservationImageAngle =
  (typeof CONSERVATION_IMAGE_ANGLES)[number];
export type ConservationImageStatus =
  (typeof CONSERVATION_IMAGE_STATUSES)[number];

export type ConservationWorkspace = {
  report: ConservationReport;
  asset: {
    id: string;
    assetCode: string;
    workTitle: string;
    lookNumber: string;
    status: string;
    condition: string;
    currentLocation: string;
    sizeLabel: string;
    colorLabel: string;
    imageUrl: string;
  } | null;
  work: {
    id: string;
    title: string;
    collection: string;
    lookNumber: string;
  } | null;
  provenance: {
    dossierCode: string;
    slug: string;
    publishedAt: string | null;
  } | null;
  checks: ConservationReportCheck[];
  images: Array<ConservationReportImage & { imageUrl: string }>;
  summary: {
    stableChecks: number;
    attentionChecks: number;
    criticalChecks: number;
    pendingChecks: number;
    activeImages: number;
    missingFields: string[];
    approvalReady: boolean;
    overdue: boolean;
  };
};

export type ConservationOverview = {
  generatedAt: string;
  metrics: {
    total: number;
    inReview: number;
    approved: number;
    treatment: number;
    attention: number;
  };
  reports: ConservationWorkspace[];
  references: {
    assets: Array<{
      sampleAssetId: string;
      assetCode: string;
      workTitle: string;
      lookNumber: string;
      status: string;
      condition: string;
      currentLocation: string;
      imageUrl: string;
      latestSequence: number;
    }>;
  };
};

export async function listAllConservationReports(limit = 8000) {
  const db = await getDb();
  return db
    .select()
    .from(conservationReports)
    .orderBy(desc(conservationReports.updatedAt), desc(conservationReports.sequence))
    .limit(limit);
}

export async function listAllConservationReportChecks(limit = 48000) {
  const db = await getDb();
  return db
    .select()
    .from(conservationReportChecks)
    .orderBy(
      asc(conservationReportChecks.conservationReportId),
      asc(conservationReportChecks.sortOrder),
    )
    .limit(limit);
}

export async function listAllConservationReportImages(limit = 32000) {
  const db = await getDb();
  return db
    .select()
    .from(conservationReportImages)
    .orderBy(
      asc(conservationReportImages.conservationReportId),
      asc(conservationReportImages.sortOrder),
    )
    .limit(limit);
}

export async function getConservationReport(id: string) {
  const db = await getDb();
  const [record] = await db
    .select()
    .from(conservationReports)
    .where(eq(conservationReports.id, id))
    .limit(1);
  return record ?? null;
}

export async function getConservationReportCheck(id: string) {
  const db = await getDb();
  const [record] = await db
    .select()
    .from(conservationReportChecks)
    .where(eq(conservationReportChecks.id, id))
    .limit(1);
  return record ?? null;
}

export async function getConservationReportImage(id: string) {
  const db = await getDb();
  const [record] = await db
    .select()
    .from(conservationReportImages)
    .where(eq(conservationReportImages.id, id))
    .limit(1);
  return record ?? null;
}

export async function buildConservationOverview(): Promise<ConservationOverview> {
  const [reports, checks, images, assets, works, dossiers] = await Promise.all([
    listAllConservationReports(),
    listAllConservationReportChecks(),
    listAllConservationReportImages(),
    listAllSampleAssets(),
    listAllWorks(4000),
    listAllProvenanceDossiers(),
  ]);
  const assetById = new Map(assets.map((item) => [item.id, item]));
  const workById = new Map(works.map((item) => [item.id, item]));
  const checksByReport = groupBy(checks, (item) => item.conservationReportId);
  const imagesByReport = groupBy(images, (item) => item.conservationReportId);
  const reportsByAsset = groupBy(reports, (item) => item.sampleAssetId);
  const publishedDossierByWork = new Map<
    string,
    (typeof dossiers)[number]
  >();
  dossiers
    .filter((item) => item.status === "published")
    .forEach((item) => {
      if (!publishedDossierByWork.has(item.workId)) {
        publishedDossierByWork.set(item.workId, item);
      }
    });
  const now = Date.now();

  const workspaces = reports.map((report) => {
    const asset = assetById.get(report.sampleAssetId) ?? null;
    const work = report.workId ? workById.get(report.workId) ?? null : null;
    const dossier = report.workId
      ? publishedDossierByWork.get(report.workId) ?? null
      : null;
    const linkedChecks = checksByReport.get(report.id) ?? [];
    const linkedImages = (imagesByReport.get(report.id) ?? []).map((image) => ({
      ...image,
      imageUrl: mediaUrl(image.imageKey),
    }));
    const activeImages = linkedImages.filter((image) => image.status === "active");
    const missingFields = conservationMissingFields(report, activeImages);
    const stableChecks = linkedChecks.filter((check) =>
      ["stable", "resolved", "na"].includes(check.result),
    ).length;
    const attentionChecks = linkedChecks.filter((check) =>
      ["attention", "treatment"].includes(check.result),
    ).length;
    const criticalChecks = linkedChecks.filter(
      (check) =>
        ["high", "critical"].includes(check.severity) &&
        !["resolved", "na"].includes(check.result),
    ).length;
    const pendingChecks = linkedChecks.filter((check) => check.result === "pending").length;
    const decisionReady =
      report.decision !== "pending" &&
      (report.decision !== "treat" || Boolean(report.proposedTreatment.trim())) &&
      (report.decision !== "ready_for_use" ||
        (attentionChecks === 0 && criticalChecks === 0));
    return {
      report,
      asset: asset
        ? {
            id: asset.id,
            assetCode: asset.assetCode,
            workTitle: asset.workTitle,
            lookNumber: asset.lookNumber,
            status: asset.status,
            condition: asset.condition,
            currentLocation: asset.currentLocation,
            sizeLabel: asset.sizeLabel,
            colorLabel: asset.colorLabel,
            imageUrl: asset.imageKey ? mediaUrl(asset.imageKey) : "",
          }
        : null,
      work: work
        ? {
            id: work.id,
            title: work.title,
            collection: work.collection,
            lookNumber: work.lookNumber,
          }
        : null,
      provenance: dossier
        ? {
            dossierCode: dossier.dossierCode,
            slug: dossier.slug,
            publishedAt: dossier.publishedAt,
          }
        : null,
      checks: linkedChecks,
      images: linkedImages,
      summary: {
        stableChecks,
        attentionChecks,
        criticalChecks,
        pendingChecks,
        activeImages: activeImages.length,
        missingFields,
        approvalReady:
          missingFields.length === 0 &&
          linkedChecks.length >= 6 &&
          pendingChecks === 0 &&
          criticalChecks === 0 &&
          decisionReady,
        overdue:
          Boolean(report.nextReviewAt) &&
          new Date(report.nextReviewAt || 0).getTime() < now &&
          !["closed", "void"].includes(report.status),
      },
    } satisfies ConservationWorkspace;
  });

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      total: reports.length,
      inReview: reports.filter((item) => item.status === "in_review").length,
      approved: reports.filter((item) => item.status === "approved").length,
      treatment: reports.filter((item) => item.decision === "treat").length,
      attention: workspaces.filter(
        (item) =>
          !["closed", "void"].includes(item.report.status) &&
          (item.summary.criticalChecks > 0 || item.summary.overdue),
      ).length,
    },
    reports: workspaces,
    references: {
      assets: assets
        .filter((asset) => !["missing", "archived"].includes(asset.status))
        .map((asset) => ({
          sampleAssetId: asset.id,
          assetCode: asset.assetCode,
          workTitle: asset.workTitle,
          lookNumber: asset.lookNumber,
          status: asset.status,
          condition: asset.condition,
          currentLocation: asset.currentLocation,
          imageUrl: asset.imageKey ? mediaUrl(asset.imageKey) : "",
          latestSequence: (reportsByAsset.get(asset.id) ?? []).reduce(
            (latest, item) => Math.max(latest, item.sequence),
            0,
          ),
        })),
    },
  };
}

export function conservationMissingFields(
  report: ConservationReport,
  images: Array<{ status: string }>,
) {
  const missing: string[] = [];
  if (!report.assessedAt) missing.push("检查时间");
  if (!report.assessmentLocation.trim()) missing.push("检查地点");
  if (report.overallCondition === "not_checked") missing.push("总体状态");
  if (!report.conditionSummary.trim()) missing.push("状态总结");
  if (!report.storageGuidance.trim()) missing.push("保存建议");
  if (!report.nextReviewAt) missing.push("下次复查时间");
  if (!report.approvalNote.trim()) missing.push("人工结论依据");
  if (images.filter((image) => image.status === "active").length === 0) {
    missing.push("至少一张私密状态证据");
  }
  return missing;
}

export function conservationReportsToCsv(overview: ConservationOverview) {
  return toCsv([
    ["report_code", "asset_code", "work_title", "sequence", "status", "decision", "assessed_at", "overall_condition", "next_review_at", "approved_by", "approved_at"],
    ...overview.reports.map(({ report, asset, work }) => [
      report.reportCode,
      asset?.assetCode ?? "",
      work?.title ?? asset?.workTitle ?? "",
      report.sequence,
      report.status,
      report.decision,
      report.assessedAt ?? "",
      report.overallCondition,
      report.nextReviewAt ?? "",
      report.approvedBy,
      report.approvedAt ?? "",
    ]),
  ]);
}

export function conservationChecksToCsv(overview: ConservationOverview) {
  return toCsv([
    ["report_code", "category", "title", "result", "severity", "observation", "treatment_note"],
    ...overview.reports.flatMap(({ report, checks }) =>
      checks.map((check) => [
        report.reportCode,
        check.category,
        check.title,
        check.result,
        check.severity,
        check.observation,
        check.treatmentNote,
      ]),
    ),
  ]);
}

export function conservationImagesToCsv(overview: ConservationOverview) {
  return toCsv([
    ["report_code", "angle", "caption", "alt_text", "object_key", "content_type", "bytes", "status"],
    ...overview.reports.flatMap(({ report, images }) =>
      images.map((image) => [
        report.reportCode,
        image.angle,
        image.caption,
        image.altText,
        image.imageKey,
        image.imageType,
        image.imageSize,
        image.status,
      ]),
    ),
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

function toCsv(rows: Array<Array<string | number>>) {
  return rows
    .map((row) =>
      row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");
}
