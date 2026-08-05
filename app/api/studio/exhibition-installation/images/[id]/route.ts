import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { exhibitionInstallationImages, type NewExhibitionInstallationImage } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { EXHIBITION_INSTALLATION_IMAGE_ANGLES, EXHIBITION_INSTALLATION_IMAGE_STATUSES, getExhibitionInstallationGate, getExhibitionInstallationImage, type ExhibitionInstallationImageAngle, type ExhibitionInstallationImageStatus } from "@/lib/exhibition-installation";
import { cleanInstallationText, installationApiError, installationInteger } from "@/lib/exhibition-installation-input";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = { angle?: ExhibitionInstallationImageAngle; caption?: string; altText?: string; status?: ExhibitionInstallationImageStatus; sortOrder?: number | string };

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError;
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const { id } = await context.params; const current = await getExhibitionInstallationImage(id);
    if (!current) return Response.json({ error: "现场装校证据不存在。" }, { status: 404 });
    const gate = await getExhibitionInstallationGate(current.exhibitionInstallationGateId);
    if (!gate) return Response.json({ error: "展览装校签核不存在。" }, { status: 404 });
    if (["approved", "closed", "void"].includes(gate.status)) return Response.json({ error: "该装校事实已经冻结，不能修改证据。" }, { status: 409 });
    const payload = (await request.json()) as UpdatePayload; const update: Partial<NewExhibitionInstallationImage> = { updatedAt: new Date().toISOString() }; let changed = false;
    if (payload.angle !== undefined) { if (!EXHIBITION_INSTALLATION_IMAGE_ANGLES.includes(payload.angle)) return Response.json({ error: "证据类型无效。" }, { status: 400 }); update.angle = payload.angle; changed = true; }
    if (payload.status !== undefined) { if (!EXHIBITION_INSTALLATION_IMAGE_STATUSES.includes(payload.status)) return Response.json({ error: "证据状态无效。" }, { status: 400 }); update.status = payload.status; changed = true; }
    if (payload.caption !== undefined) { update.caption = cleanInstallationText(payload.caption, 600); changed = true; }
    if (payload.altText !== undefined) { const altText = cleanInstallationText(payload.altText, 240); if (!altText) return Response.json({ error: "图片描述不能为空。" }, { status: 400 }); update.altText = altText; changed = true; }
    if (payload.sortOrder !== undefined) { update.sortOrder = installationInteger(payload.sortOrder, current.sortOrder); changed = true; }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    const db = await getDb(); const [image] = await db.update(exhibitionInstallationImages).set(update).where(eq(exhibitionInstallationImages.id, id)).returning(); return Response.json({ image });
  } catch (error) { return installationApiError(error, "更新现场装校证据失败，请稍后重试。"); }
}
