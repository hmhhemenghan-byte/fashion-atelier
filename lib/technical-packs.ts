import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  techPackConstructionNotes,
  techPackMeasurements,
  technicalPacks,
  type TechPackConstructionNote,
  type TechPackMeasurement,
  type TechnicalPack,
} from "@/db/schema";
import { listAllWorks, mediaUrl } from "@/lib/works";

export const TECH_PACK_STATUSES = [
  "draft",
  "review",
  "approved",
  "locked",
] as const;

export const SAMPLE_STAGES = [
  "concept",
  "toile",
  "prototype",
  "fit",
  "preproduction",
  "final",
] as const;

export const TECH_PACK_UNITS = ["cm", "in"] as const;

export const CONSTRUCTION_CATEGORIES = [
  "seam",
  "stitch",
  "finish",
  "trim",
  "label",
  "artwork",
  "packing",
  "other",
] as const;

export const CONSTRUCTION_PRIORITIES = [
  "standard",
  "important",
  "critical",
] as const;

export const CONSTRUCTION_STATUSES = [
  "open",
  "confirmed",
  "removed",
] as const;

export const MEASUREMENT_STATUSES = ["active", "removed"] as const;

export type TechPackStatus = (typeof TECH_PACK_STATUSES)[number];
export type SampleStage = (typeof SAMPLE_STAGES)[number];
export type TechPackUnit = (typeof TECH_PACK_UNITS)[number];
export type ConstructionCategory =
  (typeof CONSTRUCTION_CATEGORIES)[number];
export type ConstructionPriority =
  (typeof CONSTRUCTION_PRIORITIES)[number];
export type ConstructionStatus =
  (typeof CONSTRUCTION_STATUSES)[number];
export type MeasurementStatus = (typeof MEASUREMENT_STATUSES)[number];

export type TechnicalPackWorkspace = {
  pack: TechnicalPack;
  work: {
    id: string;
    title: string;
    lookNumber: string;
    collection: string;
    status: string;
    imageUrl: string;
  } | null;
  sketchUrl: string | null;
  measurements: TechPackMeasurement[];
  constructionNotes: TechPackConstructionNote[];
  summary: {
    activeMeasurements: number;
    activeConstructionNotes: number;
    confirmedConstructionNotes: number;
    criticalOpenNotes: number;
    completeness: number;
    missingFields: string[];
    approvalReady: boolean;
  };
};

export type TechnicalPackOverview = {
  generatedAt: string;
  metrics: {
    packCount: number;
    reviewCount: number;
    approvedCount: number;
    lockedCount: number;
    incompleteCount: number;
    criticalOpenCount: number;
    worksWithoutPackCount: number;
  };
  packs: TechnicalPackWorkspace[];
  references: {
    works: Array<{
      id: string;
      title: string;
      lookNumber: string;
      collection: string;
      status: string;
      imageUrl: string;
      latestRevision: number;
      hasApprovedPack: boolean;
    }>;
  };
};

export async function listAllTechnicalPacks(limit = 4000) {
  const db = await getDb();
  return db
    .select()
    .from(technicalPacks)
    .orderBy(
      desc(technicalPacks.updatedAt),
      desc(technicalPacks.revision),
    )
    .limit(limit);
}

export async function listAllTechPackMeasurements(limit = 20000) {
  const db = await getDb();
  return db
    .select()
    .from(techPackMeasurements)
    .orderBy(
      asc(techPackMeasurements.techPackId),
      asc(techPackMeasurements.sortOrder),
      asc(techPackMeasurements.label),
    )
    .limit(limit);
}

export async function listAllTechPackConstructionNotes(limit = 20000) {
  const db = await getDb();
  return db
    .select()
    .from(techPackConstructionNotes)
    .orderBy(
      asc(techPackConstructionNotes.techPackId),
      asc(techPackConstructionNotes.sortOrder),
      desc(techPackConstructionNotes.updatedAt),
    )
    .limit(limit);
}

