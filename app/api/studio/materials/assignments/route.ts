import { getDb } from "@/db";
import {
  workMaterials,
  type NewWorkMaterial,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanMaterialText,
  materialApiError,
  materialSortOrder,
} from "@/lib/material-input";
import {
  getMaterial,
  listAllWorkMaterials,
  MATERIAL_ROLES,
  MATERIAL_UNITS,
  WORK_MATERIAL_STATUSES,
  type MaterialRole,
  type MaterialUnit,
  type WorkMaterialStatus,
} from "@/lib/materials";
import { getWorkById } from "@/lib/works";

export const dynamic = "force-dynamic";

type CreatePayload = {
  workId?: string;
  materialId?: string;
  role?: MaterialRole;
  status?: WorkMaterialStatus;
  placement?: string;
  colorway?: string;
  consumption?: string;
  unit?: MaterialUnit;
  notes?: string;
  sortOrder?: number | string;
};

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as CreatePayload;
    const workId = cleanMaterialText(payload.workId, 160);
    const materialId = cleanMaterialText(payload.materialId, 160);
    if (!workId || !materialId) {
      return Response.json(
        { error: "请选择 Look 与材料。" },
        { status: 400 },
      );
    }
    const [work, material] = await Promise.all([
      getWorkById(workId),
      getMaterial(materialId),
    ]);
    if (!work) {
      return Response.json({ error: "关联 Look 不存在。" }, { status: 404 });
    }
    if (!material) {
      return Response.json({ error: "材料档案不存在。" }, { status: 404 });
    }
    if (material.status === "archived") {
      return Response.json(
        { error: "已归档材料不能加入新的 Look 用料。" },
        { status: 400 },
      );
    }
    const role = payload.role ?? "shell";
    const status = payload.status ?? "proposed";
    const unit = payload.unit ?? "m";
    if (!MATERIAL_ROLES.includes(role)) {
      return Response.json({ error: "材料用途无效。" }, { status: 400 });
    }
    if (!WORK_MATERIAL_STATUSES.includes(status)) {
      return Response.json({ error: "用料状态无效。" }, { status: 400 });
    }
    if (!MATERIAL_UNITS.includes(unit)) {
      return Response.json({ error: "用量单位无效。" }, { status: 400 });
    }
    if (status === "approved" && material.status !== "approved") {
      return Response.json(
        { error: "材料档案尚未批准，不能批准该 Look 用料。" },
        { status: 400 },
      );
    }
    const placement = cleanMaterialText(payload.placement, 240);
    const existing = await listAllWorkMaterials();
    const duplicate = existing.some(
      (assignment) =>
        assignment.workId === workId &&
        assignment.materialId === materialId &&
        assignment.role === role &&
        assignment.placement === placement &&
        assignment.status !== "dropped",
    );
    if (duplicate) {
      return Response.json(
        { error: "该 Look 已存在相同用途与部位的材料记录。" },
        { status: 400 },
      );
    }

    const timestamp = new Date().toISOString();
    const values: NewWorkMaterial = {
      id: crypto.randomUUID(),
      workId,
      materialId,
      role,
      status,
      placement,
      colorway: cleanMaterialText(payload.colorway, 180),
      consumption: cleanMaterialText(payload.consumption, 120),
      unit,
      notes: cleanMaterialText(payload.notes, 2000),
      sortOrder: materialSortOrder(payload.sortOrder),
      createdBy: auth.user.email,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const db = await getDb();
    const [assignment] = await db
      .insert(workMaterials)
      .values(values)
      .returning();
    return Response.json({ assignment }, { status: 201 });
  } catch (error) {
    return materialApiError(error, "加入 Look 用料失败，请稍后重试。");
  }
}
