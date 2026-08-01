import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  sampleAssets,
  sampleAuditItems,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { getSampleAuditWorkspace } from "@/lib/sample-inventory";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};
type ResolvePayload = { resolutionNote?: string };

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id, itemId } = await context.params;
    const audit = await getSampleAuditWorkspace(id);
    if (!audit) {
      return Response.json({ error: "盘点会话不存在。" }, { status: 404 });
    }
    if (audit.audit.status !== "review") {
      return Response.json(
        { error: "请先结束扫描，再处理盘点差异。" },
        { status: 409 },
      );
    }
    const item = audit.items.find((entry) => entry.id === itemId);
    if (
      !item ||
      !["misplaced", "missing", "unexpected"].includes(item.result)
    ) {
      return Response.json(
        { error: "没有可处理的盘点差异。" },
        { status: 404 },
      );
    }
    if (item.resolvedAt) {
      return Response.json(
        { error: "这条差异已经处理。" },
        { status: 409 },
      );
    }
    const payload = (await request.json()) as ResolvePayload;
    const resolutionNote =
      cleanText(payload.resolutionNote, 1000) ||
      defaultResolution(item.result);
    const now = new Date().toISOString();
    const db = await getDb();
    await db
      .update(sampleAuditItems)
      .set({ resolvedAt: now, resolutionNote, updatedAt: now })
      .where(
        and(
          eq(sampleAuditItems.id, itemId),
          eq(sampleAuditItems.auditId, id),
        ),
      );
    if (item.sampleAssetId) {
      if (item.result === "missing") {
        await db
          .update(sampleAssets)
          .set({ status: "missing", updatedAt: now })
          .where(eq(sampleAssets.id, item.sampleAssetId));
      } else {
        await db
          .update(sampleAssets)
          .set({
            currentLocation: item.observedLocation,
            lastSeenAt: item.scannedAt ?? now,
            ...(item.observedCondition !== "not_checked"
              ? { condition: item.observedCondition }
              : {}),
            updatedAt: now,
          })
          .where(eq(sampleAssets.id, item.sampleAssetId));
      }
    }
    return Response.json({
      audit: await getSampleAuditWorkspace(id),
    });
  } catch {
    return Response.json(
      { error: "处理盘点差异失败，请稍后重试。" },
      { status: 500 },
    );
  }
}

function defaultResolution(result: string) {
  if (result === "missing") return "已确认缺失并更新资产状态。";
  if (result === "misplaced") return "已接受现场位置并更新资产库位。";
  return "已将意外出现的资产位置更新到库存。";
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
