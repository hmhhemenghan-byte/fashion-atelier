import { getDb } from "@/db";
import { publications } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  getCollectionById,
  listAllCollections,
  listCollectionWorks,
} from "@/lib/collections";
import {
  getPublicationPreflight,
  listAllPublications,
  normalizePublicationSlug,
} from "@/lib/publications";

export const dynamic = "force-dynamic";

type CreatePayload = {
  collectionId?: string;
  headline?: string;
  slug?: string;
};

export async function GET() {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const [publicationRows, collectionRows] = await Promise.all([
      listAllPublications(),
      listAllCollections(),
    ]);
    const collectionById = new Map(
      collectionRows.map((collection) => [collection.id, collection]),
    );
    const readinessEntries = await Promise.all(
      publicationRows.map(async (publication) => {
        const collection =
          collectionById.get(publication.collectionId) ?? null;
        const lineup = collection
          ? await listCollectionWorks(collection.id, true)
          : [];
        return [
          publication.id,
          getPublicationPreflight(publication, collection, lineup),
        ] as const;
      }),
    );

    return Response.json({
      publications: publicationRows,
      collections: collectionRows,
      readiness: Object.fromEntries(readinessEntries),
    });
  } catch {
    return Response.json(
      { error: "发布中心尚未初始化，请完成新版部署后再试。" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as CreatePayload;
    const collectionId =
      typeof payload.collectionId === "string"
        ? payload.collectionId.trim()
        : "";
    const headline =
      typeof payload.headline === "string"
        ? payload.headline.trim().slice(0, 160)
        : "";
    const slug = normalizePublicationSlug(payload.slug || headline);
    if (!collectionId || !headline || !slug) {
      return Response.json(
        { error: "系列、发布标题和网址标识为必填项。" },
        { status: 400 },
      );
    }

    const collection = await getCollectionById(collectionId);
    if (!collection) {
      return Response.json({ error: "关联系列不存在。" }, { status: 404 });
    }

    const id = crypto.randomUUID();
    const db = await getDb();
    const [publication] = await db
      .insert(publications)
      .values({
        id,
        collectionId,
        slug,
        headline,
        deck: collection.subtitle,
        body: collection.statement,
        releaseDate: String(collection.year),
        seoTitle: `${headline} — NÉRA ATELIER`.slice(0, 160),
        seoDescription: (
          collection.subtitle ||
          collection.statement ||
          `${headline} official release from NÉRA ATELIER.`
        ).slice(0, 320),
        createdBy: auth.user.email,
      })
      .returning();

    const lineup = await listCollectionWorks(collection.id, true);
    return Response.json(
      {
        publication,
        readiness: getPublicationPreflight(
          publication,
          collection,
          lineup,
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Response.json(
      {
        error: message.includes("UNIQUE")
          ? "该系列已有发布包，或网址标识已被使用。"
          : "创建发布包失败，请稍后重试。",
      },
      { status: 500 },
    );
  }
}
