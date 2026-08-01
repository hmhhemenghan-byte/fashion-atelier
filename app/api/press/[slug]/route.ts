import { getCollectionById, listCollectionWorks } from "@/lib/collections";
import {
  getPublicationBySlug,
  publicationCredits,
  publicationHeroUrl,
  publicationIsPublic,
} from "@/lib/publications";
import { mediaUrl } from "@/lib/works";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  try {
    const publication = await getPublicationBySlug(slug);
    if (!publication || !publicationIsPublic(publication)) {
      return new Response("Not found", { status: 404 });
    }
    const collection = await getCollectionById(publication.collectionId);
    if (!collection || collection.status !== "published") {
      return new Response("Not found", { status: 404 });
    }
    const lineup = await listCollectionWorks(collection.id);
    const requestUrl = new URL(request.url);
    const origin = requestUrl.origin;
    const heroUrl = new URL(
      publicationHeroUrl(collection, lineup),
      origin,
    ).toString();
    const releaseUrl = new URL(
      `/press/${encodeURIComponent(publication.slug)}`,
      origin,
    ).toString();
    const collectionUrl = new URL(
      `/collections/${encodeURIComponent(collection.slug)}`,
      origin,
    ).toString();
    const lookbookUrl = new URL(
      `/collections/${encodeURIComponent(collection.slug)}/lookbook`,
      origin,
    ).toString();
    const credits = Object.fromEntries(publicationCredits(publication));
    const works = lineup.map(({ assignment, work }, index) => ({
      position: index + 1,
      lookNumber:
        assignment.lookNumber ||
        work.lookNumber ||
        `LOOK ${String(index + 1).padStart(2, "0")}`,
      title: work.title,
      description: work.description,
      imageUrl: new URL(mediaUrl(work.imageKey), origin).toString(),
      detailUrl: new URL(
        `/works/${encodeURIComponent(work.id)}`,
        origin,
      ).toString(),
      processUrl: new URL(
        `/works/${encodeURIComponent(work.id)}/process`,
        origin,
      ).toString(),
    }));
    const payload = {
      brand: "NÉRA ATELIER",
      headline: publication.headline,
      deck: publication.deck,
      body: publication.body,
      city: publication.city,
      releaseDate: publication.releaseDate,
      releaseUrl,
      heroUrl,
      contact: {
        name: publication.contactName,
        email: publication.contactEmail,
      },
      credits,
      collection: {
        title: collection.title,
        subtitle: collection.subtitle,
        season: collection.season,
        year: collection.year,
        statement: collection.statement,
        collectionUrl,
        lookbookUrl,
      },
      works,
    };
    const format =
      requestUrl.searchParams.get("format") === "txt" ? "txt" : "json";
    const headers = new Headers({
      "cache-control": "public, max-age=300",
      "content-disposition": `attachment; filename="nera-${publication.slug}-press-kit.${format}"`,
    });

    if (format === "txt") {
      headers.set("content-type", "text/plain; charset=utf-8");
      return new Response(toPressText(payload), { headers });
    }
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(payload, null, 2), { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

function toPressText(payload: {
  brand: string;
  headline: string;
  deck: string;
  body: string;
  city: string;
  releaseDate: string;
  releaseUrl: string;
  heroUrl: string;
  contact: { name: string; email: string };
  credits: Record<string, string>;
  collection: {
    title: string;
    season: string;
    year: number;
    collectionUrl: string;
    lookbookUrl: string;
  };
  works: Array<{ lookNumber: string; title: string; detailUrl: string }>;
}) {
  const credits = Object.entries(payload.credits)
    .map(([role, name]) => `${role}: ${name}`)
    .join("\n");
  const works = payload.works
    .map((work) => `${work.lookNumber} — ${work.title}\n${work.detailUrl}`)
    .join("\n\n");
  return [
    payload.brand,
    "",
    payload.headline,
    payload.deck,
    "",
    `${payload.city} · ${payload.releaseDate}`,
    "",
    payload.body,
    "",
    "COLLECTION",
    `${payload.collection.title} · ${payload.collection.season} ${payload.collection.year}`,
    payload.collection.collectionUrl,
    payload.collection.lookbookUrl,
    "",
    "CREDITS",
    credits,
    "",
    "MEDIA CONTACT",
    [payload.contact.name, payload.contact.email].filter(Boolean).join(" · "),
    "",
    "SELECTED LOOKS",
    works,
    "",
    "PRESS RELEASE",
    payload.releaseUrl,
    "",
    "HERO IMAGE",
    payload.heroUrl,
  ].join("\n");
}
