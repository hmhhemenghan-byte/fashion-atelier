import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { exhibitionWatchImages, type NewExhibitionWatchImage } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { WATCH_IMAGE_ANGLES, WATCH_IMAGE_STATUSES, getExhibitionWatch, getExhibitionWatchImage, type WatchImageAngle, type WatchImageStatus } from "@/lib/exhibition-watch";
import { cleanWatchText, exhibitionWatchApiError, watchInteger } from "@/lib/exhibition-watch-input";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
type Payload = { angle?: WatchImageAngle; caption?: string; altText?: string; status?: WatchImageStatus; sortOrder?: number | string };

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const current = await getExhibitionWatchImage(id);
    if (!current) return Response.json({ error: "展期证据不存在。" }, { status: 404 });
    const watch = await getExhibitionWatch(current.exhibitionWatchId);
    if (!watch) return Response.json({ error: "展期监测记录不存在。" }, { status: 404 });
    if (watch.status === "closed") return Response.json({ error: "监测记录已关闭，不能修改证据。" }, { status: 409 });
    const payload = (await request.json()) as Payload;
    const update: Partial<NewExhibitionWatchImage> = { updatedAt: new Date().toISOString() };
    let changed = false;
    if (payload.angle !== undefined) { if (!WATCH_IMAGE_ANGLES.includes(payload.angle)) return Response.json({ error: "证据类型无效。" }, { status: 400 }); update.angle = payload.angle; changed = true; }
    if (payload.status !== undefined) { if (!WATCH_IMAGE_STATUSES.includes(payload.status)) return Response.json({ error: "证据状态无效。" }, { status: 400 }); update.status = payload.status; changed = true; }
    if (payload.caption !== undefined) { update.caption = cleanWatchText(payload.caption, 600); changed = true; }
    if (payload.altText !== undefined) { const value = cleanWatchText(payload.altText, 240); if (!value) return Response.json({ error: "图片描述不能为空。" }, { status: 400 }); update.altText = value; changed = true; }
    if (payload.sortOrder !== undefined) { update.sortOrder = watchInteger(payload.sortOrder); changed = true; }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    const db = await getDb();
    const [image] = await db.update(exhibitionWatchImages).set(update).where(eq(exhibitionWatchImages.id, id)).returning();
    return Response.json({ image });
  } catch (error) {
    return exhibitionWatchApiError(error, "更新展期证据失败，请稍后重试。");
  }
}
