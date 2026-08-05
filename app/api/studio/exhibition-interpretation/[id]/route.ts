import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { interpretationPackages, type NewInterpretationPackage } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { buildInterpretationOverview, getInterpretationPackage, INTERPRETATION_DECISIONS, INTERPRETATION_STATUSES, interpretationMissingFields, type InterpretationDecision, type InterpretationStatus } from "@/lib/exhibition-interpretation";
import { cleanInterpretationText, interpretationApiError } from "@/lib/exhibition-interpretation-input";

type RouteContext = { params: Promise<{ id: string }> };
type Payload = { status?: InterpretationStatus; decision?: InterpretationDecision; editor?: string; primaryLanguage?: string; secondaryLanguage?: string; title?: string; subtitle?: string; entranceText?: string; curatorialCredit?: string; acknowledgement?: string; accessibilityNote?: string; rightsNote?: string; approvalNote?: string };
const transitions: Record<InterpretationStatus, InterpretationStatus[]> = {
  draft: ["draft", "in_review", "void"], in_review: ["in_review", "draft", "approved", "void"], approved: ["approved", "closed"], closed: ["closed"], void: ["void"],
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError;
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const { id } = await context.params; const current = await getInterpretationPackage(id);
    if (!current) return Response.json({ error: "展览释读包不存在。" }, { status: 404 });
    if (["closed", "void"].includes(current.status)) return Response.json({ error: "该释读事实已经冻结，不能改写。" }, { status: 409 });
    const payload = (await request.json()) as Payload;
    if (current.status === "approved" && (payload.status !== "closed" || Object.keys(payload).some((key) => key !== "status"))) return Response.json({ error: "已批准释读包只能关闭；新的文字变化请建立下一修订。" }, { status: 409 });
    const update: Partial<NewInterpretationPackage> = { updatedAt: new Date().toISOString() }; let changed = false;
    for (const [key, max] of [["editor", 500], ["primaryLanguage", 40], ["secondaryLanguage", 40], ["title", 500], ["subtitle", 1000], ["entranceText", 8000], ["curatorialCredit", 2000], ["acknowledgement", 4000], ["accessibilityNote", 4000], ["rightsNote", 4000], ["approvalNote", 5000]] as const) {
      if (payload[key] !== undefined) { update[key] = cleanInterpretationText(payload[key], max); changed = true; }
    }
    if (payload.decision !== undefined) { if (!INTERPRETATION_DECISIONS.includes(payload.decision)) return Response.json({ error: "人工决定无效。" }, { status: 400 }); update.decision = payload.decision; changed = true; }
    if (payload.status !== undefined) {
      if (!INTERPRETATION_STATUSES.includes(payload.status) || !transitions[current.status].includes(payload.status)) return Response.json({ error: "释读状态转换无效。" }, { status: 409 });
      if (payload.status === "approved") {
        const overview = await buildInterpretationOverview(); const workspace = overview.packages.find((item) => item.package.id === id);
        if (!workspace) return Response.json({ error: "无法核对释读包。" }, { status: 404 });
        const missing = interpretationMissingFields({ ...current, ...update }, workspace.sections, workspace.labels, workspace.summary.expectedSelectionIds);
        if (missing.length || (update.decision ?? current.decision) !== "approve") return Response.json({ error: `批准前仍需补齐：${missing.join("、") || "人工决定必须为通过"}。` }, { status: 409 });
        update.approvedBy = auth.user.email; update.approvedAt = new Date().toISOString();
      }
      if (payload.status === "closed") update.closedAt = new Date().toISOString();
      update.status = payload.status; changed = true;
    }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    const db = await getDb(); const [item] = await db.update(interpretationPackages).set(update).where(eq(interpretationPackages.id, id)).returning();
    return Response.json({ package: item });
  } catch (error) { return interpretationApiError(error, "保存展览释读包失败，请稍后重试。"); }
}
