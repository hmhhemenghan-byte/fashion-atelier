import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { exhibitionInstallationGates, type ExhibitionInstallationGate, type NewExhibitionInstallationGate } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { EXHIBITION_INSTALLATION_DECISIONS, EXHIBITION_INSTALLATION_STATUSES, buildExhibitionInstallationOverview, exhibitionInstallationMissingFields, getExhibitionInstallationGate, type ExhibitionInstallationDecision, type ExhibitionInstallationStatus } from "@/lib/exhibition-installation";
import { cleanInstallationText, installationApiError, normalizeInstallationDateTime } from "@/lib/exhibition-installation-input";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = { status?: ExhibitionInstallationStatus; decision?: ExhibitionInstallationDecision; leadName?: string; venue?: string; inspectionAt?: string | null; openingAt?: string | null; installationScope?: string; accessibilityObservation?: string; rightsObservation?: string; safetyNote?: string; handoverNote?: string; approvalNote?: string };

const transitions: Record<ExhibitionInstallationStatus, ExhibitionInstallationStatus[]> = {
  draft: ["draft", "in_review", "void"], in_review: ["in_review", "draft", "approved", "void"], approved: ["approved", "closed"], closed: ["closed"], void: ["void"],
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError;
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const { id } = await context.params; const current = await getExhibitionInstallationGate(id);
    if (!current) return Response.json({ error: "展览装校签核不存在。" }, { status: 404 });
    const payload = (await request.json()) as UpdatePayload;
    if (["closed", "void"].includes(current.status)) return Response.json({ error: "该装校事实已经冻结，不能改写。" }, { status: 409 });
    if (current.status === "approved" && (payload.status !== "closed" || Object.keys(payload).some((key) => key !== "status"))) return Response.json({ error: "已签核装校记录不可原地改写；请关闭后建立新修订。" }, { status: 409 });
    const update: Partial<NewExhibitionInstallationGate> = { updatedAt: new Date().toISOString() }; let changed = false;
    for (const [key, maxLength] of [["leadName", 500], ["venue", 1000], ["installationScope", 4000], ["accessibilityObservation", 4000], ["rightsObservation", 4000], ["safetyNote", 4000], ["handoverNote", 4000], ["approvalNote", 4000]] as const) {
      if (payload[key] !== undefined) { update[key] = cleanInstallationText(payload[key], maxLength); changed = true; }
    }
    for (const key of ["inspectionAt", "openingAt"] as const) {
      if (payload[key] !== undefined) { const normalized = normalizeInstallationDateTime(payload[key]); if (payload[key] && !normalized) return Response.json({ error: "装校检查或开放时间无效。" }, { status: 400 }); update[key] = normalized; changed = true; }
    }
    if (payload.decision !== undefined) { if (!EXHIBITION_INSTALLATION_DECISIONS.includes(payload.decision)) return Response.json({ error: "人工装校决定无效。" }, { status: 400 }); update.decision = payload.decision; changed = true; }
    if (payload.status !== undefined) { if (!EXHIBITION_INSTALLATION_STATUSES.includes(payload.status)) return Response.json({ error: "装校状态无效。" }, { status: 400 }); if (!transitions[current.status].includes(payload.status)) return Response.json({ error: "请按草稿、复核、签核与关闭顺序推进。" }, { status: 409 }); update.status = payload.status; changed = true; }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    const candidate = { ...current, ...update } as ExhibitionInstallationGate;
    if (candidate.status === "approved") {
      if (candidate.decision !== "accept") return Response.json({ error: "只有设计师明确选择现场验收后才能签核。" }, { status: 409 });
      const overview = await buildExhibitionInstallationOverview(); const workspace = overview.gates.find((item) => item.gate.id === id);
      if (!workspace || !workspace.delivery || !["approved", "closed"].includes(workspace.delivery.status)) return Response.json({ error: "来源交付主档已经失效。" }, { status: 409 });
      const missing = exhibitionInstallationMissingFields(candidate, workspace.checks, workspace.images.filter((image) => image.status === "active"), workspace.summary.expectedChecks);
      if (missing.length > 0) return Response.json({ error: `签核前仍需补齐：${missing.join("、")}。` }, { status: 409 });
      update.approvedBy = auth.user.email; update.approvedAt = new Date().toISOString();
    } else if (candidate.status === "closed") update.closedAt = new Date().toISOString();
    const db = await getDb(); const [gate] = await db.update(exhibitionInstallationGates).set(update).where(eq(exhibitionInstallationGates.id, id)).returning();
    return Response.json({ gate });
  } catch (error) { return installationApiError(error, "保存展览装校签核失败，请稍后重试。"); }
}
