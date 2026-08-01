import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  productionReleaseChecks,
  productionReleases,
  type ProductionRelease,
  type ProductionReleaseCheck,
} from "@/db/schema";
import { listAllSampleSignoffs } from "@/lib/sample-signoffs";
import { listAllTechnicalPacks } from "@/lib/technical-packs";
import { listAllWorks, mediaUrl } from "@/lib/works";

export const PRODUCTION_RELEASE_MODES = [
  "atelier",
  "small_batch",
  "production",
  "reference",
] as const;

export const PRODUCTION_RELEASE_STATUSES = [
  "draft",
  "in_review",
  "ready",
  "released",
  "superseded",
  "void",
] as const;

export const PRODUCTION_RELEASE_DECISIONS = [
  "pending",
  "release",
  "revise",
  "hold",
] as const;

export const PRODUCTION_RELEASE_CHECK_CATEGORIES = [
  "reference",
  "revision",
  "grading",
  "bom",
  "color",
  "labels",
  "quality",
  "schedule",
] as const;

export const PRODUCTION_RELEASE_CHECK_RESULTS = [
  "pending",
  "ready",
  "blocked",
  "na",
] as const;

export const DEFAULT_PRODUCTION_RELEASE_CHECKS = [
  {
    category: "reference",
    title: "封样实物与标识",
    requirement: "唯一封样实物、封样编号和存放位置可以被生产团队准确核验。",
  },
  {
    category: "revision",
    title: "最终技术包修订",
    requirement: "放行包只引用已锁定技术包的明确修订，不混用旧版附件。",
  },
  {
    category: "grading",
    title: "尺码范围与放码",
    requirement: "生产尺码范围、基码、关键尺寸与公差规则已经明确。",
  },
  {
    category: "bom",
    title: "材料、辅料与 BOM",
    requirement: "面料、内里、辅料、五金和替代规则与批准事实一致。",
  },
  {
    category: "color",
    title: "色彩与批次标准",
    requirement: "生产色号、色差标准、批次或批准色样引用完整。",
  },
  {
    category: "labels",
    title: "标识与包装说明",
    requirement: "品牌、尺码、成分、洗护标识及包装方向已经核对。",
  },
  {
    category: "quality",
    title: "质量控制点",
    requirement: "关键工艺、外观、测量和最终验收标准已转为可执行检查点。",
  },
  {
    category: "schedule",
    title: "时间窗口与风险",
    requirement: "计划窗口、责任边界和未决风险已写明；不存在未关闭的阻塞项。",
  },
] as const;

export type ProductionReleaseMode =
  (typeof PRODUCTION_RELEASE_MODES)[number];
export type ProductionReleaseStatus =
  (typeof PRODUCTION_RELEASE_STATUSES)[number];
export type ProductionReleaseDecision =
  (typeof PRODUCTION_RELEASE_DECISIONS)[number];
export type ProductionReleaseCheckCategory =
  (typeof PRODUCTION_RELEASE_CHECK_CATEGORIES)[number];
export type ProductionReleaseCheckResult =
  (typeof PRODUCTION_RELEASE_CHECK_RESULTS)[number];

export type ProductionReleaseWorkspace = {
  release: ProductionRelease;
  sampleSignoff: {
    id: string;
    signoffCode: string;
    sealCode: string | null;
    status: string;
    sampleType: string;
    sampleSize: string;
    physicalLocation: string;
    sealedAt: string | null;
  } | null;
  technicalPack: {
    id: string;
    techPackCode: string;
    revision: number;
    status: string;
    sampleStage: string;
    baseSize: string;
    unit: string;
  } | null;
  work: {
    id: string;
    title: string;
    lookNumber: string;
    collection: string;
    status: string;
    imageUrl: string;
  } | null;
  checks: ProductionReleaseCheck[];
  summary: {
    readyChecks: number;
    pendingChecks: number;
    blockedChecks: number;
    completeness: number;
    missingFields: string[];
    approvalReady: boolean;
  };
};

export type ProductionReleaseOverview = {
  generatedAt: string;
  metrics: {
    releaseCount: number;
    draftCount: number;
    reviewCount: number;
    readyCount: number;
    releasedCount: number;
    attentionCount: number;
    blockedCheckCount: number;
    sealedSamplesWithoutReleaseCount: number;
  };
  releases: ProductionReleaseWorkspace[];
  references: {
    eligibleSources: Array<{
      sampleSignoffId: string;
      signoffCode: string;
      sealCode: string;
      sampleType: string;
      sampleSize: string;
      physicalLocation: string;
      sealedAt: string | null;
      technicalPackId: string;
      techPackCode: string;
      revision: number;
      baseSize: string;
      unit: string;
      workId: string;
      workTitle: string;
      lookNumber: string;
      collection: string;
      workImageUrl: string;
      latestReleaseSequence: number;
    }>;
  };
};

export async function listAllProductionReleases(limit = 4000) {
  const db = await getDb();
  return db
    .select()
    .from(productionReleases)
    .orderBy(
      desc(productionReleases.updatedAt),
      desc(productionReleases.sequence),
    )
    .limit(limit);
}

