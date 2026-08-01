import Link from "next/link";
import { listPublishedWorks, mediaUrl } from "@/lib/works";

export default async function PublishedArchive() {
  let published;
  try {
    published = await listPublishedWorks(12);
  } catch {
    return null;
  }

  if (!published.length) return null;

  return (
    <section className="archive" id="archive" aria-labelledby="archive-title">
      <div className="archive-head">
        <div className="section-marker">
          <span>03.5</span>
          <p>LIVE ARCHIVE / 最新发布</p>
        </div>
        <h2 id="archive-title">NEW<br /><i>WORKS</i></h2>
        <p>由 NÉRA 设计工作室持续更新的最新作品档案。</p>
      </div>
      <div className="archive-grid">
        {published.map((work, index) => (
          <article className={`archive-card archive-card--${(index % 3) + 1}`} key={work.id}>
            <Link className="archive-image" href={`/works/${encodeURIComponent(work.id)}`} aria-label={`查看作品：${work.title}`}>
              <img src={mediaUrl(work.imageKey)} alt={work.altText} />
              <span>{work.lookNumber || String(index + 1).padStart(2, "0")}</span>
            </Link>
            <div className="archive-meta">
              <small>{work.collection}</small>
              <h3><Link href={`/works/${encodeURIComponent(work.id)}`}>{work.title}</Link></h3>
              {work.description && <p>{work.description}</p>}
              <Link className="archive-view" href={`/works/${encodeURIComponent(work.id)}`}>VIEW WORK <span>→</span></Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
