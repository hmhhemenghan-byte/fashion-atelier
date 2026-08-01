import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { materials, type NewMaterial } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanMaterialText,
  materialApiError,
} from "@/lib/material-input";
import {
  getMaterial,
  MATERIAL_CATEGORIES,
  MATERIAL_STATUSES,
  type MaterialCategory,
  type MaterialStatus,
} from "@/lib/materials";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  name?: string;
  category?: MaterialCategory;
  status?: MaterialStatus;
  composition?: string;
  construction?: string;
  colorName?: string;
  colorCode?: string;
  supplierName?: string;
  supplierReference?: string;
  origin?: string;
  weight?: string;
  width?: string;
  handFeel?: string;
  finish?: string;
  certifications?: string;
  swatchAltText?: string;
  notes?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    if (!(await getMaterial(id))) {
      return Response.json({ error: "材料档案不存在。" }, { status: 404 });
    }
    const payload = (await request.json()) as UpdatePayload;
    const update: Partial<NewMaterial> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;

    if (payload.name !== undefined) {
      const value = cleanMaterialText(payload.name, 240);
      if (!value) {
        return Response.json(
          { error: "材料名称不能为空。" },
          { status: 400 },
        );
      }
      update.name = value;
      changed = true;
    }
    if (payload.category !== undefined) {
      if (!MATERIAL_CATEGORIES.includes(payload.category)) {
        return Response.json({ error: "材料类别无效。" }, { status: 400 });
      }
      update.category = payload.category;
      changed = true;
    }
    if (payload.status !== undefined) {
      if (!MATERIAL_STATUSES.includes(payload.status)) {
        return Response.json({ error: "材料状态无效。" }, { status: 400 });
      }
      update.status = payload.status;
      changed = true;
    }
    for (const [key, maxLength] of [
      ["composition", 500],
      ["construction", 500],
      ["colorName", 160],
      ["colorCode", 120],
      ["supplierName", 240],
      ["supplierReference", 180],
      ["origin", 180],
      ["weight", 120],
      ["width", 120],
      ["handFeel", 500],
      ["finish", 500],
      ["certifications", 800],
      ["swatchAltText", 240],
      ["notes", 4000],
    ] as const) {
      if (payload[key] !== undefined) {
        update[key] = cleanMaterialText(payload[key], maxLength);
        changed = true;
      }
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }

    const db = await getDb();
    const [material] = await db
      .update(materials)
      .set(update)
      .where(eq(materials.id, id))
      .returning();
    return Response.json({ material });
  } catch (error) {
    return materialApiError(error, "更新材料档案失败，请稍后重试。");
  }
}
