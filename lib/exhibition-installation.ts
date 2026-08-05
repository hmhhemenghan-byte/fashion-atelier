import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  exhibitionInstallationChecks,
  exhibitionInstallationGates,
  exhibitionInstallationImages,
  type ExhibitionInstallationCheck,
  type ExhibitionInstallationGate,
  type ExhibitionInstallationImage,
} from "@/db/schema";
import { buildExhibitionDeliveryOverview, type ExhibitionDeliveryItemView, type ExhibitionDeliveryWorkspace } from "@/lib/exhibition-delivery";
import { mediaUrl } from "@/lib/works";

export const EXHIBITION_INSTALLATION_STATUSES = ["draft", "in_review", "approved", "closed", "void"] as const;
export const EXHIBITION_INSTALLATION_DECISIONS = ["pending", "accept", "rework", "hold"] as const;
export const EXHIBITION_INSTALLATION_RESULTS = ["pending", "pass", "attention", "blocked", "not_installed"] as const;
export const EXHIBITION_INSTALLATION_IMAGE_ANGLES = ["overview", "wall_text", "object_label", "digital_guide", "accessibility", "rights", "detail"] as const;
export const EXHIBITION_INSTALLATION_IMAGE_STATUSES = ["active", "removed"] as const;

export type ExhibitionInstallationStatus = (typeof EXHIBITION_INSTALLATION_STATUSES)[number];
export type ExhibitionInstallationDecision = (typeof EXHIBITION_INSTALLATION_DECISIONS)[number];
export type ExhibitionInstallationResult = (typeof EXHIBITION_INSTALLATION_RESULTS)[number];
export type ExhibitionInstallationImageAngle = (typeof EXHIBITION_INSTALLATION_IMAGE_ANGLES)[number];
export type ExhibitionInstallationImageStatus = (typeof EXHIBITION_INSTALLATION_IMAGE_STATUSES)[number];

export type ExhibitionInstallationCheckView = ExhibitionInstallationCheck & {
  deliveryItem: ExhibitionDeliveryItemView | null;
};

export type ExhibitionInstallationWorkspace = {
  gate: ExhibitionInstallationGate;
  delivery: {
    id: string;
    deliveryCode: string;
    masterTitle: string;
    revision: number;
    status: string;
    destination: string;
    ownerName: string;
    interpretationCode: string;
    curatorialProjectId: string;
  } | null;
  checks: ExhibitionInstallationCheckView[];
  images: Array<ExhibitionInstallationImage & { imageUrl: string }>;
  summary: {
    expectedChecks: number;
    passedChecks: number;
    attentionChecks: number;
    blockedChecks: number;
    pendingChecks: number;
    activeImages: number;
    missingFields: string[];
    approvalReady: boolean;
    upcomingUnapproved: boolean;
  };
};

export type ExhibitionInstallationOverview = {
  generatedAt: string;
  metrics: { total: number; inReview: number; approved: number; checks: number; evidence: number; attention: number };
  gates: ExhibitionInstallationWorkspace[];
  references: {
    deliveries: Array<{ id: string; deliveryCode: string; title: string; destination: string; ownerName: string; itemCount: number; existingRevisions: number }>;
  };
};

export async function listAllExhibitionInstallationGates(limit = 4000) {
  const db = await getDb();
  return db.select().from(exhibitionInstallationGates).orderBy(desc(exhibitionInstallationGates.updatedAt)).limit(limit);
}

export async function listAllExhibitionInstallationChecks(limit = 36000) {
  const db = await getDb();
  return db.select().from(exhibitionInstallationChecks).orderBy(asc(exhibitionInstallationChecks.exhibitionInstallationGateId), asc(exhibitionInstallationChecks.sequence)).limit(limit);
}

export async function listAllExhibitionInstallationImages(limit = 24000) {
  const db = await getDb();
  return db.select().from(exhibitionInstallationImages).orderBy(asc(exhibitionInstallationImages.exhibitionInstallationGateId), asc(exhibitionInstallationImages.sortOrder)).limit(limit);
}

export async function getExhibitionInstallationGate(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(exhibitionInstallationGates).where(eq(exhibitionInstallationGates.id, id)).limit(1);
  return row ?? null;
}

export async function getExhibitionInstallationCheck(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(exhibitionInstallationChecks).where(eq(exhibitionInstallationChecks.id, id)).limit(1);
  return row ?? null;
}

export async function getExhibitionInstallationImage(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(exhibitionInstallationImages).where(eq(exhibitionInstallationImages.id, id)).limit(1);
  return row ?? null;
}

