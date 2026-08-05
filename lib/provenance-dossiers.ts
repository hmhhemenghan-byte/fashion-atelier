import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  provenanceDossierChecks,
  provenanceDossiers,
  type ProvenanceDossier,
  type ProvenanceDossierCheck,
} from "@/db/schema";
import { listAllProductionAcceptances } from "@/lib/production-acceptances";
import { listAllProductionReleases } from "@/lib/production-releases";
import { listAllWorks, mediaUrl } from "@/lib/works";

export const PROVENANCE_DOSSIER_STATUSES = [
  "draft",
  "in_review",
  "published",
  "retired",
  "void",
] as const;

export const PROVENANCE_DOSSIER_DECISIONS = [
  "pending",
  "publish",
  "revise",
  "hold",
] as const;

export const PROVENANCE_DOSSIER_CHECK_RESULTS = [
  "pending",
  "pass",
  "fail",
  "na",
] as const;

export const DEFAULT_PROVENANCE_DOSSIER_CHECKS = [
  {
    category: "identity",
    title: "作品与实物身份",
    requirement: "Look、版号、颜色与 NERA-ACCEPT 验收事实一致。",
  },
  {
    category: "source",
    title: "签核来源",
    requirement: "档案可追溯至唯一且有效的 NERA-GO 与 NERA-ACCEPT。",
  },
  {
    category: "materials",
    title: "材料披露",
    requirement: "公开材料描述与最终成衣事实一致，不作无法证明的声明。",
  },
  {
    category: "maker",
    title: "制作信息",
    requirement: "制作方、制作地点与完成时间已由设计师核对。",
  },
  {
    category: "care",
    title: "护理与修复",
    requirement: "护理及修复建议清楚、适用且不会伤害作品。",
  },
  {
    category: "public_copy",
    title: "公开文案",
    requirement: "设计故事与公开摘要准确，不泄露私密证据或个人信息。",
  },
] as const;

export type ProvenanceDossierStatus =
  (typeof PROVENANCE_DOSSIER_STATUSES)[number];
export type ProvenanceDossierDecision =
  (typeof PROVENANCE_DOSSIER_DECISIONS)[number];
export type ProvenanceDossierCheckResult =
  (typeof PROVENANCE_DOSSIER_CHECK_RESULTS)[number];

export type ProvenanceDossierWorkspace = {
  dossier: ProvenanceDossier;
  acceptance: {
    id: string;
    acceptanceCode: string;
    acceptanceSeal: string;
    editionReference: string;
    colorway: string;
    sizeRange: string;
    acceptedAt: string | null;
  } | null;
  release: {
    releaseCode: string;
    authorizationCode: string | null;
  } | null;
  work: {
    id: string;
    title: string;
    lookNumber: string;
    collection: string;
    imageUrl: string;
  } | null;
  checks: ProvenanceDossierCheck[];
  summary: {
    passedChecks: number;
    failedChecks: number;
    pendingChecks: number;
    missingFields: string[];
    publishReady: boolean;
  };
};

export type ProvenanceDossierOverview = {
  generatedAt: string;
  metrics: {
    total: number;
    inReview: number;
    published: number;
    retired: number;
    attention: number;
  };
  dossiers: ProvenanceDossierWorkspace[];
  references: {
    acceptedSources: Array<{
      productionAcceptanceId: string;
      acceptanceCode: string;
      acceptanceSeal: string;
      workId: string;
      workTitle: string;
      lookNumber: string;
      collection: string;
      imageUrl: string;
      latestRevision: number;
    }>;
  };
};

export async function listAllProvenanceDossiers(limit = 8000) {
  const db = await getDb();
  return db
    .select()
    .from(provenanceDossiers)
    .orderBy(desc(provenanceDossiers.updatedAt), desc(provenanceDossiers.revision))
    .limit(limit);
}

export async function listAllProvenanceDossierChecks(limit = 48000) {
  const db = await getDb();
  return db
    .select()
    .from(provenanceDossierChecks)
    .orderBy(
      asc(provenanceDossierChecks.provenanceDossierId),
      asc(provenanceDossierChecks.sortOrder),
    )
    .limit(limit);
}

export async function getProvenanceDossier(id: string) {
  const db = await getDb();
  const [record] = await db
    .select()
    .from(provenanceDossiers)
    .where(eq(provenanceDossiers.id, id))
    .limit(1);
  return record ?? null;
}

export async function getProvenanceDossierBySlug(slug: string) {
  const db = await getDb();
  const [record] = await db
    .select()
    .from(provenanceDossiers)
    .where(eq(provenanceDossiers.slug, slug))
    .limit(1);
  return record ?? null;
}

export async function getProvenanceDossierCheck(id: string) {
  const db = await getDb();
  const [record] = await db
    .select()
    .from(provenanceDossierChecks)
    .where(eq(provenanceDossierChecks.id, id))
    .limit(1);
  return record ?? null;
}