export async function getTechnicalPack(id: string) {
  const db = await getDb();
  const [pack] = await db
    .select()
    .from(technicalPacks)
    .where(eq(technicalPacks.id, id))
    .limit(1);
  return pack ?? null;
}

export async function getTechPackMeasurement(id: string) {
  const db = await getDb();
  const [measurement] = await db
    .select()
    .from(techPackMeasurements)
    .where(eq(techPackMeasurements.id, id))
    .limit(1);
  return measurement ?? null;
}

export async function getTechPackConstructionNote(id: string) {
  const db = await getDb();
  const [note] = await db
    .select()
    .from(techPackConstructionNotes)
    .where(eq(techPackConstructionNotes.id, id))
    .limit(1);
  return note ?? null;
}

export async function buildTechnicalPackOverview(): Promise<TechnicalPackOverview> {
  const [packRows, measurementRows, noteRows, works] = await Promise.all([
    listAllTechnicalPacks(),
    listAllTechPackMeasurements(),
    listAllTechPackConstructionNotes(),
    listAllWorks(3000),
  ]);
  const workById = new Map(works.map((work) => [work.id, work]));
  const measurementsByPack = groupBy(
    measurementRows,
    (measurement) => measurement.techPackId,
  );
  const notesByPack = groupBy(noteRows, (note) => note.techPackId);
  const packsByWork = groupBy(packRows, (pack) => pack.workId);

  const workspaces = packRows.map((pack) => {
    const work = workById.get(pack.workId) ?? null;
    const measurements = measurementsByPack.get(pack.id) ?? [];
    const constructionNotes = notesByPack.get(pack.id) ?? [];
    const activeMeasurements = measurements.filter(
      (measurement) => measurement.status === "active",
    );
    const activeNotes = constructionNotes.filter(
      (note) => note.status !== "removed",
    );
    const criticalOpenNotes = activeNotes.filter(
      (note) =>
        note.priority === "critical" && note.status !== "confirmed",
    );
    const missingFields = technicalPackMissingFields(
      pack,
      activeMeasurements,
      activeNotes,
    );
    return {
      pack,
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
      sketchUrl: pack.sketchImageKey
        ? mediaUrl(pack.sketchImageKey)
        : null,
      measurements,
      constructionNotes,
      summary: {
        activeMeasurements: activeMeasurements.length,
        activeConstructionNotes: activeNotes.length,
        confirmedConstructionNotes: activeNotes.filter(
          (note) => note.status === "confirmed",
        ).length,
        criticalOpenNotes: criticalOpenNotes.length,
        completeness: Math.round(
          ((5 - missingFields.length) / 5) * 100,
        ),
        missingFields,
        approvalReady:
          missingFields.length === 0 && criticalOpenNotes.length === 0,
      },
    } satisfies TechnicalPackWorkspace;
  });

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      packCount: packRows.length,
      reviewCount: packRows.filter((pack) => pack.status === "review")
        .length,
      approvedCount: packRows.filter((pack) => pack.status === "approved")
        .length,
      lockedCount: packRows.filter((pack) => pack.status === "locked")
        .length,
      incompleteCount: workspaces.filter(
        (workspace) => workspace.summary.missingFields.length > 0,
      ).length,
      criticalOpenCount: workspaces.reduce(
        (total, workspace) =>
          total + workspace.summary.criticalOpenNotes,
        0,
      ),
      worksWithoutPackCount: works.filter(
        (work) => !(packsByWork.get(work.id) ?? []).length,
      ).length,
    },
    packs: workspaces,
    references: {
      works: works.map((work) => {
        const workPacks = packsByWork.get(work.id) ?? [];
        return {
          id: work.id,
          title: work.title,
          lookNumber: work.lookNumber,
          collection: work.collection,
          status: work.status,
          imageUrl: mediaUrl(work.imageKey),
          latestRevision: workPacks.reduce(
            (latest, pack) => Math.max(latest, pack.revision),
            0,
          ),
          hasApprovedPack: workPacks.some((pack) =>
            ["approved", "locked"].includes(pack.status),
          ),
        };
      }),
    },
  };
}

