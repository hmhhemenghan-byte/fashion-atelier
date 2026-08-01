import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  materials,
  workMaterials,
  type Material,
  type WorkMaterial,
} from "@/db/schema";
import { listAllWorks, mediaUrl } from "@/lib/works";

export const MATERIAL_CATEGORIES = [
  "fabric",
  "knit",
  "leather",
  "lining",
  "trim",
  "hardware",
  "embellishment",
  "other",
] as const;

export const MATERIAL_STATUSES = [
  "research",
  "sampling",
  "approved",
  "hold",
  "archived",
] as const;

export const MATERIAL_ROLES = [
  "shell",
  "lining",
  "interlining",
  "trim",
  "hardware",
  "embellishment",
  "label",
  "other",
] as const;

export const WORK_MATERIAL_STATUSES = [
  "proposed",
  "selected",
  "approved",
  "dropped",
] as const;

export const MATERIAL_UNITS = [
  "m",
  "yd",
  "pcs",
  "g",
  "set",
  "other",
] as const;

export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];
export type MaterialRole = (typeof MATERIAL_ROLES)[number];
export type WorkMaterialStatus =
  (typeof WORK_MATERIAL_STATUSES)[number];
export type MaterialUnit = (typeof MATERIAL_UNITS)[number];

export type MaterialAssignmentWorkspace = {
  assignment: WorkMaterial;
  work: {
    id: string;
    title: string;
    lookNumber: string;
    collection: string;
    status: string;
    imageKey: string;
    imageUrl: string;
  } | null;
};

export type MaterialWorkspace = {
  material: Material;
  imageUrl: string | null;
  assignments: MaterialAssignmentWorkspace[];
  summary: {
    usageCount: number;
    activeUsageCount: number;
    approvedUsageCount: number;
    completeness: number;
    missingFields: string[];
  };
};

export type MaterialOverview = {
  generatedAt: string;
  metrics: {
    materialCount: number;
    approvedCount: number;
    samplingCount: number;
    missingSwatchCount: number;
    incompleteCount: number;
    activeBomCount: number;
    selectedPendingApprovalCount: number;
  };
  categories: Array<{
    category: MaterialCategory;
    count: number;
  }>;
  materials: MaterialWorkspace[];
  references: {
    works: Array<{
      id: string;
      title: string;
      lookNumber: string;
      collection: string;
      status: string;
      imageKey: string;
      imageUrl: string;
    }>;
  };
};

const CLOSED_ASSIGNMENT_STATUSES = new Set(["dropped"]);

export async function listAllMaterials(limit = 2000) {
  const db = await getDb();
  return db
    .select()
    .from(materials)
    .orderBy(desc(materials.updatedAt), asc(materials.name))
    .limit(limit);
}

export async function listAllWorkMaterials(limit = 8000) {
  const db = await getDb();
  return db
    .select()
    .from(workMaterials)
    .orderBy(
      asc(workMaterials.workId),
      asc(workMaterials.sortOrder),
      desc(workMaterials.updatedAt),
    )
    .limit(limit);
}

export async function getMaterial(id: string) {
  const db = await getDb();
  const [material] = await db
    .select()
    .from(materials)
    .where(eq(materials.id, id))
    .limit(1);
  return material ?? null;
}

export async function getWorkMaterial(id: string) {
  const db = await getDb();
  const [assignment] = await db
    .select()
    .from(workMaterials)
    .where(eq(workMaterials.id, id))
    .limit(1);
  return assignment ?? null;
}

