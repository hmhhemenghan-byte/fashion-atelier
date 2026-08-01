import { requireApiAdmin } from "@/lib/admin";
import {
  listAllCollectionAssignments,
  listAllCollections,
} from "@/lib/collections";
import { listAllWorkProcessEntries } from "@/lib/process";
import { listAllPublications } from "@/lib/publications";
import { listAllWorkImages, listAllWorks, mediaUrl } from "@/lib/works";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const [
      rows,
      galleryRows,
      processRows,
      collectionRows,
      collectionAssignments,
      publicationRows,
    ] =
      await Promise.all([
        listAllWorks(1000),
        listAllWorkImages(),
        listAllWorkProcessEntries(),
        listAllCollections(1000),
        listAllCollectionAssignments(),
        listAllPublications(1000),
      ]);
    const requestUrl = new URL(request.url);
    const exportedAt = new Date().toISOString();
    const galleryByWork = new Map<string, typeof galleryRows>();
    galleryRows.forEach((image) => {
      galleryByWork.set(image.workId, [...(galleryByWork.get(image.workId) ?? []), image]);
    });
    const processByWork = new Map<string, typeof processRows>();
    processRows.forEach((entry) => {
      processByWork.set(entry.workId, [
        ...(processByWork.get(entry.workId) ?? []),
        entry,
      ]);
    });
    const collectionById = new Map(
      collectionRows.map((collection) => [collection.id, collection]),
    );
    const membershipsByWork = new Map<
      string,
      Array<{
        collectionId: string;
        collectionTitle: string;
        collectionSlug: string;
        lookNumber: string;
        sortOrder: number;
        featured: boolean;
      }>
    >();
    collectionAssignments.forEach((assignment) => {
      const collection = collectionById.get(assignment.collectionId);
      if (!collection) return;
      const membership = {
        collectionId: collection.id,
        collectionTitle: collection.title,
        collectionSlug: collection.slug,
        lookNumber: assignment.lookNumber,
        sortOrder: assignment.sortOrder,
        featured: assignment.featured,
      };
      membershipsByWork.set(assignment.workId, [
        ...(membershipsByWork.get(assignment.workId) ?? []),
        membership,
      ]);
    });
    const exportRows = rows.map((work) => {
      const gallery = (galleryByWork.get(work.id) ?? []).map((image) => ({
        id: image.id,
        label: image.label,
        altText: image.altText,
        sortOrder: image.sortOrder,
        imageKey: image.imageKey,
        imageType: image.imageType,
        imageSize: image.imageSize,
        imageUrl: new URL(mediaUrl(image.imageKey), requestUrl.origin).toString(),
      }));
      const processEntries = (processByWork.get(work.id) ?? []).map((entry) => ({
        id: entry.id,
        stage: entry.stage,
        title: entry.title,
        notes: entry.notes,
        dateLabel: entry.dateLabel,
        altText: entry.altText,
        status: entry.status,
        sortOrder: entry.sortOrder,
        imageKey: entry.imageKey,
        imageType: entry.imageType,
        imageSize: entry.imageSize,
        imageUrl: entry.imageKey
          ? new URL(mediaUrl(entry.imageKey), requestUrl.origin).toString()
          : null,
        publishedAt: entry.publishedAt,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }));
      const memberships = membershipsByWork.get(work.id) ?? [];
      return {
        id: work.id,
        title: work.title,
        collection: work.collection,
        lookNumber: work.lookNumber,
        description: work.description,
        altText: work.altText,
        imageKey: work.imageKey,
        imageType: work.imageType,
        imageSize: work.imageSize,
        imageUrl: new URL(mediaUrl(work.imageKey), requestUrl.origin).toString(),
        detailUrl: new URL(`/works/${encodeURIComponent(work.id)}`, requestUrl.origin).toString(),
        galleryCount: gallery.length,
        galleryImageKeys: gallery.map((image) => image.imageKey).join(";"),
        galleryImageUrls: gallery.map((image) => image.imageUrl).join(";"),
        gallery,
        processUrl: new URL(
          `/works/${encodeURIComponent(work.id)}/process`,
          requestUrl.origin,
        ).toString(),
        processCount: processEntries.length,
        processImageKeys: processEntries
          .flatMap((entry) => (entry.imageKey ? [entry.imageKey] : []))
          .join(";"),
        processImageUrls: processEntries
          .flatMap((entry) => (entry.imageUrl ? [entry.imageUrl] : []))
          .join(";"),
        processEntries,
        collectionIds: memberships.map((item) => item.collectionId).join(";"),
        collectionTitles: memberships.map((item) => item.collectionTitle).join(";"),
        collectionSlugs: memberships.map((item) => item.collectionSlug).join(";"),
        collectionLookNumbers: memberships.map((item) => item.lookNumber).join(";"),
        collectionMemberships: memberships,
        status: work.status,
        sortOrder: work.sortOrder,
        publishedAt: work.publishedAt,
        createdAt: work.createdAt,
        updatedAt: work.updatedAt,
      };
    });
    const format = requestUrl.searchParams.get("format") === "csv" ? "csv" : "json";
    const filenameDate = exportedAt.slice(0, 10);
    const headers = new Headers({
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="nera-atelier-works-${filenameDate}.${format}"`,
    });

    if (format === "csv") {
      headers.set("content-type", "text/csv; charset=utf-8");
      return new Response(toCsv(exportRows), { headers });
    }

    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(
      JSON.stringify(
        {
          exportedAt,
          count: exportRows.length,
          collectionCount: collectionRows.length,
          processEntryCount: processRows.length,
          publicationCount: publicationRows.length,
          publications: publicationRows.map((publication) => ({
            ...publication,
            releaseUrl: new URL(
              `/press/${encodeURIComponent(publication.slug)}`,
              requestUrl.origin,
            ).toString(),
            pressTextUrl: new URL(
              `/api/press/${encodeURIComponent(publication.slug)}?format=txt`,
              requestUrl.origin,
            ).toString(),
            pressDataUrl: new URL(
              `/api/press/${encodeURIComponent(publication.slug)}`,
              requestUrl.origin,
            ).toString(),
          })),
          collections: collectionRows.map((collection) => ({
            ...collection,
            heroImageUrl: collection.heroImageKey
              ? new URL(mediaUrl(collection.heroImageKey), requestUrl.origin).toString()
              : null,
            detailUrl: new URL(
              `/collections/${encodeURIComponent(collection.slug)}`,
              requestUrl.origin,
            ).toString(),
            lineup: collectionAssignments.filter(
              (assignment) => assignment.collectionId === collection.id,
            ),
            publication:
              publicationRows.find(
                (publication) =>
                  publication.collectionId === collection.id,
              ) ?? null,
          })),
          works: exportRows,
        },
        null,
        2,
      ),
      { headers },
    );
  } catch {
    return Response.json({ error: "导出作品数据失败，请稍后重试。" }, { status: 500 });
  }
}

function toCsv(rows: Array<Record<string, unknown>>) {
  const columns = [
    "id",
    "title",
    "collection",
    "lookNumber",
    "description",
    "altText",
    "imageKey",
    "imageType",
    "imageSize",
    "imageUrl",
    "detailUrl",
    "galleryCount",
    "galleryImageKeys",
    "galleryImageUrls",
    "processUrl",
    "processCount",
    "processImageKeys",
    "processImageUrls",
    "collectionIds",
    "collectionTitles",
    "collectionSlugs",
    "collectionLookNumbers",
    "status",
    "sortOrder",
    "publishedAt",
    "createdAt",
    "updatedAt",
  ];
  const lines = [columns.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(row[column])).join(","));
  }
  return `\ufeff${lines.join("\r\n")}`;
}

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
