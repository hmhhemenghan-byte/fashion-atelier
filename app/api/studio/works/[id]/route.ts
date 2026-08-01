import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workImages, workProcessEntries, works } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { getBucket } from "@/lib/runtime";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const payload = (await request.json()) as {
    title?: string;
    collection?: string;
    lookNumber?: string;
    description?: string;
    altText?: string;
    sortOrder?: number;
    status?: "draft" | "published";
  };

  if (payload.title !== undefined && !payload.title.trim()) {
    return Response.json({ error: "作品名称不能为空。" }, { status: 400 });
  }
  if (payload.altText !== undefined && !payload.altText.trim()) {
    return Response.json({ error: "图片描述不能为空。" }, { status: 400 });
  }

  const update: Record<string, string | number | null> = {
    updatedAt: new Date().toISOString(),
  };

  setText(update, "title", payload.title, 120);
  setText(update, "collection", payload.collection, 120);
  setText(update, "lookNumber", payload.lookNumber, 40);
  setText(update, "description", payload.description, 1000);
  setText(update, "altText", payload.altText, 240);
  if (typeof payload.sortOrder === "number" && Number.isFinite(payload.sortOrder)) {
    update.sortOrder = Math.max(-9999, Math.min(9999, Math.round(payload.sortOrder)));
  }
  if (payload.status === "draft" || payload.status === "published") {
    update.status = payload.status;
    update.publishedAt = payload.status === "published" ? new Date().toISOString() : null;
  }

  try {
    const db = await getDb();
    const [work] = await db
      .update(works)
      .set(update)
      .where(eq(works.id, id))
      .returning();
    if (!work) return Response.json({ error: "作品不存在。" }, { status: 404 });
    return Response.json({ work });
  } catch {
    return Response.json({ error: "更新作品失败，请稍后重试。" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  try {
    const db = await getDb();
    const [work] = await db.select().from(works).where(eq(works.id, id)).limit(1);
    if (!work) return Response.json({ error: "作品不存在。" }, { status: 404 });

    const gallery = await db
      .select({ imageKey: workImages.imageKey })
      .from(workImages)
      .where(eq(workImages.workId, id));
    const processEntries = await db
      .select({ imageKey: workProcessEntries.imageKey })
      .from(workProcessEntries)
      .where(eq(workProcessEntries.workId, id));

    const bucket = await getBucket();
    await bucket.delete([
      work.imageKey,
      ...gallery.map((image) => image.imageKey),
      ...processEntries.flatMap((entry) =>
        entry.imageKey ? [entry.imageKey] : [],
      ),
    ]);
    await db
      .delete(workProcessEntries)
      .where(eq(workProcessEntries.workId, id));
    await db.delete(workImages).where(eq(workImages.workId, id));
    await db.delete(works).where(eq(works.id, id));
    return Response.json({ deleted: true });
  } catch {
    return Response.json({ error: "删除作品失败，请稍后重试。" }, { status: 500 });
  }
}

function setText(
  target: Record<string, string | number | null>,
  key: string,
  value: string | undefined,
  maxLength: number,
) {
  if (typeof value === "string") target[key] = value.trim().slice(0, maxLength);
}
