import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  sampleSignoffChecks,
  sampleSignoffImages,
  sampleSignoffs,
  type SampleSignoff,
  type SampleSignoffCheck,
  type SampleSignoffImage,
} from "@/db/schema";
import {
  listAllFittingSessions,
} from "@/lib/fittings";
import {
  listAllTechnicalPacks,
} from "@/lib/technical-packs";
import { listAllWorks, mediaUrl } from "@/lib/works";

export const SAMPLE_SIGNOFF_TYPES = [
  "preproduction",
  "final",
  "showroom",
  "reference",
] as const;

export const SAMPLE_SIGNOFF_STATUSES = [
  "draft",
  "in_review",
  "approved",
  "sealed",
  "void",
] as const;

export const SAMPLE_SIGNOFF_DECISIONS = [
  "pending",
  "approve",
  "revise",
  "hold",
] as const;

export const SAMPLE_SIGNOFF_CHECK_CATEGORIES = [
  "silhouette",
  "measurements",
  "materials",
  "trims",
  "construction",
  "finishing",
  "color",
  "labels",
] as const;

export const SAMPLE_SIGNOFF_CHECK_RESULTS = [
  "pending",
  "pass",
  "fail",
  "na",
] as const;

export const SAMPLE_SIGNOFF_IMAGE_ANGLES = [
  "front",
  "side",
  "back",
  "detail",
  "label",
  "seal",
  "other",
] as const;

export const SAMPLE_SIGNOFF_IMAGE_STATUSES = [
  "active",
  "removed",
] as const;

export const DEFAULT_SAMPLE_SIGNOFF_CHECKS = [
  {
    category: "silhouette",
    title: "廓形与试身结论",
    requirement: "最终样衣廓形、比例与已批准试身结论一致。",
  },
  {
    category: "measurements",
    title: "关键尺寸与公差",
    requirement: "基码与关键 POM 落在批准技术包的允许公差内。",
  },
  {
    category: "materials",
    title: "主面料与内里",
    requirement: "主面料、内里、克重、手感与已批准材料事实一致。",
  },
  {
    category: "trims",
    title: "辅料、五金与装饰",
    requirement: "辅料、五金、装饰及位置与 Look 用料表一致。",
  },
  {
    category: "construction",
    title: "结构与制作工艺",
    requirement: "缝型、针距、结构、加固与关键制作说明一致。",
  },
  {
    category: "finishing",
    title: "整烫与表面完成",
    requirement: "整烫、表面处理、清洁度与最终完成标准一致。",
  },
  {
    category: "color",
    title: "颜色与批次",
    requirement: "颜色、色差与可追溯批次符合批准标准。",
  },
  {
    category: "labels",
    title: "品牌与成分标识",
    requirement: "品牌标、尺码标、成分与洗护标识内容和位置正确。",
  },
] as const;

export type SampleSignoffType = (typeof SAMPLE_SIGNOFF_TYPES)[number];
export type SampleSignoffStatus =
  (typeof SAMPLE_SIGNOFF_STATUSES)[number];
export type SampleSignoffDecision =
  (typeof SAMPLE_SIGNOFF_DECISIONS)[number];
export type SampleSignoffCheckCategory =
  (typeof SAMPLE_SIGNOFF_CHECK_CATEGORIES)[number];
export type SampleSignoffCheckResult =
  (typeof SAMPLE_SIGNOFF_CHECK_RESULTS)[number];
export type SampleSignoffImageAngle =
  (typeof SAMPLE_SIGNOFF_IMAGE_ANGLES)[number];
export type SampleSignoffImageStatus =
  (typeof SAMPLE_SIGNOFF_IMAGE_STATUSES)[number];

export type SampleSignoffWorkspace = {
  signoff: SampleSignoff;
  technicalPack: {
    id: string;
    techPackCode: string;
    revision: number;
    status: string;
    sampleStage: string;
    baseSize: string;
    unit: string;
  } | null;
  fittingSession: {
    id: string;
    fittingCode: string;
    round: number;
    status: string;
    decision: string;
    fittingAt: string | null;
    sampleSize: string;
  } | null;
  work: {
    id: string;
    title: string;
    lookNumber: string;
    collection: string;
    status: string;
    imageUrl: string;
  } | null;
  checks: SampleSignoffCheck[];
  images: Array<SampleSignoffImage & { imageUrl: string }>;
  summary: {
    activeImages: number;
    passedChecks: number;
    pendingChecks: number;
    failedChecks: number;
    completeness: number;
    missingFields: string[];
    approvalReady: boolean;
  };
};

