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
import { getTechnicalPack } from "@/lib/technical-packs";

export const dynamic = "force-dynamic";

type CreatePayload = {
  techPackId?: string;
  pointCode?: string;
  label?: string;
  value?: string;
  tolerancePlus?: string;
  toleranceMinus?: string;
  method?: string;
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
    const label = cleanTechPackText(payload.label, 240);
    if (!techPackId || !label) {
      return Response.json(
        { error: "请选择技术包并填写尺寸点名称。" },
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
    const timestamp = new Date().toISOString();
    const values: NewTechPackMeasurement = {
      id: crypto.randomUUID(),
      techPackId,
      pointCode: cleanTechPackText(payload.pointCode, 80),
      label,
      value: cleanTechPackText(payload.value, 80),
      tolerancePlus: cleanTechPackText(payload.tolerancePlus, 80),
      toleranceMinus: cleanTechPackText(payload.toleranceMinus, 80),
      method: cleanTechPackText(payload.method, 800),
      status: "active",
      sortOrder: techPackInteger(payload.sortOrder),
      createdBy: auth.user.email,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const db = await getDb();
    const [measurement] = await db
      .insert(techPackMeasurements)
      .values(values)
      .returning();
    return Response.json({ measurement }, { status: 201 });
  } catch (error) {
    return techPackApiError(error, "新增尺寸点失败，请稍后重试。");
  }
}
