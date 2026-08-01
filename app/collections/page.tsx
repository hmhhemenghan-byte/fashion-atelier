import type { Metadata } from "next";
import Link from "next/link";
import {
  collectionHeroUrl,
  collectionLabel,
  listCollectionWorks,
  listPublishedCollections,
} from "@/lib/collections";
import { mediaUrl } from "@/lib/works";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Collections — NÉRA ATELIER",
  description: "NÉRA ATELIER 时装系列档案、造型编排与设计宣言。",
};

export default async function CollectionsPage() {
  const collectionRows = await listPublishedCollections().catch(() => []);
  const cards = await Promise.all(
    collectionRows.map(async (collection) => {
      const lineup = await listCollectionWorks(collection.id).catch(() => []);
      return {
        collection,
        lineup,
        image:
          collectionHeroUrl(collection) ||
          (lineup[0] ? mediaUrl(lineup[0].work.imageKey) : "/images/hero-fashion.webp"),
      };
    }),
  );

  return (
    <main className="collections-index">
      <header className="collections-nav">
        <Link className="studio-brand" href="/">NÉRA <span>ATELIER</span></Link>
        <Link href="/">← HOME</Link>
      </header>

      <section className="collections-index-hero" aria-labelledby="collections-title">
        <div>
          <span>COLLECTION DOSSIER / 系列档案</span>
          <strong>{String(cards.length).padStart(2, "0")}</strong>
        </div>
        <h1 id="collections-title">CURATED<br /><i>SEASONS</i></h1>
        <p>每个系列由宣言、造型顺序与设计细节共同构成。这里不是目录，而是一条持续生长的设计时间线。</p>
      </section>

      {cards.length > 0 ? (
        <section className="collections-index-grid" aria-label="已发布系列">
          {cards.map(({ collection, lineup, image }, index) => (
            <article
              className={`collection-index-card collection-index-card--${(index % 3) + 1}`}
              key={collection.id}
            >
              <Link
                className="collection-index-image"
                href={`/collections/${encodeURIComponent(collection.slug)}`}
                aria-label={`探索系列：${collection.title}`}
              >
                <img src={image} alt={collection.heroAltText || `${collection.title} 系列封面`} />
                <span>{String(index + 1).padStart(2, "0")}</span>
                {collection.featured && <strong>CURRENT COLLECTION</strong>}
              </Link>
              <div className="collection-index-copy">
                <small>{collectionLabel(collection) || "NÉRA COLLECTION"}</small>
                <h2>
                  <Link href={`/collections/${encodeURIComponent(collection.slug)}`}>
                    {collection.title}
                  </Link>
                </h2>
                {collection.subtitle && <p>{collection.subtitle}</p>}
                <div className="collection-index-actions">
                  <span>{String(lineup.length).padStart(2, "0")} LOOKS</span>
                  <div>
                    {lineup.length > 0 && (
                      <Link href={`/collections/${encodeURIComponent(collection.slug)}/lookbook`}>
                        LOOKBOOK ↗
                      </Link>
                    )}
                    <Link href={`/collections/${encodeURIComponent(collection.slug)}`}>DOSSIER →</Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="collections-empty">
          <span>00</span>
          <h2>THE ARCHIVE<br />IS BEING CURATED.</h2>
          <p>首个系列将在设计后台完成编排和发布后出现在这里。</p>
          <Link href="/">返回首页 →</Link>
        </section>
      )}

      <footer className="collections-footer">
        <span>© 2027 NÉRA ATELIER</span>
        <div>
          <Link href="/press">PRESS ROOM →</Link>
          <Link href="/studio">DESIGNER STUDIO →</Link>
        </div>
      </footer>
    </main>
  );
}
