import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  productionAcceptanceChecks,
  productionAcceptanceImages,
  productionAcceptances,
  type ProductionAcceptance,
  type ProductionAcceptanceCheck,
  type ProductionAcceptanceImage,
} from "@/db/schema";
import { listAllProductionExceptions } from "@/lib/production-exceptions";
import { listAllProductionReleases } from "@/lib/production-releases";
import { listAllWorks, mediaUrl } from "@/lib/works";

export const PRODUCTION_ACCEPTANCE_STATUSES = [
  "draft",
  "in_review",
  "accepted",
  "rejected",
  "void",
] as const;

export const PRODUCTION_ACCEPTANCE_DECISIONS = [
  "pending",
  "accept",
  "rework",
  "hold",
  "reject",
] as const;

export const PRODUCTION_ACCEPTANCE_CHECK_CATEGORIES = [
  "identity",
  "material_color",
  "measurements",
  "construction",
  "finishing",
  "labels",
  "packaging",
  "quantity",
] as const;

export const PRODUCTION_ACCEPTANCE_CHECK_RESULTS = [
  "pending",
  "pass",
  "fail",
  "na",
] as const;

export const PRODUCTION_ACCEPTANCE_IMAGE_ANGLES = [
  "front",
  "back",
  "detail",
  "label",
  "packaging",
  "group",
  "other",
] as const;

export const PRODUCTION_ACCEPTANCE_IMAGE_STATUSES = [
  "active",
  "removed",
] as const;

export const DEFAULT_PRODUCTION_ACCEPTANCE_CHECKS = [
  {
    category: "identity",
    title: "版号与放行身份",
    requirement: "实物版号、颜色、尺码范围与 NERA-GO 放行事实一致。",
  },
  {
    category: "material_color",
    title: "材料、色彩与手感",
    requirement: "面辅料、颜色、批次表现与最终封样和批准标准一致。",
  },
  {
    category: "measurements",
    title: "关键尺寸与尺码递进",
    requirement: "抽检成衣关键尺寸与尺码递进落在批准公差内。",
  },
  {
    category: "construction",
    title: "结构与制作工艺",
    requirement: "缝型、针距、加固、装配与关键制作指令一致。",
  },
  {
    category: "finishing",
    title: "后整理与外观完成",
    requirement: "整烫、表面、清洁度、对称与整体完成度符合标准。",
  },
  {
    category: "labels",
    title: "品牌、尺码与洗护标识",
    requirement: "标识内容、位置、语言与成分洗护事实正确。",
  },
  {
    category: "packaging",
    title: "包装与保护",
    requirement: "折叠、衣架、防护、外包装与放行说明一致。",
  },
  {
    category: "quantity",
    title: "到达与抽检数量",
    requirement: "到达数量、抽检数量与本次验收范围记录完整。",
  },
] as const;

export type ProductionAcceptanceStatus =
  (typeof PRODUCTION_ACCEPTANCE_STATUSES)[number];
export type ProductionAcceptanceDecision =
  (typeof PRODUCTION_ACCEPTANCE_DECISIONS)[number];
export type ProductionAcceptanceCheckCategory =
  (typeof PRODUCTION_ACCEPTANCE_CHECK_CATEGORIES)[number];
export type ProductionAcceptanceCheckResult =
  (typeof PRODUCTION_ACCEPTANCE_CHECK_RESULTS)[number];
export type ProductionAcceptanceImageAngle =
  (typeof PRODUCTION_ACCEPTANCE_IMAGE_ANGLES)[number];
export type ProductionAcceptanceImageStatus =
  (typeof PRODUCTION_ACCEPTANCE_IMAGE_STATUSES)[number];

export type ProductionAcceptanceWorkspace = {
  acceptance: ProductionAcceptance;
  release: {
    id: string;
    releaseCode: string;
    authorizationCode: string | null;
    factoryName: string;
    sizeRange: string;
    colorways: string;
    releasedAt: string | null;
  } | null;
  work: {
    id: string;
    title: string;
    lookNumber: string;
    collection: string;
    imageUrl: string;
  } | null;
  checks: ProductionAcceptanceCheck[];
  images: Array<ProductionAcceptanceImage & { imageUrl: string }>;
  summary: {
    passedChecks: number;
    pendingChecks: number;
    failedChecks: number;
    activeImages: number;
    blockingExceptions: number;
    missingFields: string[];
    approvalReady: boolean;
  };
};

export type ProductionAcceptanceOverview = {
  generatedAt: string;
  metrics: {
    total: number;
    draft: number;
    inReview: number;
    accepted: number;
    rejected: number;
    attention: number;
  };
  acceptances: ProductionAcceptanceWorkspace[];
  references: {
    releasedSources: Array<{
      productionReleaseId: string;
      releaseCode: string;
      authorizationCode: string;
      factoryName: string;
      sizeRange: string;
      colorways: string;
      workId: string;
      workTitle: string;
      lookNumber: string;
      collection: string;
      imageUrl: string;
      latestSequence: number;
      blockingExceptions: number;
    }>;
  };
};

