"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

type LookbookLook = {
  id: string;
  title: string;
  lookNumber: string;
  description: string;
  imageUrl: string;
  altText: string;
  featured: boolean;
};

type LookbookViewerProps = {
  collection: {
    title: string;
    subtitle: string;
    label: string;
    statement: string;
    heroImage: string;
    heroAltText: string;
  };
  looks: LookbookLook[];
  dossierHref: string;
  archiveHref: string;
  draftPreview?: boolean;
};

const interactiveSelector = "a, button, input, textarea, select, summary";

export default function LookbookViewer({
  collection,
  looks,
  dossierHref,
  archiveHref,
  draftPreview = false,
}: LookbookViewerProps) {
  const finalSlide = looks.length + 1;
  const [current, setCurrent] = useState(0);
  const [indexOpen, setIndexOpen] = useState(false);
  const pointerStart = useRef<number | null>(null);
  const lastWheelAt = useRef(0);

  const goTo = useCallback(
    (next: number) => {
      setCurrent(Math.min(Math.max(next, 0), finalSlide));
    },
    [finalSlide],
  );

  const goPrevious = useCallback(() => goTo(current - 1), [current, goTo]);
  const goNext = useCallback(() => goTo(current + 1), [current, goTo]);

  useEffect(() => {
    const requestedHash = window.location.hash;
    const frame = window.requestAnimationFrame(() => {
      const match = requestedHash.match(/^#look-(\d+)$/);
      if (match) {
        goTo(Number.parseInt(match[1], 10));
      } else if (requestedHash === "#end") {
        goTo(finalSlide);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [finalSlide, goTo]);

  useEffect(() => {
    const hash =
      current === 0
        ? "#cover"
        : current === finalSlide
          ? "#end"
          : `#look-${String(current).padStart(2, "0")}`;
    window.history.replaceState(null, "", hash);
  }, [current, finalSlide]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest(interactiveSelector)) {
        if (event.key === "Escape" && indexOpen) setIndexOpen(false);
        return;
      }

      if (event.key === "Escape" && indexOpen) {
        event.preventDefault();
        setIndexOpen(false);
        return;
      }

      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        goNext();
      }
      if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) {
        event.preventDefault();
        goPrevious();
      }
      if (event.key === "Home") {
        event.preventDefault();
        goTo(0);
      }
      if (event.key === "End") {
        event.preventDefault();
        goTo(finalSlide);
      }
      if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        setIndexOpen((open) => !open);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [finalSlide, goNext, goPrevious, goTo, indexOpen]);

  function handleWheel(event: ReactWheelEvent<HTMLElement>) {
    if (indexOpen || Math.abs(event.deltaY) < 28) return;
    const now = Date.now();
    if (now - lastWheelAt.current < 700) return;
    lastWheelAt.current = now;
    if (event.deltaY > 0) goNext();
    else goPrevious();
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    pointerStart.current = event.clientX;
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (pointerStart.current === null || indexOpen) return;
    const distance = event.clientX - pointerStart.current;
    pointerStart.current = null;
    if (Math.abs(distance) < 56) return;
    if (distance < 0) goNext();
    else goPrevious();
  }

  function handleStageKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" && current === 0) goNext();
  }

  const currentLook =
    current > 0 && current <= looks.length ? looks[current - 1] : null;
  const spreadVariant = currentLook ? (current - 1) % 4 : 0;
  const progress = finalSlide === 0 ? 0 : (current / finalSlide) * 100;

  return (
    <main
      className={`lookbook-viewer lookbook-viewer--spread-${spreadVariant}`}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onKeyDown={handleStageKeyDown}
      aria-label={`${collection.title} Digital Lookbook`}
    >
      <header className="lookbook-header">
        <Link className="lookbook-brand" href="/">
          NÉRA <span>ATELIER</span>
        </Link>
        <div className="lookbook-collection-id">
          <span>DIGITAL LOOKBOOK</span>
          <strong>{collection.title}</strong>
        </div>
        <div className="lookbook-header-actions">
          <button
            type="button"
            onClick={() => setIndexOpen(true)}
            aria-expanded={indexOpen}
            aria-controls="lookbook-index"
          >
            INDEX
          </button>
          <Link href={dossierHref}>CLOSE ×</Link>
        </div>
      </header>

      <div
        className="lookbook-progress"
        aria-label={`Lookbook progress ${Math.round(progress)}%`}
      >
        <span style={{ width: `${progress}%` }} />
      </div>

      <section className="lookbook-stage" aria-live="polite">
        {current === 0 && (
          <article className="lookbook-cover">
            <img src={collection.heroImage} alt={collection.heroAltText} />
            <div className="lookbook-cover-shade" />
            <div className="lookbook-cover-copy">
              <p>{collection.label || "NÉRA COLLECTION"}</p>
              <h1>{collection.title}</h1>
              {collection.subtitle && <strong>{collection.subtitle}</strong>}
              <button type="button" onClick={goNext} disabled={looks.length === 0}>
                {looks.length > 0 ? "START LOOKBOOK" : "LOOKBOOK IN CURATION"}
                <span>→</span>
              </button>
            </div>
            <div className="lookbook-cover-note">
              <span>{String(looks.length).padStart(2, "0")} LOOKS</span>
              <p>Use arrows, swipe or scroll<br />方向键、滑动或滚轮切换</p>
            </div>
            {draftPreview && (
              <b className="lookbook-draft">DRAFT PREVIEW / 草稿预览</b>
            )}
          </article>
        )}

        {currentLook && (
          <article
            key={currentLook.id}
            className={`lookbook-spread lookbook-spread--${spreadVariant}`}
            aria-labelledby={`lookbook-title-${currentLook.id}`}
          >
            <figure className="lookbook-spread-image">
              <img src={currentLook.imageUrl} alt={currentLook.altText} />
              <figcaption>
                {currentLook.lookNumber ||
                  `LOOK ${String(current).padStart(2, "0")}`}
              </figcaption>
            </figure>

            <div className="lookbook-spread-copy">
              <p className="lookbook-spread-kicker">
                {collection.title} /{" "}
                {String(current).padStart(2, "0")} OF{" "}
                {String(looks.length).padStart(2, "0")}
              </p>
              <h1 id={`lookbook-title-${currentLook.id}`}>
                {currentLook.title}
              </h1>
              <p className="lookbook-spread-description">
                {currentLook.description ||
                  "造型从身体轴线展开，在静止的结构与行走的流动之间建立新的比例。"}
              </p>
              <dl>
                <div>
                  <dt>LOOK</dt>
                  <dd>
                    {currentLook.lookNumber ||
                      String(current).padStart(2, "0")}
                  </dd>
                </div>
                <div>
                  <dt>EDITION</dt>
                  <dd>{collection.label || "NÉRA COLLECTION"}</dd>
                </div>
              </dl>
              <Link href={`/works/${encodeURIComponent(currentLook.id)}`}>
                VIEW FULL DOSSIER <span>↗</span>
              </Link>
            </div>

            <span className="lookbook-spread-number" aria-hidden="true">
              {String(current).padStart(2, "0")}
            </span>
            {currentLook.featured && (
              <strong className="lookbook-selected">SELECTED LOOK</strong>
            )}
          </article>
        )}

        {current === finalSlide && (
          <article className="lookbook-end">
            <div>
              <p>END OF DIGITAL LOOKBOOK</p>
              <h1>
                THE BODY
                <br />
                <i>CONTINUES.</i>
              </h1>
            </div>
            <blockquote>
              {collection.statement ||
                "服装不是覆盖身体，而是身体运动留下的轨迹。"}
            </blockquote>
            <div className="lookbook-end-actions">
              <Link href={dossierHref}>
                <span>RETURN TO</span>
                <strong>COLLECTION DOSSIER</strong>
                <i>→</i>
              </Link>
              <Link href={archiveHref}>
                <span>EXPLORE</span>
                <strong>ALL COLLECTIONS</strong>
                <i>↗</i>
              </Link>
            </div>
          </article>
        )}
      </section>

      <footer className="lookbook-controls">
        <button
          type="button"
          onClick={goPrevious}
          disabled={current === 0}
          aria-label="Previous spread"
        >
          <span>←</span> PREV
        </button>
        <div aria-live="off">
          <strong>{String(current).padStart(2, "0")}</strong>
          <span>/</span>
          <span>{String(finalSlide).padStart(2, "0")}</span>
        </div>
        <button
          type="button"
          onClick={goNext}
          disabled={current === finalSlide || (current === 0 && looks.length === 0)}
          aria-label="Next spread"
        >
          NEXT <span>→</span>
        </button>
      </footer>

      {indexOpen && (
        <aside className="lookbook-index" id="lookbook-index" aria-label="Lookbook index">
          <header>
            <div>
              <span>LOOKBOOK INDEX / 造型目录</span>
              <h2>{collection.title}</h2>
            </div>
            <button type="button" onClick={() => setIndexOpen(false)} autoFocus>
              CLOSE ×
            </button>
          </header>
          <div className="lookbook-index-grid">
            {looks.map((look, index) => (
              <button
                type="button"
                key={look.id}
                className={current === index + 1 ? "is-current" : ""}
                onClick={() => {
                  goTo(index + 1);
                  setIndexOpen(false);
                }}
              >
                <span>
                  <img src={look.imageUrl} alt="" loading="lazy" />
                  <i>{String(index + 1).padStart(2, "0")}</i>
                </span>
                <strong>{look.lookNumber || `LOOK ${String(index + 1).padStart(2, "0")}`}</strong>
                <small>{look.title}</small>
              </button>
            ))}
          </div>
        </aside>
      )}
    </main>
  );
}
