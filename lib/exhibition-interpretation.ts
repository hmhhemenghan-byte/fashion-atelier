import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  interpretationLabels,
  interpretationPackages,
  interpretationSections,
  type InterpretationLabel,
  type InterpretationPackage,
  type InterpretationSection,
} from "@/db/schema";
import { buildCuratorialOverview, type CuratorialAssetReference } from "@/lib/archive-curation";

export const INTERPRETATION_STATUSES = ["draft", "in_review", "approved", "closed", "void"] as const;
export const INTERPRETATION_DECISIONS = ["pending", "approve", "revise", "hold"] as const;
export const INTERPRETATION_RIGHTS_STATUSES = ["unchecked", "cleared", "restricted", "not_required"] as const;

export type InterpretationStatus = (typeof INTERPRETATION_STATUSES)[number];
export type InterpretationDecision = (typeof INTERPRETATION_DECISIONS)[number];
export type InterpretationRightsStatus = (typeof INTERPRETATION_RIGHTS_STATUSES)[number];

export type InterpretationLabelView = InterpretationLabel & {
  asset: CuratorialAssetReference | null;
  curatorialRole: string;
  curatorialRationale: string;
};

export type InterpretationWorkspace = {
  package: InterpretationPackage;
  project: {
    id: string;
    projectCode: string;
    title: string;
    status: string;
    curator: string;
    thesis: string;
  } | null;
  sections: InterpretationSection[];
  labels: InterpretationLabelView[];
  summary: {
    sectionCount: number;
    labelCount: number;
    expectedLabelCount: number;
    expectedSelectionIds: string[];
    clearedLabels: number;
    missingFields: string[];
    approvalReady: boolean;
  };
};

export type InterpretationOverview = {
  generatedAt: string;
  metrics: { total: number; inReview: number; approved: number; labels: number; attention: number };
  packages: InterpretationWorkspace[];
  references: {
    projects: Array<{ id: string; projectCode: string; title: string; curator: string; status: string; included: number; existingRevisions: number }>;
  };
};

export async function listAllInterpretationPackages(limit = 4000) {
  const db = await getDb();
  return db.select().from(interpretationPackages).orderBy(desc(interpretationPackages.updatedAt)).limit(limit);
}

export async function listAllInterpretationSections(limit = 24000) {
  const db = await getDb();
  return db.select().from(interpretationSections).orderBy(asc(interpretationSections.interpretationPackageId), asc(interpretationSections.sequence)).limit(limit);
}

export async function listAllInterpretationLabels(limit = 24000) {
  const db = await getDb();
  return db.select().from(interpretationLabels).orderBy(asc(interpretationLabels.interpretationPackageId), asc(interpretationLabels.sequence)).limit(limit);
}

export async function getInterpretationPackage(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(interpretationPackages).where(eq(interpretationPackages.id, id)).limit(1);
  return row ?? null;
}

export async function getInterpretationSection(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(interpretationSections).where(eq(interpretationSections.id, id)).limit(1);
  return row ?? null;
}

export async function getInterpretationLabel(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(interpretationLabels).where(eq(interpretationLabels.id, id)).limit(1);
  return row ?? null;
}

export async function buildInterpretationOverview(now = new Date()): Promise<InterpretationOverview> {
  const [packages, sections, labels, curation] = await Promise.all([
    listAllInterpretationPackages(),
    listAllInterpretationSections(),
    listAllInterpretationLabels(),
    buildCuratorialOverview(now),
  ]);
  const projectById = new Map(curation.projects.map((item) => [item.project.id, item]));
  const sectionsByPackage = groupBy(sections, (item) => item.interpretationPackageId);
  const labelsByPackage = groupBy(labels, (item) => item.interpretationPackageId);
  const selectionById = new Map(curation.projects.flatMap((item) => item.selections).map((item) => [item.id, item]));
  const workspaces = packages.map((item) => {
    const projectWorkspace = projectById.get(item.curatorialProjectId) ?? null;
    const packageSections = sectionsByPackage.get(item.id) ?? [];
    const packageLabels = (labelsByPackage.get(item.id) ?? []).map((label) => {
      const selection = selectionById.get(label.curatorialSelectionId);
      return {
        ...label,
        asset: selection?.asset ?? null,
        curatorialRole: selection?.role ?? "",
        curatorialRationale: selection?.rationale ?? "",
      };
    });
    const expectedSelections = projectWorkspace?.selections.filter((selection) => selection.decision === "include") ?? [];
    const missingFields = interpretationMissingFields(item, packageSections, packageLabels, expectedSelections.map((selection) => selection.id));
    const clearedLabels = packageLabels.filter((label) => ["cleared", "not_required"].includes(label.rightsStatus)).length;
    return {
      package: item,
      project: projectWorkspace ? {
        id: projectWorkspace.project.id,
        projectCode: projectWorkspace.project.projectCode,
        title: projectWorkspace.project.title,
        status: projectWorkspace.project.status,
        curator: projectWorkspace.project.curator,
        thesis: projectWorkspace.project.thesis,
      } : null,
      sections: packageSections,
      labels: packageLabels,
      summary: {
        sectionCount: packageSections.length,
        labelCount: packageLabels.length,
        expectedLabelCount: expectedSelections.length,
        expectedSelectionIds: expectedSelections.map((selection) => selection.id),
        clearedLabels,
        missingFields,
        approvalReady: missingFields.length === 0 && item.decision === "approve",
      },
    } satisfies InterpretationWorkspace;
  });
  const revisionCountByProject = new Map<string, number>();
  packages.forEach((item) => revisionCountByProject.set(item.curatorialProjectId, (revisionCountByProject.get(item.curatorialProjectId) ?? 0) + 1));
  return {
    generatedAt: now.toISOString(),
    metrics: {
      total: packages.length,
      inReview: packages.filter((item) => item.status === "in_review").length,
      approved: packages.filter((item) => item.status === "approved").length,
      labels: labels.length,
      attention: workspaces.filter((item) => !["approved", "closed", "void"].includes(item.package.status) && (item.package.status === "in_review" || item.package.decision === "revise") && !item.summary.approvalReady).length,
    },
    packages: workspaces,
    references: {
      projects: curation.projects
        .filter((item) => ["approved", "closed"].includes(item.project.status))
        .map((item) => ({
          id: item.project.id,
          projectCode: item.project.projectCode,
          title: item.project.title,
          curator: item.project.curator,
          status: item.project.status,
          included: item.selections.filter((selection) => selection.decision === "include").length,
          existingRevisions: revisionCountByProject.get(item.project.id) ?? 0,
        })),
    },
  };
}

