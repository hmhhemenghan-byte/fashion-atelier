import type {
  Collection,
  Publication,
  Work,
  WorkImage,
  WorkProcessEntry,
} from "@/db/schema";
import {
  listAllCollectionAssignments,
  listAllCollections,
} from "@/lib/collections";
import { listAllWorkProcessEntries } from "@/lib/process";
import { processStageMeta } from "@/lib/process-stages";
import {
  getPublicationPreflight,
  listAllPublications,
} from "@/lib/publications";
import { listAllWorkImages, listAllWorks, mediaUrl } from "@/lib/works";

export type EditorialSeverity = "critical" | "warning" | "note";
export type MediaAssetKind =
  | "work"
  | "gallery"
  | "process"
  | "collection";

export type EditorialIssue = {
  id: string;
  severity: EditorialSeverity;
  area: string;
  title: string;
  detail: string;
  href: string;
};

export type EditorialPipelineStage = {
  id: "intake" | "curate" | "document" | "publish";
  number: string;
  label: string;
  english: string;
  complete: number;
  total: number;
  progress: number;
  href: string;
};

export type EditorialActivity = {
  id: string;
  type: string;
  title: string;
  detail: string;
  updatedAt: string;
  href: string;
};

export type MediaAsset = {
  id: string;
  kind: MediaAssetKind;
  sourceLabel: string;
  title: string;
  context: string;
  altText: string;
  imageKey: string;
  imageUrl: string;
  imageType: string;
  imageSize: number;
  status: "draft" | "published";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  editEndpoint: string;
  editTitleKey: "title" | "label" | null;
  editTitleLabel: string | null;
  previewHref: string;
  studioHref: string;
};

export type EditorialOverview = {
  generatedAt: string;
  score: number;
  summary: {
    works: {
      total: number;
      draft: number;
      published: number;
      unassigned: number;
    };
    collections: {
      total: number;
      draft: number;
      published: number;
      featured: number;
    };
    process: {
      total: number;
      draft: number;
      published: number;
      withImage: number;
    };
    publications: {
      total: number;
      draft: number;
      scheduled: number;
      published: number;
      ready: number;
    };
    media: {
      total: number;
      imageBytes: number;
      missingAlt: number;
      altCoverage: number;
    };
  };
  pipeline: EditorialPipelineStage[];
  issues: EditorialIssue[];
  activities: EditorialActivity[];
  assets: MediaAsset[];
};

