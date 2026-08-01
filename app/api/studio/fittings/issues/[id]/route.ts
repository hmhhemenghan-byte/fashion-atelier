import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  fittingIssues,
  type NewFittingIssue,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanFittingText,
  fittingApiError,
  fittingInteger,
  normalizeFittingDateTime,
} from "@/lib/fitting-input";
import {
  FITTING_ISSUE_CATEGORIES,
  FITTING_ISSUE_SEVERITIES,
  FITTING_ISSUE_STATUSES,
  FITTING_SIDES,
  getFittingIssue,
  getFittingSession,
  type FittingIssueCategory,
  type FittingIssueSeverity,
  type FittingIssueStatus,
  type FittingSide,
} from "@/lib/fittings";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  category?: FittingIssueCategory;
  area?: string;
  side?: FittingSide;
  observation?: string;
  alteration?: string;
  pointCode?: string;
  severity?: FittingIssueSeverity;
  status?: FittingIssueStatus;
  ownerName?: string;
  dueAt?: string | null;
  sortOrder?: number | string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getFittingIssue(id);
    if (!current) {
      return Response.json({ error: "版型问题不存在。" }, { status: 404 });
    }
    const session = await getFittingSession(current.fittingSessionId);
    if (!session) {
      return Response.json({ error: "试身场次不存在。" }, { status: 404 });
    }
    if (["approved", "closed", "cancelled"].includes(session.status)) {
      return Response.json(
        { error: "该试身场次已冻结，不能修改问题记录。" },
        { status: 409 },
      );
    }
    const payload = (await request.json()) as UpdatePayload;
    const update: Partial<NewFittingIssue> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;
    if (payload.category !== undefined) {
      if (!FITTING_ISSUE_CATEGORIES.includes(payload.category)) {
        return Response.json({ error: "问题类别无效。" }, { status: 400 });
      }
      update.category = payload.category;
      changed = true;
    }
    if (payload.side !== undefined) {
      if (!FITTING_SIDES.includes(payload.side)) {
        return Response.json({ error: "观察方向无效。" }, { status: 400 });
      }
      update.side = payload.side;
      changed = true;
    }
    if (payload.severity !== undefined) {
      if (!FITTING_ISSUE_SEVERITIES.includes(payload.severity)) {
        return Response.json({ error: "问题级别无效。" }, { status: 400 });
      }
      update.severity = payload.severity;
      changed = true;
    }
    if (payload.status !== undefined) {
      if (!FITTING_ISSUE_STATUSES.includes(payload.status)) {
        return Response.json({ error: "问题状态无效。" }, { status: 400 });
      }
      update.status = payload.status;
      update.resolvedAt =
        payload.status === "resolved" ? new Date().toISOString() : null;
      changed = true;
    }
    for (const [key, maxLength] of [
      ["area", 180],
      ["observation", 2400],
      ["alteration", 2400],
      ["pointCode", 80],
      ["ownerName", 180],
    ] as const) {
      if (payload[key] !== undefined) {
        const value = cleanFittingText(payload[key], maxLength);
        if (key === "observation" && !value) {
          return Response.json(
            { error: "观察事实不能为空。" },
            { status: 400 },
          );
        }
        update[key] = value;
        changed = true;
      }
    }
    if (payload.dueAt !== undefined) {
      const dueAt = normalizeFittingDateTime(payload.dueAt);
      if (payload.dueAt && !dueAt) {
        return Response.json({ error: "处理日期无效。" }, { status: 400 });
      }
      update.dueAt = dueAt;
      changed = true;
    }
    if (payload.sortOrder !== undefined) {
      update.sortOrder = fittingInteger(payload.sortOrder);
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }
    const db = await getDb();
    const [issue] = await db
      .update(fittingIssues)
      .set(update)
      .where(eq(fittingIssues.id, id))
      .returning();
    return Response.json({ issue });
  } catch (error) {
    return fittingApiError(error, "更新版型问题失败，请稍后重试。");
  }
}
