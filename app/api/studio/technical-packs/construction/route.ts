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
  getTechnicalPack,
  type ConstructionCategory,
  type ConstructionPriority,
} from "@/lib/technical-packs";

export const dynamic = "force-dynamic";

type CreatePayload = {
  techPackId?: string;
  category?: ConstructionCategory;
  title?: string;
  instruction?: string;
  priority?: ConstructionPriority;
  sortOrder?: number | string;
};

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as CreatePayload;
    const techPackId = cleanTechPackText(payload.techPackId, 120);
    const title = cleanTechPackText(payload.title, 240);
    if (!techPackId || !title) {
      return Response.json(
        { error: "请选择技术包并填写工艺标题。" },
        { status: 400 },
      );
    }
    const pack = await getTechnicalPack(techPackId);
    if (!pack) {
      return Response.json({ error: "技术包不存在。" }, { status: 404 });
    }
    if (["approved", "locked"].includes(pack.status)) {
      return Response.json(
        { error: "已批准或锁定的技术包需先退回评审状态。" },
        { status: 409 },
      );
    }
    const category = payload.category ?? "seam";
    const priority = payload.priority ?? "standard";
    if (!CONSTRUCTION_CATEGORIES.includes(category)) {
      return Response.json({ error: "工艺类别无效。" }, { status: 400 });
    }
    if (!CONSTRUCTION_PRIORITIES.includes(priority)) {
      return Response.json({ error: "工艺优先级无效。" }, { status: 400 });
    }
    const timestamp = new Date().toISOString();
    const values: NewTechPackConstructionNote = {
      id: crypto.randomUUID(),
      techPackId,
      category,
      title,
      instruction: cleanTechPackText(payload.instruction, 2400),
      priority,
      status: "open",
      sortOrder: techPackInteger(payload.sortOrder),
      createdBy: auth.user.email,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const db = await getDb();
    const [note] = await db
      .insert(techPackConstructionNotes)
      .values(values)
      .returning();
    return Response.json({ note }, { status: 201 });
  } catch (error) {
    return techPackApiError(error, "新增工艺说明失败，请稍后重试。");
  }
}