export async function getEditorialOverview(): Promise<EditorialOverview> {
  const [
    workRows,
    galleryRows,
    processRows,
    collectionRows,
    assignmentRows,
    publicationRows,
  ] = await Promise.all([
    listAllWorks(1000),
    listAllWorkImages(),
    listAllWorkProcessEntries(),
    listAllCollections(1000),
    listAllCollectionAssignments(),
    listAllPublications(1000),
  ]);

  const workById = new Map(workRows.map((work) => [work.id, work]));
  const collectionById = new Map(
    collectionRows.map((collection) => [collection.id, collection]),
  );
  const galleryByWork = groupBy(galleryRows, (image) => image.workId);
  const processByWork = groupBy(processRows, (entry) => entry.workId);
  const assignmentsByWork = groupBy(
    assignmentRows,
    (assignment) => assignment.workId,
  );
  const assignmentsByCollection = groupBy(
    assignmentRows,
    (assignment) => assignment.collectionId,
  );
  const publicationByCollection = new Map(
    publicationRows.map((publication) => [
      publication.collectionId,
      publication,
    ]),
  );

  const preflightByPublication = new Map(
    publicationRows.map((publication) => {
      const collection =
        collectionById.get(publication.collectionId) ?? null;
      const lineup = (assignmentsByCollection.get(publication.collectionId) ?? [])
        .map((assignment) => workById.get(assignment.workId))
        .filter((work): work is Work => Boolean(work))
        .map((work) => ({ work }));
      return [
        publication.id,
        getPublicationPreflight(publication, collection, lineup),
      ];
    }),
  );

  const assets = buildAssets({
    workRows,
    galleryRows,
    processRows,
    collectionRows,
    workById,
  }).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  const issues = buildIssues({
    workRows,
    processRows,
    collectionRows,
    publicationRows,
    galleryByWork,
    processByWork,
    assignmentsByWork,
    assignmentsByCollection,
    publicationByCollection,
    preflightByPublication,
    assets,
  });

  const criticalCount = issues.filter(
    (issue) => issue.severity === "critical",
  ).length;
  const warningCount = issues.filter(
    (issue) => issue.severity === "warning",
  ).length;
  const noteCount = issues.filter(
    (issue) => issue.severity === "note",
  ).length;
  const hasEditorialInventory =
    workRows.length + collectionRows.length + processRows.length > 0;
  const score = hasEditorialInventory
    ? Math.max(
        0,
        100 -
          Math.min(60, criticalCount * 12) -
          Math.min(30, warningCount * 4) -
          Math.min(10, noteCount),
      )
    : 0;

  const publishedWorks = countStatus(workRows, "published");
  const publishedCollections = countStatus(collectionRows, "published");
  const publishedProcess = countStatus(processRows, "published");
  const publicReleases = publicationRows.filter(
    (publication) =>
      publication.status === "published" ||
      publication.status === "scheduled",
  ).length;
  const readyPublications = publicationRows.filter(
    (publication) =>
      preflightByPublication.get(publication.id)?.readyToPublish,
  ).length;
  const missingAlt = assets.filter((asset) => !asset.altText.trim()).length;

  return {
    generatedAt: new Date().toISOString(),
    score,
    summary: {
      works: {
        total: workRows.length,
        draft: countStatus(workRows, "draft"),
        published: publishedWorks,
        unassigned: workRows.filter(
          (work) => !(assignmentsByWork.get(work.id) ?? []).length,
        ).length,
      },
      collections: {
        total: collectionRows.length,
        draft: countStatus(collectionRows, "draft"),
        published: publishedCollections,
        featured: collectionRows.filter((collection) => collection.featured)
          .length,
      },
      process: {
        total: processRows.length,
        draft: countStatus(processRows, "draft"),
        published: publishedProcess,
        withImage: processRows.filter((entry) => entry.imageKey).length,
      },
      publications: {
        total: publicationRows.length,
        draft: publicationRows.filter(
          (publication) => publication.status === "draft",
        ).length,
        scheduled: publicationRows.filter(
          (publication) => publication.status === "scheduled",
        ).length,
        published: publicationRows.filter(
          (publication) => publication.status === "published",
        ).length,
        ready: readyPublications,
      },
      media: {
        total: assets.length,
        imageBytes: assets.reduce(
          (total, asset) => total + asset.imageSize,
          0,
        ),
        missingAlt,
        altCoverage:
          assets.length === 0
            ? 100
            : Math.round(((assets.length - missingAlt) / assets.length) * 100),
      },
    },
    pipeline: [
      pipelineStage(
        "intake",
        "01",
        "作品录入",
        "INTAKE",
        publishedWorks,
        workRows.length,
        "#work-library",
      ),
      pipelineStage(
        "curate",
        "02",
        "系列策展",
        "CURATE",
        publishedCollections,
        collectionRows.length,
        "#collection-system",
      ),
      pipelineStage(
        "document",
        "03",
        "过程记录",
        "DOCUMENT",
        publishedProcess,
        processRows.length,
        "#work-library",
      ),
      pipelineStage(
        "publish",
        "04",
        "专业发布",
        "PUBLISH",
        publicReleases,
        publicationRows.length,
        "#publication-center",
      ),
    ],
    issues,
    activities: buildActivities({
      workRows,
      processRows,
      collectionRows,
      publicationRows,
      workById,
      collectionById,
    }),
    assets,
  };
}

