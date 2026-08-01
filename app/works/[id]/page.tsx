import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import WorkDetail from "@/app/components/work-detail";
import { getCollectionNavigationForWork } from "@/lib/collections";
import { listWorkProcessEntries } from "@/lib/process";
import { isAdminEmail } from "@/lib/runtime";
import { getWorkById, listWorkImages } from "@/lib/works";

export const dynamic = "force-dynamic";

type WorkPageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: WorkPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const work = await getWorkById(id);
    if (!work || work.status !== "published") {
      return { title: "作品预览 — NÉRA ATELIER", robots: { index: false, follow: false } };
    }
    return {
      title: `${work.title} — NÉRA ATELIER`,
      description: work.description || `${work.collection} · ${work.lookNumber || "Fashion work"}`,
    };
  } catch {
    return { title: "NÉRA ATELIER" };
  }
}

export default async function WorkPage({ params }: WorkPageProps) {
  const { id } = await params;
  const work = await getWorkById(id).catch(() => null);
  if (!work) notFound();

  let draftPreview = false;
  if (work.status !== "published") {
    const user = await getChatGPTUser();
    if (!user || !(await isAdminEmail(user.email))) notFound();
    draftPreview = true;
  }

  const [gallery, processEntries, collectionNavigation] = await Promise.all([
    listWorkImages(work.id).catch(() => []),
    listWorkProcessEntries(work.id, draftPreview).catch(() => []),
    getCollectionNavigationForWork(work.id, draftPreview).catch(() => null),
  ]);
  return (
    <WorkDetail
      work={work}
      gallery={gallery}
      processEntryCount={processEntries.length}
      draftPreview={draftPreview}
      collectionNavigation={collectionNavigation}
    />
  );
}
