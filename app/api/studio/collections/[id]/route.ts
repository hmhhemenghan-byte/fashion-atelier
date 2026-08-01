import { eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  collections,
  collectionWorks,
  type NewCollection,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { normalizeCollectionSlug } from "@/lib/collections";
import { getBucket } from "@/lib/runtime";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

type CollectionPatch = {
  title?: string;
  slug?: string;
  subtitle?: string;
  season?: string;
  year?: number;
  statement?: string;
  heroAltText?: string;
  status?: "draft" | "published";
  featured?: boolean;
  sortOrder?: number;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const payload = (await request.json()) as CollectionPatch;
  const update: Partial<NewCollection> = {
    updatedAt: new Date().toISOString(),
  };

  if (payload.title !== undefined) {
    const title = payload.title.trim().slice(0, 120);
    if (!title) {
      return Response.json({ error: "系列名称不能为空。" }, { status: 400 });
    }
    update.title = title;
  }
  if (payload.slug !== undefined) {
    const slug = normalizeCollectionSlug(payload.slug);
    if (!slug) {
      return Response.json(
        { error: "请输入有效的系列网址标识。" },
        { status: 400 },
      );
    }
    update.slug = slug;
  }
  setText(update, "subtitle", payload.subtitle, 160);
  setText(update, "season", payload.season, 80);
  setText(update, "statement", payload.statement, 1600);
  setText(update, "heroAltText", payload.heroAltText, 240);

  if (payload.year !== undefined) {
    if (
      !Number.isInteger(payload.year) ||
      payload.year < 1900 ||
      payload.year > 2100
    ) {
      return Response.json(
        { error: "请输入 1900–2100 之间的年份。" },
        { status: 400 },
      );
    }
    update.year = payload.year;
  }
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
      payload.status === "published" ? new Date().toISOString() : null;
    if (payload.status === "draft") update.featured = false;
  }
  if (typeof payload.featured === "boolean") {
    update.featured = payload.featured;
  }

  try {
    const db = await getDb();
    if (payload.featured === true) {
      await db
        .update(collections)
        .set({ featured: false, updatedAt: new Date().toISOString() })
        .where(ne(collections.id, id));
    }
    const [collection] = await db
      .update(collections)
      .set(update)
      .where(eq(collections.id, id))
      .returning();
    if (!collection) {
      return Response.json({ error: "系列不存在。" }, { status: 404 });
    }
    return Response.json({ collection });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Response.json(
      {
        error: message.includes("UNIQUE")
          ? "该系列网址标识已存在，请换一个名称。"
          : "更新系列失败，请稍后重试。",
      },
      { status: 500 },
    );
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
    const [collection] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, id))
      .limit(1);
    if (!collection) {
      return Response.json({ error: "系列不存在。" }, { status: 404 });
    }

    if (collection.heroImageKey) {
      const bucket = await getBucket();
      await bucket.delete(collection.heroImageKey);
    }
    await db
      .delete(collectionWorks)
      .where(eq(collectionWorks.collectionId, id));
    await db.delete(collections).where(eq(collections.id, id));
    return Response.json({ deleted: true });
  } catch {
    return Response.json(
      { error: "删除系列失败，请稍后重试。" },
      { status: 500 },
    );
  }
}

function setText(
  target: Partial<NewCollection>,
  key: "subtitle" | "season" | "statement" | "heroAltText",
  value: string | undefined,
  maxLength: number,
) {
  if (typeof value === "string") target[key] = value.trim().slice(0, maxLength);
}