function buildAssets({
  workRows,
  galleryRows,
  processRows,
  collectionRows,
  workById,
}: {
  workRows: Work[];
  galleryRows: WorkImage[];
  processRows: WorkProcessEntry[];
  collectionRows: Collection[];
  workById: Map<string, Work>;
}): MediaAsset[] {
  const workAssets: MediaAsset[] = workRows.map((work) => ({
    id: `work:${work.id}`,
    kind: "work",
    sourceLabel: "作品主图",
    title: work.title,
    context: [work.collection, work.lookNumber].filter(Boolean).join(" · "),
    altText: work.altText,
    imageKey: work.imageKey,
    imageUrl: mediaUrl(work.imageKey),
    imageType: work.imageType,
    imageSize: work.imageSize,
    status: work.status,
    sortOrder: work.sortOrder,
    createdAt: work.createdAt,
    updatedAt: work.updatedAt,
    editEndpoint: `/api/studio/works/${encodeURIComponent(work.id)}`,
    editTitleKey: "title",
    editTitleLabel: "作品名称",
    previewHref: `/works/${encodeURIComponent(work.id)}`,
    studioHref: `#work-${encodeURIComponent(work.id)}`,
  }));

  const galleryAssets: MediaAsset[] = galleryRows.flatMap((image) => {
    const work = workById.get(image.workId);
    if (!work) return [];
    return [
      {
        id: `gallery:${image.id}`,
        kind: "gallery",
        sourceLabel: "作品细节图",
        title: image.label || "DETAIL",
        context: work.title,
        altText: image.altText,
        imageKey: image.imageKey,
        imageUrl: mediaUrl(image.imageKey),
        imageType: image.imageType,
        imageSize: image.imageSize,
        status: work.status,
        sortOrder: image.sortOrder,
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
        editEndpoint: `/api/studio/works/${encodeURIComponent(work.id)}/gallery/${encodeURIComponent(image.id)}`,
        editTitleKey: "label" as const,
        editTitleLabel: "细节标签",
        previewHref: `/works/${encodeURIComponent(work.id)}`,
        studioHref: `#work-${encodeURIComponent(work.id)}`,
      },
    ];
  });

  const processAssets: MediaAsset[] = processRows.flatMap((entry) => {
    const work = workById.get(entry.workId);
    if (!work || !entry.imageKey || !entry.imageType || !entry.imageSize) {
      return [];
    }
    const stage = processStageMeta(entry.stage);
    return [
      {
        id: `process:${entry.id}`,
        kind: "process",
        sourceLabel: `${stage.english} / ${stage.label}`,
        title: entry.title,
        context: work.title,
        altText: entry.altText,
        imageKey: entry.imageKey,
        imageUrl: mediaUrl(entry.imageKey),
        imageType: entry.imageType,
        imageSize: entry.imageSize,
        status: entry.status,
        sortOrder: entry.sortOrder,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        editEndpoint: `/api/studio/works/${encodeURIComponent(work.id)}/process/${encodeURIComponent(entry.id)}`,
        editTitleKey: "title" as const,
        editTitleLabel: "记录标题",
        previewHref: `/works/${encodeURIComponent(work.id)}/process?preview=1`,
        studioHref: `#work-${encodeURIComponent(work.id)}`,
      },
    ];
  });

  const collectionAssets: MediaAsset[] = collectionRows.flatMap(
    (collection) => {
      if (
        !collection.heroImageKey ||
        !collection.heroImageType ||
        !collection.heroImageSize
      ) {
        return [];
      }
      return [
        {
          id: `collection:${collection.id}`,
          kind: "collection",
          sourceLabel: "系列封面",
          title: collection.title,
          context: [collection.season, collection.year]
            .filter(Boolean)
            .join(" · "),
          altText: collection.heroAltText,
          imageKey: collection.heroImageKey,
          imageUrl: mediaUrl(collection.heroImageKey),
          imageType: collection.heroImageType,
          imageSize: collection.heroImageSize,
          status: collection.status,
          sortOrder: collection.sortOrder,
          createdAt: collection.createdAt,
          updatedAt: collection.updatedAt,
          editEndpoint: `/api/studio/collections/${encodeURIComponent(collection.id)}`,
          editTitleKey: null,
          editTitleLabel: null,
          previewHref: `/collections/${encodeURIComponent(collection.slug)}`,
          studioHref: `#collection-${encodeURIComponent(collection.id)}`,
        },
      ];
    },
  );

  return [
    ...workAssets,
    ...galleryAssets,
    ...processAssets,
    ...collectionAssets,
  ];
}

