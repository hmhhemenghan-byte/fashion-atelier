import type { Metadata } from "next";
import Link from "next/link";
import {
  getCollectionById,
  listCollectionWorks,
} from "@/lib/collections";
import {
  listPublicPublications,
  publicationHeroUrl,
} from "@/lib/publications";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Press Room — NÉRA ATELIER",
  description:
    "NÉRA ATELIER 官方发布、系列新闻稿、制作署名与媒体资料。",
};

export default async function PressRoomPage() {
  const publicationRows = await listPublicPublications().catch(() => []);
  const releases = (
    await Promise.all(
      publicationRows.map(async (publication) => {
        const collection = await getCollectionById(
          publication.collectionId,
        ).catch(() => null);
        if (!collection || collection.status !== "published") return null;
        const lineup = await listCollectionWorks(collection.id).catch(() => []);
        return {
          publication,
          collection,
          lineup,
          image: publicationHeroUrl(collection, lineup),
        };
      }),
    )
  ).filter((release): release is NonNullable<typeof release> =>
    Boolean(release),
  );

  return (
    <main className="press-room-page">
      <header className="press-room-nav">
        <Link className="studio-brand" href="/">
          NÉRA <span>ATELIER</span>
        </Link>
        <nav aria-label="媒体中心导航">
          <Link href="/collections">COLLECTIONS</Link>
          <a href="#releases">RELEASES</a>
        </nav>
        <Link className="press-room-close" href="/">
          HOME ↗
        </Link>
      </header>

      <section className="press-room-hero" aria-labelledby="press-room-title">
        <div>
          <p>OFFICIAL NEWSROOM / 官方媒体中心</p>
          <h1 id="press-room-title">
            PRESS
            <br />
            <i>ROOM</i>
          </h1>
        </div>
        <div className="press-room-hero-note">
          <span>{String(releases.length).padStart(2, "0")} RELEASES</span>
          <p>
            系列新闻稿、完整制作署名、精选造型与可下载媒体资料，
            由 NÉRA ATELIER 统一发布。
          </p>
        </div>
        <strong aria-hidden="true">PR</strong>
      </section>

      {releases.length > 0 ? (
        <section
          className="press-release-index"
          id="releases"
          aria-label="官方发布列表"
        >
          {releases.map(
            ({ publication, collection, lineup, image }, index) => (
              <article
                className={`press-release-card press-release-card--${(index % 3) + 1}`}
                key={publication.id}
              >
                <Link
                  className="press-release-card-image"
                  href={`/press/${encodeURIComponent(publication.slug)}`}
                  aria-label={`阅读发布：${publication.headline}`}
                >
                  <img
                    src={image}
                    alt={
                      collection.heroAltText ||
                      `${collection.title} official release`
                    }
                  />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>OFFICIAL RELEASE</strong>
                </Link>
                <div className="press-release-card-copy">
                  <div>
                    <span>
                      {publication.city || "NÉRA ATELIER"} ·{" "}
                      {publication.releaseDate || collection.year}
                    </span>
                    <small>
                      {String(lineup.length).padStart(2, "0")} LOOKS
                    </small>
                  </div>
                  <h2>
                    <Link
                      href={`/press/${encodeURIComponent(publication.slug)}`}
                    >
                      {publication.headline}
                    </Link>
                  </h2>
                  <p>{publication.deck}</p>
                  <Link
                    className="press-release-card-link"
                    href={`/press/${encodeURIComponent(publication.slug)}`}
                  >
                    READ &amp; DOWNLOAD <span>→</span>
                  </Link>
                </div>
              </article>
            ),
          )}
        </section>
      ) : (
        <section className="press-room-empty" id="releases">
          <span>00</span>
          <h2>
            RELEASES
            <br />
            <i>IN PREPARATION.</i>
          </h2>
          <p>首份官方发布包将在工作室完成预检后出现在这里。</p>
          <Link href="/collections">EXPLORE COLLECTIONS →</Link>
        </section>
      )}

      <section className="press-room-contact">
        <p>PRESS &amp; EDITORIAL ENQUIRIES</p>
        <h2>
          FOR THE FULL
          <br />
          <i>STORY.</i>
        </h2>
        <p>
          每份公开发布均提供新闻稿文本、结构化资料、造型索引和制作署名。
          媒体联系信息请以对应发布页为准。
        </p>
      </section>

      <footer className="press-room-footer">
        <span>© 2027 NÉRA ATELIER</span>
        <Link href="/studio">DESIGNER STUDIO →</Link>
      </footer>
    </main>
  );
}
