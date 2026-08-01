import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { showroomWorks, type NewShowroomWork } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  getShowroomById,
  getShowroomAccessState,
  listShowroomWorks,
  SHOWROOM_SAMPLE_STATUSES,
  type ShowroomSampleStatus,
} from "@/lib/showrooms";
import { listAllWorks } from "@/lib/works";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

type LineupPayload = {
  items?: Array<{
    workId?: string;
    note?: string;
    sampleStatus?: ShowroomSampleStatus;
    featured?: boolean;
  }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  try {
    const showroom = await getShowroomById(id);
    if (!showroom) {
      return Response.json({ error: "私享展厅不存在。" }, { status: 404 });
    }
    const payload = (await request.json()) as LineupPayload;
    if (!Array.isArray(payload.items) || payload.items.length > 80) {
      return Response.json(
        { error: "展厅选品必须是 0–80 件 Look。" },
        { status: 400 },
      );
    }

    const uniqueItems = payload.items.filter(
      (item, index, rows) =>
        typeof item.workId === "string" &&
        item.workId.length <= 120 &&
        rows.findIndex((candidate) => candidate.workId === item.workId) ===
          index,
    );
    if (uniqueItems.length !== payload.items.length) {
      return Response.json(
        { error: "选品中存在无效或重复的作品。" },
        { status: 400 },
      );
    }
    const workRows = await listAllWorks(1000);
    const workIds = new Set(workRows.map((work) => work.id));
    if (uniqueItems.some((item) => !workIds.has(item.workId as string))) {
      return Response.json(
        { error: "选品中包含已经不存在的作品。" },
        { status: 400 },
      );
    }

    let hasFeatured = false;
    const now = new Date().toISOString();
    const values: NewShowroomWork[] = uniqueItems.map((item, index) => {
      const wantsFeatured = Boolean(item.featured) && !hasFeatured;
      if (wantsFeatured) hasFeatured = true;
      return {
        showroomId: showroom.id,
        workId: item.workId as string,
        note: cleanText(item.note, 800),
        sampleStatus: pickSampleStatus(item.sampleStatus),
        sortOrder: index,
        featured: wantsFeatured,
        createdAt: now,
        updatedAt: now,
      };
    });

    const db = await getDb();
    await db
      .delete(showroomWorks)
      .where(eq(showroomWorks.showroomId, showroom.id));
    if (values.length > 0) {
      await db.insert(showroomWorks).values(values);
    }
    const items = await listShowroomWorks(showroom.id);
    return Response.json({
      room: {
        showroom,
        items,
        accessState: getShowroomAccessState(showroom),
      },
    });
  } catch {
    return Response.json(
      { error: "保存展厅选品失败，请稍后重试。" },
      { status: 500 },
    );
  }
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function pickSampleStatus(value: unknown): ShowroomSampleStatus {
  return typeof value === "string" &&
    SHOWROOM_SAMPLE_STATUSES.includes(value as ShowroomSampleStatus)
    ? (value as ShowroomSampleStatus)
    : "on_request";
}
