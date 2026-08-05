import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { exhibitionOpeningGates, type ExhibitionOpeningGate, type NewExhibitionOpeningGate } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { EXHIBITION_OPENING_DECISIONS, EXHIBITION_OPENING_STATUSES, buildExhibitionOpeningOverview, exhibitionOpeningMissingFields, getExhibitionOpeningGate, type ExhibitionOpeningDecision, type ExhibitionOpeningStatus } from "@/lib/exhibition-opening";
import { cleanOpeningText, normalizeOpeningDateTime, openingApiError } from "@/lib/exhibition-opening-input";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = { status?: ExhibitionOpeningStatus; decision?: ExhibitionOpeningDecision; openingLead?: string; venue?: string; plannedOpeningAt?: string | null; plannedClosingAt?: string | null; operatingBrief?: string; dailyCheckCadence?: string; staffHandover?: string; visitorAccessibilityPlan?: string; incidentEscalation?: string; emergencyPauseRule?: string; approvalNote?: string };
const transitions: Record<ExhibitionOpeningStatus, ExhibitionOpeningStatus[]> = { draft: ["draft", "in_review", "void"], in_review: ["in_review", "draft", "approved", "void"], approved: ["approved", "closed"], closed: ["closed"], void: ["void"] };

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError; const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const { id } = await context.params; const current = await getExhibitionOpeningGate(id); if (!current) return Response.json({ error: "展览开放签核不存在。" }, { status: 404 }); const payload = (await request.json()) as UpdatePayload;
    if (["closed", "void"].includes(current.status)) return Response.json({ error: "该开放事实已经冻结，不能改写。" }, { status: 409 }); if (current.status === "approved" && (payload.status !== "closed" || Object.keys(payload).some((key) => key !== "status"))) return Response.json({ error: "已批准开放记录不可原地改写；请关闭后建立新修订。" }, { status: 409 });
    const update: Partial<NewExhibitionOpeningGate> = { updatedAt: new Date().toISOString() }; let changed = false;
    for (const [key, maxLength] of [["openingLead", 500], ["venue", 1000], ["operatingBrief", 4000], ["dailyCheckCadence", 4000], ["staffHandover", 4000], ["visitorAccessibilityPlan", 4000], ["incidentEscalation", 4000], ["emergencyPauseRule", 4000], ["approvalNote", 4000]] as const) if (payload[key] !== undefined) { update[key] = cleanOpeningText(payload[key], maxLength); changed = true; }
    for (const key of ["plannedOpeningAt", "plannedClosingAt"] as const) if (payload[key] !== undefined) { const normalized = normalizeOpeningDateTime(payload[key]); if (payload[key] && !normalized) return Response.json({ error: "开放或闭展时间无效。" }, { status: 400 }); update[key] = normalized; changed = true; }
    if (payload.decision !== undefined) { if (!EXHIBITION_OPENING_DECISIONS.includes(payload.decision)) return Response.json({ error: "人工开放决定无效。" }, { status: 400 }); update.decision = payload.decision; changed = true; }
    if (payload.status !== undefined) { if (!EXHIBITION_OPENING_STATUSES.includes(payload.status)) return Response.json({ error: "开放签核状态无效。" }, { status: 400 }); if (!transitions[current.status].includes(payload.status)) return Response.json({ error: "请按草稿、复核、批准与关闭顺序推进。" }, { status: 409 }); update.status = payload.status; changed = true; }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 }); const candidate = { ...current, ...update } as ExhibitionOpeningGate;
    if (candidate.status === "approved") { if (candidate.decision !== "open") return Response.json({ error: "只有设计师明确选择开放授权后才能批准。" }, { status: 409 }); const overview = await buildExhibitionOpeningOverview(); const workspace = overview.gates.find((item) => item.gate.id === id); if (!workspace) return Response.json({ error: "开放签核来源已经失效。" }, { status: 409 }); const missing = exhibitionOpeningMissingFields(candidate, workspace.items, workspace.summary.expectedItems, workspace.project, workspace.installation); if (missing.length > 0) return Response.json({ error: `批准前仍需补齐：${missing.join("、")}。` }, { status: 409 }); update.approvedBy = auth.user.email; update.approvedAt = new Date().toISOString(); } else if (candidate.status === "closed") update.closedAt = new Date().toISOString();
    const db = await getDb(); const [gate] = await db.update(exhibitionOpeningGates).set(update).where(eq(exhibitionOpeningGates.id, id)).returning(); return Response.json({ gate });
  } catch (error) { return openingApiError(error, "保存展览开放签核失败，请稍后重试。"); }
}