export async function listAllProductionAcceptances(limit = 8000) {
  const db = await getDb();
  return db
    .select()
    .from(productionAcceptances)
    .orderBy(
      desc(productionAcceptances.updatedAt),
      desc(productionAcceptances.sequence),
    )
    .limit(limit);
}

export async function listAllProductionAcceptanceChecks(limit = 64000) {
  const db = await getDb();
  return db
    .select()
    .from(productionAcceptanceChecks)
    .orderBy(
      asc(productionAcceptanceChecks.productionAcceptanceId),
      asc(productionAcceptanceChecks.sortOrder),
    )
    .limit(limit);
}

export async function listAllProductionAcceptanceImages(limit = 32000) {
  const db = await getDb();
  return db
    .select()
    .from(productionAcceptanceImages)
    .orderBy(
      asc(productionAcceptanceImages.productionAcceptanceId),
      asc(productionAcceptanceImages.sortOrder),
    )
    .limit(limit);
}

export async function getProductionAcceptance(id: string) {
  const db = await getDb();
  const [record] = await db
    .select()
    .from(productionAcceptances)
    .where(eq(productionAcceptances.id, id))
    .limit(1);
  return record ?? null;
}

export async function getProductionAcceptanceCheck(id: string) {
  const db = await getDb();
  const [record] = await db
    .select()
    .from(productionAcceptanceChecks)
    .where(eq(productionAcceptanceChecks.id, id))
    .limit(1);
  return record ?? null;
}

export async function getProductionAcceptanceImage(id: string) {
  const db = await getDb();
  const [record] = await db
    .select()
    .from(productionAcceptanceImages)
    .where(eq(productionAcceptanceImages.id, id))
    .limit(1);
  return record ?? null;
}