export type SampleSignoffOverview = {
  generatedAt: string;
  metrics: {
    signoffCount: number;
    draftCount: number;
    reviewCount: number;
    approvedCount: number;
    sealedCount: number;
    incompleteCount: number;
    failedCheckCount: number;
    readyPacksWithoutSignoffCount: number;
  };
  signoffs: SampleSignoffWorkspace[];
  references: {
    eligibleSources: Array<{
      technicalPackId: string;
      techPackCode: string;
      revision: number;
      sampleStage: string;
      baseSize: string;
      unit: string;
      workId: string;
      workTitle: string;
      lookNumber: string;
      collection: string;
      workImageUrl: string;
      fittingSessionId: string;
      fittingCode: string;
      fittingRound: number;
      fittingAt: string | null;
      sampleSize: string;
      latestSignoffRound: number;
    }>;
  };
};

export async function listAllSampleSignoffs(limit = 4000) {
  const db = await getDb();
  return db
    .select()
    .from(sampleSignoffs)
    .orderBy(
      desc(sampleSignoffs.updatedAt),
      desc(sampleSignoffs.round),
    )
    .limit(limit);
}

export async function listAllSampleSignoffChecks(limit = 32000) {
  const db = await getDb();
  return db
    .select()
    .from(sampleSignoffChecks)
    .orderBy(
      asc(sampleSignoffChecks.sampleSignoffId),
      asc(sampleSignoffChecks.sortOrder),
    )
    .limit(limit);
}

export async function listAllSampleSignoffImages(limit = 20000) {
  const db = await getDb();
  return db
    .select()
    .from(sampleSignoffImages)
    .orderBy(
      asc(sampleSignoffImages.sampleSignoffId),
      asc(sampleSignoffImages.sortOrder),
      asc(sampleSignoffImages.createdAt),
    )
    .limit(limit);
}

export async function getSampleSignoff(id: string) {
  const db = await getDb();
  const [record] = await db
    .select()
    .from(sampleSignoffs)
    .where(eq(sampleSignoffs.id, id))
    .limit(1);
  return record ?? null;
}

export async function getSampleSignoffCheck(id: string) {
  const db = await getDb();
  const [record] = await db
    .select()
    .from(sampleSignoffChecks)
    .where(eq(sampleSignoffChecks.id, id))
    .limit(1);
  return record ?? null;
}

export async function getSampleSignoffImage(id: string) {
  const db = await getDb();
  const [record] = await db
    .select()
    .from(sampleSignoffImages)
    .where(eq(sampleSignoffImages.id, id))
    .limit(1);
  return record ?? null;
}

