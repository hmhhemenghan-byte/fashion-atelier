import { and, asc, desc, eq, lte, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  publications,
  type Collection,
  type Publication,
  type Work,
} from "@/db/schema";
import { mediaUrl } from "@/lib/works";

export type PublicationLineupItem = {
  work: Work;
};

export type PublicationPreflight = {
  issues: string[];
  readyToPublish: boolean;
  readyToSchedule: boolean;
  scheduledIssue: string | null;
  publishedLooks: number;
  hasHero: boolean;
};

export async function listAllPublications(limit = 100) {
  const db = await getDb();
  return db
    .select()
    .from(publications)
    .orderBy(
      asc(publications.sortOrder),
      desc(publications.releaseAt),
      desc(publications.createdAt),
    )
    .limit(limit);
}

export async function listPublicPublications(limit = 50) {
  const db = await getDb();
  const now = new Date().toISOString();
  return db
    .select()
    .from(publications)
    .where(
      or(
        eq(publications.status, "published"),
        and(
          eq(publications.status, "scheduled"),
          lte(publications.releaseAt, now),
        ),
      ),
    )
    .orderBy(
      desc(publications.releaseAt),
      desc(publications.publishedAt),
      asc(publications.sortOrder),
    )
    .limit(limit);
}

export async function getPublicationById(id: string) {
  const db = await getDb();
  const [publication] = await db
    .select()
    .from(publications)
    .where(eq(publications.id, id))
    .limit(1);
  return publication ?? null;
}

export async function getPublicationBySlug(slug: string) {
  const db = await getDb();
  const [publication] = await db
    .select()
    .from(publications)
    .where(eq(publications.slug, slug))
    .limit(1);
  return publication ?? null;
}

export async function getPublicPublicationForCollection(collectionId: string) {
  const db = await getDb();
  const now = new Date().toISOString();
  const [publication] = await db
    .select()
    .from(publications)
    .where(
      and(
        eq(publications.collectionId, collectionId),
        or(
          eq(publications.status, "published"),
          and(
            eq(publications.status, "scheduled"),
            lte(publications.releaseAt, now),
          ),
        ),
      ),
    )
    .limit(1);
  return publication ?? null;
}

export function publicationIsPublic(
  publication: Publication,
  now = new Date(),
) {
  if (publication.status === "published") return true;
  if (publication.status !== "scheduled" || !publication.releaseAt) {
    return false;
  }
  const releaseTime = new Date(publication.releaseAt).getTime();
  return Number.isFinite(releaseTime) && releaseTime <= now.getTime();
}

export function publicationHeroUrl(
  collection: Collection,
  lineup: PublicationLineupItem[],
) {
  if (collection.heroImageKey) return mediaUrl(collection.heroImageKey);
  return lineup[0] ? mediaUrl(lineup[0].work.imageKey) : "/images/hero-fashion.webp";
}

export function publicationCredits(publication: Publication) {
  return [
    ["PHOTOGRAPHY", publication.photography],
    ["STYLING", publication.styling],
    ["CASTING", publication.casting],
    ["HAIR", publication.hair],
    ["MAKEUP", publication.makeup],
    ["PRODUCTION", publication.production],
  ].filter((item): item is [string, string] => Boolean(item[1]));
}

export function getPublicationPreflight(
  publication: Publication,
  collection: Collection | null,
  lineup: PublicationLineupItem[],
): PublicationPreflight {
  const issues: string[] = [];
  const publishedLooks = lineup.filter(
    (item) => item.work.status === "published",
  ).length;
  const hasHero = Boolean(collection?.heroImageKey || publishedLooks > 0);

  if (!collection) issues.push("选择一个有效系列");
  else if (collection.status !== "published") issues.push("先发布关联系列");
  if (publishedLooks === 0) issues.push("系列至少需要 1 件已发布 Look");
  if (!hasHero) issues.push("补充系列封面或已发布作品主图");
  if (!publication.headline.trim()) issues.push("填写发布标题");
  if (!publication.deck.trim()) issues.push("填写媒体摘要");
  if (publication.body.trim().length < 120) {
    issues.push("新闻稿正文至少 120 字");
  }
  if (!publication.city.trim()) issues.push("填写发布城市");
  if (!publication.releaseDate.trim()) issues.push("填写对外发布日期");
  if (!isEmail(publication.contactEmail)) issues.push("填写有效媒体联系邮箱");
  if (
    ![
      publication.photography,
      publication.styling,
      publication.casting,
      publication.hair,
      publication.makeup,
      publication.production,
    ].some((value) => value.trim())
  ) {
    issues.push("至少填写 1 项制作署名");
  }
  if (!publication.seoTitle.trim()) issues.push("填写 SEO 标题");
  if (!publication.seoDescription.trim()) issues.push("填写 SEO 描述");

  const scheduledTime = publication.releaseAt
    ? new Date(publication.releaseAt).getTime()
    : Number.NaN;
  const scheduledIssue =
    !Number.isFinite(scheduledTime)
      ? "设置有效的定时发布时间"
      : scheduledTime <= Date.now()
        ? "定时发布时间必须晚于当前时间"
        : null;

  return {
    issues,
    readyToPublish: issues.length === 0,
    readyToSchedule: issues.length === 0 && !scheduledIssue,
    scheduledIssue,
    publishedLooks,
    hasHero,
  };
}

export function normalizePublicationSlug(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
