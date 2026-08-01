import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  sampleAssets,
  sampleAuditItems,
  type NewSampleAuditItem,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  findSampleAssetByCode,
  getSampleAuditWorkspace,
  SAMPLE_ASSET_CONDITIONS,
  type SampleAssetCondition,
} from "@/lib/sample-inventory";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type ScanPayload = {
  code?: string;
  observedLocation?: string;
  observedCondition?: SampleAssetCondition;
};

export async function POST(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const audit = await getSampleAuditWorkspace(id);
    if (!audit) {
      return Response.json({ error: "盘点会话不存在。" }, { status: 404 });
    }
    if (audit.audit.status !== "counting") {
      return Response.json(
        { error: "该盘点已停止扫描。" },
        { status: 409 },
      );
    }
    const payload = (await request.json()) as ScanPayload;
    const code = cleanText(payload.code, 160).toUpperCase();
    const observedLocation = cleanText(
      payload.observedLocation,
      180,
    ).toUpperCase();
    const observedCondition = payload.observedCondition ?? "not_checked";
    if (!code || !observedLocation) {
      return Response.json(
        { error: "请输入标签编号和现场位置。" },
        { status: 400 },
      );
    }
    if (!SAMPLE_ASSET_CONDITIONS.includes(observedCondition)) {
      return Response.json({ error: "现场品相无效。" }, { status: 400 });
    }
    const asset = await findSampleAssetByCode(code);
    if (!asset) {
      return Response.json(
        { error: "没有找到对应的样衣资产。" },
        { status: 404 },
      );
    }

    const db = await getDb();
    const [existing] = await db
      .select()
      .from(sampleAuditItems)
      .where(
        and(
          eq(sampleAuditItems.auditId, id),
          eq(sampleAuditItems.sampleAssetId, asset.id),
        ),
      )
      .limit(1);
    const now = new Date().toISOString();
    if (existing) {
      await db
        .update(sampleAuditItems)
        .set({
          observedLocation,
          observedCondition,
          result:
            existing.expectedLocation === observedLocation
              ? "matched"
              : "misplaced",
          scannedAt: now,
          resolvedAt: null,
          resolutionNote: "",
          updatedAt: now,
        })
        .where(eq(sampleAuditItems.id, existing.id));
    } else {
      const item: NewSampleAuditItem = {
        id: crypto.randomUUID(),
        auditId: id,
        sampleAssetId: asset.id,
        assetCode: asset.assetCode,
        workTitle: asset.workTitle,
        expectedStatus: asset.status,
        expectedLocation: asset.currentLocation,
        observedLocation,
        observedCondition,
        result: "unexpected",
        scannedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(sampleAuditItems).values(item);
    }
    const assetUpdate = {
      lastSeenAt: now,
      updatedAt: now,
      ...(observedCondition !== "not_checked"
        ? { condition: observedCondition }
        : {}),
    };
    await db
      .update(sampleAssets)
      .set(assetUpdate)
      .where(eq(sampleAssets.id, asset.id));
    return Response.json({
      audit: await getSampleAuditWorkspace(id),
    });
  } catch {
    return Response.json(
      { error: "登记盘点扫描失败，请稍后重试。" },
      { status: 500 },
    );
  }
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
