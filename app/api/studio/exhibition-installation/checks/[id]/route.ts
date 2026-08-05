import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { exhibitionInstallationChecks, type NewExhibitionInstallationCheck } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { EXHIBITION_INSTALLATION_RESULTS, getExhibitionInstallationCheck, getExhibitionInstallationGate, type ExhibitionInstallationResult } from "@/lib/exhibition-installation";
import { cleanInstallationText, installationApiError, installationInteger } from "@/lib/exhibition-installation-input";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = { sequence?: number | string; result?: ExhibitionInstallationResult; observedPlacement?: string; observedFormat?: string; observation?: string; correctiveAction?: string };

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError;
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const { id } = await context.params; const current = await getExhibitionInstallationCheck(id);
    if (!current) return Response.json({ error: "现场装校核对项不存在。" }, { status: 404 });
    const gate = await getExhibitionInstallationGate(current.exhibitionInstallationGateId);
    if (!gate) return Response.json({ error: "展览装校签核不存在。" }, { status: 404 });
    if (["approved", "closed", "void"].includes(gate.status)) return Response.json({ error: "该装校事实已经冻结，不能修改核对项。" }, { status: 409 });
    const payload = (await request.json()) as UpdatePayload; const update: Partial<NewExhibitionInstallationCheck> = { updatedAt: new Date().toISOString() }; let changed = false;
    if (payload.sequence !== undefined) { update.sequence = installationInteger(payload.sequence, current.sequence); changed = true; }
    if (payload.result !== undefined) { if (!EXHIBITION_INSTALLATION_RESULTS.includes(payload.result)) return Response.json({ error: "现场核对结果无效。" }, { status: 400 }); update.result = payload.result; changed = true; }
    for (const [key, maxLength] of [["observedPlacement", 2400], ["observedFormat", 2400], ["observation", 4000], ["correctiveAction", 4000]] as const) {
      if (payload[key] !== undefined) { update[key] = cleanInstallationText(payload[key], maxLength); changed = true; }
    }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    const db = await getDb(); const [check] = await db.update(exhibitionInstallationChecks).set(update).where(eq(exhibitionInstallationChecks.id, id)).returning();
    return Response.json({ check });
  } catch (error) { return installationApiError(error, "保存现场装校核对失败，请稍后重试。"); }
}