function buildIssues({
  workRows,
  processRows,
  collectionRows,
  publicationRows,
  galleryByWork,
  processByWork,
  assignmentsByWork,
  assignmentsByCollection,
  publicationByCollection,
  preflightByPublication,
  assets,
}: {
  workRows: Work[];
  processRows: WorkProcessEntry[];
  collectionRows: Collection[];
  publicationRows: Publication[];
  galleryByWork: Map<string, WorkImage[]>;
  processByWork: Map<string, WorkProcessEntry[]>;
  assignmentsByWork: Map<string, Array<{ workId: string }>>;
  assignmentsByCollection: Map<string, Array<{ collectionId: string }>>;
  publicationByCollection: Map<string, Publication>;
  preflightByPublication: Map<
    string,
    ReturnType<typeof getPublicationPreflight>
  >;
  assets: MediaAsset[];
}): EditorialIssue[] {
  const issues: EditorialIssue[] = [];
  const add = (
    id: string,
    severity: EditorialSeverity,
    area: string,
    title: string,
    detail: string,
    href: string,
  ) => issues.push({ id, severity, area, title, detail, href });

  workRows.forEach((work) => {
    const workHref = `#work-${encodeURIComponent(work.id)}`;
    const assignments = assignmentsByWork.get(work.id) ?? [];
    const gallery = galleryByWork.get(work.id) ?? [];
    const processEntries = processByWork.get(work.id) ?? [];
    if (work.status === "published" && work.description.trim().length < 40) {
      add(
        `work:${work.id}:description`,
        "warning",
        "WORK",
        `${work.title} 的说明过短`,
        "公开作品建议补充设计命题、材料或廓形信息。",
        workHref,
      );
    }
    if (work.status === "published" && !work.lookNumber.trim()) {
      add(
        `work:${work.id}:look`,
        "warning",
        "WORK",
        `${work.title} 缺少 Look 编号`,
        "编号会用于系列、Lookbook 与媒体资料的交叉引用。",
        workHref,
      );
    }
    if (work.status === "published" && assignments.length === 0) {
      add(
        `work:${work.id}:collection`,
        "critical",
        "CURATION",
        `${work.title} 尚未编入系列`,
        "已发布作品未进入任何 Collection，无法形成完整叙事。",
        "#collection-system",
      );
    }
    if (work.status === "published" && gallery.length === 0) {
      add(
        `work:${work.id}:gallery`,
        "note",
        "MEDIA",
        `${work.title} 只有一张主图`,
        "可补充背面、侧面、工艺或面料细节图。",
        workHref,
      );
    }
    if (work.status === "published" && processEntries.length === 0) {
      add(
        `work:${work.id}:process`,
        "note",
        "PROCESS",
        `${work.title} 尚无过程档案`,
        "添加研究、草图、材料、试衣或制作记录以完善档案。",
        workHref,
      );
    }
  });

  collectionRows.forEach((collection) => {
    if (collection.status !== "published") return;
    const href = `#collection-${encodeURIComponent(collection.id)}`;
    const assignments =
      assignmentsByCollection.get(collection.id) ?? [];
    if (!collection.statement.trim()) {
      add(
        `collection:${collection.id}:statement`,
        "critical",
        "COLLECTION",
        `${collection.title} 缺少系列宣言`,
        "公开系列需要明确的核心命题与设计立场。",
        href,
      );
    }
    if (assignments.length === 0) {
      add(
        `collection:${collection.id}:lineup`,
        "critical",
        "COLLECTION",
        `${collection.title} 没有 Look 编排`,
        "至少加入一件作品后再作为完整系列公开。",
        href,
      );
    }
    if (!collection.heroImageKey && assignments.length === 0) {
      add(
        `collection:${collection.id}:hero`,
        "critical",
        "MEDIA",
        `${collection.title} 缺少主视觉`,
        "上传系列封面或先配置可作为主视觉的 Look。",
        href,
      );
    }
    if (!publicationByCollection.has(collection.id)) {
      add(
        `collection:${collection.id}:publication`,
        "warning",
        "PUBLISHING",
        `${collection.title} 尚无官方发布包`,
        "创建 Publication 后可进入 Press Room 并交付媒体资料。",
        "#publication-center",
      );
    }
  });

  processRows.forEach((entry) => {
    if (
      entry.status === "published" &&
      entry.notes.trim().length < 30
    ) {
      add(
        `process:${entry.id}:notes`,
        "warning",
        "PROCESS",
        `${entry.title} 的过程说明过短`,
        "公开记录建议说明选择、变化或制作判断。",
        `#work-${encodeURIComponent(entry.workId)}`,
      );
    }
  });

  publicationRows.forEach((publication) => {
    const preflight = preflightByPublication.get(publication.id);
    if (!preflight || preflight.readyToPublish) return;
    add(
      `publication:${publication.id}:preflight`,
      publication.status === "draft" ? "warning" : "critical",
      "PUBLISHING",
      `${publication.headline} 未通过发布预检`,
      preflight.issues.slice(0, 3).join("；"),
      `#publication-${encodeURIComponent(publication.id)}`,
    );
  });

  assets
    .filter((asset) => !asset.altText.trim())
    .forEach((asset) =>
      add(
        `asset:${asset.id}:alt`,
        "critical",
        "ACCESSIBILITY",
        `${asset.title} 缺少图片描述`,
        `${asset.sourceLabel}需要准确的无障碍替代文本。`,
        "#media-index",
      ),
    );

  return issues
    .sort((left, right) => {
      const severityOrder: Record<EditorialSeverity, number> = {
        critical: 0,
        warning: 1,
        note: 2,
      };
      return (
        severityOrder[left.severity] - severityOrder[right.severity] ||
        left.title.localeCompare(right.title)
      );
    })
    .slice(0, 60);
}