export async function buildProvenanceDossierOverview(): Promise<ProvenanceDossierOverview> {
  const [dossiers, checks, acceptances, releases, works] = await Promise.all([
    listAllProvenanceDossiers(),
    listAllProvenanceDossierChecks(),
    listAllProductionAcceptances(),
    listAllProductionReleases(),
    listAllWorks(4000),
  ]);
  const acceptanceById = new Map(acceptances.map((item) => [item.id, item]));
  const releaseById = new Map(releases.map((item) => [item.id, item]));
  const workById = new Map(works.map((item) => [item.id, item]));
  const checksByDossier = groupBy(checks, (item) => item.provenanceDossierId);
  const dossiersByAcceptance = groupBy(
    dossiers,
    (item) => item.productionAcceptanceId,
  );

  const workspaces = dossiers.map((dossier) => {
    const acceptance = acceptanceById.get(dossier.productionAcceptanceId) ?? null;
    const release = acceptance
      ? releaseById.get(acceptance.productionReleaseId) ?? null
      : null;
    const work = workById.get(dossier.workId) ?? null;
    const linkedChecks = checksByDossier.get(dossier.id) ?? [];
    const critical = linkedChecks.filter((check) => check.critical);
    const missingFields = provenanceDossierMissingFields(dossier);
    const passedChecks = critical.filter((check) => check.result === "pass").length;
    const failedChecks = critical.filter((check) => check.result === "fail").length;
    const pendingChecks = critical.filter((check) => check.result !== "pass" && check.result !== "fail").length;
    const sourceValid = Boolean(
      acceptance?.status === "accepted" && acceptance.acceptanceSeal,
    );
    return {
      dossier,
      acceptance: acceptance?.acceptanceSeal
        ? {
            id: acceptance.id,
            acceptanceCode: acceptance.acceptanceCode,
            acceptanceSeal: acceptance.acceptanceSeal,
            editionReference: acceptance.editionReference,
            colorway: acceptance.colorway,
            sizeRange: acceptance.sizeRange,
            acceptedAt: acceptance.acceptedAt,
          }
        : null,
      release: release
        ? {
            releaseCode: release.releaseCode,
            authorizationCode: release.authorizationCode,
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
      summary: {
        passedChecks,
        failedChecks,
        pendingChecks,
        missingFields,
        publishReady:
          sourceValid &&
          dossier.decision === "publish" &&
          missingFields.length === 0 &&
          critical.length >= 6 &&
          critical.every((check) => check.result === "pass"),
      },
    } satisfies ProvenanceDossierWorkspace;
  });

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      total: dossiers.length,
      inReview: dossiers.filter((item) => item.status === "in_review").length,
      published: dossiers.filter((item) => item.status === "published").length,
      retired: dossiers.filter((item) => item.status === "retired").length,
      attention: workspaces.filter(
        (item) =>
          !["published", "retired", "void"].includes(item.dossier.status) &&
          (item.summary.failedChecks > 0 || item.summary.missingFields.length > 0),
      ).length,
    },
    dossiers: workspaces,
    references: {
      acceptedSources: acceptances
        .filter((item) => item.status === "accepted" && Boolean(item.acceptanceSeal))
        .flatMap((acceptance) => {
          const work = workById.get(acceptance.workId);
          if (!work || !acceptance.acceptanceSeal) return [];
          return [{
            productionAcceptanceId: acceptance.id,
            acceptanceCode: acceptance.acceptanceCode,
            acceptanceSeal: acceptance.acceptanceSeal,
            workId: work.id,
            workTitle: work.title,
            lookNumber: work.lookNumber,
            collection: work.collection,
            imageUrl: mediaUrl(work.imageKey),
            latestRevision: (dossiersByAcceptance.get(acceptance.id) ?? []).reduce(
              (latest, item) => Math.max(latest, item.revision),
              0,
            ),
          }];
        }),
    },
  };
}

export function provenanceDossierMissingFields(record: ProvenanceDossier) {
  const missing: string[] = [];
  if (!record.title.trim()) missing.push("公开标题");
  if (!record.slug.trim()) missing.push("公开地址");
  if (!record.designStory.trim()) missing.push("设计故事");
  if (!record.materialDisclosure.trim()) missing.push("材料披露");
  if (!record.makerDisclosure.trim()) missing.push("制作信息");
  if (!record.placeOfMaking.trim()) missing.push("制作地点");
  if (!record.madeAt) missing.push("完成日期");
  if (!record.careGuidance.trim()) missing.push("护理建议");
  if (!record.repairGuidance.trim()) missing.push("修复建议");
  if (!record.publicSummary.trim()) missing.push("公开摘要");
  return missing;
}

export function provenanceDossiersToCsv(overview: ProvenanceDossierOverview) {
  return toCsv([
    ["dossier_code", "slug", "acceptance_seal", "look_number", "title", "revision", "status", "decision", "place_of_making", "made_at", "published_at"],
    ...overview.dossiers.map(({ dossier, acceptance, work }) => [
      dossier.dossierCode,
      dossier.slug,
      acceptance?.acceptanceSeal ?? "",
      work?.lookNumber ?? "",
      dossier.title,
      dossier.revision,
      dossier.status,
      dossier.decision,
      dossier.placeOfMaking,
      dossier.madeAt ?? "",
      dossier.publishedAt ?? "",
    ]),
  ]);
}

export function provenanceDossierChecksToCsv(overview: ProvenanceDossierOverview) {
  return toCsv([
    ["dossier_code", "category", "title", "requirement", "result", "observation", "critical"],
    ...overview.dossiers.flatMap(({ dossier, checks }) =>
      checks.map((check) => [
        dossier.dossierCode,
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