export async function buildExhibitionInstallationOverview(now = new Date()): Promise<ExhibitionInstallationOverview> {
  const [gates, checks, images, delivery] = await Promise.all([
    listAllExhibitionInstallationGates(),
    listAllExhibitionInstallationChecks(),
    listAllExhibitionInstallationImages(),
    buildExhibitionDeliveryOverview(now),
  ]);
  const deliveryById = new Map(delivery.packages.map((item) => [item.package.id, item]));
  const checksByGate = groupBy(checks, (item) => item.exhibitionInstallationGateId);
  const imagesByGate = groupBy(images, (item) => item.exhibitionInstallationGateId);
  const revisionCountByDelivery = new Map<string, number>();
  gates.forEach((item) => revisionCountByDelivery.set(item.exhibitionDeliveryPackageId, (revisionCountByDelivery.get(item.exhibitionDeliveryPackageId) ?? 0) + 1));
  const sevenDaysAt = now.getTime() + 7 * 86_400_000;
  const workspaces = gates.map((gate) => {
    const source = deliveryById.get(gate.exhibitionDeliveryPackageId) ?? null;
    const deliveryItems = new Map((source?.items ?? []).map((item) => [item.id, item]));
    const linkedChecks = (checksByGate.get(gate.id) ?? []).map((check) => ({ ...check, deliveryItem: deliveryItems.get(check.exhibitionDeliveryItemId) ?? null }));
    const linkedImages = (imagesByGate.get(gate.id) ?? []).map((image) => ({ ...image, imageUrl: mediaUrl(image.imageKey) }));
    const activeImages = linkedImages.filter((image) => image.status === "active");
    const missingFields = exhibitionInstallationMissingFields(gate, linkedChecks, activeImages, source?.items.length ?? 0);
    const openingMs = timestamp(gate.openingAt);
    return {
      gate,
      delivery: source ? {
        id: source.package.id,
        deliveryCode: source.package.deliveryCode,
        masterTitle: source.package.masterTitle,
        revision: source.package.revision,
        status: source.package.status,
        destination: source.package.destination,
        ownerName: source.package.ownerName,
        interpretationCode: source.interpretation?.packageCode ?? "",
        curatorialProjectId: source.interpretation?.curatorialProjectId ?? "",
      } : null,
      checks: linkedChecks,
      images: linkedImages,
      summary: {
        expectedChecks: source?.items.length ?? 0,
        passedChecks: linkedChecks.filter((check) => check.result === "pass").length,
        attentionChecks: linkedChecks.filter((check) => check.result === "attention").length,
        blockedChecks: linkedChecks.filter((check) => ["blocked", "not_installed"].includes(check.result)).length,
        pendingChecks: linkedChecks.filter((check) => check.result === "pending").length,
        activeImages: activeImages.length,
        missingFields,
        approvalReady: missingFields.length === 0 && gate.decision === "accept",
        upcomingUnapproved: !["approved", "closed", "void"].includes(gate.status) && openingMs > 0 && openingMs <= sevenDaysAt,
      },
    } satisfies ExhibitionInstallationWorkspace;
  });
  return {
    generatedAt: now.toISOString(),
    metrics: {
      total: gates.length,
      inReview: gates.filter((item) => item.status === "in_review").length,
      approved: gates.filter((item) => item.status === "approved").length,
      checks: checks.length,
      evidence: images.filter((item) => item.status === "active").length,
      attention: workspaces.filter((item) => !["approved", "closed", "void"].includes(item.gate.status) && (item.summary.upcomingUnapproved || item.gate.decision === "rework" || item.summary.attentionChecks + item.summary.blockedChecks > 0)).length,
    },
    gates: workspaces,
    references: {
      deliveries: delivery.packages
        .filter((item) => ["approved", "closed"].includes(item.package.status))
        .map((item) => ({ id: item.package.id, deliveryCode: item.package.deliveryCode, title: item.package.masterTitle, destination: item.package.destination, ownerName: item.package.ownerName, itemCount: item.items.length, existingRevisions: revisionCountByDelivery.get(item.package.id) ?? 0 })),
    },
  };
}