export async function buildMaterialOverview(): Promise<MaterialOverview> {
  const [materialRows, assignmentRows, works] = await Promise.all([
    listAllMaterials(),
    listAllWorkMaterials(),
    listAllWorks(2000),
  ]);
  const workById = new Map(works.map((work) => [work.id, work]));
  const assignmentsByMaterial = groupBy(
    assignmentRows,
    (assignment) => assignment.materialId,
  );
  const activeAssignments = assignmentRows.filter(
    (assignment) => !CLOSED_ASSIGNMENT_STATUSES.has(assignment.status),
  );
  const materialById = new Map(
    materialRows.map((material) => [material.id, material]),
  );

  const workspaces = materialRows.map((material) => {
    const assignments = assignmentsByMaterial.get(material.id) ?? [];
    const missingFields = materialMissingFields(material);
    return {
      material,
      imageUrl: material.swatchImageKey
        ? mediaUrl(material.swatchImageKey)
        : null,
      assignments: assignments.map((assignment) => {
        const work = workById.get(assignment.workId);
        return {
          assignment,
          work: work
            ? {
                id: work.id,
                title: work.title,
                lookNumber: work.lookNumber,
                collection: work.collection,
                status: work.status,
                imageKey: work.imageKey,
                imageUrl: mediaUrl(work.imageKey),
              }
            : null,
        };
      }),
      summary: {
        usageCount: assignments.length,
        activeUsageCount: assignments.filter(
          (assignment) =>
            !CLOSED_ASSIGNMENT_STATUSES.has(assignment.status),
        ).length,
        approvedUsageCount: assignments.filter(
          (assignment) => assignment.status === "approved",
        ).length,
        completeness: Math.round(
          ((4 - missingFields.length) / 4) * 100,
        ),
        missingFields,
      },
    } satisfies MaterialWorkspace;
  });

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      materialCount: materialRows.length,
      approvedCount: materialRows.filter(
        (material) => material.status === "approved",
      ).length,
      samplingCount: materialRows.filter(
        (material) => material.status === "sampling",
      ).length,
      missingSwatchCount: materialRows.filter(
        (material) => !material.swatchImageKey,
      ).length,
      incompleteCount: materialRows.filter(
        (material) => materialMissingFields(material).length > 0,
      ).length,
      activeBomCount: activeAssignments.length,
      selectedPendingApprovalCount: activeAssignments.filter(
        (assignment) =>
          ["selected", "approved"].includes(assignment.status) &&
          materialById.get(assignment.materialId)?.status !== "approved",
      ).length,
    },
    categories: MATERIAL_CATEGORIES.map((category) => ({
      category,
      count: materialRows.filter(
        (material) => material.category === category,
      ).length,
    })),
    materials: workspaces,
    references: {
      works: works.map((work) => ({
        id: work.id,
        title: work.title,
        lookNumber: work.lookNumber,
        collection: work.collection,
        status: work.status,
        imageKey: work.imageKey,
        imageUrl: mediaUrl(work.imageKey),
      })),
    },
  };
}

export function materialsToCsv(overview: MaterialOverview): string {
  const columns = [
    "materialCode",
    "name",
    "category",
    "status",
    "composition",
    "construction",
    "colorName",
    "colorCode",
    "supplierName",
    "supplierReference",
    "origin",
    "weight",
    "width",
    "handFeel",
    "finish",
    "certifications",
    "swatchImageKey",
    "swatchAltText",
    "notes",
    "activeUsageCount",
    "completeness",
    "createdAt",
    "updatedAt",
  ];
  const lines = [columns.map(csvCell).join(",")];
  overview.materials.forEach((workspace) => {
    const material = workspace.material;
    lines.push(
      [
        material.materialCode,
        material.name,
        material.category,
        material.status,
        material.composition,
        material.construction,
        material.colorName,
        material.colorCode,
        material.supplierName,
        material.supplierReference,
        material.origin,
        material.weight,
        material.width,
        material.handFeel,
        material.finish,
        material.certifications,
        material.swatchImageKey,
        material.swatchAltText,
        material.notes,
        workspace.summary.activeUsageCount,
        workspace.summary.completeness,
        material.createdAt,
        material.updatedAt,
      ]
        .map(csvCell)
        .join(","),
    );
  });
  return `\ufeff${lines.join("\r\n")}`;
}

export function workMaterialsToCsv(overview: MaterialOverview): string {
  const columns = [
    "materialCode",
    "materialName",
    "materialStatus",
    "work",
    "lookNumber",
    "collection",
    "role",
    "status",
    "placement",
    "colorway",
    "consumption",
    "unit",
    "notes",
    "sortOrder",
    "createdAt",
    "updatedAt",
  ];
  const lines = [columns.map(csvCell).join(",")];
  overview.materials.forEach((workspace) => {
    workspace.assignments.forEach(({ assignment, work }) => {
      lines.push(
        [
          workspace.material.materialCode,
          workspace.material.name,
          workspace.material.status,
          work?.title ?? "",
          work?.lookNumber ?? "",
          work?.collection ?? "",
          assignment.role,
          assignment.status,
          assignment.placement,
          assignment.colorway,
          assignment.consumption,
          assignment.unit,
          assignment.notes,
          assignment.sortOrder,
          assignment.createdAt,
          assignment.updatedAt,
        ]
          .map(csvCell)
          .join(","),
      );
    });
  });
  return `\ufeff${lines.join("\r\n")}`;
}

function materialMissingFields(material: Material): string[] {
  return [
    material.swatchImageKey ? "" : "色卡图片",
    material.composition ? "" : "成分",
    material.colorName || material.colorCode ? "" : "颜色",
    material.supplierName ? "" : "供应方",
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