export async function listAllProductionReleaseChecks(limit = 32000) {
  const db = await getDb();
  return db
    .select()
    .from(productionReleaseChecks)
    .orderBy(
      asc(productionReleaseChecks.productionReleaseId),
      asc(productionReleaseChecks.sortOrder),
    )
    .limit(limit);
}

export async function getProductionRelease(id: string) {
  const db = await getDb();
  const [record] = await db
    .select()
    .from(productionReleases)
    .where(eq(productionReleases.id, id))
    .limit(1);
  return record ?? null;
}

export async function getProductionReleaseCheck(id: string) {
  const db = await getDb();
  const [record] = await db
    .select()
    .from(productionReleaseChecks)
    .where(eq(productionReleaseChecks.id, id))
    .limit(1);
  return record ?? null;
}

export async function buildProductionReleaseOverview():
  Promise<ProductionReleaseOverview> {
  const [releases, checks, signoffs, packs, works] = await Promise.all([
    listAllProductionReleases(),
    listAllProductionReleaseChecks(),
    listAllSampleSignoffs(),
    listAllTechnicalPacks(),
    listAllWorks(4000),
  ]);
  const signoffById = new Map(signoffs.map((item) => [item.id, item]));
  const packById = new Map(packs.map((item) => [item.id, item]));
  const workById = new Map(works.map((item) => [item.id, item]));
  const checksByReleaseId = groupBy(
    checks,
    (item) => item.productionReleaseId,
  );
  const releasesBySignoffId = groupBy(
    releases,
    (item) => item.sampleSignoffId,
  );

  const workspaces: ProductionReleaseWorkspace[] = releases.map((release) => {
    const signoff = signoffById.get(release.sampleSignoffId) ?? null;
    const pack = packById.get(release.technicalPackId) ?? null;
    const work = workById.get(release.workId) ?? null;
    const releaseChecks = checksByReleaseId.get(release.id) ?? [];
    const missingFields = productionReleaseMissingFields(release);
    const readyChecks = releaseChecks.filter(
      (check) => check.result === "ready",
    ).length;
    const blockedChecks = releaseChecks.filter(
      (check) => check.result === "blocked",
    ).length;
    const pendingChecks = releaseChecks.filter(
      (check) => check.result !== "ready",
    ).length;
    const fieldScore = Math.max(0, 8 - missingFields.length);
    const completeness = Math.round(
      ((fieldScore + readyChecks) / 16) * 100,
    );
    return {
      release,
      sampleSignoff: signoff
        ? {
            id: signoff.id,
            signoffCode: signoff.signoffCode,
            sealCode: signoff.sealCode,
            status: signoff.status,
            sampleType: signoff.sampleType,
            sampleSize: signoff.sampleSize,
            physicalLocation: signoff.physicalLocation,
            sealedAt: signoff.sealedAt,
          }
        : null,
      technicalPack: pack
        ? {
            id: pack.id,
            techPackCode: pack.techPackCode,
            revision: pack.revision,
            status: pack.status,
            sampleStage: pack.sampleStage,
            baseSize: pack.baseSize,
            unit: pack.unit,
          }
        : null,
      work: work
        ? {
            id: work.id,
            title: work.title,
            lookNumber: work.lookNumber,
            collection: work.collection,
            status: work.status,
            imageUrl: mediaUrl(work.imageKey),
          }
        : null,
      checks: releaseChecks,
      summary: {
        readyChecks,
        pendingChecks,
        blockedChecks,
        completeness,
        missingFields,
        approvalReady:
          missingFields.length === 0 &&
          releaseChecks.length >= 8 &&
          releaseChecks.every((check) => check.result === "ready") &&
          release.decision === "release" &&
          signoff?.status === "sealed" &&
          Boolean(signoff.sealCode) &&
          Boolean(pack && ["approved", "locked"].includes(pack.status)),
      },
    };
  });

  const eligibleSources = signoffs
    .filter(
      (signoff) =>
        signoff.status === "sealed" &&
        Boolean(signoff.sealCode) &&
        ["preproduction", "final"].includes(signoff.sampleType),
    )
    .flatMap((signoff) => {
      const pack = packById.get(signoff.technicalPackId);
      const work = workById.get(signoff.workId);
      if (
        !pack ||
        !work ||
        !["approved", "locked"].includes(pack.status)
      ) {
        return [];
      }
      const existing = releasesBySignoffId.get(signoff.id) ?? [];
      return [
        {
          sampleSignoffId: signoff.id,
          signoffCode: signoff.signoffCode,
          sealCode: signoff.sealCode as string,
          sampleType: signoff.sampleType,
          sampleSize: signoff.sampleSize,
          physicalLocation: signoff.physicalLocation,
          sealedAt: signoff.sealedAt,
          technicalPackId: pack.id,
          techPackCode: pack.techPackCode,
          revision: pack.revision,
          baseSize: pack.baseSize,
          unit: pack.unit,
          workId: work.id,
          workTitle: work.title,
          lookNumber: work.lookNumber,
          collection: work.collection,
          workImageUrl: mediaUrl(work.imageKey),
          latestReleaseSequence: existing.reduce(
            (latest, release) => Math.max(latest, release.sequence),
            0,
          ),
        },
      ];
    })
    .sort(
      (left, right) =>
        timestamp(right.sealedAt) - timestamp(left.sealedAt),
    );

  const attention = workspaces.filter(
    (workspace) =>
      workspace.release.status === "in_review" ||
      workspace.summary.blockedChecks > 0 ||
      workspace.summary.missingFields.length > 0,
  );
  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      releaseCount: releases.length,
      draftCount: releases.filter((item) => item.status === "draft").length,
      reviewCount: releases.filter((item) => item.status === "in_review")
        .length,
      readyCount: releases.filter((item) => item.status === "ready").length,
      releasedCount: releases.filter((item) => item.status === "released")
        .length,
      attentionCount: attention.length,
      blockedCheckCount: checks.filter((item) => item.result === "blocked")
        .length,
      sealedSamplesWithoutReleaseCount: eligibleSources.filter(
        (source) =>
          !(releasesBySignoffId.get(source.sampleSignoffId) ?? []).some(
            (release) =>
              !["void", "superseded"].includes(release.status),
          ),
      ).length,
    },
    releases: workspaces,
    references: { eligibleSources },
  };
}

