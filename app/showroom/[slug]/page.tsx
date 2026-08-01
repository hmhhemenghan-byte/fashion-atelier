import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import ShowroomActions from "@/app/showroom/[slug]/showroom-actions";
import ShowroomPullList from "@/app/showroom/[slug]/showroom-pull-list";
import { isAdminEmail } from "@/lib/runtime";
import {
  getShowroomWorkspaceBySlug,
  verifyShowroomToken,
} from "@/lib/showrooms";
import { mediaUrl } from "@/lib/works";

export const dynamic = "force-dynamic";

type ShowroomPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ key?: string }>;
};

export const metadata: Metadata = {
  title: "Private Showroom — NÉRA ATELIER",
  description: "A private NÉRA ATELIER collection appointment.",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default async function ShowroomPage({
  params,
  searchParams,
}: ShowroomPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const workspace = await getShowroomWorkspaceBySlug(slug).catch(() => null);
  if (!workspace) notFound();

  const user = await getChatGPTUser();
  const adminPreview = Boolean(
    user && (await isAdminEmail(user.email)),
  );
  const tokenAccess = adminPreview
    ? false
    : await verifyShowroomToken(workspace.showroom, query.key);

  if (!adminPreview && !tokenAccess) {
    if (
      workspace.accessState === "closed" ||
      workspace.accessState === "expired"
    ) {
      return (
        <AccessScreen
          title="ACCESS WINDOW CLOSED"
          detail={
            workspace.accessState === "expired"
              ? "This private appointment has reached its scheduled closing time."
              : "This private appointment has been closed by the atelier."
          }
        />
      );
    }
    return <AccessGate slug={workspace.showroom.slug} />;
  }

  const { showroom, items } = workspace;
  const featured =
    items.find((item) => item.assignment.featured) ?? items[0] ?? null;
  const heroImage = featured
    ? mediaUrl(featured.work.imageKey)
    : "/images/hero-fashion.webp";
  const expiry = showroom.expiresAt
    ? formatDate(showroom.expiresAt)
    : "BY INVITATION";

  return (
    <main className="showroom-page">
      <header className="showroom-nav">
        <a className="showroom-brand" href="#top">
          NÉRA <span>ATELIER</span>
        </a>
        <div>
          <span>PRIVATE SHOWROOM</span>
          <strong>{showroom.audienceLabel}</strong>
        </div>
        <small>ACCESS · {showroom.accessTokenHint}</small>
      </header>

      <section className="showroom-hero" id="top">
        <figure>
          <img
            src={heroImage}
            alt={featured?.work.altText || `${showroom.title} showroom cover`}
          />
          <figcaption>
            <span>CURATED APPOINTMENT</span>
            <strong>
              {String(items.length).padStart(2, "0")} SELECTED LOOKS
            </strong>
          </figcaption>
        </figure>
        <div className="showroom-hero-copy">
          <span>{showroom.audienceLabel}</span>
          <h1>{showroom.title}</h1>
          {showroom.subtitle && <p>{showroom.subtitle}</p>}
          <ShowroomActions
            lineupId="private-lineup"
            allowDownloads={showroom.allowDownloads}
          />
        </div>
        <div className="showroom-confidential">
          <span>CONFIDENTIAL</span>
          <small>FOR APPOINTMENT USE ONLY</small>
        </div>
        {adminPreview && (
          <strong className="showroom-admin-preview">
            DESIGNER PREVIEW / {workspace.accessState.toUpperCase()}
          </strong>
        )}
      </section>

      <section className="showroom-introduction">
        <div>
          <span>01</span>
          <small>PRIVATE EDIT / 私享选辑</small>
        </div>
        <blockquote>
          {showroom.introduction ||
            "A focused edit prepared by NÉRA ATELIER for a private collection appointment."}
        </blockquote>
        <dl>
          <div>
            <dt>RECIPIENT</dt>
            <dd>{showroom.audienceLabel}</dd>
          </div>
          <div>
            <dt>ACCESS UNTIL</dt>
            <dd>{expiry}</dd>
          </div>
          <div>
            <dt>DOWNLOADS</dt>
            <dd>{showroom.allowDownloads ? "ENABLED" : "VIEW ONLY"}</dd>
          </div>
        </dl>
      </section>

      <section
        className="showroom-lineup"
        id="private-lineup"
        aria-labelledby="private-lineup-title"
      >
        <header>
          <div>
            <span>02 / LINE SHEET</span>
            <h2 id="private-lineup-title">
              THE PRIVATE<br />
              <i>SELECTION.</i>
            </h2>
          </div>
          <p>
            Each look remains connected to its atelier record. Notes and sample
            status belong to this appointment only.
          </p>
        </header>

        {items.length > 0 ? (
          <ShowroomPullList
            items={items}
            showroomSlug={showroom.slug}
            showroomTitle={showroom.title}
            accessKey={tokenAccess ? query.key || "" : ""}
            submissionEnabled={tokenAccess}
            allowDownloads={showroom.allowDownloads}
          />
        ) : (
          <div className="showroom-lineup-empty">
            <span>00</span>
            <strong>SELECTION IN PROGRESS</strong>
          </div>
        )}
      </section>

      <footer className="showroom-footer">
        <div>
          <span>PRIVATE APPOINTMENT</span>
          <strong>NÉRA ATELIER</strong>
        </div>
        <p>
          This edit is shared for review and professional conversation. Please
          contact the atelier before reproducing or publishing any visual.
        </p>
        {showroom.contactEmail ? (
          <a href={`mailto:${showroom.contactEmail}`}>
            {showroom.contactName || "ATELIER CONTACT"} ↗
          </a>
        ) : (
          <span>CONTACT VIA YOUR ATELIER REPRESENTATIVE</span>
        )}
      </footer>
    </main>
  );
}

function AccessGate(props: { slug: string }) {
  return (
    <main className="showroom-access">
      <header>
        <strong>NÉRA <span>ATELIER</span></strong>
        <small>PRIVATE SHOWROOM</small>
      </header>
      <section>
        <span>INVITATION REQUIRED</span>
        <h1>ENTER YOUR<br /><i>ACCESS KEY.</i></h1>
        <p>
          This collection edit is reserved for invited buyers, stylists and
          editorial partners.
        </p>
        <form action={`/showroom/${encodeURIComponent(props.slug)}`} method="get">
          <label>
            <span>PRIVATE ACCESS KEY</span>
            <input
              name="key"
              autoComplete="off"
              spellCheck={false}
              required
              placeholder="48-character access key"
            />
          </label>
          <button type="submit">ENTER SHOWROOM →</button>
        </form>
      </section>
      <footer>CONFIDENTIAL / NÉRA ATELIER</footer>
    </main>
  );
}

function AccessScreen(props: { title: string; detail: string }) {
  return (
    <main className="showroom-access is-closed">
      <header>
        <strong>NÉRA <span>ATELIER</span></strong>
        <small>PRIVATE SHOWROOM</small>
      </header>
      <section>
        <span>APPOINTMENT STATUS</span>
        <h1>{props.title}</h1>
        <p>{props.detail}</p>
      </section>
      <footer>CONTACT THE ATELIER FOR A NEW INVITATION</footer>
    </main>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  })
    .format(date)
    .toUpperCase();
}
