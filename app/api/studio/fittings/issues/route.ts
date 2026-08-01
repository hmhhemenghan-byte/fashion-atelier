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
  FITTING_SIDES,
  getFittingSession,
  type FittingIssueCategory,
  type FittingIssueSeverity,
  type FittingSide,
} from "@/lib/fittings";

export const dynamic = "force-dynamic";

type CreatePayload = {
  fittingSessionId?: string;
  category?: FittingIssueCategory;
  area?: string;
  side?: FittingSide;
  observation?: string;
  alteration?: string;
  pointCode?: string;
  severity?: FittingIssueSeverity;
  ownerName?: string;
  dueAt?: string | null;
  sortOrder?: number | string;
};

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as CreatePayload;
    const fittingSessionId = cleanFittingText(
      payload.fittingSessionId,
      120,
    );
    const observation = cleanFittingText(payload.observation, 2400);
    if (!fittingSessionId || !observation) {
      return Response.json(
        { error: "请选择试身场次并填写观察事实。" },
        { status: 400 },
      );
    }
    const session = await getFittingSession(fittingSessionId);
    if (!session) {
      return Response.json({ error: "试身场次不存在。" }, { status: 404 });
    }
    if (["approved", "closed", "cancelled"].includes(session.status)) {
      return Response.json(
        { error: "该试身场次已冻结，不能新增问题。" },
        { status: 409 },
      );
    }
    const category = payload.category ?? "balance";
    const side = payload.side ?? "all";
    const severity = payload.severity ?? "important";
    if (!FITTING_ISSUE_CATEGORIES.includes(category)) {
      return Response.json({ error: "问题类别无效。" }, { status: 400 });
    }
    if (!FITTING_SIDES.includes(side)) {
      return Response.json({ error: "观察方向无效。" }, { status: 400 });
    }
    if (!FITTING_ISSUE_SEVERITIES.includes(severity)) {
      return Response.json({ error: "问题级别无效。" }, { status: 400 });
    }
    const dueAt = normalizeFittingDateTime(payload.dueAt);
    if (payload.dueAt && !dueAt) {
      return Response.json({ error: "处理日期无效。" }, { status: 400 });
    }
    const timestamp = new Date().toISOString();
    const values: NewFittingIssue = {
      id: crypto.randomUUID(),
      fittingSessionId,
      category,
      area: cleanFittingText(payload.area, 180),
      side,
      observation,
      alteration: cleanFittingText(payload.alteration, 2400),
      pointCode: cleanFittingText(payload.pointCode, 80),
      severity,
      status: "open",
      ownerName: cleanFittingText(payload.ownerName, 180),
      dueAt,
      resolvedAt: null,
      sortOrder: fittingInteger(payload.sortOrder),
      createdBy: auth.user.email,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const db = await getDb();
    const [issue] = await db
      .insert(fittingIssues)
      .values(values)
      .returning();
    return Response.json({ issue }, { status: 201 });
  } catch (error) {
    return fittingApiError(error, "新增版型问题失败，请稍后重试。");
  }
}
