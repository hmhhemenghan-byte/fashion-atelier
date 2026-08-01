import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getCollectionNavigationForWork } from "@/lib/collections";
import {
  listWorkProcessEntries,
  processImageUrl,
} from "@/lib/process";
import { processStageMeta } from "@/lib/process-stages";
import { isAdminEmail } from "@/lib/runtime";
import { getWorkById, mediaUrl } from "@/lib/works";

export const dynamic = "force-dynamic";

type ProcessPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ preview?: string }>;
};

export async function generateMetadata({
  params,
}: ProcessPageProps): Promise<Metadata> {
  const { id } = await params;
  const work = await getWorkById(id).catch(() => null);
  if (!work || work.status !== "published") {
    return {
      title: "Process Dossier Preview — NÉRA ATELIER",
      robots: { index: false, follow: false },
    };
  }
  return {
    title: `${work.title} Process Dossier — NÉRA ATELIER`,
    description:
      work.description ||
      `${work.title} 从概念、材料到制作完成的设计过程档案。`,
  };
}

export default async function ProcessPage({
  params,
  searchParams,
}: ProcessPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const work = await getWorkById(id).catch(() => null);
  if (!work) notFound();

  const requestedPreview = query?.preview === "1";
  const draftPreview = work.status !== "published" || requestedPreview;
  if (draftPreview) {
    const user = await getChatGPTUser();
    if (!user || !(await isAdminEmail(user.email))) notFound();
  }

  const [entries, collectionNavigation] = await Promise.all([
    listWorkProcessEntries(work.id, draftPreview).catch(() => []),
    getCollectionNavigationForWork(work.id, draftPreview).catch(() => null),
  ]);
  const collectionHref = collectionNavigation
    ? `/collections/${encodeURIComponent(collectionNavigation.collection.slug)}`
    : "/collections";
  const lookbookHref = collectionNavigation
    ? `${collectionHref}/lookbook#look-${String(collectionNavigation.position).padStart(2, "0")}`
    : null;
  const stages = Array.from(
    new Set(entries.map((entry) => entry.stage)),
  ).map(processStageMeta);

  return (
    <main className="process-dossier-page">
      <header className="process-dossier-nav">
        <Link className="studio-brand" href="/">
          NÉRA <span>ATELIER</span>
        </Link>
        <nav aria-label="过程档案导航">
          <a href="#process-map">PROCESS MAP</a>
          <a href="#process-records">RECORDS</a>
          <Link href={`/works/${encodeURIComponent(work.id)}`}>FINAL LOOK</Link>
        </nav>
        <Link
          className="process-dossier-close"
          href={`/works/${encodeURIComponent(work.id)}`}
        >
          CLOSE ×
        </Link>
      </header>

      <section
        className="process-dossier-hero"
        aria-labelledby="process-dossier-title"
      >
        <div className="process-dossier-hero-copy">
          <p>DESIGN DEVELOPMENT / 设计过程</p>
          <h1 id="process-dossier-title">
            PROCESS
            <br />
            <i>DOSSIER</i>
          </h1>
          <div>
            <span>{work.lookNumber || "NÉRA EDITION"}</span>
            <strong>{work.title}</strong>
          </div>
          <a href="#process-map">
            ENTER THE PROCESS <span>↓</span>
          </a>
        </div>

        <figure>
          <img src={mediaUrl(work.imageKey)} alt={work.altText} />
          <figcaption>
            <span>FINAL LOOK</span>
            <strong>{String(entries.length).padStart(2, "0")} RECORDS</strong>
          </figcaption>
        </figure>

        <dl>
          <div>
            <dt>COLLECTION</dt>
            <dd>
              {collectionNavigation?.collection.title || work.collection}
            </dd>
          </div>
          <div>
            <dt>LOOK</dt>
            <dd>
              {collectionNavigation?.assignment.lookNumber ||
                work.lookNumber ||
                "—"}
            </dd>
          </div>
          <div>
            <dt>STAGES</dt>
            <dd>{String(stages.length).padStart(2, "0")}</dd>
          </div>
        </dl>

        {draftPreview && (
          <b className="process-dossier-draft">
            DRAFT PREVIEW / 草稿预览
          </b>
        )}
      </section>

      <section
        className="process-map"
        id="process-map"
        aria-labelledby="process-map-title"
      >
        <div className="process-section-marker">
          <span>01</span>
          <p>PROCESS MAP / 过程路径</p>
        </div>
        <div>
          <h2 id="process-map-title">
            ANATOMY OF
            <br />
            <i>A LOOK.</i>
          </h2>
          <p>
            一件作品不是单一结果，而是一系列判断的叠加。过程档案保留每次试验、
            修正与材料反馈，让最终造型拥有可以被阅读的路径。
          </p>
        </div>
        <ol>
          {stages.length > 0 ? (
            stages.map((stage, index) => (
              <li key={stage.value}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{stage.english}</strong>
                  <small>{stage.label}</small>
                </div>
              </li>
            ))
          ) : (
            <li>
              <span>00</span>
              <div>
                <strong>IN CURATION</strong>
                <small>整理中</small>
              </div>
            </li>
          )}
        </ol>
      </section>

      <section
        className="process-records"
        id="process-records"
        aria-labelledby="process-records-title"
      >
        <header>
          <div className="process-section-marker process-section-marker--dark">
            <span>02</span>
            <p>WORKING RECORDS / 工作记录</p>
          </div>
          <h2 id="process-records-title">
            THE MAKING
            <br />
            <i>OF FORM</i>
          </h2>
          <p>
            从最初的参考、草图和材料样本，到立裁、试衣与完成制作，
            每一条记录都对应一个具体的设计决定。
          </p>
        </header>

        {entries.length > 0 ? (
          <div className="process-records-grid">
            {entries.map((entry, index) => {
              const stage = processStageMeta(entry.stage);
              const image = processImageUrl(entry);
              return (
                <article
                  className={`process-record process-record--${(index % 5) + 1}${image ? "" : " is-text-only"}`}
                  key={entry.id}
                >
                  <div className="process-record-visual">
                    {image ? (
                      <img
                        src={image}
                        alt={entry.altText}
                        loading={index > 1 ? "lazy" : undefined}
                      />
                    ) : (
                      <div aria-hidden="true">
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <i />
                        <i />
                        <i />
                      </div>
                    )}
                    <span>{stage.english}</span>
                    <strong>{String(index + 1).padStart(2, "0")}</strong>
                    {draftPreview && entry.status === "draft" && (
                      <b>DRAFT</b>
                    )}
                  </div>
                  <div className="process-record-copy">
                    <div>
                      <span>
                        {stage.english} / {stage.label}
                      </span>
                      <small>
                        {entry.dateLabel || formatDate(entry.createdAt)}
                      </small>
                    </div>
                    <h3>{entry.title}</h3>
                    {entry.notes && <p>{entry.notes}</p>}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="process-records-empty">
            <span>00</span>
            <h3>PROCESS RECORD<br />IN CURATION.</h3>
            <p>设计过程正在由工作室整理，完成后会在这里形成连续档案。</p>
          </div>
        )}
      </section>

      <section className="process-dossier-end">
        <p>END OF PROCESS DOSSIER / {work.title}</p>
        <h2>
          FROM IDEA
          <br />
          <i>TO FORM.</i>
        </h2>
        <div>
          <Link href={`/works/${encodeURIComponent(work.id)}`}>
            <span>RETURN TO</span>
            <strong>FINAL LOOK</strong>
            <i>→</i>
          </Link>
          {lookbookHref ? (
            <Link href={lookbookHref}>
              <span>CONTINUE IN</span>
              <strong>DIGITAL LOOKBOOK</strong>
              <i>↗</i>
            </Link>
          ) : (
            <Link href={collectionHref}>
              <span>EXPLORE</span>
              <strong>COLLECTIONS</strong>
              <i>↗</i>
            </Link>
          )}
        </div>
      </section>

      <footer className="process-dossier-footer">
        <span>
          {collectionNavigation?.collection.title || work.collection} / NÉRA
          ATELIER
        </span>
        <span>DESIGN PROCESS ARCHIVE · © 2027</span>
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
