import { eq } from "drizzle-orm";
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
  getWorkMaterial,
  MATERIAL_ROLES,
  MATERIAL_UNITS,
  WORK_MATERIAL_STATUSES,
  type MaterialRole,
  type MaterialUnit,
  type WorkMaterialStatus,
} from "@/lib/materials";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  role?: MaterialRole;
  status?: WorkMaterialStatus;
  placement?: string;
  colorway?: string;
  consumption?: string;
  unit?: MaterialUnit;
  notes?: string;
  sortOrder?: number | string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getWorkMaterial(id);
    if (!current) {
      return Response.json({ error: "Look 用料不存在。" }, { status: 404 });
    }
    const payload = (await request.json()) as UpdatePayload;
    const update: Partial<NewWorkMaterial> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;

    if (payload.role !== undefined) {
      if (!MATERIAL_ROLES.includes(payload.role)) {
        return Response.json({ error: "材料用途无效。" }, { status: 400 });
      }
      update.role = payload.role;
      changed = true;
    }
    if (payload.status !== undefined) {
      if (!WORK_MATERIAL_STATUSES.includes(payload.status)) {
        return Response.json({ error: "用料状态无效。" }, { status: 400 });
      }
      if (payload.status === "approved") {
        const material = await getMaterial(current.materialId);
        if (!material || material.status !== "approved") {
          return Response.json(
            { error: "材料档案尚未批准，不能批准该 Look 用料。" },
            { status: 400 },
          );
        }
      }
      update.status = payload.status;
      changed = true;
    }
    if (payload.unit !== undefined) {
      if (!MATERIAL_UNITS.includes(payload.unit)) {
        return Response.json({ error: "用量单位无效。" }, { status: 400 });
      }
      update.unit = payload.unit;
      changed = true;
    }
    for (const [key, maxLength] of [
      ["placement", 240],
      ["colorway", 180],
      ["consumption", 120],
      ["notes", 2000],
    ] as const) {
      if (payload[key] !== undefined) {
        update[key] = cleanMaterialText(payload[key], maxLength);
        changed = true;
      }
    }
    if (payload.sortOrder !== undefined) {
      update.sortOrder = materialSortOrder(payload.sortOrder);
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }

    const db = await getDb();
    const [assignment] = await db
      .update(workMaterials)
      .set(update)
      .where(eq(workMaterials.id, id))
      .returning();
    return Response.json({ assignment });
  } catch (error) {
    return materialApiError(error, "更新 Look 用料失败，请稍后重试。");
  }
}
