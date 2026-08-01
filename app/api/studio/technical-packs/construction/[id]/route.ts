import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  techPackConstructionNotes,
  type NewTechPackConstructionNote,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanTechPackText,
  techPackApiError,
  techPackInteger,
} from "@/lib/tech-pack-input";
import {
  CONSTRUCTION_CATEGORIES,
  CONSTRUCTION_PRIORITIES,
  CONSTRUCTION_STATUSES,
  getTechPackConstructionNote,
  getTechnicalPack,
  type ConstructionCategory,
  type ConstructionPriority,
  type ConstructionStatus,
} from "@/lib/technical-packs";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  category?: ConstructionCategory;
  title?: string;
  instruction?: string;
  priority?: ConstructionPriority;
  status?: ConstructionStatus;
  sortOrder?: number | string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getTechPackConstructionNote(id);
    if (!current) {
      return Response.json({ error: "工艺说明不存在。" }, { status: 404 });
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
    const update: Partial<NewTechPackConstructionNote> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;
    if (payload.category !== undefined) {
      if (!CONSTRUCTION_CATEGORIES.includes(payload.category)) {
        return Response.json({ error: "工艺类别无效。" }, { status: 400 });
      }
      update.category = payload.category;
      changed = true;
    }
    if (payload.priority !== undefined) {
      if (!CONSTRUCTION_PRIORITIES.includes(payload.priority)) {
        return Response.json({ error: "工艺优先级无效。" }, { status: 400 });
      }
      update.priority = payload.priority;
      changed = true;
    }
    if (payload.status !== undefined) {
      if (!CONSTRUCTION_STATUSES.includes(payload.status)) {
        return Response.json({ error: "工艺状态无效。" }, { status: 400 });
      }
      update.status = payload.status;
      changed = true;
    }
    for (const [key, maxLength] of [
      ["title", 240],
      ["instruction", 2400],
    ] as const) {
      if (payload[key] !== undefined) {
        const value = cleanTechPackText(payload[key], maxLength);
        if (key === "title" && !value) {
          return Response.json(
            { error: "工艺标题不能为空。" },
            { status: 400 },
          );
        }
        update[key] = value;
        changed = true;
      }
    }
    if (payload.sortOrder !== undefined) {
      update.sortOrder = techPackInteger(payload.sortOrder);
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }
    const db = await getDb();
    const [note] = await db
      .update(techPackConstructionNotes)
      .set(update)
      .where(eq(techPackConstructionNotes.id, id))
      .returning();
    return Response.json({ note });
  } catch (error) {
    return techPackApiError(error, "更新工艺说明失败，请稍后重试。");
  }
}
