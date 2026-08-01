import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  getCollectionById,
  listCollectionWorks,
} from "@/lib/collections";
import {
  getPublicationBySlug,
  publicationCredits,
  publicationHeroUrl,
  publicationIsPublic,
} from "@/lib/publications";
import { isAdminEmail } from "@/lib/runtime";
import { mediaUrl } from "@/lib/works";
import PressActions from "./press-actions";

export const dynamic = "force-dynamic";

type PressReleasePageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ preview?: string }>;
};

export async function generateMetadata({
  params,
}: PressReleasePageProps): Promise<Metadata> {
  const { slug } = await params;
  const publication = await getPublicationBySlug(slug).catch(() => null);
  if (!publication || !publicationIsPublic(publication)) {
    return {
      title: "Press Release Preview — NÉRA ATELIER",
      robots: { index: false, follow: false },
    };
  }
  const collection = await getCollectionById(
    publication.collectionId,
  ).catch(() => null);
  if (!collection) return { title: "NÉRA ATELIER" };
  const lineup = await listCollectionWorks(collection.id).catch(() => []);
  const imagePath = publicationHeroUrl(collection, lineup);
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") || "https";
  const image =
    host && imagePath
      ? new URL(imagePath, `${protocol}://${host}`).toString()
      : undefined;
  return {
    title: publication.seoTitle || publication.headline,
    description: publication.seoDescription || publication.deck,
    openGraph: {
      type: "article",
      title: publication.seoTitle || publication.headline,
      description: publication.seoDescription || publication.deck,
      publishedTime:
        publication.releaseAt ||
        publication.publishedAt ||
        publication.createdAt,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: publication.seoTitle || publication.headline,
      description: publication.seoDescription || publication.deck,
      images: image ? [image] : undefined,
    },
  };
}