export function technicalPacksToCsv(
  overview: TechnicalPackOverview,
): string {
  const columns = [
    "techPackCode",
    "work",
    "lookNumber",
    "collection",
    "revision",
    "status",
    "sampleStage",
    "baseSize",
    "unit",
    "fitIntent",
    "patternReference",
    "constructionSummary",
    "gradingNotes",
    "finishingNotes",
    "labelNotes",
    "packagingNotes",
    "sketchImageKey",
    "approvalNote",
    "approvedBy",
    "approvedAt",
    "notes",
    "completeness",
    "createdAt",
    "updatedAt",
  ];
  const lines = [columns.map(csvCell).join(",")];
  overview.packs.forEach((workspace) => {
    const { pack, work } = workspace;
    lines.push(
      [
        pack.techPackCode,
        work?.title ?? "",
        work?.lookNumber ?? "",
        work?.collection ?? "",
        pack.revision,
        pack.status,
        pack.sampleStage,
        pack.baseSize,
        pack.unit,
        pack.fitIntent,
        pack.patternReference,
        pack.constructionSummary,
        pack.gradingNotes,
        pack.finishingNotes,
        pack.labelNotes,
        pack.packagingNotes,
        pack.sketchImageKey,
        pack.approvalNote,
        pack.approvedBy,
        pack.approvedAt,
        pack.notes,
        workspace.summary.completeness,
        pack.createdAt,
        pack.updatedAt,
      ]
        .map(csvCell)
        .join(","),
    );
  });
  return `\ufeff${lines.join("\r\n")}`;
}

export function techPackMeasurementsToCsv(
  overview: TechnicalPackOverview,
): string {
  const columns = [
    "techPackCode",
    "work",
    "revision",
    "baseSize",
    "unit",
    "pointCode",
    "label",
    "value",
    "tolerancePlus",
    "toleranceMinus",
    "method",
    "status",
    "sortOrder",
  ];
  const lines = [columns.map(csvCell).join(",")];
  overview.packs.forEach((workspace) => {
    workspace.measurements.forEach((measurement) => {
      lines.push(
        [
          workspace.pack.techPackCode,
          workspace.work?.title ?? "",
          workspace.pack.revision,
          workspace.pack.baseSize,
          workspace.pack.unit,
          measurement.pointCode,
          measurement.label,
          measurement.value,
          measurement.tolerancePlus,
          measurement.toleranceMinus,
          measurement.method,
          measurement.status,
          measurement.sortOrder,
        ]
          .map(csvCell)
          .join(","),
      );
    });
  });
  return `\ufeff${lines.join("\r\n")}`;
}

export function techPackConstructionToCsv(
  overview: TechnicalPackOverview,
): string {
  const columns = [
    "techPackCode",
    "work",
    "revision",
    "category",
    "title",
    "instruction",
    "priority",
    "status",
    "sortOrder",
  ];
  const lines = [columns.map(csvCell).join(",")];
  overview.packs.forEach((workspace) => {
    workspace.constructionNotes.forEach((note) => {
      lines.push(
        [
          workspace.pack.techPackCode,
          workspace.work?.title ?? "",
          workspace.pack.revision,
          note.category,
          note.title,
          note.instruction,
          note.priority,
          note.status,
          note.sortOrder,
        ]
          .map(csvCell)
          .join(","),
      );
    });
  });
  return `\ufeff${lines.join("\r\n")}`;
}

function technicalPackMissingFields(
  pack: TechnicalPack,
  measurements: TechPackMeasurement[],
  notes: TechPackConstructionNote[],
): string[] {
  return [
    pack.sketchImageKey ? "" : "技术图",
    pack.baseSize ? "" : "基码",
    pack.fitIntent ? "" : "版型意图",
    measurements.length > 0 ? "" : "尺寸点",
    notes.length > 0 ? "" : "工艺说明",
  ].filter(Boolean);
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

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
