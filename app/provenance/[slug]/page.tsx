import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductionAcceptance } from "@/lib/production-acceptances";
import { getProductionRelease } from "@/lib/production-releases";
import { getProvenanceDossierBySlug } from "@/lib/provenance-dossiers";
import { getWorkById, mediaUrl } from "@/lib/works";

export const dynamic = "force-dynamic";

type ProvenancePageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProvenancePageProps): Promise<Metadata> {
  const { slug } = await params;
  const dossier = await getProvenanceDossierBySlug(slug).catch(() => null);
  if (!dossier || dossier.status !== "published") {
    return {
      title: "Provenance Dossier — NÉRA ATELIER",
      robots: { index: false, follow: false },
    };
  }
  return {
    title: `${dossier.title} — Provenance Dossier`,
    description: dossier.publicSummary,
  };
}

export default async function ProvenancePage({ params }: ProvenancePageProps) {
  const { slug } = await params;
  const dossier = await getProvenanceDossierBySlug(slug).catch(() => null);
  if (!dossier || dossier.status !== "published") notFound();
  const [acceptance, work] = await Promise.all([
    getProductionAcceptance(dossier.productionAcceptanceId).catch(() => null),
    getWorkById(dossier.workId).catch(() => null),
  ]);
  if (
    !acceptance ||
    acceptance.status !== "accepted" ||
    !acceptance.acceptanceSeal ||
    !work
  ) {
    notFound();
  }
  const release = await getProductionRelease(acceptance.productionReleaseId).catch(() => null);

  return (
    <main className="provenance-page">
      <header className="provenance-nav">
        <Link className="studio-brand" href="/">
          NÉRA <span>ATELIER</span>
        </Link>
        <nav aria-label="溯源档案导航">
          <a href="#story">STORY</a>
          <a href="#making">MAKING</a>
          <a href="#care">CARE</a>
        </nav>
        <span>{dossier.dossierCode}</span>
      </header>

      <section className="provenance-hero">
        <div className="provenance-hero-image">
          <Image
            src={mediaUrl(work.imageKey)}
            alt={work.altText}
            fill
            sizes="(max-width: 900px) 100vw, 58vw"
            priority
            unoptimized
          />
        </div>
        <div className="provenance-hero-copy">
          <p>PROVENANCE DOSSIER / 成衣溯源档案</p>
          <h1>{dossier.title}</h1>
          <strong>{dossier.subtitle || work.collection}</strong>
          <div>
            <span>{work.lookNumber || "NÉRA LOOK"}</span>
            <span>REVISION {String(dossier.revision).padStart(2, "0")}</span>
          </div>
          <blockquote>{dossier.publicSummary}</blockquote>
        </div>
      </section>

      <section className="provenance-story" id="story">
        <div className="provenance-index">
          <span>01</span>
          <p>DESIGN MEMORY</p>
        </div>
        <article>
          <h2>一件作品，<br /><i>一条可追溯的线。</i></h2>
          {paragraphs(dossier.designStory).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </article>
        <aside>
          <span>COLLECTION</span><b>{work.collection}</b>
          <span>EDITION</span><b>{acceptance.editionReference}</b>
          <span>COLORWAY</span><b>{acceptance.colorway}</b>
          <span>SIZE RANGE</span><b>{acceptance.sizeRange}</b>
        </aside>
      </section>

      <section className="provenance-making" id="making">
        <header>
          <span>02 / MATERIAL & MAKING</span>
          <h2>What it is.<br /><i>How it became.</i></h2>
        </header>
        <div>
          <article>
            <span>MATERIAL DISCLOSURE / 材料披露</span>
            {paragraphs(dossier.materialDisclosure).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </article>
          <article>
            <span>MAKING / 制作</span>
            {paragraphs(dossier.makerDisclosure).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            <dl>
              <div><dt>PLACE</dt><dd>{dossier.placeOfMaking}</dd></div>
              <div><dt>COMPLETED</dt><dd>{formatDate(dossier.madeAt)}</dd></div>
            </dl>
          </article>
        </div>
      </section>

      <section className="provenance-care" id="care">
        <div className="provenance-index">
          <span>03</span>
          <p>LONGEVITY</p>
        </div>
        <article>
          <h2>Care for the piece.<br /><i>Keep the memory.</i></h2>
          <div>
            <section>
              <span>CARE / 护理</span>
              {paragraphs(dossier.careGuidance).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>
            <section>
              <span>REPAIR / 修复</span>
              {paragraphs(dossier.repairGuidance).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>
          </div>
        </article>
      </section>

      <section className="provenance-verification">
        <p>HUMAN VERIFIED / 人工核对</p>
        <div>
          <span>PROVENANCE</span><b>{dossier.dossierCode}</b>
          <span>ACCEPTANCE</span><b>{acceptance.acceptanceSeal}</b>
          <span>RELEASE</span><b>{release?.authorizationCode || release?.releaseCode || "ARCHIVED"}</b>
          <span>PUBLISHED</span><b>{formatDate(dossier.publishedAt)}</b>
        </div>
        {dossier.provenanceNote && <p>{dossier.provenanceNote}</p>}
        <small>
          本页是 NÉRA ATELIER 自有设计与制作档案，不替代第三方法规认证、
          检测报告或产品标签。
        </small>
      </section>

      <footer className="provenance-footer">
        <Link href="/">NÉRA ATELIER</Link>
        <span>DESIGNED TO BE REMEMBERED.</span>
      </footer>
    </main>
  );
}

function paragraphs(value: string) {
  return value.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
}