export default async function PressReleasePage({
  params,
  searchParams,
}: PressReleasePageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const publication = await getPublicationBySlug(slug).catch(() => null);
  if (!publication) notFound();

  const isPublic = publicationIsPublic(publication);
  const requestedPreview = query?.preview === "1";
  const draftPreview = !isPublic || requestedPreview;
  if (draftPreview) {
    const user = await getChatGPTUser();
    if (!user || !(await isAdminEmail(user.email))) notFound();
  }

  const collection = await getCollectionById(
    publication.collectionId,
  ).catch(() => null);
  if (!collection) notFound();
  const lineup = await listCollectionWorks(
    collection.id,
    draftPreview,
  ).catch(() => []);
  const heroImage = publicationHeroUrl(collection, lineup);
  const credits = publicationCredits(publication);
  const paragraphs = publication.body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <main className="press-release-page">
      <header className="press-release-nav">
        <Link className="studio-brand" href="/">
          NÉRA <span>ATELIER</span>
        </Link>
        <nav aria-label="发布页导航">
          <a href="#release">RELEASE</a>
          <a href="#credits">CREDITS</a>
          <a href="#materials">MATERIALS</a>
        </nav>
        <Link className="press-release-close" href="/press">
          PRESS ROOM ×
        </Link>
      </header>

      <section className="press-release-hero">
        <img
          src={heroImage}
          alt={
            collection.heroAltText ||
            `${collection.title} official press release`
          }
        />
        <div className="press-release-hero-shade" />
        <div className="press-release-hero-copy">
          <p>OFFICIAL RELEASE / NÉRA ATELIER</p>
          <h1>{publication.headline}</h1>
          <strong>{publication.deck}</strong>
        </div>
        <div className="press-release-dateline">
          <span>{publication.city || "NÉRA ATELIER"}</span>
          <strong>
            {publication.releaseDate || String(collection.year)}
          </strong>
        </div>
        {draftPreview && (
          <b className="press-release-draft">
            {publication.status.toUpperCase()} PREVIEW / 发布预览
          </b>
        )}
      </section>

      <article
        className="press-release-story"
        id="release"
        aria-labelledby="press-release-story-title"
      >
        <div className="press-release-marker">
          <span>01</span>
          <p>PRESS RELEASE / 新闻稿</p>
        </div>
        <div className="press-release-story-copy">
          <p className="press-release-location">
            {publication.city || "NÉRA ATELIER"} —{" "}
            {publication.releaseDate || collection.year}
          </p>
          <h2 id="press-release-story-title">
            {collection.title}
            <br />
            <i>{collection.subtitle || collection.season}</i>
          </h2>
          <div>
            {paragraphs.length > 0 ? (
              paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))
            ) : (
              <p>
                新闻稿正文正在由工作室整理。完整内容将在正式发布前完成。
              </p>
            )}
          </div>
        </div>
        <aside>
          <span>COLLECTION FACTS</span>
          <dl>
            <div>
              <dt>SEASON</dt>
              <dd>{collection.season || "—"}</dd>
            </div>
            <div>
              <dt>YEAR</dt>
              <dd>{collection.year}</dd>
            </div>
            <div>
              <dt>LOOKS</dt>
              <dd>{String(lineup.length).padStart(2, "0")}</dd>
            </div>
            <div>
              <dt>STATUS</dt>
              <dd>{draftPreview ? "PREVIEW" : "OFFICIAL"}</dd>
            </div>
          </dl>
          <Link
            href={`/collections/${encodeURIComponent(collection.slug)}`}
          >
            COLLECTION DOSSIER <span>↗</span>
          </Link>
          {lineup.length > 0 && (
            <Link
              href={`/collections/${encodeURIComponent(collection.slug)}/lookbook`}
            >
              DIGITAL LOOKBOOK <span>↗</span>
            </Link>
          )}
        </aside>
      </article>

      {lineup.length > 0 && (
        <section className="press-release-looks" aria-label="精选发布造型">
          <header>
            <p>SELECTED LOOKS / 官方造型</p>
            <strong>{String(lineup.length).padStart(2, "0")}</strong>
          </header>
          <div>
            {lineup.slice(0, 4).map(({ assignment, work }, index) => (
              <Link
                className={`press-release-look press-release-look--${index + 1}`}
                href={`/works/${encodeURIComponent(work.id)}`}
                key={work.id}
              >
                <figure>
                  <img
                    src={mediaUrl(work.imageKey)}
                    alt={work.altText}
                    loading={index > 1 ? "lazy" : undefined}
                  />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </figure>
                <small>
                  {assignment.lookNumber ||
                    work.lookNumber ||
                    `LOOK ${String(index + 1).padStart(2, "0")}`}
                </small>
                <h3>{work.title}</h3>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="press-release-credits" id="credits">
        <header>
          <span>02</span>
          <p>PRODUCTION CREDITS / 制作署名</p>
        </header>
        <h2>
          MADE BY
          <br />
          <i>PEOPLE.</i>
        </h2>
        {credits.length > 0 ? (
          <dl>
            {credits.map(([role, name]) => (
              <div key={role}>
                <dt>{role}</dt>
                <dd>{name}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>制作署名将在正式发布前补充。</p>
        )}
      </section>

      <section className="press-materials" id="materials">
        <div>
          <p>03 / PRESS MATERIALS</p>
          <h2>
            READY TO
            <br />
            <i>PUBLISH.</i>
          </h2>
          <p>
            下载可复制的新闻稿文本或结构化媒体数据，也可直接打印并保存为
            PDF。
          </p>
        </div>
        <PressActions
          slug={publication.slug}
          downloadable={isPublic}
        />
      </section>

      <section className="press-release-contact">
        <p>MEDIA CONTACT / 媒体联系</p>
        <h2>{publication.contactName || "NÉRA ATELIER PRESS"}</h2>
        {publication.contactEmail ? (
          <a href={`mailto:${publication.contactEmail}`}>
            {publication.contactEmail} <span>↗</span>
          </a>
        ) : (
          <span>CONTACT TO BE ANNOUNCED</span>
        )}
      </section>

      <footer className="press-release-footer">
        <span>
          {collection.title} / NÉRA ATELIER
        </span>
        <Link href="/press">BACK TO PRESS ROOM →</Link>
      </footer>
    </main>
  );
}
