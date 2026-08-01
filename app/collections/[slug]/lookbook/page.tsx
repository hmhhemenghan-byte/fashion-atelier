import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import LookbookViewer from "@/app/collections/[slug]/lookbook/lookbook-viewer";
import {
  collectionHeroUrl,
  collectionLabel,
  getCollectionBySlug,
  listCollectionWorks,
} from "@/lib/collections";
import { isAdminEmail } from "@/lib/runtime";
import { mediaUrl } from "@/lib/works";

export const dynamic = "force-dynamic";

type LookbookPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: LookbookPageProps): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug).catch(() => null);
  if (!collection || collection.status !== "published") {
    return {
      title: "Digital Lookbook Preview — NÉRA ATELIER",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `${collection.title} Digital Lookbook — NÉRA ATELIER`,
    description:
      collection.statement ||
      `${collectionLabel(collection)} · NÉRA ATELIER Digital Lookbook`,
  };
}

export default async function LookbookPage({ params }: LookbookPageProps) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug).catch(() => null);
  if (!collection) notFound();

  let draftPreview = false;
  if (collection.status !== "published") {
    const user = await getChatGPTUser();
    if (!user || !(await isAdminEmail(user.email))) notFound();
    draftPreview = true;
  }

  const lineup = await listCollectionWorks(collection.id, draftPreview).catch(
    () => [],
  );
  const heroImage =
    collectionHeroUrl(collection) ||
    (lineup[0]
      ? mediaUrl(lineup[0].work.imageKey)
      : "/images/hero-fashion.webp");
  const dossierHref = `/collections/${encodeURIComponent(collection.slug)}`;

  return (
    <LookbookViewer
      collection={{
        title: collection.title,
        subtitle: collection.subtitle,
        label: collectionLabel(collection),
        statement: collection.statement,
        heroImage,
        heroAltText:
          collection.heroAltText ||
          lineup[0]?.work.altText ||
          `${collection.title} 系列主视觉`,
      }}
      looks={lineup.map(({ assignment, work }, index) => ({
        id: work.id,
        title: work.title,
        lookNumber:
          assignment.lookNumber ||
          work.lookNumber ||
          `LOOK ${String(index + 1).padStart(2, "0")}`,
        description: work.description,
        imageUrl: mediaUrl(work.imageKey),
        altText: work.altText,
        featured: assignment.featured,
      }))}
      dossierHref={dossierHref}
      archiveHref="/collections"
      draftPreview={draftPreview}
    />
  );
}
