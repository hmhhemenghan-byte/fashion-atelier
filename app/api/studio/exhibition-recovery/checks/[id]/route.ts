import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { exhibitionRecoveryChecks, type NewExhibitionRecoveryCheck } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { EXHIBITION_RECOVERY_CHECK_RESULTS, getExhibitionRecovery, getExhibitionRecoveryCheck, type ExhibitionRecoveryCheckResult } from "@/lib/exhibition-recovery";
import { cleanRecoveryText, exhibitionRecoveryApiError } from "@/lib/exhibition-recovery-input";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError;
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const current = await getExhibitionRecoveryCheck(id);
    if (!current) return Response.json({ error: "展后复原核对项不存在。" }, { status: 404 });
    const recovery = await getExhibitionRecovery(current.exhibitionRecoveryId);
    if (!recovery) return Response.json({ error: "展后复原记录不存在。" }, { status: 404 });
    if (["released", "referred", "void"].includes(recovery.status)) return Response.json({ error: "该复原事实已经冻结，不能修改核对项。" }, { status: 409 });
    const payload = (await request.json()) as { result?: ExhibitionRecoveryCheckResult; observation?: string };
    const update: Partial<NewExhibitionRecoveryCheck> = { updatedAt: new Date().toISOString() }; let changed = false;
    if (payload.result !== undefined) { if (!EXHIBITION_RECOVERY_CHECK_RESULTS.includes(payload.result)) return Response.json({ error: "核对结果无效。" }, { status: 400 }); update.result = payload.result; changed = true; }
    if (payload.observation !== undefined) { update.observation = cleanRecoveryText(payload.observation, 2500); changed = true; }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    const db = await getDb(); const [check] = await db.update(exhibitionRecoveryChecks).set(update).where(eq(exhibitionRecoveryChecks.id, id)).returning();
    return Response.json({ check });
  } catch (error) { return exhibitionRecoveryApiError(error, "保存展后复原核对失败，请稍后重试。"); }
}
