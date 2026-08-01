import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  fittingSessions,
  type FittingSession,
  type NewFittingSession,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanFittingText,
  fittingApiError,
  normalizeFittingDateTime,
} from "@/lib/fitting-input";
import {
  FITTING_DECISIONS,
  FITTING_STATUSES,
  fittingMissingFields,
  getFittingSession,
  listAllFittingImages,
  listAllFittingIssues,
  type FittingDecision,
  type FittingStatus,
} from "@/lib/fittings";
import { getTechnicalPack } from "@/lib/technical-packs";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  status?: FittingStatus;
  decision?: FittingDecision;
  sampleSize?: string;
  fittingAt?: string | null;
  location?: string;
  fitModelReference?: string;
  objective?: string;
  balanceNotes?: string;
  silhouetteNotes?: string;
  movementNotes?: string;
  comfortNotes?: string;
  conclusion?: string;
  nextFittingAt?: string | null;
  approvalNote?: string;
  notes?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getFittingSession(id);
    if (!current) {
      return Response.json({ error: "试身场次不存在。" }, { status: 404 });
    }
    const payload = (await request.json()) as UpdatePayload;

    if (["approved", "closed"].includes(current.status)) {
      if (
        current.status === "approved" &&
        payload.status === "closed" &&
        Object.keys(payload).every((key) => key === "status")
      ) {
        const db = await getDb();
        const [session] = await db
          .update(fittingSessions)
          .set({
            status: "closed",
            updatedAt: new Date().toISOString(),
          })
          .where(eq(fittingSessions.id, id))
          .returning();
        return Response.json({ session });
      }
      return Response.json(
        { error: "已批准的试身事实不可改写；如需继续调整，请建立下一轮试身。" },
        { status: 409 },
      );
    }
    if (current.status === "cancelled") {
      return Response.json(
        { error: "已取消场次不可改写，请建立新的试身场次。" },
        { status: 409 },
      );
    }

    const update: Partial<NewFittingSession> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;
    for (const [key, maxLength] of [
      ["sampleSize", 80],
      ["location", 240],
      ["fitModelReference", 180],
      ["objective", 2000],
      ["balanceNotes", 3000],
      ["silhouetteNotes", 3000],
      ["movementNotes", 3000],
      ["comfortNotes", 3000],
      ["conclusion", 4000],
      ["approvalNote", 2000],
      ["notes", 4000],
    ] as const) {
      if (payload[key] !== undefined) {
        update[key] = cleanFittingText(payload[key], maxLength);
        changed = true;
      }
    }
    for (const key of ["fittingAt", "nextFittingAt"] as const) {
      if (payload[key] !== undefined) {
        const normalized = normalizeFittingDateTime(payload[key]);
        if (payload[key] && !normalized) {
          return Response.json(
            { error: key === "fittingAt" ? "试身时间无效。" : "下次试身时间无效。" },
            { status: 400 },
          );
        }
        update[key] = normalized;
        changed = true;
      }
    }
    if (payload.decision !== undefined) {
      if (!FITTING_DECISIONS.includes(payload.decision)) {
        return Response.json({ error: "试身结论无效。" }, { status: 400 });
      }
      update.decision = payload.decision;
      changed = true;
    }
    if (payload.status !== undefined) {
      if (!FITTING_STATUSES.includes(payload.status)) {
        return Response.json({ error: "试身状态无效。" }, { status: 400 });
      }
      if (payload.status === "closed") {
        return Response.json(
          { error: "只有已批准的场次可以关闭。" },
          { status: 409 },
        );
      }
      update.status = payload.status;
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }

    const candidate = { ...current, ...update } as FittingSession;
    if (candidate.status === "approved") {
      const [pack, images, issues] = await Promise.all([
        getTechnicalPack(current.technicalPackId),
        listAllFittingImages(),
        listAllFittingIssues(),
      ]);
      if (!pack) {
        return Response.json({ error: "技术包不存在。" }, { status: 404 });
      }
      if (pack.status === "draft") {
        return Response.json(
          { error: "技术包至少进入评审状态后，才能批准试身结论。" },
          { status: 409 },
        );
      }
      if (candidate.decision !== "approve") {
        return Response.json(
          { error: "请先将设计结论设为通过，再批准试身场次。" },
          { status: 409 },
        );
      }
      const activeImages = images.filter(
        (image) =>
          image.fittingSessionId === id && image.status === "active",
      );
      const missing = fittingMissingFields(candidate, activeImages);
      if (missing.length > 0) {
        return Response.json(
          { error: `批准前仍需补齐：${missing.join("、")}。` },
          { status: 409 },
        );
      }
      const criticalOpen = issues.filter(
        (issue) =>
          issue.fittingSessionId === id &&
          issue.severity === "critical" &&
          !["resolved", "removed"].includes(issue.status),
      );
      if (criticalOpen.length > 0) {
        return Response.json(
          { error: `仍有 ${criticalOpen.length} 个关键版型问题未解决。` },
          { status: 409 },
        );
      }
      update.approvedBy = auth.user.email;
      update.approvedAt = new Date().toISOString();
    }

    const db = await getDb();
    const [session] = await db
      .update(fittingSessions)
      .set(update)
      .where(eq(fittingSessions.id, id))
      .returning();
    return Response.json({ session });
  } catch (error) {
    return fittingApiError(error, "更新试身场次失败，请稍后重试。");
  }
}
