import PublishedArchive from "@/app/components/published-archive";
import Link from "next/link";
import {
  collectionHeroUrl,
  getFeaturedCollection,
  listCollectionWorks,
} from "@/lib/collections";

export const dynamic = "force-dynamic";

export default async function Home() {
  const featuredCollection = await getFeaturedCollection().catch(() => null);
  const featuredWorks = featuredCollection
    ? await listCollectionWorks(featuredCollection.id).catch(() => [])
    : [];
  const heroTitle = splitHeroTitle(featuredCollection?.title ?? "SECOND SKIN");
  const heroHref = featuredCollection
    ? `/collections/${encodeURIComponent(featuredCollection.slug)}`
    : "#collection";
  const heroImage =
    (featuredCollection && collectionHeroUrl(featuredCollection)) ||
    (featuredWorks[0] ? `/api/media/${featuredWorks[0].work.imageKey.split("/").map(encodeURIComponent).join("/")}` : null) ||
    "/images/hero-fashion.webp";
  const heroLookCount = featuredWorks.length || 12;

  return (
    <main>
      <section className="hero" id="top" aria-labelledby="hero-title">
        <header className="site-header">
          <a className="brand" href="#top" aria-label="Néra Atelier 首页">
            NÉRA <span>ATELIER</span>
          </a>
          <nav aria-label="主导航">
            <Link href="/collections">系列</Link>
            <a href="#archive">档案</a>
            <a href="#craft">工艺</a>
            <Link href="/press">媒体</Link>
            <Link href="/exhibitions/latest">展陈</Link>
            <a href="#about">关于</a>
          </nav>
          <Link className="index-link" href="/collections" aria-label="查看系列档案">
            INDEX <span>↘</span>
          </Link>
        </header>

        <div className="hero-blue" aria-hidden="true" />
        <div className="hero-acid" aria-hidden="true" />
        <div className="hero-rule" aria-hidden="true" />

        <div className="hero-title-wrap">
          <p className="eyebrow">
            NÉRA / {featuredCollection
              ? `${featuredCollection.season || "COLLECTION"} ${featuredCollection.year}`
              : "AUTUMN—WINTER 2027"}
          </p>
          <h1 id="hero-title">
            <span>{heroTitle[0]}</span>
            <span>{heroTitle[1]}</span>
          </h1>
        </div>

        <figure className="hero-figure">
          <img
            src={heroImage}
            alt={featuredCollection?.heroAltText || featuredWorks[0]?.work.altText || "身着黑色与深酒红雕塑廓形服装的模特"}
            width="1672"
            height="941"
          />
        </figure>

        <div className="hero-copy">
          <div className="hero-season">
            <span>01</span>
            <p>
              {featuredCollection
                ? `${featuredCollection.year} ${featuredCollection.season || "系列"}`
                : "2027 秋冬系列"}
            </p>
          </div>
          <p className="hero-statement">
            {featuredCollection?.statement ? (
              featuredCollection.statement
            ) : (
              <>在结构与流动之间，<br />重塑身体的边界。</>
            )}
          </p>
          <a className="primary-link" href={heroHref}>
            <span>探索系列</span>
            <span aria-hidden="true">→</span>
          </a>
        </div>

        <div className="look-count" aria-label={`系列共${heroLookCount}套造型`}>
          <span>LOOK</span>
          <strong>01—{String(heroLookCount).padStart(2, "0")}</strong>
        </div>
        <a className="scroll-cue" href="#collection">
          <span>SCROLL TO DISCOVER</span>
          <i aria-hidden="true" />
        </a>
      </section>

      <div className="ticker" aria-label="系列关键词">
        <div>
          <span>NÉRA ATELIER</span><i>◆</i><span>SECOND SKIN</span><i>◆</i>
          <span>FORM IN MOTION</span><i>◆</i><span>AW 2027</span><i>◆</i>
          <span aria-hidden="true">NÉRA ATELIER</span><i aria-hidden="true">◆</i>
          <span aria-hidden="true">SECOND SKIN</span><i aria-hidden="true">◆</i>
        </div>
      </div>

      <section className="collection" id="collection" aria-labelledby="collection-title">
        <div className="section-marker">
          <span>02</span>
          <p>THE CONCEPT / 设计理念</p>
        </div>

        <div className="collection-heading">
          <h2 id="collection-title">
            <span>FORM</span>
            <em>/</em>
            <span>MOTION</span>
          </h2>
          <div className="collection-copy">
            <p className="lead">衣服不是覆盖身体，<br />而是身体运动留下的轨迹。</p>
            <p>
              SECOND SKIN 从人体结构出发，将精准肩线、偏移褶皱与透明层次
              组合成十二组廓形。静止时如建筑，行走时重新获得流动。
            </p>
          </div>
        </div>

        <figure className="collection-visual">
          <img
            src="/images/lookbook-duo.webp"
            alt="两位模特展示象牙白、黑色与深酒红系列造型"
            width="1536"
            height="1024"
          />
          <figcaption>
            <span>CAMPAIGN 01</span>
            <p>结构与流动 / Structure in motion</p>
            <strong>AW—27</strong>
          </figcaption>
        </figure>

        <div className="collection-specs" aria-label="系列概览">
          <article>
            <span>12</span>
            <p>完整造型<br />SIGNATURE LOOKS</p>
          </article>
          <article>
            <span>03</span>
            <p>核心材料<br />CORE MATERIALS</p>
          </article>
          <article>
            <span>01</span>
            <p>统一廓形系统<br />SILHOUETTE SYSTEM</p>
          </article>
        </div>
      </section>

      <section className="looks" id="looks" aria-labelledby="looks-title">
        <div className="looks-head">
          <div className="section-marker section-marker--light">
            <span>03</span>
            <p>SELECTED LOOKS / 精选造型</p>
          </div>
          <h2 id="looks-title">造型<br /><i>索引</i></h2>
          <p>同一套设计语言，在剪裁、悬垂与透明度之间切换。</p>
        </div>

        <div className="look-grid">
          <article className="look-card look-card--wide">
            <div className="look-image">
              <img src="/images/lookbook-duo.webp" alt="Look 01 与 Look 02 双人系列造型" width="1536" height="1024" />
              <span className="look-tag">EDITOR&apos;S PICK</span>
            </div>
            <div className="look-meta">
              <span>LOOK 01—02</span>
              <h3>Axis / 轴线</h3>
              <p>精确肩线与错位门襟，建立身体的新坐标。</p>
            </div>
          </article>

          <article className="look-card look-card--portrait look-card--left">
            <div className="look-image">
              <img src="/images/lookbook-duo.webp" alt="象牙白不对称剪裁造型" width="1536" height="1024" />
              <span className="look-number">04</span>
            </div>
            <div className="look-meta">
              <span>LOOK 04</span>
              <h3>Cut / 切面</h3>
              <p>象牙白结构沿身体斜向展开。</p>
            </div>
          </article>

          <article className="look-card look-card--portrait look-card--right">
            <div className="look-image">
              <img src="/images/lookbook-duo.webp" alt="深酒红流动长裙造型" width="1536" height="1024" />
              <span className="look-number">08</span>
            </div>
            <div className="look-meta">
              <span>LOOK 08</span>
              <h3>Fold / 褶变</h3>
              <p>酒红真丝在行走中改变体积。</p>
            </div>
          </article>
        </div>

        <div className="looks-foot">
          <p>12 LOOKS / 01 COLLECTION</p>
          <a href="#craft">继续探索工艺 <span>↘</span></a>
        </div>
      </section>

      <PublishedArchive />

      <section className="manifesto" aria-label="系列宣言">
        <p>WEAR THE</p>
        <p>SPACE <em>BETWEEN</em></p>
        <p>BODY &amp; FORM.</p>
        <span>穿上身体与形态之间的空间。</span>
      </section>

      <section className="craft" id="craft" aria-labelledby="craft-title">
        <div className="craft-image-wrap">
          <span>MATERIAL STUDY / 01</span>
          <img
            src="/images/material-detail.webp"
            alt="黑色羊毛、酒红真丝与半透明薄膜的工艺细节"
            width="1254"
            height="1254"
          />
        </div>

        <div className="craft-content">
          <div className="section-marker section-marker--light">
            <span>04</span>
            <p>ATELIER NOTES / 工艺笔记</p>
          </div>
          <h2 id="craft-title">材料，<br /><i>成为结构。</i></h2>
          <p className="craft-intro">
            触感与技术不再对立。传统羊毛、液态真丝与透明技术薄膜被组合为
            可弯折、可呼吸，也会回应光线的表面。
          </p>

          <div className="material-list">
            <details open>
              <summary><span>01</span><strong>STRUCTURAL WOOL / 结构羊毛</strong><i>＋</i></summary>
              <p>以双层压衬保持锐利折面，在肩部与腰部构成稳定支点。</p>
            </details>
            <details>
              <summary><span>02</span><strong>LIQUID SILK / 液态真丝</strong><i>＋</i></summary>
              <p>偏斜裁剪让酒红丝面沿动作移动，平衡硬朗轮廓。</p>
            </details>
            <details>
              <summary><span>03</span><strong>TECH FILM / 技术薄膜</strong><i>＋</i></summary>
              <p>半透明夹层捕捉钴蓝反光，以酸橙明线完成手工固定。</p>
            </details>
          </div>
        </div>
      </section>

      <section className="about" id="about" aria-labelledby="about-title">
        <div className="about-no">05 / NÉRA</div>
        <h2 id="about-title">
          <span>RETHINK</span>
          <span>THE <i>BOUNDARY.</i></span>
        </h2>
        <div className="about-grid">
          <p className="about-lead">
            NÉRA 是一次关于边界的练习：<br />精密但不僵硬，未来感却依然保留手的温度。
          </p>
          <p>
            每一件作品都从一条人体轴线开始，再通过切割、折叠与悬垂让空间进入服装。
            系列拒绝固定答案，只提供继续变化的可能。
          </p>
          <a href="#top">回到开场 <span>↑</span></a>
        </div>
      </section>

      <footer>
        <div className="footer-brand">NÉRA <span>ATELIER</span></div>
        <p>SECOND SKIN / AUTUMN—WINTER 2027</p>
        <p>FASHION DESIGN SHOWCASE</p>
        <div className="footer-links">
          <Link href="/collections">VIEW COLLECTIONS →</Link>
          <Link href="/press">PRESS ROOM →</Link>
          <Link href="/exhibitions/latest">VIRTUAL EXHIBITION →</Link>
          <a href="/studio">STUDIO LOGIN →</a>
        </div>
        <div className="footer-bottom">
          <span>© 2027 NÉRA ATELIER</span>
          <span>DESIGNED AROUND THE BODY</span>
        </div>
      </footer>
    </main>
  );
}

function splitHeroTitle(value: string): [string, string] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [words[0] || "NÉRA", "COLLECTION"];
  const pivot = Math.ceil(words.length / 2);
  return [words.slice(0, pivot).join(" "), words.slice(pivot).join(" ")];
}