export function productionReleaseMissingFields(
  release: ProductionRelease,
) {
  const missing: string[] = [];
  if (!release.factoryName.trim()) missing.push("执行方或版房");
  if (!release.sizeRange.trim()) missing.push("尺码范围");
  if (!release.colorways.trim()) missing.push("生产色组");
  if (!release.plannedWindowStart) missing.push("计划开始日");
  if (!release.plannedWindowEnd) missing.push("计划结束日");
  if (!release.qualityStandard.trim()) missing.push("质量标准");
  if (!release.packagingInstruction.trim()) missing.push("标识与包装说明");
  if (!release.releaseSummary.trim()) missing.push("放行摘要");
  if (release.openRisk.trim()) missing.push("未关闭风险");
  return missing;
}

export function productionReleasesToCsv(
  overview: ProductionReleaseOverview,
) {
  const rows = overview.releases.map((workspace) => [
    workspace.release.releaseCode,
    workspace.release.authorizationCode ?? "",
    workspace.release.status,
    workspace.release.decision,
    workspace.release.releaseMode,
    workspace.work?.lookNumber ?? "",
    workspace.work?.title ?? "",
    workspace.technicalPack?.techPackCode ?? "",
    workspace.sampleSignoff?.signoffCode ?? "",
    workspace.sampleSignoff?.sealCode ?? "",
    workspace.release.factoryName,
    workspace.release.factoryReference,
    workspace.release.sizeRange,
    workspace.release.colorways,
    workspace.release.plannedWindowStart ?? "",
    workspace.release.plannedWindowEnd ?? "",
    workspace.release.qualityStandard,
    workspace.release.packagingInstruction,
    workspace.release.releaseSummary,
    workspace.release.openRisk,
    workspace.release.approvedBy,
    workspace.release.approvedAt ?? "",
    workspace.release.releasedAt ?? "",
  ]);
  return csv(
    [
      "release_code",
      "authorization_code",
      "status",
      "decision",
      "release_mode",
      "look_number",
      "work_title",
      "technical_pack",
      "sample_signoff",
      "seal_code",
      "factory_name",
      "factory_reference",
      "size_range",
      "colorways",
      "planned_window_start",
      "planned_window_end",
      "quality_standard",
      "packaging_instruction",
      "release_summary",
      "open_risk",
      "approved_by",
      "approved_at",
      "released_at",
    ],
    rows,
  );
}

export function productionReleaseChecksToCsv(
  overview: ProductionReleaseOverview,
) {
  const rows = overview.releases.flatMap((workspace) =>
    workspace.checks.map((check) => [
      workspace.release.releaseCode,
      workspace.work?.lookNumber ?? "",
      check.category,
      check.title,
      check.requirement,
      check.result,
      check.observation,
      check.critical ? "true" : "false",
      String(check.sortOrder),
      check.updatedAt,
    ]),
  );
  return csv(
    [
      "release_code",
      "look_number",
      "category",
      "title",
      "requirement",
      "result",
      "observation",
      "critical",
      "sort_order",
      "updated_at",
    ],
    rows,
  );
}

function csv(headers: string[], rows: string[][]) {
  const lines = [headers, ...rows].map((row) =>
    row.map(csvCell).join(","),
  );
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function csvCell(value: string) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function groupBy<T>(
  items: T[],
  key: (item: T) => string,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  items.forEach((item) => {
    const id = key(item);
    grouped.set(id, [...(grouped.get(id) ?? []), item]);
  });
  return grouped;
}

function timestamp(value: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}
