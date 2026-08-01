import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workImages } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { getBucket } from "@/lib/runtime";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; imageId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  const { id: workId, imageId } = await context.params;
  const payload = (await request.json()) as {
    label?: string;
    altText?: string;
    sortOrder?: number;
  };

  if (payload.altText !== undefined && !payload.altText.trim()) {
    return Response.json({ error: "细节图描述不能为空。" }, { status: 400 });
  }

  const update: Record<string, string | number> = {
    updatedAt: new Date().toISOString(),
  };
  if (typeof payload.label === "string") {
    update.label = payload.label.trim().slice(0, 40) || "DETAIL";
  }
  if (typeof payload.altText === "string") {
    update.altText = payload.altText.trim().slice(0, 240);
  }
  if (typeof payload.sortOrder === "number" && Number.isFinite(payload.sortOrder)) {
    update.sortOrder = Math.max(-9999, Math.min(9999, Math.round(payload.sortOrder)));
  }

  try {
    const db = await getDb();
    const [image] = await db
      .update(workImages)
      .set(update)
      .where(and(eq(workImages.id, imageId), eq(workImages.workId, workId)))
      .returning();
    if (!image) return Response.json({ error: "细节图不存在。" }, { status: 404 });
    return Response.json({ image });
  } catch {
    return Response.json({ error: "保存细节图资料失败，请稍后重试。" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  const { id: workId, imageId } = await context.params;
  try {
    const db = await getDb();
    const [image] = await db
      .select()
      .from(workImages)
      .where(and(eq(workImages.id, imageId), eq(workImages.workId, workId)))
      .limit(1);
    if (!image) return Response.json({ error: "细节图不存在。" }, { status: 404 });

    const bucket = await getBucket();
    await bucket.delete(image.imageKey);
    await db
      .delete(workImages)
      .where(and(eq(workImages.id, imageId), eq(workImages.workId, workId)));
    return Response.json({ deleted: true });
  } catch {
    return Response.json({ error: "删除细节图失败，请稍后重试。" }, { status: 500 });
  }
}