export async function buildSampleSignoffOverview(): Promise<SampleSignoffOverview> {
  const [signoffRows, checkRows, imageRows, packRows, fittingRows, works] =
    await Promise.all([
      listAllSampleSignoffs(),
      listAllSampleSignoffChecks(),
      listAllSampleSignoffImages(),
      listAllTechnicalPacks(),
      listAllFittingSessions(),
      listAllWorks(3000),
    ]);
  const checksBySignoff = groupBy(
    checkRows,
    (check) => check.sampleSignoffId,
  );
  const imagesBySignoff = groupBy(
    imageRows,
    (image) => image.sampleSignoffId,
  );
  const signoffsByPack = groupBy(
    signoffRows,
    (signoff) => signoff.technicalPackId,
  );
  const fittingsByPack = groupBy(
    fittingRows,
    (session) => session.technicalPackId,
  );
  const packById = new Map(packRows.map((pack) => [pack.id, pack]));
  const fittingById = new Map(
    fittingRows.map((session) => [session.id, session]),
  );
  const workById = new Map(works.map((work) => [work.id, work]));

  const workspaces = signoffRows.map((signoff) => {
    const pack = packById.get(signoff.technicalPackId) ?? null;
    const fitting = fittingById.get(signoff.fittingSessionId) ?? null;
    const work = workById.get(signoff.workId) ?? null;
    const checks = checksBySignoff.get(signoff.id) ?? [];
    const images = (imagesBySignoff.get(signoff.id) ?? []).map((image) => ({
      ...image,
      imageUrl: mediaUrl(image.imageKey),
    }));
    const activeImages = images.filter((image) => image.status === "active");
    const activeChecks = checks.filter((check) => check.critical);
    const missingFields = sampleSignoffMissingFields(signoff, activeImages);
    const passedChecks = activeChecks.filter(
      (check) => check.result === "pass",
    ).length;
    const pendingChecks = activeChecks.filter(
      (check) => ["pending", "na"].includes(check.result),
    ).length;
    const failedChecks = activeChecks.filter(
      (check) => check.result === "fail",
    ).length;
    const factCount = 6 + activeChecks.length;
    const completeFacts =
      6 - missingFields.length + passedChecks;
    return {
      signoff,
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
      fittingSession: fitting
        ? {
            id: fitting.id,
            fittingCode: fitting.fittingCode,
            round: fitting.round,
            status: fitting.status,
            decision: fitting.decision,
            fittingAt: fitting.fittingAt,
            sampleSize: fitting.sampleSize,
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
      checks,
      images,
      summary: {
        activeImages: activeImages.length,
        passedChecks,
        pendingChecks,
        failedChecks,
        completeness: factCount
          ? Math.max(
              0,
              Math.round((completeFacts / factCount) * 100),
            )
          : 0,
        missingFields,
        approvalReady:
          missingFields.length === 0 &&
          failedChecks === 0 &&
          pendingChecks === 0 &&
          signoff.decision === "approve" &&
          Boolean(
            pack &&
              ["approved", "locked"].includes(pack.status) &&
              ["preproduction", "final"].includes(pack.sampleStage),
          ) &&
          Boolean(
            fitting &&
              ["approved", "closed"].includes(fitting.status) &&
              fitting.decision === "approve",
          ),
      },
    } satisfies SampleSignoffWorkspace;
  });

  const eligibleSources = packRows.flatMap((pack) => {
    if (!["approved", "locked"].includes(pack.status)) return [];
    const packFittings = [...(fittingsByPack.get(pack.id) ?? [])].sort(
      (left, right) =>
        right.round - left.round ||
        timestamp(right.updatedAt) - timestamp(left.updatedAt),
    );
    const fitting = packFittings[0] ?? null;
    if (
      !fitting ||
      !["approved", "closed"].includes(fitting.status) ||
      fitting.decision !== "approve"
    ) {
      return [];
    }
    const work = workById.get(pack.workId);
    if (!work) return [];
    const packSignoffs = signoffsByPack.get(pack.id) ?? [];
    return [
      {
        technicalPackId: pack.id,
        techPackCode: pack.techPackCode,
        revision: pack.revision,
        sampleStage: pack.sampleStage,
        baseSize: pack.baseSize,
        unit: pack.unit,
        workId: work.id,
        workTitle: work.title,
        lookNumber: work.lookNumber,
        collection: work.collection,
        workImageUrl: mediaUrl(work.imageKey),
        fittingSessionId: fitting.id,
        fittingCode: fitting.fittingCode,
        fittingRound: fitting.round,
        fittingAt: fitting.fittingAt,
        sampleSize: fitting.sampleSize,
        latestSignoffRound: packSignoffs.reduce(
          (latest, signoff) => Math.max(latest, signoff.round),
          0,
        ),
      },
    ];
  });

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      signoffCount: signoffRows.length,
      draftCount: signoffRows.filter((row) => row.status === "draft").length,
      reviewCount: signoffRows.filter((row) => row.status === "in_review")
        .length,
      approvedCount: signoffRows.filter((row) => row.status === "approved")
        .length,
      sealedCount: signoffRows.filter((row) => row.status === "sealed").length,
      incompleteCount: workspaces.filter(
        (workspace) =>
          !["sealed", "void"].includes(workspace.signoff.status) &&
          !workspace.summary.approvalReady,
      ).length,
      failedCheckCount: checkRows.filter((check) => check.result === "fail")
        .length,
      readyPacksWithoutSignoffCount: eligibleSources.filter(
        (source) =>
          !(signoffsByPack.get(source.technicalPackId) ?? []).some(
            (signoff) =>
              !["void"].includes(signoff.status),
          ),
      ).length,
    },
    signoffs: workspaces,
    references: { eligibleSources },
  };
}

