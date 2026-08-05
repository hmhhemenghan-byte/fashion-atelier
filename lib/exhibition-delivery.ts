import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  exhibitionDeliveryItems,
  exhibitionDeliveryPackages,
  type ExhibitionDeliveryItem,
  type ExhibitionDeliveryPackage,
} from "@/db/schema";
import { buildInterpretationOverview, type InterpretationLabelView, type InterpretationWorkspace } from "@/lib/exhibition-interpretation";

export const EXHIBITION_DELIVERY_STATUSES = ["draft", "in_review", "approved", "closed", "void"] as const;
export const EXHIBITION_DELIVERY_DECISIONS = ["pending", "release", "revise", "hold"] as const;
export const EXHIBITION_DELIVERY_SOURCE_TYPES = ["entrance", "section", "object_label", "credits", "accessibility", "rights"] as const;
export const EXHIBITION_DELIVERY_CHANNELS = ["wall_text", "object_label", "digital_guide", "print_guide", "press_reference", "internal_master"] as const;
export const EXHIBITION_DELIVERY_PROOF_STATUSES = ["draft", "ready", "hold", "omitted"] as const;

export type ExhibitionDeliveryStatus = (typeof EXHIBITION_DELIVERY_STATUSES)[number];
export type ExhibitionDeliveryDecision = (typeof EXHIBITION_DELIVERY_DECISIONS)[number];
export type ExhibitionDeliverySourceType = (typeof EXHIBITION_DELIVERY_SOURCE_TYPES)[number];
export type ExhibitionDeliveryChannel = (typeof EXHIBITION_DELIVERY_CHANNELS)[number];
export type ExhibitionDeliveryProofStatus = (typeof EXHIBITION_DELIVERY_PROOF_STATUSES)[number];

export type ExhibitionDeliveryItemView = ExhibitionDeliveryItem & {
  sourceTitle: string;
  sourceText: string;
  asset: InterpretationLabelView["asset"];
};

export type ExhibitionDeliveryWorkspace = {
  package: ExhibitionDeliveryPackage;
  interpretation: {
    id: string;
    packageCode: string;
    title: string;
    revision: number;
    status: string;
    editor: string;
    primaryLanguage: string;
    secondaryLanguage: string;
    projectCode: string;
    curatorialProjectId: string;
  } | null;
  items: ExhibitionDeliveryItemView[];
  summary: {
    itemCount: number;
    readyCount: number;
    expectedCount: number;
    expectedKeys: string[];
    missingFields: string[];
    approvalReady: boolean;
  };
};

export type ExhibitionDeliveryOverview = {
  generatedAt: string;
  metrics: { total: number; inReview: number; approved: number; items: number; attention: number };
  packages: ExhibitionDeliveryWorkspace[];
  references: {
    interpretations: Array<{ id: string; packageCode: string; title: string; revision: number; editor: string; languages: string; itemCount: number; existingRevisions: number }>;
  };
};

export type ExhibitionDeliveryBlueprint = {
  sourceType: ExhibitionDeliverySourceType;
  sourceId: string;
  language: string;
  channel: ExhibitionDeliveryChannel;
  sequence: number;
  title: string;
};

export async function listAllExhibitionDeliveryPackages(limit = 4000) {
  const db = await getDb();
  return db.select().from(exhibitionDeliveryPackages).orderBy(desc(exhibitionDeliveryPackages.updatedAt)).limit(limit);
}

export async function listAllExhibitionDeliveryItems(limit = 36000) {
  const db = await getDb();
  return db.select().from(exhibitionDeliveryItems).orderBy(asc(exhibitionDeliveryItems.exhibitionDeliveryPackageId), asc(exhibitionDeliveryItems.sequence)).limit(limit);
}

export async function getExhibitionDeliveryPackage(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(exhibitionDeliveryPackages).where(eq(exhibitionDeliveryPackages.id, id)).limit(1);
  return row ?? null;
}

export async function getExhibitionDeliveryItem(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(exhibitionDeliveryItems).where(eq(exhibitionDeliveryItems.id, id)).limit(1);
  return row ?? null;
}

