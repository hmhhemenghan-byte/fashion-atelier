"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  EditorialOverview,
  EditorialSeverity,
  MediaAsset,
  MediaAssetKind,
} from "@/lib/editorial-operations";

type ApiPayload = {
  overview?: EditorialOverview;
  error?: string;
};

type AssetKindFilter = "all" | MediaAssetKind;
type AssetStatusFilter = "all" | MediaAsset["status"];

const kindFilters: Array<{ value: AssetKindFilter; label: string }> = [
  { value: "all", label: "全部素材" },
  { value: "work", label: "作品主图" },
  { value: "gallery", label: "细节图" },
  { value: "process", label: "过程图" },
  { value: "collection", label: "系列封面" },
];

const severityLabels: Record<EditorialSeverity, string> = {
  critical: "必须处理",
  warning: "建议完善",
  note: "可继续增强",
};

export default function EditorialOperations() {
  const [overview, setOverview] = useState<EditorialOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [kindFilter, setKindFilter] = useState<AssetKindFilter>("all");
  const [statusFilter, setStatusFilter] =
    useState<AssetStatusFilter>("all");
  const [query, setQuery] = useState("");
  const [editingAssetId, setEditingAssetId] = useState<string | null>(
    null,
  );
  const [editTitle, setEditTitle] = useState("");
  const [editAltText, setEditAltText] = useState("");
  const [savingAssetId, setSavingAssetId] = useState<string | null>(
    null,
  );
  const [issueLimit, setIssueLimit] = useState(8);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const payload = await requestOverview();
        if (!cancelled) setOverview(payload);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "无法读取工作台总览。",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleAssets = useMemo(() => {
    if (!overview) return [];
    const needle = query.trim().toLocaleLowerCase();
    return overview.assets.filter((asset) => {
      if (kindFilter !== "all" && asset.kind !== kindFilter) return false;
      if (statusFilter !== "all" && asset.status !== statusFilter) {
        return false;
      }
      if (!needle) return true;
      return [
        asset.title,
        asset.context,
        asset.altText,
        asset.sourceLabel,
        asset.imageKey,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [kindFilter, overview, query, statusFilter]);

  async function refresh(successMessage = "") {
    setError("");
    if (successMessage) setMessage(successMessage);
    try {
      setOverview(await requestOverview());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "无法刷新工作台总览。",
      );
    }
  }

  function beginAssetEdit(asset: MediaAsset) {
    if (editingAssetId === asset.id) {
      setEditingAssetId(null);
      return;
    }
    setError("");
    setMessage("");
    setEditingAssetId(asset.id);
    setEditTitle(asset.title);
    setEditAltText(asset.altText);
  }

  async function saveAssetMetadata(
    event: React.FormEvent<HTMLFormElement>,
    asset: MediaAsset,
  ) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!editAltText.trim()) {
      setError("图片描述不能为空。");
      return;
    }
    if (asset.editTitleKey && !editTitle.trim()) {
      setError(`${asset.editTitleLabel || "名称"}不能为空。`);
      return;
    }

    const body: Record<string, string> = {
      altText: editAltText.trim(),
    };
    if (asset.editTitleKey) {
      body[asset.editTitleKey] = editTitle.trim();
    }

    setSavingAssetId(asset.id);
    try {
      const response = await fetch(asset.editEndpoint, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "素材资料保存失败。");
      }
      setEditingAssetId(null);
      await refresh("素材名称与无障碍描述已更新。");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "素材资料保存失败。",
      );
    } finally {
      setSavingAssetId(null);
    }
  }

  async function copyAssetUrl(asset: MediaAsset) {
    setError("");
    try {
      await navigator.clipboard.writeText(
        new URL(asset.imageUrl, window.location.origin).toString(),
      );
      setMessage(`已复制 ${asset.title} 的图片链接。`);
    } catch {
      setError("无法复制链接，请打开原图后从地址栏复制。");
    }
  }

  if (loading) {
    return (
      <section className="studio-operations is-loading">
        <p>正在建立 Editorial Operations 索引…</p>
      </section>
    );
  }

  if (!overview) {
    return (
      <section className="studio-operations is-loading">
        <p>{error || "工作台总览暂时不可用。"}</p>
        <button type="button" onClick={() => void refresh()}>
          重新读取
        </button>
      </section>
    );
  }

  const issueCounts = {
    critical: overview.issues.filter(
      (issue) => issue.severity === "critical",
    ).length,
    warning: overview.issues.filter(
      (issue) => issue.severity === "warning",
    ).length,
    note: overview.issues.filter((issue) => issue.severity === "note")
      .length,
  };
  const scoreLabel =
    overview.score >= 85
      ? "READY"
      : overview.score >= 60
        ? "REFINE"
        : "ATTENTION";

  return (
    <section
      className="studio-operations"
      id="editorial-operations"
      aria-labelledby="studio-operations-title"
    >
      <header className="studio-operations-head">
        <div>
          <span>05 / EDITORIAL OPERATIONS</span>
          <h2 id="studio-operations-title">
            检查。整理。<i>推进。</i>
          </h2>
        </div>
        <div className="studio-operations-score">
          <span>EDITORIAL READINESS</span>
          <strong>{String(overview.score).padStart(2, "0")}</strong>
          <small>{scoreLabel} / 100</small>
        </div>
        <p>
          把作品、系列、过程档案、发布包和所有已上传视觉素材汇总到同一张
          工作图上，优先处理影响公开交付的问题。
        </p>
      </header>

      <div className="studio-operations-toolbar">
        <div>
          <strong>
            {overview.issues.length === 0
              ? "ALL CHECKS CLEAR"
              : `${String(overview.issues.length).padStart(2, "0")} OPEN CHECKS`}
          </strong>
          <span>
            UPDATED {formatDateTime(overview.generatedAt).toUpperCase()}
          </span>
        </div>
        <nav aria-label="工作台快速入口">
          <a href="#editorial-calendar">编辑日历</a>
          <a href="#archive-handoff">交接归档</a>
          <a href="#private-showrooms">私享展厅</a>
          <a href="#work-upload">上传作品</a>
          <a href="#collection-system">系列系统</a>
          <a href="#publication-center">发布中心</a>
          <a href="/api/studio/overview?download=1">导出 QA</a>
          <button type="button" onClick={() => void refresh("工作台已刷新。")}>
            刷新数据 ↻
          </button>
        </nav>
      </div>

      <div className="studio-operations-metrics">
        <Metric
          label="VISUAL ASSETS"
          value={overview.summary.media.total}
          detail={`${formatBytes(overview.summary.media.imageBytes)} 已索引`}
        />
        <Metric
          label="ALT COVERAGE"
          value={`${overview.summary.media.altCoverage}%`}
          detail={
            overview.summary.media.missingAlt
              ? `${overview.summary.media.missingAlt} 项待补充`
              : "无障碍描述完整"
          }
        />
        <Metric
          label="PUBLISHED WORKS"
          value={overview.summary.works.published}
          detail={`${overview.summary.works.draft} 件草稿`}
        />
        <Metric
          label="READY RELEASES"
          value={overview.summary.publications.ready}
          detail={`${overview.summary.publications.total} 个发布包`}
        />
      </div>

      <div className="studio-operations-pipeline">
        {overview.pipeline.map((stage) => (
          <a
            className={`studio-pipeline-stage is-${stage.id}`}
            href={stage.href}
            key={stage.id}
          >
            <div>
              <span>{stage.number}</span>
              <small>{stage.english}</small>
            </div>
            <strong>{stage.label}</strong>
            <p>
              {String(stage.complete).padStart(2, "0")} /{" "}
              {String(stage.total).padStart(2, "0")} COMPLETE
            </p>
            <div className="studio-pipeline-progress">
              <span style={{ width: `${stage.progress}%` }} />
            </div>
            <b>{stage.progress}%</b>
          </a>
        ))}
      </div>

      <div className="studio-operations-grid">
        <section className="studio-attention" aria-labelledby="attention-title">
          <header>
            <div>
              <span>ATTENTION QUEUE</span>
              <h3 id="attention-title">待处理队列</h3>
            </div>
            <div>
              <strong>{issueCounts.critical} 必须</strong>
              <span>{issueCounts.warning} 建议</span>
              <small>{issueCounts.note} 增强</small>
            </div>
          </header>
          {overview.issues.length === 0 ? (
            <div className="studio-attention-clear">
              <span>✓</span>
              <strong>当前没有开放检查项</strong>
              <p>继续维护新上传作品与发布资料即可。</p>
            </div>
          ) : (
            <>
              <div className="studio-attention-list">
                {overview.issues.slice(0, issueLimit).map((issue) => (
                  <a
                    className={`studio-attention-item is-${issue.severity}`}
                    href={issue.href}
                    key={issue.id}
                  >
                    <span>{severityLabels[issue.severity]}</span>
                    <div>
                      <small>{issue.area}</small>
                      <strong>{issue.title}</strong>
                      <p>{issue.detail}</p>
                    </div>
                    <b>→</b>
                  </a>
                ))}
              </div>
              {overview.issues.length > issueLimit && (
                <button
                  className="studio-attention-more"
                  type="button"
                  onClick={() => setIssueLimit(overview.issues.length)}
                >
                  显示全部 {overview.issues.length} 项检查
                </button>
              )}
            </>
          )}
        </section>

        <aside className="studio-activity" aria-labelledby="activity-title">
          <header>
            <span>RECENT ACTIVITY</span>
            <h3 id="activity-title">最近更新</h3>
          </header>
          {overview.activities.length === 0 ? (
            <p>新建内容后，更新记录会出现在这里。</p>
          ) : (
            <ol>
              {overview.activities.map((activity, index) => (
                <li key={activity.id}>
                  <a href={activity.href}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <small>{activity.type}</small>
                      <strong>{activity.title}</strong>
                      <p>{activity.detail}</p>
                    </div>
                    <time dateTime={activity.updatedAt}>
                      {formatShortDate(activity.updatedAt)}
                    </time>
                  </a>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>

      <section
        className="studio-media-index"
        id="media-index"
        aria-labelledby="media-index-title"
      >
        <header>
          <div>
            <span>UNIFIED MEDIA INDEX</span>
            <h3 id="media-index-title">
              视觉素材<i>索引。</i>
            </h3>
          </div>
          <p>
            统一检索作品主图、细节图、过程记录和系列封面；元数据修改会直接
            回写原始内容，不复制图片，也不会打断现有链接。
          </p>
        </header>

        <div className="studio-media-tools">
          <div className="studio-media-kind-filters">
            {kindFilters.map((item) => (
              <button
                type="button"
                key={item.value}
                className={kindFilter === item.value ? "is-active" : ""}
                aria-pressed={kindFilter === item.value}
                onClick={() => setKindFilter(item.value)}
              >
                {item.label}
                <span>
                  {item.value === "all"
                    ? overview.assets.length
                    : overview.assets.filter(
                        (asset) => asset.kind === item.value,
                      ).length}
                </span>
              </button>
            ))}
          </div>
          <div className="studio-media-query">
            <label>
              <span>STATUS</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as AssetStatusFilter,
                  )
                }
              >
                <option value="all">全部状态</option>
                <option value="draft">草稿来源</option>
                <option value="published">公开来源</option>
              </select>
            </label>
            <label>
              <span>SEARCH</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="名称 / 上下文 / 图片描述"
              />
            </label>
          </div>
        </div>

        <div className="studio-operations-notice" aria-live="polite">
          {error && <p className="is-error">{error}</p>}
          {message && <p>{message}</p>}
        </div>

        {overview.assets.length === 0 ? (
          <div className="studio-media-empty">
            <span>00</span>
            <strong>素材索引仍为空</strong>
            <p>上传第一件作品或系列封面后，这里会自动建立统一索引。</p>
            <a href="#work-upload">开始上传 →</a>
          </div>
        ) : visibleAssets.length === 0 ? (
          <div className="studio-media-empty">
            <span>○</span>
            <strong>没有符合条件的素材</strong>
            <p>尝试更换来源、状态或搜索关键词。</p>
          </div>
        ) : (
          <div className="studio-media-grid">
            {visibleAssets.slice(0, 80).map((asset, index) => (
              <article
                className={`studio-media-card studio-media-card--${(index % 5) + 1}`}
                key={asset.id}
              >
                <a
                  className="studio-media-image"
                  href={asset.previewHref}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`预览 ${asset.title}`}
                >
                  <img src={asset.imageUrl} alt={asset.altText} />
                  <span>{asset.sourceLabel}</span>
                  <small>{formatBytes(asset.imageSize)}</small>
                </a>
                <div className="studio-media-copy">
                  <div>
                    <span className={`is-${asset.status}`}>
                      {asset.status === "published" ? "公开来源" : "草稿来源"}
                    </span>
                    <small>{asset.imageType.replace("image/", "").toUpperCase()}</small>
                  </div>
                  <h4>{asset.title}</h4>
                  <p>{asset.context || "NÉRA ATELIER"}</p>
                  <blockquote
                    className={asset.altText.trim() ? "" : "is-missing"}
                  >
                    {asset.altText || "图片描述待补充"}
                  </blockquote>
                </div>
                <div className="studio-media-actions">
                  <button
                    type="button"
                    onClick={() => beginAssetEdit(asset)}
                  >
                    {editingAssetId === asset.id ? "收起" : "编辑资料"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyAssetUrl(asset)}
                  >
                    复制链接
                  </button>
                  <a href={asset.studioHref}>原始内容</a>
                </div>
                {editingAssetId === asset.id && (
                  <form
                    className="studio-media-editor"
                    onSubmit={(event) =>
                      void saveAssetMetadata(event, asset)
                    }
                  >
                    {asset.editTitleKey && (
                      <label>
                        <span>{asset.editTitleLabel}</span>
                        <input
                          required
                          maxLength={
                            asset.editTitleKey === "label" ? 40 : 120
                          }
                          value={editTitle}
                          onChange={(event) =>
                            setEditTitle(event.target.value)
                          }
                        />
                      </label>
                    )}
                    <label>
                      <span>图片描述（无障碍）*</span>
                      <textarea
                        required
                        rows={3}
                        maxLength={240}
                        value={editAltText}
                        onChange={(event) =>
                          setEditAltText(event.target.value)
                        }
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={savingAssetId === asset.id}
                    >
                      {savingAssetId === asset.id
                        ? "正在保存…"
                        : "保存元数据"}
                    </button>
                  </form>
                )}
              </article>
            ))}
          </div>
        )}
        {visibleAssets.length > 80 && (
          <p className="studio-media-limit">
            当前显示最近 80 项，共 {visibleAssets.length} 项；使用搜索可快速定位。
          </p>
        )}
      </section>
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

async function requestOverview() {
  const response = await fetch("/api/studio/overview", {
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok || !payload.overview) {
    throw new Error(payload.error || "无法读取工作台总览。");
  }
  return payload.overview;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "NOW";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
  })
    .format(date)
    .toUpperCase();
}
