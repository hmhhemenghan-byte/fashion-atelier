import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  collections,
  fittingImages,
  materials,
  samplePlacements,
  sampleSignoffImages,
  technicalPacks,
  workImages,
  workProcessEntries,
  works,
} from "@/db/schema";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getBucket, isAdminEmail } from "@/lib/runtime";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ key: string[] }> };

export async function GET(request: Request, context: RouteContext) {
  const { key: segments } = await context.params;
  const key = segments.map((segment) => decodeURIComponent(segment)).join("/");

  try {
    const db = await getDb();
    let [work] = await db
      .select({ status: works.status })
      .from(works)
      .where(eq(works.imageKey, key))
      .limit(1);

    if (!work) {
      [work] = await db
        .select({ status: works.status })
        .from(workImages)
        .innerJoin(works, eq(workImages.workId, works.id))
        .where(eq(workImages.imageKey, key))
        .limit(1);
    }

    if (!work) {
      [work] = await db
        .select({ status: collections.status })
        .from(collections)
        .where(eq(collections.heroImageKey, key))
        .limit(1);
    }

    if (!work) {
      const [processEntry] = await db
        .select({
          workStatus: works.status,
          entryStatus: workProcessEntries.status,
        })
        .from(workProcessEntries)
        .innerJoin(works, eq(workProcessEntries.workId, works.id))
        .where(eq(workProcessEntries.imageKey, key))
        .limit(1);
      if (processEntry) {
        work = {
          status:
            processEntry.workStatus === "published" &&
            processEntry.entryStatus === "published"
              ? "published"
              : "draft",
        };
      }
    }

    if (!work) {
      const [placement] = await db
        .select({ id: samplePlacements.id })
        .from(samplePlacements)
        .where(eq(samplePlacements.evidenceImageKey, key))
        .limit(1);
      if (placement) work = { status: "draft" };
    }

    if (!work) {
      const [material] = await db
        .select({ status: materials.status })
        .from(materials)
        .where(eq(materials.swatchImageKey, key))
        .limit(1);
      if (material) {
        work = {
          status: material.status === "approved" ? "published" : "draft",
        };
      }
    }

    if (!work) {
      const [technicalPack] = await db
        .select({ status: technicalPacks.status })
        .from(technicalPacks)
        .where(eq(technicalPacks.sketchImageKey, key))
        .limit(1);
      if (technicalPack) {
        work = {
          status: ["approved", "locked"].includes(technicalPack.status)
            ? "published"
            : "draft",
        };
      }
    }

    if (!work) {
      const [fittingImage] = await db
        .select({ id: fittingImages.id })
        .from(fittingImages)
        .where(eq(fittingImages.imageKey, key))
        .limit(1);
      if (fittingImage) work = { status: "draft" };
    }

    if (!work) {
      const [sampleSignoffImage] = await db
        .select({ id: sampleSignoffImages.id })
        .from(sampleSignoffImages)
        .where(eq(sampleSignoffImages.imageKey, key))
        .limit(1);
      if (sampleSignoffImage) work = { status: "draft" };
    }

    if (!work) return new Response("Not found", { status: 404 });
    if (work.status !== "published") {
      const user = await getChatGPTUser();
      if (!user || !(await isAdminEmail(user.email))) {
        return new Response("Not found", { status: 404 });
      }
    }

    const bucket = await getBucket();
    const object = await bucket.get(key, {
      onlyIf: request.headers,
    });
    if (!object) return new Response("Not found", { status: 404 });

    if (!object.body) {
      return new Response(null, { status: 304, headers: { etag: object.httpEtag } });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set(
      "cache-control",
      work.status === "published"
        ? "public, max-age=31536000, immutable"
        : "private, no-store",
    );
    headers.set("x-content-type-options", "nosniff");
    return new Response(object.body, { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
