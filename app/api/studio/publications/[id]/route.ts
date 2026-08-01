import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  publications,
  type NewPublication,
  type Publication,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  getCollectionById,
  listCollectionWorks,
} from "@/lib/collections";
import {
  getPublicationPreflight,
  normalizePublicationSlug,
} from "@/lib/publications";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

type PublicationPatch = {
  collectionId?: string;
  slug?: string;
  headline?: string;
  deck?: string;
  body?: string;
  city?: string;
  releaseDate?: string;
  releaseAt?: string | null;
  contactName?: string;
  contactEmail?: string;
  photography?: string;
  styling?: string;
  casting?: string;
  hair?: string;
  makeup?: string;
  production?: string;
  seoTitle?: string;
  seoDescription?: string;
  status?: "draft" | "scheduled" | "published";
  sortOrder?: number;
};

const TEXT_LIMITS = {
  headline: 160,
  deck: 320,
  body: 8000,
  city: 120,
  releaseDate: 100,
  contactName: 120,
  contactEmail: 200,
  photography: 160,
  styling: 160,
  casting: 160,
  hair: 160,
  makeup: 160,
  production: 160,
  seoTitle: 160,
  seoDescription: 320,
} as const;

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  try {
    const payload = (await request.json()) as PublicationPatch;
    const db = await getDb();
    const [current] = await db
      .select()
      .from(publications)
      .where(eq(publications.id, id))
      .limit(1);
    if (!current) {
      return Response.json({ error: "发布包不存在。" }, { status: 404 });
    }

    const update: Partial<NewPublication> = {
      updatedAt: new Date().toISOString(),
    };
    if (payload.collectionId !== undefined) {
      const collectionId = payload.collectionId.trim();
      if (!collectionId) {
        return Response.json(
          { error: "必须选择一个关联系列。" },
          { status: 400 },
        );
      }
      update.collectionId = collectionId;
    }
    if (payload.slug !== undefined) {
      const slug = normalizePublicationSlug(payload.slug);
      if (!slug) {
        return Response.json(
          { error: "请输入有效的网址标识。" },
          { status: 400 },
        );
      }
      update.slug = slug;
    }
    for (const [key, maxLength] of Object.entries(TEXT_LIMITS) as Array<
      [keyof typeof TEXT_LIMITS, number]
    >) {
      const value = payload[key];
      if (typeof value === "string") {
        update[key] = value.trim().slice(0, maxLength);
      }
    }
    if (payload.headline !== undefined && !payload.headline.trim()) {
      return Response.json(
        { error: "发布标题不能为空。" },
        { status: 400 },
      );
    }
    if (payload.releaseAt !== undefined) {
      update.releaseAt = normalizeDateTime(payload.releaseAt);
      if (payload.releaseAt && !update.releaseAt) {
        return Response.json(
          { error: "请输入有效的定时发布时间。" },
          { status: 400 },
        );
      }
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
    if (
      payload.status === "draft" ||
      payload.status === "scheduled" ||
      payload.status === "published"
    ) {
      update.status = payload.status;
    }

    const candidate = { ...current, ...update } as Publication;
    const collection = await getCollectionById(candidate.collectionId);
    if (!collection) {
      return Response.json(
        { error: "关联系列不存在。" },
        { status: 404 },
      );
    }
    const lineup = await listCollectionWorks(collection.id, true);
    const readiness = getPublicationPreflight(
      candidate,
      collection,
      lineup,
    );

    if (candidate.status === "published" && !readiness.readyToPublish) {
      return Response.json(
        {
          error: "发布前检查尚未通过。",
          issues: readiness.issues,
        },
        { status: 400 },
      );
    }
    if (candidate.status === "scheduled" && !readiness.readyToSchedule) {
      return Response.json(
        {
          error: "定时发布前检查尚未通过。",
          issues: [
            ...readiness.issues,
            ...(readiness.scheduledIssue
              ? [readiness.scheduledIssue]
              : []),
          ],
        },
        { status: 400 },
      );
    }

    if (candidate.status === "published") {
      update.publishedAt =
        current.publishedAt ?? new Date().toISOString();
    } else {
      update.publishedAt = null;
    }

    const [publication] = await db
      .update(publications)
      .set(update)
      .where(eq(publications.id, id))
      .returning();
    return Response.json({
      publication,
      readiness: getPublicationPreflight(
        publication,
        collection,
        lineup,
      ),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Response.json(
      {
        error: message.includes("UNIQUE")
          ? "该系列已有发布包，或网址标识已被使用。"
          : "保存发布包失败，请稍后重试。",
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
    const [deleted] = await db
      .delete(publications)
      .where(eq(publications.id, id))
      .returning({ id: publications.id });
    if (!deleted) {
      return Response.json({ error: "发布包不存在。" }, { status: 404 });
    }
    return Response.json({ deleted: true });
  } catch {
    return Response.json(
      { error: "删除发布包失败，请稍后重试。" },
      { status: 500 },
    );
  }
}

function normalizeDateTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
