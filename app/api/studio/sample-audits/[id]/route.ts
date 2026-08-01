import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  sampleAssets,
  sampleAuditItems,
  sampleAudits,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  getSampleAuditWorkspace,
  sampleAuditToCsv,
} from "@/lib/sample-inventory";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  action?: "finish_count" | "complete" | "cancel";
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const audit = await getSampleAuditWorkspace(id);
    if (!audit) {
      return Response.json({ error: "盘点会话不存在。" }, { status: 404 });
    }
    if (new URL(request.url).searchParams.get("format") === "csv") {
      return new Response(sampleAuditToCsv(audit), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="nera-${audit.audit.auditCode.toLowerCase()}.csv"`,
          "cache-control": "private, no-store",
        },
      });
    }
    return Response.json(
      { audit },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      { error: "无法读取盘点会话，请稍后重试。" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getSampleAuditWorkspace(id);
    if (!current) {
      return Response.json({ error: "盘点会话不存在。" }, { status: 404 });
    }
    const payload = (await request.json()) as UpdatePayload;
    const now = new Date().toISOString();
    const db = await getDb();

    if (payload.action === "finish_count") {
      if (current.audit.status !== "counting") {
        return Response.json(
          { error: "只有计数中的盘点可以结束扫描。" },
          { status: 409 },
        );
      }
      await db.batch([
        db
          .update(sampleAuditItems)
          .set({ result: "accounted_out", updatedAt: now })
          .where(
            and(
              eq(sampleAuditItems.auditId, id),
              eq(sampleAuditItems.result, "pending"),
              inArray(sampleAuditItems.expectedStatus, [
                "in_transit",
                "out_on_loan",
              ]),
            ),
          ),
        db
          .update(sampleAuditItems)
          .set({ result: "missing", updatedAt: now })
          .where(
            and(
              eq(sampleAuditItems.auditId, id),
              eq(sampleAuditItems.result, "pending"),
            ),
          ),
        db
          .update(sampleAudits)
          .set({ status: "review", updatedAt: now })
          .where(eq(sampleAudits.id, id)),
      ]);
      return Response.json({
        audit: await getSampleAuditWorkspace(id),
      });
    }

    if (payload.action === "complete") {
      if (current.audit.status !== "review") {
        return Response.json(
          { error: "请先结束扫描并进入差异复核。" },
          { status: 409 },
        );
      }
      if (current.summary.pending > 0 || current.summary.unresolved > 0) {
        return Response.json(
          { error: "仍有未处理的盘点差异，暂时不能完成。" },
          { status: 409 },
        );
      }
      const assetIds = current.items
        .map((item) => item.sampleAssetId)
        .filter((value): value is string => Boolean(value));
      await db
        .update(sampleAudits)
        .set({ status: "completed", completedAt: now, updatedAt: now })
        .where(eq(sampleAudits.id, id));
      if (assetIds.length > 0) {
        await db
          .update(sampleAssets)
          .set({ lastAuditAt: now, updatedAt: now })
          .where(inArray(sampleAssets.id, assetIds));
      }
      return Response.json({
        audit: await getSampleAuditWorkspace(id),
      });
    }

    if (payload.action === "cancel") {
      if (current.audit.status === "completed") {
        return Response.json(
          { error: "已完成的盘点不能取消。" },
          { status: 409 },
        );
      }
      await db
        .update(sampleAudits)
        .set({ status: "cancelled", completedAt: now, updatedAt: now })
        .where(eq(sampleAudits.id, id));
      return Response.json({
        audit: await getSampleAuditWorkspace(id),
      });
    }

    return Response.json({ error: "盘点操作无效。" }, { status: 400 });
  } catch {
    return Response.json(
      { error: "更新盘点状态失败，请稍后重试。" },
      { status: 500 },
    );
  }
}
