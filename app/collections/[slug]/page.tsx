import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  collectionHeroUrl,
  collectionLabel,
  getCollectionBySlug,
  listCollectionWorks,
  listPublishedCollections,
} from "@/lib/collections";
import { getPublicPublicationForCollection } from "@/lib/publications";
import { isAdminEmail } from "@/lib/runtime";
import { mediaUrl } from "@/lib/works";

export const dynamic = "force-dynamic";

type CollectionPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug).catch(() => null);
  if (!collection || collection.status !== "published") {
    return {
      title: "系列预览 — NÉRA ATELIER",
      robots: { index: false, follow: false },
    };
  }
  return {
    title: `${collection.title} — NÉRA ATELIER`,
    description:
      collection.statement ||
      `${collectionLabel(collection)} · NÉRA ATELIER Collection`,
  };
}

export default async function CollectionPage({ params }: CollectionPageProps) {
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
  const publication = draftPreview
    ? null
    : await getPublicPublicationForCollection(collection.id).catch(() => null);
  const heroImage =
    collectionHeroUrl(collection) ||
    (lineup[0] ? mediaUrl(lineup[0].work.imageKey) : "/images/hero-fashion.webp");
  const publishedCollections = await listPublishedCollections(100).catch(() => []);
  const publishedIndex = publishedCollections.findIndex(
    (item) => item.id === collection.id,
  );
  const nextCollection =
    publishedIndex >= 0
      ? publishedCollections[(publishedIndex + 1) % publishedCollections.length]
      : null;

  return (
    <main className="collection-page">
      <header className="collection-page-nav">
        <Link className="studio-brand" href="/">NÉRA <span>ATELIER</span></Link>
        <nav aria-label="系列页面导航">
          <a href="#manifesto">MANIFESTO</a>
          <a href="#runway">RUNWAY</a>
          <Link href="/press">PRESS</Link>
          <Link href="/collections">ARCHIVE</Link>
        </nav>
        <Link className="collection-page-close" href="/collections">CLOSE ×</Link>
      </header>

      <section className="collection-page-hero" aria-labelledby="collection-page-title">
        <img src={heroImage} alt={collection.heroAltText || `${collection.title} 系列主视觉`} />
        <div className="collection-page-hero-shade" />
        <div className="collection-page-hero-copy">
          <p>{collectionLabel(collection) || "NÉRA COLLECTION"}</p>
          <h1 id="collection-page-title">{collection.title}</h1>
          {collection.subtitle && <strong>{collection.subtitle}</strong>}
          <div className="collection-page-hero-actions">
            {lineup.length > 0 && (
              <Link href={`/collections/${encodeURIComponent(collection.slug)}/lookbook`}>
                OPEN DIGITAL LOOKBOOK <span>→</span>
              </Link>
            )}
            {publication && (
              <Link href={`/press/${encodeURIComponent(publication.slug)}`}>
                OFFICIAL PRESS RELEASE <span>↗</span>
              </Link>
            )}
            <a href="#manifesto">ENTER THE DOSSIER <span>↓</span></a>
          </div>
        </div>
        <div className="collection-page-counter">
          <span>LOOKS</span>
          <strong>{String(lineup.length).padStart(2, "0")}</strong>
        </div>
        {draftPreview && <b className="collection-page-draft">DRAFT PREVIEW / 草稿预览</b>}
      </section>

      <section className="collection-manifesto" id="manifesto" aria-labelledby="manifesto-title">
        <div className="collection-chapter">
          <span>00</span>
          <p>MANIFESTO / 系列宣言</p>
        </div>
        <div>
          <h2 id="manifesto-title">A COLLECTION<br /><i>AS A POSITION.</i></h2>
          <p>
            {collection.statement ||
              "系列宣言将在设计档案完善后更新。服装从身体出发，并在材料、结构与动作之间寻找新的平衡。"}
          </p>
        </div>
        <dl>
          <div><dt>SEASON</dt><dd>{collection.season || "—"}</dd></div>
          <div><dt>YEAR</dt><dd>{collection.year}</dd></div>
          <div><dt>LOOKS</dt><dd>{String(lineup.length).padStart(2, "0")}</dd></div>
          <div><dt>STATUS</dt><dd>{draftPreview ? "DRAFT" : "PUBLISHED"}</dd></div>
        </dl>
      </section>

      <section className="collection-runway" id="runway" aria-labelledby="runway-title">
        <header>
          <div className="collection-chapter collection-chapter--dark">
            <span>01</span>
            <p>RUNWAY / 造型编排</p>
          </div>
          <h2 id="runway-title">THE<br /><i>LINEUP</i></h2>
          <div className="collection-runway-intro">
            <p>作品按照设计师设定的顺序展开。编号属于系列叙事，而不只是文件名称。</p>
            {lineup.length > 0 && (
              <Link href={`/collections/${encodeURIComponent(collection.slug)}/lookbook`}>
                VIEW AS DIGITAL LOOKBOOK <span>↗</span>
              </Link>
            )}
          </div>
        </header>

        {lineup.length > 0 ? (
          <div className="collection-runway-grid">
            {lineup.map(({ assignment, work }, index) => (
              <article
                className={`collection-runway-look collection-runway-look--${(index % 5) + 1}`}
                key={work.id}
              >
                <Link href={`/works/${encodeURIComponent(work.id)}`}>
                  <div>
                    <img src={mediaUrl(work.imageKey)} alt={work.altText} loading={index > 1 ? "lazy" : undefined} />
                    <span>{assignment.lookNumber || work.lookNumber || `LOOK ${String(index + 1).padStart(2, "0")}`}</span>
                    {assignment.featured && <strong>SELECTED LOOK</strong>}
                  </div>
                  <small>{String(index + 1).padStart(2, "0")} / {String(lineup.length).padStart(2, "0")}</small>
                  <h3>{work.title}</h3>
                  {work.description && <p>{work.description}</p>}
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="collection-runway-empty">
            <span>00 LOOKS</span>
            <p>系列已经建立，作品编排仍在设计后台进行。</p>
          </div>
        )}
      </section>

      <section className="collection-page-end">
        <p>END OF DOSSIER / {collection.title}</p>
        {nextCollection && nextCollection.id !== collection.id ? (
          <Link href={`/collections/${encodeURIComponent(nextCollection.slug)}`}>
            <span>NEXT COLLECTION</span>
            <strong>{nextCollection.title}</strong>
            <i>→</i>
          </Link>
        ) : (
          <Link href="/collections">
            <span>CONTINUE</span>
            <strong>COLLECTION ARCHIVE</strong>
            <i>→</i>
          </Link>
        )}
      </section>
    </main>
  );
}
