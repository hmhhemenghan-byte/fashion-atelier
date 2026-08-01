import Link from "next/link";
import type {
  Collection,
  CollectionWork,
  Work,
  WorkImage,
} from "@/db/schema";
import { mediaUrl } from "@/lib/works";

type CollectionNavigation = {
  collection: Collection;
  assignment: CollectionWork;
  previous: Work | null;
  next: Work | null;
  position: number;
  total: number;
};

type WorkDetailProps = {
  work: Work;
  gallery?: WorkImage[];
  processEntryCount?: number;
  draftPreview?: boolean;
  imageUrl?: string;
  collectionNavigation?: CollectionNavigation | null;
};

export default function WorkDetail({
  work,
  gallery = [],
  processEntryCount = 0,
  draftPreview = false,
  imageUrl,
  collectionNavigation,
}: WorkDetailProps) {
  const collectionHref = collectionNavigation
    ? `/collections/${encodeURIComponent(collectionNavigation.collection.slug)}`
    : "/#archive";

  return (
    <main className="work-detail-page">
      <header className="work-detail-header">
        <Link className="studio-brand" href="/">NÉRA <span>ATELIER</span></Link>
        <Link className="work-detail-back" href={collectionHref}>
          ← {collectionNavigation ? "BACK TO COLLECTION" : "BACK TO ARCHIVE"}
        </Link>
      </header>

      <article className="work-detail-layout" aria-labelledby="work-title">
        <div className="work-detail-media">
          <img src={imageUrl ?? mediaUrl(work.imageKey)} alt={work.altText} />
          <span className="work-detail-look">{work.lookNumber || "NÉRA EDITION"}</span>
          {draftPreview && <strong className="work-detail-draft">DRAFT PREVIEW / 草稿预览</strong>}
        </div>

        <div className="work-detail-content">
          <p className="work-detail-kicker">
            NÉRA ARCHIVE / {collectionNavigation?.collection.title || work.collection}
          </p>
          <span className="work-detail-number">
            {collectionNavigation
              ? `${String(collectionNavigation.position).padStart(2, "0")} / ${String(collectionNavigation.total).padStart(2, "0")}`
              : String(Math.abs(work.sortOrder)).padStart(2, "0")}
          </span>
          <h1 id="work-title">{work.title}</h1>
          <p className="work-detail-description">
            {work.description || "作品说明将在设计档案完善后更新。"}
          </p>

          <dl className="work-detail-facts">
            <div><dt>COLLECTION / 系列</dt><dd>{collectionNavigation?.collection.title || work.collection}</dd></div>
            <div><dt>LOOK / 造型</dt><dd>{collectionNavigation?.assignment.lookNumber || work.lookNumber || "—"}</dd></div>
            <div><dt>STATUS / 状态</dt><dd>{draftPreview ? "草稿预览" : "已发布"}</dd></div>
            <div><dt>PUBLISHED / 发布</dt><dd>{formatDate(work.publishedAt ?? work.createdAt)}</dd></div>
          </dl>

          <div className="work-detail-actions">
            {processEntryCount > 0 && (
              <Link href={`/works/${encodeURIComponent(work.id)}/process`}>
                打开 PROCESS DOSSIER <span>↗</span>
              </Link>
            )}
            {collectionNavigation && (
              <Link
                href={`${collectionHref}/lookbook#look-${String(collectionNavigation.position).padStart(2, "0")}`}
              >
                打开 DIGITAL LOOKBOOK <span>↗</span>
              </Link>
            )}
            <Link href={collectionHref}>继续浏览系列 <span>→</span></Link>
            {draftPreview && <Link href="/studio">返回作品后台</Link>}
          </div>
        </div>
      </article>

      {processEntryCount > 0 && (
        <section className="work-process-teaser" aria-labelledby="work-process-title">
          <div>
            <span>02 / DESIGN DEVELOPMENT</span>
            <strong>{String(processEntryCount).padStart(2, "0")} RECORDS</strong>
          </div>
          <h2 id="work-process-title">
            BEHIND
            <br />
            <i>THE FORM.</i>
          </h2>
          <p>
            阅读这件作品从概念、草图与材料实验，到打版、试衣和制作完成的完整路径。
          </p>
          <Link href={`/works/${encodeURIComponent(work.id)}/process`}>
            OPEN PROCESS DOSSIER <span>→</span>
          </Link>
        </section>
      )}

      {gallery.length > 0 && (
        <section className="work-gallery" aria-labelledby="work-gallery-title">
          <header className="work-gallery-head">
            <div>
              <span>{processEntryCount > 0 ? "03" : "02"} / SECONDARY VIEWS</span>
              <h2 id="work-gallery-title">DETAILS<br /><i>IN MOTION</i></h2>
            </div>
            <p>
              从轮廓、背面到面料触感，完整记录作品在身体与空间中的变化。
              <strong>{String(gallery.length).padStart(2, "0")} FRAMES</strong>
            </p>
          </header>

          <div className="work-gallery-grid">
            {gallery.map((image, index) => (
              <figure
                className={`work-gallery-frame work-gallery-frame--${(index % 5) + 1}`}
                key={image.id}
              >
                <div>
                  <img src={mediaUrl(image.imageKey)} alt={image.altText} loading="lazy" />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <figcaption>
                  <strong>{image.label}</strong>
                  <small>NÉRA / {work.lookNumber || "ARCHIVE"}</small>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {collectionNavigation && (
        <nav className="work-sequence" aria-label="系列作品导航">
          {collectionNavigation.previous ? (
            <Link href={`/works/${encodeURIComponent(collectionNavigation.previous.id)}`}>
              <span>PREVIOUS LOOK</span>
              <strong>{collectionNavigation.previous.title}</strong>
              <i>←</i>
            </Link>
          ) : (
            <span className="is-empty" />
          )}
          {collectionNavigation.next ? (
            <Link href={`/works/${encodeURIComponent(collectionNavigation.next.id)}`}>
              <span>NEXT LOOK</span>
              <strong>{collectionNavigation.next.title}</strong>
              <i>→</i>
            </Link>
          ) : (
            <Link href={collectionHref}>
              <span>END OF LINEUP</span>
              <strong>{collectionNavigation.collection.title}</strong>
              <i>↗</i>
            </Link>
          )}
        </nav>
      )}

      <footer className="work-detail-footer">
        <span>{collectionNavigation?.collection.title || "SECOND SKIN"} / NÉRA ATELIER</span>
        <span>© 2027 NÉRA ATELIER</span>
      </footer>
    </main>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
}