export async function buildProductionAcceptanceOverview(): Promise<ProductionAcceptanceOverview> {
  const [acceptances, checks, images, releases, exceptions, works] =
    await Promise.all([
      listAllProductionAcceptances(),
      listAllProductionAcceptanceChecks(),
      listAllProductionAcceptanceImages(),
      listAllProductionReleases(),
      listAllProductionExceptions(),
      listAllWorks(4000),
    ]);
  const releaseById = new Map(releases.map((item) => [item.id, item]));
  const workById = new Map(works.map((item) => [item.id, item]));
  const checksByAcceptance = groupBy(
    checks,
    (item) => item.productionAcceptanceId,
  );
  const imagesByAcceptance = groupBy(
    images,
    (item) => item.productionAcceptanceId,
  );
  const acceptancesByRelease = groupBy(
    acceptances,
    (item) => item.productionReleaseId,
  );
  const blockingByRelease = groupBy(
    exceptions.filter(
      (item) =>
        ["high", "critical"].includes(item.severity) &&
        !["closed", "withdrawn"].includes(item.status),
    ),
    (item) => item.productionReleaseId,
  );

  const workspaces = acceptances.map((acceptance) => {
    const release = releaseById.get(acceptance.productionReleaseId) ?? null;
    const work = workById.get(acceptance.workId) ?? null;
    const linkedChecks = checksByAcceptance.get(acceptance.id) ?? [];
    const linkedImages = (imagesByAcceptance.get(acceptance.id) ?? []).map(
      (image) => ({ ...image, imageUrl: mediaUrl(image.imageKey) }),
    );
    const activeChecks = linkedChecks.filter((check) => check.critical);
    const activeImages = linkedImages.filter((image) => image.status === "active");
    const blockingExceptions = (
      blockingByRelease.get(acceptance.productionReleaseId) ?? []
    ).length;
    const missingFields = productionAcceptanceMissingFields(
      acceptance,
      activeImages,
    );
    const passedChecks = activeChecks.filter(
      (check) => check.result === "pass",
    ).length;
    const failedChecks = activeChecks.filter(
      (check) => check.result === "fail",
    ).length;
    const pendingChecks = activeChecks.filter(
      (check) => check.result !== "pass" && check.result !== "fail",
    ).length;
    return {
      acceptance,
      release: release
        ? {
            id: release.id,
            releaseCode: release.releaseCode,
            authorizationCode: release.authorizationCode,
            factoryName: release.factoryName,
            sizeRange: release.sizeRange,
            colorways: release.colorways,
            releasedAt: release.releasedAt,
          }
        : null,
      work: work
        ? {
            id: work.id,
            title: work.title,
            lookNumber: work.lookNumber,
            collection: work.collection,
            imageUrl: mediaUrl(work.imageKey),
          }
        : null,
      checks: linkedChecks,
      images: linkedImages,
      summary: {
        passedChecks,
        pendingChecks,
        failedChecks,
        activeImages: activeImages.length,
        blockingExceptions,
        missingFields,
        approvalReady:
          missingFields.length === 0 &&
          blockingExceptions === 0 &&
          activeChecks.length >= 8 &&
          activeChecks.every((check) => check.result === "pass"),
      },
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      total: acceptances.length,
      draft: acceptances.filter((item) => item.status === "draft").length,
      inReview: acceptances.filter((item) => item.status === "in_review").length,
      accepted: acceptances.filter((item) => item.status === "accepted").length,
      rejected: acceptances.filter((item) => item.status === "rejected").length,
      attention: workspaces.filter(
        (item) =>
          !["accepted", "rejected", "void"].includes(item.acceptance.status) &&
          (item.summary.failedChecks > 0 ||
            item.summary.blockingExceptions > 0 ||
            item.summary.missingFields.length > 0),
      ).length,
    },
    acceptances: workspaces,
    references: {
      releasedSources: releases
        .filter(
          (release) =>
            release.status === "released" && Boolean(release.authorizationCode),
        )
        .flatMap((release) => {
          const work = workById.get(release.workId);
          if (!work || !release.authorizationCode) return [];
          const linked = acceptancesByRelease.get(release.id) ?? [];
          return [{
            productionReleaseId: release.id,
            releaseCode: release.releaseCode,
            authorizationCode: release.authorizationCode,
            factoryName: release.factoryName,
            sizeRange: release.sizeRange,
            colorways: release.colorways,
            workId: work.id,
            workTitle: work.title,
            lookNumber: work.lookNumber,
            collection: work.collection,
            imageUrl: mediaUrl(work.imageKey),
            latestSequence: linked.reduce(
              (latest, item) => Math.max(latest, item.sequence),
              0,
            ),
            blockingExceptions: (blockingByRelease.get(release.id) ?? []).length,
          }];
        })
        .sort(
          (left, right) =>
            left.lookNumber.localeCompare(right.lookNumber) ||
            left.releaseCode.localeCompare(right.releaseCode),
        ),
    },
  };
}

export function productionAcceptanceMissingFields(
  record: ProductionAcceptance,
  images: Array<{ status: string }>,
) {
  const missing: string[] = [];
  if (!record.editionReference.trim()) missing.push("成衣版号/批次参考");
  if (!record.colorway.trim()) missing.push("颜色");
  if (!record.sizeRange.trim()) missing.push("尺码范围");
  if (record.receivedQuantity <= 0) missing.push("到达数量");
  if (record.inspectedQuantity <= 0) missing.push("抽检数量");
  if (record.inspectedQuantity > record.receivedQuantity) {
    missing.push("抽检数量不能超过到达数量");
  }
  if (!record.receivedAt) missing.push("到达时间");
  if (!record.inspectedAt) missing.push("验收时间");
  if (!record.inspectionStandard.trim()) missing.push("验收标准");
  if (!record.overallObservation.trim()) missing.push("总体观察");
  if (images.filter((image) => image.status === "active").length === 0) {
    missing.push("至少一张私密实物证据");
  }
  return missing;
}

export function productionAcceptancesToCsv(
  overview: ProductionAcceptanceOverview,
) {
  const rows = overview.acceptances.map(({ acceptance, release, work, summary }) => [
    acceptance.acceptanceCode,
    acceptance.acceptanceSeal ?? "",
    release?.releaseCode ?? "",
    release?.authorizationCode ?? "",
    work?.lookNumber ?? "",
    work?.title ?? "",
    acceptance.sequence,
    acceptance.status,
    acceptance.decision,
    acceptance.editionReference,
    acceptance.colorway,
    acceptance.sizeRange,
    acceptance.receivedQuantity,
    acceptance.inspectedQuantity,
    acceptance.receivedAt ?? "",
    acceptance.inspectedAt ?? "",
    acceptance.inspectionStandard,
    acceptance.overallObservation,
    acceptance.dispositionNote,
    summary.blockingExceptions,
    acceptance.acceptedBy,
    acceptance.acceptedAt ?? "",
  ]);
  return toCsv([
    ["acceptance_code", "acceptance_seal", "release_code", "nera_go", "look_number", "work_title", "sequence", "status", "decision", "edition_reference", "colorway", "size_range", "received_quantity", "inspected_quantity", "received_at", "inspected_at", "inspection_standard", "overall_observation", "disposition_note", "blocking_exceptions", "accepted_by", "accepted_at"],
    ...rows,
  ]);
}

export function productionAcceptanceChecksToCsv(
  overview: ProductionAcceptanceOverview,
) {
  return toCsv([
    ["acceptance_code", "category", "title", "requirement", "result", "observation", "critical"],
    ...overview.acceptances.flatMap(({ acceptance, checks }) =>
      checks.map((check) => [
        acceptance.acceptanceCode,
        check.category,
        check.title,
        check.requirement,
        check.result,
        check.observation,
        check.critical ? "true" : "false",
      ]),
    ),
  ]);
}

export function productionAcceptanceImagesToCsv(
  overview: ProductionAcceptanceOverview,
) {
  return toCsv([
    ["acceptance_code", "angle", "caption", "alt_text", "object_key", "content_type", "bytes", "status"],
    ...overview.acceptances.flatMap(({ acceptance, images }) =>
      images.map((image) => [
        acceptance.acceptanceCode,
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
