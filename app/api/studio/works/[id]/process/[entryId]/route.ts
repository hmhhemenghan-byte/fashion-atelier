import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workProcessEntries } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { isProcessStage } from "@/lib/process-stages";
import { getBucket } from "@/lib/runtime";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; entryId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  const { id: workId, entryId } = await context.params;
  const payload = (await request.json()) as {
    stage?: unknown;
    title?: string;
    notes?: string;
    dateLabel?: string;
    altText?: string;
    status?: "draft" | "published";
    sortOrder?: number;
  };

  if (payload.title !== undefined && !payload.title.trim()) {
    return Response.json({ error: "阶段标题不能为空。" }, { status: 400 });
  }
  if (payload.stage !== undefined && !isProcessStage(payload.stage)) {
    return Response.json({ error: "请选择有效的过程阶段。" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const [current] = await db
      .select()
      .from(workProcessEntries)
      .where(
        and(
          eq(workProcessEntries.id, entryId),
          eq(workProcessEntries.workId, workId),
        ),
      )
      .limit(1);
    if (!current) {
      return Response.json({ error: "过程记录不存在。" }, { status: 404 });
    }
    if (
      current.imageKey &&
      payload.altText !== undefined &&
      !payload.altText.trim()
    ) {
      return Response.json(
        { error: "带图片的过程记录必须填写图片描述。" },
        { status: 400 },
      );
    }

    const update: Record<string, string | number | null> = {
      updatedAt: new Date().toISOString(),
    };
    if (isProcessStage(payload.stage)) update.stage = payload.stage;
    setText(update, "title", payload.title, 120);
    setText(update, "notes", payload.notes, 3000);
    setText(update, "dateLabel", payload.dateLabel, 80);
    setText(update, "altText", payload.altText, 240);
    if (
      typeof payload.sortOrder === "number" &&
      Number.isFinite(payload.sortOrder)
    ) {
      update.sortOrder = Math.max(
        -9999,
        Math.min(9999, Math.round(payload.sortOrder)),
      );
    }
    if (payload.status === "draft" || payload.status === "published") {
      update.status = payload.status;
      update.publishedAt =
        payload.status === "published"
          ? current.publishedAt ?? new Date().toISOString()
          : null;
    }

    const [entry] = await db
      .update(workProcessEntries)
      .set(update)
      .where(
        and(
          eq(workProcessEntries.id, entryId),
          eq(workProcessEntries.workId, workId),
        ),
      )
      .returning();
    return Response.json({ entry });
  } catch {
    return Response.json(
      { error: "保存过程记录失败，请稍后重试。" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  const { id: workId, entryId } = await context.params;
  try {
    const db = await getDb();
    const [entry] = await db
      .select()
      .from(workProcessEntries)
      .where(
        and(
          eq(workProcessEntries.id, entryId),
          eq(workProcessEntries.workId, workId),
        ),
      )
      .limit(1);
    if (!entry) {
      return Response.json({ error: "过程记录不存在。" }, { status: 404 });
    }

    if (entry.imageKey) {
      const bucket = await getBucket();
      await bucket.delete(entry.imageKey);
    }
    await db
      .delete(workProcessEntries)
      .where(
        and(
          eq(workProcessEntries.id, entryId),
          eq(workProcessEntries.workId, workId),
        ),
      );
    return Response.json({ deleted: true });
  } catch {
    return Response.json(
      { error: "删除过程记录失败，请稍后重试。" },
      { status: 500 },
    );
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
