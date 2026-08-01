import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  productionReleaseChecks,
  type NewProductionReleaseCheck,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanProductionReleaseText,
  productionReleaseApiError,
} from "@/lib/production-release-input";
import {
  getProductionRelease,
  getProductionReleaseCheck,
  PRODUCTION_RELEASE_CHECK_RESULTS,
  type ProductionReleaseCheckResult,
} from "@/lib/production-releases";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  result?: ProductionReleaseCheckResult;
  observation?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getProductionReleaseCheck(id);
    if (!current) {
      return Response.json({ error: "准备核对项不存在。" }, { status: 404 });
    }
    const release = await getProductionRelease(
      current.productionReleaseId,
    );
    if (!release) {
      return Response.json({ error: "生产放行记录不存在。" }, { status: 404 });
    }
    if (
      ["ready", "released", "superseded", "void"].includes(release.status)
    ) {
      return Response.json(
        { error: "该生产放行事实已冻结，不能改写核对项。" },
        { status: 409 },
      );
    }
    const payload = (await request.json()) as UpdatePayload;
    const update: Partial<NewProductionReleaseCheck> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;
    if (payload.result !== undefined) {
      if (!PRODUCTION_RELEASE_CHECK_RESULTS.includes(payload.result)) {
        return Response.json({ error: "核对结果无效。" }, { status: 400 });
      }
      update.result = payload.result;
      changed = true;
    }
    if (payload.observation !== undefined) {
      update.observation = cleanProductionReleaseText(
        payload.observation,
        3000,
      );
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }
    const db = await getDb();
    const [check] = await db
      .update(productionReleaseChecks)
      .set(update)
      .where(eq(productionReleaseChecks.id, id))
      .returning();
    return Response.json({ check });
  } catch (error) {
    return productionReleaseApiError(
      error,
      "更新生产准备核对失败，请稍后重试。",
    );
  }
}
