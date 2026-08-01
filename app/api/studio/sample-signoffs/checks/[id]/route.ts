import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  sampleSignoffChecks,
  type NewSampleSignoffCheck,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanSampleSignoffText,
  sampleSignoffApiError,
} from "@/lib/sample-signoff-input";
import {
  getSampleSignoff,
  getSampleSignoffCheck,
  SAMPLE_SIGNOFF_CHECK_RESULTS,
  type SampleSignoffCheckResult,
} from "@/lib/sample-signoffs";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  result?: SampleSignoffCheckResult;
  observation?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getSampleSignoffCheck(id);
    if (!current) {
      return Response.json({ error: "封样核对项不存在。" }, { status: 404 });
    }
    const signoff = await getSampleSignoff(current.sampleSignoffId);
    if (!signoff) {
      return Response.json({ error: "封样签核不存在。" }, { status: 404 });
    }
    if (["approved", "sealed", "void"].includes(signoff.status)) {
      return Response.json(
        { error: "该封样事实已冻结，不能修改核对项。" },
        { status: 409 },
      );
    }
    const payload = (await request.json()) as UpdatePayload;
    const update: Partial<NewSampleSignoffCheck> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;
    if (payload.result !== undefined) {
      if (!SAMPLE_SIGNOFF_CHECK_RESULTS.includes(payload.result)) {
        return Response.json({ error: "核对结果无效。" }, { status: 400 });
      }
      update.result = payload.result;
      changed = true;
    }
    if (payload.observation !== undefined) {
      update.observation = cleanSampleSignoffText(
        payload.observation,
        1600,
      );
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }
    const db = await getDb();
    const [check] = await db
      .update(sampleSignoffChecks)
      .set(update)
      .where(eq(sampleSignoffChecks.id, id))
      .returning();
    return Response.json({ check });
  } catch (error) {
    return sampleSignoffApiError(
      error,
      "更新封样核对失败，请稍后重试。",
    );
  }
}
