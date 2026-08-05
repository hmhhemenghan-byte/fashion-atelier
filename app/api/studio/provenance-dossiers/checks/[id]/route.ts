import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  provenanceDossierChecks,
  type NewProvenanceDossierCheck,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { cleanProvenanceText, provenanceApiError } from "@/lib/provenance-dossier-input";
import {
  getProvenanceDossier,
  getProvenanceDossierCheck,
  PROVENANCE_DOSSIER_CHECK_RESULTS,
  type ProvenanceDossierCheckResult,
} from "@/lib/provenance-dossiers";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  result?: ProvenanceDossierCheckResult;
  observation?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const current = await getProvenanceDossierCheck(id);
    if (!current) {
      return Response.json({ error: "公开核对项不存在。" }, { status: 404 });
    }
    const dossier = await getProvenanceDossier(current.provenanceDossierId);
    if (!dossier) {
      return Response.json({ error: "溯源档案不存在。" }, { status: 404 });
    }
    if (["published", "retired", "void"].includes(dossier.status)) {
      return Response.json(
        { error: "该档案版本已经冻结，不能修改核对项。" },
        { status: 409 },
      );
    }
    const payload = (await request.json()) as UpdatePayload;
    const update: Partial<NewProvenanceDossierCheck> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;
    if (payload.result !== undefined) {
      if (!PROVENANCE_DOSSIER_CHECK_RESULTS.includes(payload.result)) {
        return Response.json({ error: "核对结果无效。" }, { status: 400 });
      }
      update.result = payload.result;
      changed = true;
    }
    if (payload.observation !== undefined) {
      update.observation = cleanProvenanceText(payload.observation, 2000);
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }
    const db = await getDb();
    const [check] = await db
      .update(provenanceDossierChecks)
      .set(update)
      .where(eq(provenanceDossierChecks.id, id))
      .returning();
    return Response.json({ check });
  } catch (error) {
    return provenanceApiError(error, "保存公开核对项失败，请稍后重试。");
  }
}