export function sampleSignoffMissingFields(
  signoff: SampleSignoff,
  activeImages: SampleSignoffImage[],
): string[] {
  return [
    signoff.receivedAt ? "" : "收样时间",
    signoff.sampleSize ? "" : "样衣尺码",
    signoff.physicalLocation ? "" : "实物位置",
    signoff.overallObservation ? "" : "总体核对",
    signoff.approvalNote ? "" : "批准说明",
    activeImages.length >= 2 ? "" : "至少两张封样证据",
  ].filter(Boolean);
}

export function sampleSignoffsToCsv(
  overview: SampleSignoffOverview,
): string {
  const columns = [
    "signoffCode",
    "sealCode",
    "work",
    "lookNumber",
    "collection",
    "techPackCode",
    "techPackRevision",
    "fittingCode",
    "round",
    "sampleType",
    "status",
    "decision",
    "sampleSize",
    "makerReference",
    "receivedAt",
    "reviewedAt",
    "physicalLocation",
    "materialLotReference",
    "colorStandardReference",
    "overallObservation",
    "approvalNote",
    "approvedBy",
    "approvedAt",
    "sealedAt",
    "notes",
    "completeness",
    "createdAt",
    "updatedAt",
  ];
  const lines = [columns.map(csvCell).join(",")];
  overview.signoffs.forEach((workspace) => {
    const { signoff, work, technicalPack, fittingSession } = workspace;
    lines.push(
      [
        signoff.signoffCode,
        signoff.sealCode,
        work?.title ?? "",
        work?.lookNumber ?? "",
        work?.collection ?? "",
        technicalPack?.techPackCode ?? "",
        technicalPack?.revision ?? "",
        fittingSession?.fittingCode ?? "",
        signoff.round,
        signoff.sampleType,
        signoff.status,
        signoff.decision,
        signoff.sampleSize,
        signoff.makerReference,
        signoff.receivedAt,
        signoff.reviewedAt,
        signoff.physicalLocation,
        signoff.materialLotReference,
        signoff.colorStandardReference,
        signoff.overallObservation,
        signoff.approvalNote,
        signoff.approvedBy,
        signoff.approvedAt,
        signoff.sealedAt,
        signoff.notes,
        workspace.summary.completeness,
        signoff.createdAt,
        signoff.updatedAt,
      ]
        .map(csvCell)
        .join(","),
    );
  });
  return `\ufeff${lines.join("\r\n")}`;
}

export function sampleSignoffChecksToCsv(
  overview: SampleSignoffOverview,
): string {
  const columns = [
    "signoffCode",
    "sealCode",
    "work",
    "category",
    "title",
    "requirement",
    "result",
    "observation",
    "critical",
    "sortOrder",
    "updatedAt",
  ];
  const lines = [columns.map(csvCell).join(",")];
  overview.signoffs.forEach((workspace) => {
    workspace.checks.forEach((check) => {
      lines.push(
        [
          workspace.signoff.signoffCode,
          workspace.signoff.sealCode,
          workspace.work?.title ?? "",
          check.category,
          check.title,
          check.requirement,
          check.result,
          check.observation,
          check.critical,
          check.sortOrder,
          check.updatedAt,
        ]
          .map(csvCell)
          .join(","),
      );
    });
  });
  return `\ufeff${lines.join("\r\n")}`;
}

export function sampleSignoffImagesToCsv(
  overview: SampleSignoffOverview,
): string {
  const columns = [
    "signoffCode",
    "sealCode",
    "work",
    "angle",
    "caption",
    "altText",
    "status",
    "objectKey",
    "contentType",
    "bytes",
    "sortOrder",
    "createdAt",
  ];
  const lines = [columns.map(csvCell).join(",")];
  overview.signoffs.forEach((workspace) => {
    workspace.images.forEach((image) => {
      lines.push(
        [
          workspace.signoff.signoffCode,
          workspace.signoff.sealCode,
          workspace.work?.title ?? "",
          image.angle,
          image.caption,
          image.altText,
          image.status,
          image.imageKey,
          image.imageType,
          image.imageSize,
          image.sortOrder,
          image.createdAt,
        ]
          .map(csvCell)
          .join(","),
      );
    });
  });
  return `\ufeff${lines.join("\r\n")}`;
}

function groupBy<T>(
  rows: T[],
  keyFor: (row: T) => string,
): Map<string, T[]> {
  const result = new Map<string, T[]>();
  rows.forEach((row) => {
    const key = keyFor(row);
    const current = result.get(key) ?? [];
    current.push(row);
    result.set(key, current);
  });
  return result;
}

function timestamp(value: string | null): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