export async function buildExhibitionDeliveryOverview(now = new Date()): Promise<ExhibitionDeliveryOverview> {
  const [packages, items, interpretation] = await Promise.all([
    listAllExhibitionDeliveryPackages(),
    listAllExhibitionDeliveryItems(),
    buildInterpretationOverview(now),
  ]);
  const interpretationById = new Map(interpretation.packages.map((item) => [item.package.id, item]));
  const itemsByPackage = groupBy(items, (item) => item.exhibitionDeliveryPackageId);
  const workspaces = packages.map((item) => {
    const source = interpretationById.get(item.interpretationPackageId) ?? null;
    const packageItems = (itemsByPackage.get(item.id) ?? []).map((deliveryItem) => deliveryItemView(deliveryItem, source));
    const blueprint = source ? deliveryBlueprintForInterpretation(source) : [];
    const expectedKeys = blueprint.map(blueprintKey);
    const missingFields = exhibitionDeliveryMissingFields(item, packageItems, expectedKeys);
    return {
      package: item,
      interpretation: source ? {
        id: source.package.id,
        packageCode: source.package.packageCode,
        title: source.package.title,
        revision: source.package.revision,
        status: source.package.status,
        editor: source.package.editor,
        primaryLanguage: source.package.primaryLanguage,
        secondaryLanguage: source.package.secondaryLanguage,
        projectCode: source.project?.projectCode ?? "",
        curatorialProjectId: source.package.curatorialProjectId,
      } : null,
      items: packageItems,
      summary: {
        itemCount: packageItems.length,
        readyCount: packageItems.filter((deliveryItem) => deliveryItem.proofStatus === "ready").length,
        expectedCount: blueprint.length,
        expectedKeys,
        missingFields,
        approvalReady: missingFields.length === 0 && item.decision === "release",
      },
    } satisfies ExhibitionDeliveryWorkspace;
  });
  const revisionCountByInterpretation = new Map<string, number>();
  packages.forEach((item) => revisionCountByInterpretation.set(item.interpretationPackageId, (revisionCountByInterpretation.get(item.interpretationPackageId) ?? 0) + 1));
  return {
    generatedAt: now.toISOString(),
    metrics: {
      total: packages.length,
      inReview: packages.filter((item) => item.status === "in_review").length,
      approved: packages.filter((item) => item.status === "approved").length,
      items: items.length,
      attention: workspaces.filter((item) => !["approved", "closed", "void"].includes(item.package.status) && ((item.package.status === "in_review" && !item.summary.approvalReady) || item.package.decision === "revise")).length,
    },
    packages: workspaces,
    references: {
      interpretations: interpretation.packages
        .filter((item) => ["approved", "closed"].includes(item.package.status))
        .map((item) => ({
          id: item.package.id,
          packageCode: item.package.packageCode,
          title: item.package.title,
          revision: item.package.revision,
          editor: item.package.editor,
          languages: [item.package.primaryLanguage, item.package.secondaryLanguage].filter(Boolean).join(" + "),
          itemCount: deliveryBlueprintForInterpretation(item).length,
          existingRevisions: revisionCountByInterpretation.get(item.package.id) ?? 0,
        })),
    },
  };
}

export function deliveryBlueprintForInterpretation(workspace: InterpretationWorkspace): ExhibitionDeliveryBlueprint[] {
  const item = workspace.package;
  const languages = [...new Set([item.primaryLanguage, item.secondaryLanguage].filter(Boolean))];
  const blueprint: ExhibitionDeliveryBlueprint[] = [];
  let sequence = 1;
  blueprint.push({ sourceType: "entrance", sourceId: item.id, language: item.primaryLanguage, channel: "wall_text", sequence: sequence++, title: item.title || "Entrance Text" });
  workspace.sections.forEach((section) => languages.forEach((language) => blueprint.push({ sourceType: "section", sourceId: section.id, language, channel: "wall_text", sequence: sequence++, title: language === item.secondaryLanguage ? section.titleSecondary : section.titlePrimary })));
  workspace.labels.forEach((label) => languages.forEach((language) => blueprint.push({ sourceType: "object_label", sourceId: label.id, language, channel: "object_label", sequence: sequence++, title: label.headline || label.asset?.workTitle || "Object Label" })));
  blueprint.push({ sourceType: "credits", sourceId: item.id, language: item.primaryLanguage, channel: "internal_master", sequence: sequence++, title: "Credits / 策展署名" });
  blueprint.push({ sourceType: "accessibility", sourceId: item.id, language: item.primaryLanguage, channel: "digital_guide", sequence: sequence++, title: "Accessibility / 无障碍释读" });
  blueprint.push({ sourceType: "rights", sourceId: item.id, language: item.primaryLanguage, channel: "internal_master", sequence: sequence++, title: "Rights / 权利说明" });
  return blueprint;
}

