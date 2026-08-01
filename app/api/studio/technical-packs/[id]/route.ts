import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { technicalPacks, type NewTechnicalPack } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanTechPackText,
  techPackApiError,
} from "@/lib/tech-pack-input";
import {
  buildTechnicalPackOverview,
  getTechnicalPack,
  SAMPLE_STAGES,
  TECH_PACK_STATUSES,
  TECH_PACK_UNITS,
  type SampleStage,
  type TechPackStatus,
  type TechPackUnit,
} from "@/lib/technical-packs";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  status?: TechPackStatus;
  sampleStage?: SampleStage;
  baseSize?: string;
  unit?: TechPackUnit;
  fitIntent?: string;
  patternReference?: string;
  constructionSummary?: string;
  gradingNotes?: string;
  finishingNotes?: string;
  labelNotes?: string;
  packagingNotes?: string;
  sketchAltText?: string;
  approvalNote?: string;
  notes?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getTechnicalPack(id);
    if (!current) {
      return Response.json({ error: "技术包不存在。" }, { status: 404 });
    }
    const payload = (await request.json()) as UpdatePayload;
    if (current.status === "locked" && payload.status !== "review") {
      return Response.json(
        { error: "已锁定的技术包需先退回评审状态，才能修改。" },
        { status: 409 },
      );
    }
    const technicalFields = [
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
      "sketchAltText",
      "notes",
    ] as const;
    if (
      current.status === "approved" &&
      payload.status !== "review" &&
      payload.status !== "locked" &&
      technicalFields.some((key) => payload[key] !== undefined)
    ) {
      return Response.json(
        { error: "已批准的技术包需先退回评审状态，才能修改技术事实。" },
        { status: 409 },
      );
    }
    const update: Partial<NewTechnicalPack> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;

    if (payload.status !== undefined) {
      if (!TECH_PACK_STATUSES.includes(payload.status)) {
        return Response.json({ error: "技术包状态无效。" }, { status: 400 });
      }
      if (payload.status === "locked" && current.status !== "approved") {
        return Response.json(
          { error: "只有已批准的技术包可以锁定。" },
          { status: 409 },
        );
      }
      if (payload.status === "approved") {
        const overview = await buildTechnicalPackOverview();
        const workspace = overview.packs.find(
          (item) => item.pack.id === current.id,
        );
        const missing = [
          current.sketchImageKey ? "" : "技术图",
          cleanTechPackText(
            payload.baseSize ?? current.baseSize,
            80,
          )
            ? ""
            : "基码",
          cleanTechPackText(
            payload.fitIntent ?? current.fitIntent,
            1200,
          )
            ? ""
            : "版型意图",
          (workspace?.summary.activeMeasurements ?? 0) > 0
            ? ""
            : "尺寸点",
          (workspace?.summary.activeConstructionNotes ?? 0) > 0
            ? ""
            : "工艺说明",
        ].filter(Boolean);
        if (
          missing.length > 0 ||
          (workspace?.summary.criticalOpenNotes ?? 0) > 0
        ) {
          return Response.json(
            {
              error: missing.length
                ? `批准前还需补齐：${missing.join("、")}。`
                : "批准前需关闭关键工艺风险。",
            },
            { status: 409 },
          );
        }
        update.approvedBy = auth.user.email;
        update.approvedAt = new Date().toISOString();
      } else if (payload.status === "draft" || payload.status === "review") {
        update.approvedBy = "";
        update.approvedAt = null;
      }
      update.status = payload.status;
      changed = true;
    }
    if (payload.sampleStage !== undefined) {
      if (!SAMPLE_STAGES.includes(payload.sampleStage)) {
        return Response.json({ error: "样衣阶段无效。" }, { status: 400 });
      }
      update.sampleStage = payload.sampleStage;
      changed = true;
    }
    if (payload.unit !== undefined) {
      if (!TECH_PACK_UNITS.includes(payload.unit)) {
        return Response.json({ error: "尺寸单位无效。" }, { status: 400 });
      }
      update.unit = payload.unit;
      changed = true;
    }
    for (const [key, maxLength] of [
      ["baseSize", 80],
      ["fitIntent", 1200],
      ["patternReference", 240],
      ["constructionSummary", 2000],
      ["gradingNotes", 2000],
      ["finishingNotes", 2000],
      ["labelNotes", 1200],
      ["packagingNotes", 1200],
      ["sketchAltText", 240],
      ["approvalNote", 2000],
      ["notes", 4000],
    ] as const) {
      if (payload[key] !== undefined) {
        update[key] = cleanTechPackText(payload[key], maxLength);
        changed = true;
      }
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }

    const db = await getDb();
    const [pack] = await db
      .update(technicalPacks)
      .set(update)
      .where(eq(technicalPacks.id, id))
      .returning();
    return Response.json({ pack });
  } catch (error) {
    return techPackApiError(error, "更新技术包失败，请稍后重试。");
  }
}
