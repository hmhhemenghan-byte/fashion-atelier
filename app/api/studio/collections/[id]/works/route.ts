import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { collections, collectionWorks, works } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

type AssignmentInput = {
  workId: string;
  lookNumber?: string;
  sortOrder?: number;
  featured?: boolean;
};

export async function PUT(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const payload = (await request.json()) as { items?: AssignmentInput[] };
  if (!Array.isArray(payload.items) || payload.items.length > 100) {
    return Response.json(
      { error: "作品编排必须是 100 项以内的列表。" },
      { status: 400 },
    );
  }

  const unique = new Map<string, AssignmentInput>();
  payload.items.forEach((item) => {
    if (typeof item.workId === "string" && item.workId.trim()) {
      unique.set(item.workId.trim(), item);
    }
  });
  const items = [...unique.values()];

  try {
    const db = await getDb();
    const [collection] = await db
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.id, id))
      .limit(1);
    if (!collection) {
      return Response.json({ error: "系列不存在。" }, { status: 404 });
    }

    if (items.length > 0) {
      const workIds = items.map((item) => item.workId);
      const existingWorks = await db
        .select({ id: works.id })
        .from(works)
        .where(inArray(works.id, workIds));
      if (existingWorks.length !== workIds.length) {
        return Response.json(
          { error: "编排中包含不存在的作品，请刷新后台后重试。" },
          { status: 400 },
        );
      }
    }

    await db
      .delete(collectionWorks)
      .where(eq(collectionWorks.collectionId, id));
    if (items.length > 0) {
      await db.insert(collectionWorks).values(
        items.map((item, index) => ({
          collectionId: id,
          workId: item.workId,
          lookNumber:
            typeof item.lookNumber === "string"
              ? item.lookNumber.trim().slice(0, 40)
              : "",
          sortOrder:
            typeof item.sortOrder === "number" &&
            Number.isFinite(item.sortOrder)
              ? Math.max(-9999, Math.min(9999, Math.round(item.sortOrder)))
              : index,
          featured: item.featured === true,
          updatedAt: new Date().toISOString(),
        })),
      );
    }

    const assignments = await db
      .select()
      .from(collectionWorks)
      .where(eq(collectionWorks.collectionId, id))
      .orderBy(collectionWorks.sortOrder);
    return Response.json({ assignments });
  } catch {
    return Response.json(
      { error: "保存系列作品编排失败，请稍后重试。" },
      { status: 500 },
    );
  }
}