export function interpretationMissingFields(
  item: InterpretationPackage,
  sections: InterpretationSection[],
  labels: InterpretationLabelView[],
  expectedSelectionIds: string[],
) {
  const missing: string[] = [];
  if (!item.editor.trim()) missing.push("文字负责人");
  if (!item.primaryLanguage.trim()) missing.push("主语言");
  if (!item.title.trim()) missing.push("展览标题");
  if (!item.entranceText.trim()) missing.push("入口导语");
  if (!item.curatorialCredit.trim()) missing.push("策展署名");
  if (!item.accessibilityNote.trim()) missing.push("无障碍释读说明");
  if (!item.rightsNote.trim()) missing.push("权利与引用说明");
  if (!item.approvalNote.trim()) missing.push("人工批准依据");
  if (sections.length === 0) missing.push("至少一个叙事章节");
  sections.forEach((section, index) => {
    if (!section.titlePrimary.trim()) missing.push(`第 ${index + 1} 章节标题`);
    if (!section.bodyPrimary.trim()) missing.push(`第 ${index + 1} 章节正文`);
    if (item.secondaryLanguage && (!section.titleSecondary.trim() || !section.bodySecondary.trim())) missing.push(`第 ${index + 1} 章节第二语言`);
  });
  const labelBySelection = new Map(labels.map((label) => [label.curatorialSelectionId, label]));
  expectedSelectionIds.forEach((selectionId) => {
    const label = labelBySelection.get(selectionId);
    if (!label) { missing.push("所有纳入作品的标签"); return; }
    const code = label.asset?.assetCode || "作品标签";
    if (!label.headline.trim()) missing.push(`${code}标题`);
    if (!label.bodyPrimary.trim()) missing.push(`${code}主语言正文`);
    if (item.secondaryLanguage && !label.bodySecondary.trim()) missing.push(`${code}第二语言正文`);
    if (!label.objectFacts.trim()) missing.push(`${code}作品事实`);
    if (!label.creditLine.trim()) missing.push(`${code}署名`);
    if (!label.accessibilityText.trim()) missing.push(`${code}无障碍描述`);
    if (!label.sourceNote.trim()) missing.push(`${code}来源依据`);
    if (!["cleared", "not_required"].includes(label.rightsStatus)) missing.push(`${code}权利状态`);
  });
  if (labels.some((label) => !expectedSelectionIds.includes(label.curatorialSelectionId))) missing.push("标签与冻结策展选择一致");
  return [...new Set(missing)];
}

export function interpretationPackagesToCsv(overview: InterpretationOverview) {
  return csv([["package_code", "curatorial_project", "revision", "status", "decision", "editor", "primary_language", "secondary_language", "sections", "labels", "rights_cleared"], ...overview.packages.map((workspace) => [workspace.package.packageCode, workspace.project?.projectCode ?? "", workspace.package.revision, workspace.package.status, workspace.package.decision, workspace.package.editor, workspace.package.primaryLanguage, workspace.package.secondaryLanguage, workspace.summary.sectionCount, workspace.summary.labelCount, workspace.summary.clearedLabels])]);
}

export function interpretationSectionsToCsv(overview: InterpretationOverview) {
  return csv([["package_code", "sequence", "title_primary", "title_secondary", "body_primary", "body_secondary"], ...overview.packages.flatMap((workspace) => workspace.sections.map((section) => [workspace.package.packageCode, section.sequence, section.titlePrimary, section.titleSecondary, section.bodyPrimary, section.bodySecondary]))]);
}

export function interpretationLabelsToCsv(overview: InterpretationOverview) {
  return csv([["package_code", "asset_code", "work_title", "sequence", "curatorial_role", "headline", "body_primary", "body_secondary", "object_facts", "credit_line", "accessibility_text", "source_note", "rights_status"], ...overview.packages.flatMap((workspace) => workspace.labels.map((label) => [workspace.package.packageCode, label.asset?.assetCode ?? "", label.asset?.workTitle ?? "", label.sequence, label.curatorialRole, label.headline, label.bodyPrimary, label.bodySecondary, label.objectFacts, label.creditLine, label.accessibilityText, label.sourceNote, label.rightsStatus]))]);
}

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const result = new Map<string, T[]>();
  rows.forEach((row) => result.set(key(row), [...(result.get(key(row)) ?? []), row]));
  return result;
}

function csv(rows: Array<Array<string | number>>) {
  return `\ufeff${rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n")}`;
}
