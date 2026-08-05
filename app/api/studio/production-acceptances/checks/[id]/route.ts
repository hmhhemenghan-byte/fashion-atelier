import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  productionAcceptanceChecks,
  type NewProductionAcceptanceCheck,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanProductionAcceptanceText,
  productionAcceptanceApiError,
} from "@/lib/production-acceptance-input";
import {
  getProductionAcceptance,
  getProductionAcceptanceCheck,
  PRODUCTION_ACCEPTANCE_CHECK_RESULTS,
  type ProductionAcceptanceCheckResult,
} from "@/lib/production-acceptances";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  result?: ProductionAcceptanceCheckResult;
  observation?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const current = await getProductionAcceptanceCheck(id);
    if (!current) {
      return Response.json({ error: "成衣验收核对项不存在。" }, { status: 404 });
    }
    const acceptance = await getProductionAcceptance(
      current.productionAcceptanceId,
    );
    if (!acceptance) {
      return Response.json({ error: "成衣验收记录不存在。" }, { status: 404 });
    }
    if (["accepted", "rejected", "void"].includes(acceptance.status)) {
      return Response.json(
        { error: "该验收事实已经冻结，不能修改核对项。" },
        { status: 409 },
      );
    }
    const payload = (await request.json()) as UpdatePayload;
    const update: Partial<NewProductionAcceptanceCheck> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;
    if (payload.result !== undefined) {
      if (!PRODUCTION_ACCEPTANCE_CHECK_RESULTS.includes(payload.result)) {
        return Response.json({ error: "核对结果无效。" }, { status: 400 });
      }
      update.result = payload.result;
      changed = true;
    }
    if (payload.observation !== undefined) {
      update.observation = cleanProductionAcceptanceText(
        payload.observation,
        2000,
      );
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }
    const db = await getDb();
    const [check] = await db
      .update(productionAcceptanceChecks)
      .set(update)
      .where(eq(productionAcceptanceChecks.id, id))
      .returning();
    return Response.json({ check });
  } catch (error) {
    return productionAcceptanceApiError(
      error,
      "保存成衣核对失败，请稍后重试。",
    );
  }
}
