import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  techPackMeasurements,
  type NewTechPackMeasurement,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanTechPackText,
  techPackApiError,
  techPackInteger,
} from "@/lib/tech-pack-input";
import {
  getTechnicalPack,
  getTechPackMeasurement,
  MEASUREMENT_STATUSES,
  type MeasurementStatus,
} from "@/lib/technical-packs";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  pointCode?: string;
  label?: string;
  value?: string;
  tolerancePlus?: string;
  toleranceMinus?: string;
  method?: string;
  status?: MeasurementStatus;
  sortOrder?: number | string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getTechPackMeasurement(id);
    if (!current) {
      return Response.json({ error: "尺寸点不存在。" }, { status: 404 });
    }
    const pack = await getTechnicalPack(current.techPackId);
    if (!pack) {
      return Response.json({ error: "技术包不存在。" }, { status: 404 });
    }
    if (["approved", "locked"].includes(pack.status)) {
      return Response.json(
        { error: "已批准或锁定的技术包需先退回评审状态。" },
        { status: 409 },
      );
    }
    const payload = (await request.json()) as UpdatePayload;
    const update: Partial<NewTechPackMeasurement> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;
    for (const [key, maxLength] of [
      ["pointCode", 80],
      ["label", 240],
      ["value", 80],
      ["tolerancePlus", 80],
      ["toleranceMinus", 80],
      ["method", 800],
    ] as const) {
      if (payload[key] !== undefined) {
        const value = cleanTechPackText(payload[key], maxLength);
        if (key === "label" && !value) {
          return Response.json(
            { error: "尺寸点名称不能为空。" },
            { status: 400 },
          );
        }
        update[key] = value;
        changed = true;
      }
    }
    if (payload.status !== undefined) {
      if (!MEASUREMENT_STATUSES.includes(payload.status)) {
        return Response.json({ error: "尺寸点状态无效。" }, { status: 400 });
      }
      update.status = payload.status;
      changed = true;
    }
    if (payload.sortOrder !== undefined) {
      update.sortOrder = techPackInteger(payload.sortOrder);
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }
    const db = await getDb();
    const [measurement] = await db
      .update(techPackMeasurements)
      .set(update)
      .where(eq(techPackMeasurements.id, id))
      .returning();
    return Response.json({ measurement });
  } catch (error) {
    return techPackApiError(error, "更新尺寸点失败，请稍后重试。");
  }
}