function buildActivities({
  workRows,
  processRows,
  collectionRows,
  publicationRows,
  workById,
  collectionById,
}: {
  workRows: Work[];
  processRows: WorkProcessEntry[];
  collectionRows: Collection[];
  publicationRows: Publication[];
  workById: Map<string, Work>;
  collectionById: Map<string, Collection>;
}): EditorialActivity[] {
  return [
    ...workRows.map((work) => ({
      id: `work:${work.id}`,
      type: "WORK",
      title: work.title,
      detail: work.status === "published" ? "作品已发布" : "作品草稿",
      updatedAt: work.updatedAt,
      href: `#work-${encodeURIComponent(work.id)}`,
    })),
    ...collectionRows.map((collection) => ({
      id: `collection:${collection.id}`,
      type: "COLLECTION",
      title: collection.title,
      detail:
        collection.status === "published" ? "系列已发布" : "系列草稿",
      updatedAt: collection.updatedAt,
      href: `#collection-${encodeURIComponent(collection.id)}`,
    })),
    ...processRows.map((entry) => ({
      id: `process:${entry.id}`,
      type: processStageMeta(entry.stage).english,
      title: entry.title,
      detail: `${workById.get(entry.workId)?.title || "未知作品"} · ${
        entry.status === "published" ? "已公开" : "草稿"
      }`,
      updatedAt: entry.updatedAt,
      href: `#work-${encodeURIComponent(entry.workId)}`,
    })),
    ...publicationRows.map((publication) => ({
      id: `publication:${publication.id}`,
      type: "RELEASE",
      title: publication.headline,
      detail: `${
        collectionById.get(publication.collectionId)?.title || "未知系列"
      } · ${publication.status.toUpperCase()}`,
      updatedAt: publication.updatedAt,
      href: `#publication-${encodeURIComponent(publication.id)}`,
    })),
  ]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 10);
}

function pipelineStage(
  id: EditorialPipelineStage["id"],
  number: string,
  label: string,
  english: string,
  complete: number,
  total: number,
  href: string,
): EditorialPipelineStage {
  return {
    id,
    number,
    label,
    english,
    complete,
    total,
    progress: total === 0 ? 0 : Math.round((complete / total) * 100),
    href,
  };
}

function countStatus<T extends { status: string }>(
  rows: T[],
  status: string,
) {
  return rows.filter((row) => row.status === status).length;
}

function groupBy<T, K extends string>(
  rows: T[],
  key: (row: T) => K,
): Map<K, T[]> {
  const grouped = new Map<K, T[]>();
  rows.forEach((row) => {
    const value = key(row);
    grouped.set(value, [...(grouped.get(value) ?? []), row]);
  });
  return grouped;
}
