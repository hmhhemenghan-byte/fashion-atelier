import { and, eq, notInArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  sampleAssets,
  sampleLoanItems,
  sampleLoans,
  type NewSampleAsset,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  getSampleAsset,
  SAMPLE_ASSET_CATEGORIES,
  SAMPLE_ASSET_CONDITIONS,
  SAMPLE_ASSET_STATUSES,
  type SampleAssetCategory,
  type SampleAssetCondition,
  type SampleAssetStatus,
} from "@/lib/sample-inventory";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  tagCode?: string | null;
  sizeLabel?: string;
  colorLabel?: string;
  category?: SampleAssetCategory;
  status?: SampleAssetStatus;
  condition?: SampleAssetCondition;
  department?: string;
  homeLocation?: string;
  currentLocation?: string;
  notes?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getSampleAsset(id);
    if (!current) {
      return Response.json({ error: "样衣资产不存在。" }, { status: 404 });
    }
    const db = await getDb();
    const [activeAssignment] = await db
      .select({ itemId: sampleLoanItems.id })
      .from(sampleLoanItems)
      .innerJoin(sampleLoans, eq(sampleLoanItems.loanId, sampleLoans.id))
      .where(
        and(
          eq(sampleLoanItems.sampleAssetId, id),
          notInArray(sampleLoans.status, [
            "closed",
            "cancelled",
            "returned",
          ]),
        ),
      )
      .limit(1);

    const payload = (await request.json()) as UpdatePayload;
    const update: Partial<NewSampleAsset> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;

    if (payload.status !== undefined) {
      if (!SAMPLE_ASSET_STATUSES.includes(payload.status)) {
        return Response.json({ error: "资产状态无效。" }, { status: 400 });
      }
      if (
        activeAssignment &&
        ["available", "archived"].includes(payload.status)
      ) {
        return Response.json(
          { error: "资产仍关联进行中的借调单，不能设为可用或归档。" },
          { status: 409 },
        );
      }
      update.status = payload.status;
      changed = true;
    }
    if (payload.category !== undefined) {
      if (!SAMPLE_ASSET_CATEGORIES.includes(payload.category)) {
        return Response.json({ error: "样衣类别无效。" }, { status: 400 });
      }
      update.category = payload.category;
      changed = true;
    }
    if (payload.condition !== undefined) {
      if (!SAMPLE_ASSET_CONDITIONS.includes(payload.condition)) {
        return Response.json({ error: "样衣品相无效。" }, { status: 400 });
      }
      update.condition = payload.condition;
      changed = true;
    }

    for (const [key, max] of [
      ["sizeLabel", 80],
      ["colorLabel", 120],
      ["department", 160],
      ["homeLocation", 180],
      ["currentLocation", 180],
      ["notes", 1600],
    ] as const) {
      if (payload[key] === undefined) continue;
      const value = cleanText(payload[key], max);
      update[key] =
        key === "department" ||
        key === "homeLocation" ||
        key === "currentLocation"
          ? value.toUpperCase()
          : value;
      if (key === "homeLocation" && current.currentLocation === current.homeLocation) {
        update.currentLocation = value.toUpperCase();
      }
      changed = true;
    }
    if (payload.tagCode !== undefined) {
      update.tagCode = cleanText(payload.tagCode, 160).toUpperCase() || null;
      changed = true;
    }
    if (!changed) {
      return Response.json(
        { error: "没有可保存的修改。" },
        { status: 400 },
      );
    }
    const [asset] = await db
      .update(sampleAssets)
      .set(update)
      .where(eq(sampleAssets.id, id))
      .returning();
    return Response.json({ asset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Response.json(
      {
        error: message.includes("UNIQUE")
          ? "标签编号已被其他样衣使用。"
          : "保存样衣资产失败，请稍后重试。",
      },
      { status: 500 },
    );
  }
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