export function exhibitionDeliveryMissingFields(item: ExhibitionDeliveryPackage, items: ExhibitionDeliveryItemView[], expectedKeys: string[]) {
  const missing: string[] = [];
  if (!item.ownerName.trim()) missing.push("交付负责人");
  if (!item.destination.trim()) missing.push("交付对象或场景");
  if (!item.deliveryAt) missing.push("计划交付时间");
  if (!item.masterTitle.trim()) missing.push("交付主档标题");
  if (!item.formatStandard.trim()) missing.push("格式标准");
  if (!item.placementStandard.trim()) missing.push("位置与层级标准");
  if (!item.accessibilityStandard.trim()) missing.push("无障碍交付标准");
  if (!item.rightsStandard.trim()) missing.push("权利交付标准");
  if (!item.handoffNote.trim()) missing.push("交接说明");
  if (!item.approvalNote.trim()) missing.push("人工批准依据");
  const readyKeys = new Set(items.filter((deliveryItem) => deliveryItem.proofStatus === "ready").map(deliveryItemKey));
  if (expectedKeys.some((key) => !readyKeys.has(key))) missing.push("全部释读来源的就绪校样");
  items.forEach((deliveryItem) => {
    const label = deliveryItem.title || deliveryItem.sourceTitle || "交付项";
    if (!deliveryItem.sourceText.trim()) missing.push(`${label}来源文字`);
    if (deliveryItem.proofStatus !== "ready") return;
    if (!deliveryItem.title.trim()) missing.push("交付项标题");
    if (!deliveryItem.language.trim()) missing.push(`${label}语言`);
    if (!deliveryItem.placement.trim()) missing.push(`${label}位置`);
    if (!deliveryItem.formatSpec.trim()) missing.push(`${label}格式`);
    if (!deliveryItem.proofNote.trim()) missing.push(`${label}校样依据`);
    if (!deliveryItem.handoffNote.trim()) missing.push(`${label}交接备注`);
  });
  return [...new Set(missing)];
}

export function exhibitionDeliveryPackagesToCsv(overview: ExhibitionDeliveryOverview) {
  return csv([["delivery_code", "interpretation_code", "revision", "status", "decision", "owner", "destination", "delivery_at", "items", "ready"], ...overview.packages.map((workspace) => [workspace.package.deliveryCode, workspace.interpretation?.packageCode ?? "", workspace.package.revision, workspace.package.status, workspace.package.decision, workspace.package.ownerName, workspace.package.destination, workspace.package.deliveryAt ?? "", workspace.summary.itemCount, workspace.summary.readyCount])]);
}

export function exhibitionDeliveryItemsToCsv(overview: ExhibitionDeliveryOverview) {
  return csv([["delivery_code", "source_type", "source_id", "language", "channel", "sequence", "title", "source_title", "placement", "format_spec", "proof_status", "proof_note", "handoff_note"], ...overview.packages.flatMap((workspace) => workspace.items.map((item) => [workspace.package.deliveryCode, item.sourceType, item.sourceId, item.language, item.channel, item.sequence, item.title, item.sourceTitle, item.placement, item.formatSpec, item.proofStatus, item.proofNote, item.handoffNote]))]);
}

function deliveryItemView(item: ExhibitionDeliveryItem, source: InterpretationWorkspace | null): ExhibitionDeliveryItemView {
  if (!source) return { ...item, sourceTitle: "", sourceText: "", asset: null };
  const secondary = item.language === source.package.secondaryLanguage;
  if (item.sourceType === "entrance") return { ...item, sourceTitle: source.package.title, sourceText: source.package.entranceText, asset: null };
  if (item.sourceType === "credits") return { ...item, sourceTitle: "Credits", sourceText: source.package.curatorialCredit, asset: null };
  if (item.sourceType === "accessibility") return { ...item, sourceTitle: "Accessibility", sourceText: source.package.accessibilityNote, asset: null };
  if (item.sourceType === "rights") return { ...item, sourceTitle: "Rights", sourceText: source.package.rightsNote, asset: null };
  if (item.sourceType === "section") {
    const section = source.sections.find((candidate) => candidate.id === item.sourceId);
    return { ...item, sourceTitle: secondary ? section?.titleSecondary ?? "" : section?.titlePrimary ?? "", sourceText: secondary ? section?.bodySecondary ?? "" : section?.bodyPrimary ?? "", asset: null };
  }
  const label = source.labels.find((candidate) => candidate.id === item.sourceId);
  return { ...item, sourceTitle: label?.headline ?? "", sourceText: secondary ? label?.bodySecondary ?? "" : label?.bodyPrimary ?? "", asset: label?.asset ?? null };
}

function blueprintKey(item: ExhibitionDeliveryBlueprint) { return `${item.sourceType}:${item.sourceId}:${item.language}`; }
function deliveryItemKey(item: ExhibitionDeliveryItem) { return `${item.sourceType}:${item.sourceId}:${item.language}`; }
function groupBy<T>(rows: T[], key: (row: T) => string) { const result = new Map<string, T[]>(); rows.forEach((row) => result.set(key(row), [...(result.get(key(row)) ?? []), row])); return result; }
function csv(rows: Array<Array<string | number>>) { return `\ufeff${rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n")}`; }