export function exhibitionInstallationMissingFields(gate: ExhibitionInstallationGate, checks: ExhibitionInstallationCheckView[], images: Array<ExhibitionInstallationImage & { imageUrl?: string }>, expectedChecks: number) {
  const missing: string[] = [];
  if (!gate.leadName.trim()) missing.push("现场负责人");
  if (!gate.venue.trim()) missing.push("现场或展区");
  if (!gate.inspectionAt) missing.push("装校检查时间");
  if (!gate.openingAt) missing.push("计划开放时间");
  if (!gate.installationScope.trim()) missing.push("装校范围");
  if (!gate.accessibilityObservation.trim()) missing.push("无障碍现场观察");
  if (!gate.rightsObservation.trim()) missing.push("权利与署名现场观察");
  if (!gate.safetyNote.trim()) missing.push("现场安全说明");
  if (!gate.handoverNote.trim()) missing.push("现场交接说明");
  if (!gate.approvalNote.trim()) missing.push("人工签核依据");
  if (gate.inspectionAt && gate.openingAt && new Date(gate.inspectionAt).getTime() > new Date(gate.openingAt).getTime()) missing.push("开放前完成装校检查");
  if (expectedChecks <= 0 || checks.length !== expectedChecks) missing.push("全部交付项的现场核对");
  if (checks.some((check) => check.result !== "pass")) missing.push("全部现场核对通过");
  checks.forEach((check) => {
    const label = check.deliveryItem?.title || check.deliveryItem?.sourceTitle || "装校项";
    if (!check.deliveryItem) missing.push(`${label}来源交付项`);
    if (check.result === "pass" && !check.observedPlacement.trim()) missing.push(`${label}现场位置`);
    if (check.result === "pass" && !check.observedFormat.trim()) missing.push(`${label}现场格式`);
    if (check.result === "pass" && !check.observation.trim()) missing.push(`${label}核对依据`);
    if (["attention", "blocked", "not_installed"].includes(check.result) && !check.correctiveAction.trim()) missing.push(`${label}处理动作`);
  });
  if (!images.some((image) => image.status === "active")) missing.push("至少一张私密现场证据");
  return [...new Set(missing)];
}

export function installationGatesToCsv(overview: ExhibitionInstallationOverview) {
  return csv([["gate_code", "delivery_code", "revision", "status", "decision", "lead", "venue", "inspection_at", "opening_at", "checks", "passed", "evidence"], ...overview.gates.map((workspace) => [workspace.gate.gateCode, workspace.delivery?.deliveryCode ?? "", workspace.gate.revision, workspace.gate.status, workspace.gate.decision, workspace.gate.leadName, workspace.gate.venue, workspace.gate.inspectionAt ?? "", workspace.gate.openingAt ?? "", workspace.checks.length, workspace.summary.passedChecks, workspace.summary.activeImages])]);
}

export function installationChecksToCsv(overview: ExhibitionInstallationOverview) {
  return csv([["gate_code", "delivery_item_id", "source_type", "language", "channel", "sequence", "title", "result", "observed_placement", "observed_format", "observation", "corrective_action"], ...overview.gates.flatMap((workspace) => workspace.checks.map((check) => [workspace.gate.gateCode, check.exhibitionDeliveryItemId, check.deliveryItem?.sourceType ?? "", check.deliveryItem?.language ?? "", check.deliveryItem?.channel ?? "", check.sequence, check.deliveryItem?.title ?? "", check.result, check.observedPlacement, check.observedFormat, check.observation, check.correctiveAction]))]);
}

export function installationImagesToCsv(overview: ExhibitionInstallationOverview) {
  return csv([["gate_code", "image_key", "image_type", "image_size", "angle", "caption", "alt_text", "status", "sort_order"], ...overview.gates.flatMap((workspace) => workspace.images.map((image) => [workspace.gate.gateCode, image.imageKey, image.imageType, image.imageSize, image.angle, image.caption, image.altText, image.status, image.sortOrder]))]);
}

export function installationChecksForDelivery(source: ExhibitionDeliveryWorkspace, gateId: string, createdBy: string, nowIso: string) {
  return source.items.map((item, index) => ({
    id: crypto.randomUUID(), exhibitionInstallationGateId: gateId, exhibitionDeliveryItemId: item.id,
    sequence: item.sequence || index + 1, result: "pending" as const, observedPlacement: "", observedFormat: "", observation: "", correctiveAction: "",
    createdBy, createdAt: nowIso, updatedAt: nowIso,
  }));
}

function timestamp(value: string | null) { if (!value) return 0; const result = new Date(value).getTime(); return Number.isNaN(result) ? 0 : result; }
function groupBy<T>(rows: T[], key: (row: T) => string) { const result = new Map<string, T[]>(); rows.forEach((row) => result.set(key(row), [...(result.get(key(row)) ?? []), row])); return result; }
function csv(rows: Array<Array<string | number>>) { return `\ufeff${rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n")}`; }
