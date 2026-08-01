import { getDb } from "@/db";
import {
  productionExceptionActions,
  type NewProductionExceptionAction,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanProductionExceptionText,
  productionExceptionApiError,
} from "@/lib/production-exception-input";
import {
  getProductionException,
  PRODUCTION_EXCEPTION_ACTION_TYPES,
  type ProductionExceptionActionType,
} from "@/lib/production-exceptions";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type CreatePayload = {
  actionType?: ProductionExceptionActionType;
  note?: string;
  reference?: string;
  occurredAt?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const parent = await getProductionException(id);
    if (!parent) {
      return Response.json({ error: "生产偏差记录不存在。" }, { status: 404 });
    }
    if (["closed", "withdrawn"].includes(parent.status)) {
      return Response.json(
        { error: "该偏差已经冻结，不能追加记录。" },
        { status: 409 },
      );
    }
    const payload = (await request.json()) as CreatePayload;
    const actionType = payload.actionType ?? "review_note";
    if (!PRODUCTION_EXCEPTION_ACTION_TYPES.includes(actionType)) {
      return Response.json({ error: "记录类型无效。" }, { status: 400 });
    }
    const note = cleanProductionExceptionText(payload.note, 4000);
    if (!note) {
      return Response.json({ error: "请填写记录内容。" }, { status: 400 });
    }
    const occurredAtRaw = cleanProductionExceptionText(payload.occurredAt, 80);
    const parsed = occurredAtRaw ? new Date(occurredAtRaw) : new Date();
    if (Number.isNaN(parsed.getTime())) {
      return Response.json({ error: "记录时间无效。" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const values: NewProductionExceptionAction = {
      id: crypto.randomUUID(),
      productionExceptionId: parent.id,
      actionType,
      note,
      reference: cleanProductionExceptionText(payload.reference, 1000),
      occurredAt: parsed.toISOString(),
      createdBy: auth.user.email,
      createdAt: now,
    };
    const db = await getDb();
    const [action] = await db
      .insert(productionExceptionActions)
      .values(values)
      .returning();
    return Response.json({ action }, { status: 201 });
  } catch (error) {
    return productionExceptionApiError(
      error,
      "追加偏差记录失败，请稍后重试。",
    );
  }
}
