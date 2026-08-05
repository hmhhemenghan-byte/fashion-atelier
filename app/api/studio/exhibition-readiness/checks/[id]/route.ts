import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { exhibitionReadinessChecks, type NewExhibitionReadinessCheck } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { cleanExhibitionText, exhibitionApiError } from "@/lib/exhibition-readiness-input";
import {
  EXHIBITION_CHECK_RESULTS,
  getExhibitionReadinessCheck,
  getExhibitionReadinessPlan,
  type ExhibitionCheckResult,
} from "@/lib/exhibition-readiness";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = { result?: ExhibitionCheckResult; observation?: string; critical?: boolean };

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const current = await getExhibitionReadinessCheck(id);
    if (!current) return Response.json({ error: "展陈核对不存在。" }, { status: 404 });
    const plan = await getExhibitionReadinessPlan(current.exhibitionReadinessPlanId);
    if (!plan) return Response.json({ error: "展陈方案不存在。" }, { status: 404 });
    if (["approved", "closed", "void"].includes(plan.status)) return Response.json({ error: "该展陈事实已经冻结，不能修改核对。" }, { status: 409 });
    const payload = (await request.json()) as UpdatePayload;
    const update: Partial<NewExhibitionReadinessCheck> = { updatedAt: new Date().toISOString() };
    let changed = false;
    if (payload.result !== undefined) {
      if (!EXHIBITION_CHECK_RESULTS.includes(payload.result)) return Response.json({ error: "核对结果无效。" }, { status: 400 });
      update.result = payload.result; changed = true;
    }
    if (payload.observation !== undefined) { update.observation = cleanExhibitionText(payload.observation, 2400); changed = true; }
    if (payload.critical !== undefined) { update.critical = Boolean(payload.critical); changed = true; }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    const candidate = { ...current, ...update };
    if (["attention", "blocked"].includes(candidate.result || "") && !candidate.observation?.trim()) {
      return Response.json({ error: "需关注或阻塞的条件必须记录观察事实。" }, { status: 409 });
    }
    const db = await getDb();
    const [check] = await db.update(exhibitionReadinessChecks).set(update)
      .where(eq(exhibitionReadinessChecks.id, id)).returning();
    return Response.json({ check });
  } catch (error) {
    return exhibitionApiError(error, "保存展陈核对失败，请稍后重试。");
  }
}
