"use client";

import { useMemo, useState, useEffect } from "react";
import type {
  DesignReviewActionPriority,
  DesignReviewActionStatus,
  DesignReviewDecision,
  DesignReviewOverview,
  DesignReviewStatus,
  DesignReviewType,
  DesignReviewWorkspace,
} from "@/lib/design-reviews";

type ApiPayload = {
  overview?: DesignReviewOverview;
  review?: { id: string };
  action?: { id: string };
  error?: string;
};

type ReviewFilter = "all" | "active" | "decided" | "closed";

const reviewTypes: Array<{ value: DesignReviewType; label: string }> = [
  { value: "concept", label: "概念方向" },
  { value: "silhouette", label: "廓形比例" },
  { value: "material", label: "材料与色彩" },
  { value: "fitting", label: "试衣与版型" },
  { value: "construction", label: "工艺结构" },
  { value: "styling", label: "造型编辑" },
  { value: "final_edit", label: "最终编辑" },
  { value: "other", label: "其他评审" },
];

const reviewStatuses: Array<{
  value: DesignReviewStatus;
  label: string;
}> = [
  { value: "planned", label: "计划中" },
  { value: "in_review", label: "评审中" },
  { value: "decided", label: "已形成结论" },
  { value: "closed", label: "已闭环" },
  { value: "cancelled", label: "已取消" },
];

const decisions: Array<{
  value: DesignReviewDecision;
  label: string;
  english: string;
}> = [
  { value: "pending", label: "待判断", english: "PENDING" },
  { value: "approved", label: "通过", english: "APPROVE" },
  { value: "revise", label: "修改后复审", english: "REVISE" },
  { value: "hold", label: "暂缓", english: "HOLD" },
  { value: "drop", label: "退出本季", english: "DROP" },
];

const actionPriorities: Array<{
  value: DesignReviewActionPriority;
  label: string;
}> = [
  { value: "normal", label: "普通" },
  { value: "high", label: "高" },
  { value: "critical", label: "关键" },
  { value: "low", label: "低" },
];

const emptyCreateForm = {
  title: "",
  reviewType: "concept" as DesignReviewType,
  status: "planned" as DesignReviewStatus,
  collectionId: "",
  workId: "",
  brief: "",
  reviewerName: "",
  scheduledAt: "",
};

const emptyActionForm = {
  title: "",
  priority: "normal" as DesignReviewActionPriority,
  ownerName: "",
  dueAt: "",
  notes: "",
};

type EditForm = ReturnType<typeof reviewEditForm>;

export default function DesignReviewBoard() {
  const [overview, setOverview] =
    useState<DesignReviewOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingActionId, setSavingActionId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [actionForm, setActionForm] = useState(emptyActionForm);
  const [filter, setFilter] = useState<ReviewFilter>("active");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await requestOverview();
        if (cancelled) return;
        setOverview(next);
        const first = next.reviews[0] ?? null;
        setSelectedId(first?.review.id ?? null);
        setEditForm(first ? reviewEditForm(first) : null);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "无法读取设计评审台。",
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

  const visibleReviews = useMemo(() => {
    if (!overview) return [];
    const needle = query.trim().toLocaleLowerCase();
    return overview.reviews.filter((workspace) => {
      const status = workspace.review.status;
      if (
        filter === "active" &&
        ["closed", "cancelled"].includes(status)
      ) {
        return false;
      }
      if (filter === "decided" && workspace.review.decision === "pending") {
        return false;
      }
      if (filter === "closed" && status !== "closed") return false;
      if (!needle) return true;
      return [
        workspace.review.reviewCode,
        workspace.review.title,
        workspace.review.brief,
        workspace.review.observations,
        workspace.collection?.title,
        workspace.work?.title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [filter, overview, query]);

  const selected = useMemo(
    () =>
      overview?.reviews.find(
        (workspace) => workspace.review.id === selectedId,
      ) ?? null,
    [overview, selectedId],
  );

  const availableCreateWorks = useMemo(() => {
    if (!overview) return [];
    if (!createForm.collectionId) return overview.references.works;
    return overview.references.works.filter((work) =>
      work.collectionIds.includes(createForm.collectionId),
    );
  }, [createForm.collectionId, overview]);

  async function refresh(
    successMessage = "",
    preferredId = selectedId,
  ) {
    setError("");
    if (successMessage) setMessage(successMessage);
    try {
      const next = await requestOverview();
      setOverview(next);
      const nextSelected =
        next.reviews.find(
          (workspace) => workspace.review.id === preferredId,
        ) ??
        next.reviews[0] ??
        null;
      setSelectedId(nextSelected?.review.id ?? null);
      setEditForm(nextSelected ? reviewEditForm(nextSelected) : null);
      window.dispatchEvent(new CustomEvent("nera:review-updated"));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "无法刷新设计评审台。",
      );
    }
  }

  function selectReview(workspace: DesignReviewWorkspace) {
    setSelectedId(workspace.review.id);
    setEditForm(reviewEditForm(workspace));
    setActionForm(emptyActionForm);
    setError("");
    setMessage("");
  }

  async function createReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!createForm.title.trim()) {
      setError("请填写评审主题。");
      return;
    }
    setCreating(true);
    try {
      const response = await fetch("/api/studio/design-reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          collectionId: createForm.collectionId || null,
          workId: createForm.workId || null,
          scheduledAt: fromLocalDateTime(createForm.scheduledAt),
        }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.review) {
        throw new Error(payload.error || "建立设计评审失败。");
      }
      setCreateForm(emptyCreateForm);
      await refresh("设计评审已建立；结论仍需由设计师人工形成。", payload.review.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "建立设计评审失败。",
      );
    } finally {
      setCreating(false);
    }
  }

  async function saveReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !editForm) return;
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const response = await fetch(
        `/api/studio/design-reviews/${encodeURIComponent(selected.review.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...editForm,
            collectionId: editForm.collectionId || null,
            workId: editForm.workId || null,
            scheduledAt: fromLocalDateTime(editForm.scheduledAt),
          }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.review) {
        throw new Error(payload.error || "保存评审失败。");
      }
      await refresh("评审事实、结论与状态已保存。", selected.review.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存评审失败。");
    } finally {
      setSaving(false);
    }
  }

  async function createAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError("");
    setMessage("");
    if (!actionForm.title.trim()) {
      setError("请填写修改任务。");
      return;
    }
    setSavingActionId("new");
    try {
      const response = await fetch("/api/studio/design-reviews/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reviewId: selected.review.id,
          ...actionForm,
          dueAt: fromLocalDateTime(actionForm.dueAt),
        }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.action) {
        throw new Error(payload.error || "建立修改任务失败。");
      }
      setActionForm(emptyActionForm);
      await refresh("修改任务已加入评审闭环。", selected.review.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "建立修改任务失败。",
      );
    } finally {
      setSavingActionId(null);
    }
  }

  async function changeActionStatus(
    actionId: string,
    status: DesignReviewActionStatus,
  ) {
    if (!selected) return;
    setError("");
    setMessage("");
    setSavingActionId(actionId);
    try {
      const response = await fetch(
        `/api/studio/design-reviews/actions/${encodeURIComponent(actionId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.action) {
        throw new Error(payload.error || "更新修改任务失败。");
      }
      await refresh("修改任务状态已更新。", selected.review.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "更新修改任务失败。",
      );
    } finally {
      setSavingActionId(null);
    }
  }

  if (loading) {
    return (
      <section className="studio-review-board is-loading">
        <span>19</span>
        <p>正在打开 Atelier Review Board…</p>
      </section>
    );
  }

  if (!overview) {
    return (
      <section className="studio-review-board is-loading is-error">
        <span>19</span>
        <p>{error || "设计评审台暂时不可用。"}</p>
        <button type="button" onClick={() => void refresh()}>
          重新读取
        </button>
      </section>
    );
  }

  return (
    <section
      className="studio-review-board"
      id="design-review-board"
      aria-labelledby="design-review-title"
    >
      <header className="studio-review-hero">
        <span aria-hidden="true">19</span>
        <div>
          <small>PHASE 19 / ATELIER REVIEW BOARD</small>
          <h2 id="design-review-title">
            LOOK.
            <i>QUESTION.</i>
            DECIDE.
          </h2>
          <p>
            把一次评审从模糊意见变成可追溯的设计判断：关联系列与 Look，
            记录观察、形成结论，再用明确修改任务完成闭环。
          </p>
        </div>
        <aside>
          <span>DESIGN DECISION PROTOCOL</span>
          <strong>
            {overview.metrics.activeReviewCount
              .toString()
              .padStart(2, "0")}
          </strong>
          <p>
            项评审仍在进行
            <small>
              {overview.metrics.overdueActionCount} OVERDUE /{" "}
              {overview.metrics.criticalActionCount} CRITICAL
            </small>
          </p>
          <nav aria-label="导出设计评审">
            <a href="/api/studio/design-reviews?format=reviews" download>
              REVIEWS CSV
            </a>
            <a href="/api/studio/design-reviews?format=actions" download>
              ACTIONS CSV
            </a>
            <a href="/api/studio/design-reviews?format=json" download>
              FULL JSON
            </a>
          </nav>
        </aside>
      </header>

      <div className="studio-review-principles">
        <span>REVIEW RULES</span>
        <p>观察与判断分开记录</p>
        <b>01</b>
        <p>结论必须说明依据</p>
        <b>02</b>
        <p>任务完成后才能关闭</p>
        <b>03</b>
        <small>NO AUTO-APPROVAL · DESIGNER OWNS THE DECISION</small>
      </div>

      {(error || message) && (
        <div
          className={`studio-review-notice${error ? " is-error" : ""}`}
          role="status"
        >
          {error || message}
        </div>
      )}

      <div className="studio-review-metrics">
        <ReviewMetric
          index="01"
          value={overview.metrics.reviewCount}
          label="全部评审"
          detail={`${overview.metrics.decidedCount} 项已形成结论`}
        />
        <ReviewMetric
          index="02"
          value={overview.metrics.reviseCount}
          label="修改后复审"
          detail="明确需要迭代的设计判断"
          attention={overview.metrics.reviseCount > 0}
        />
        <ReviewMetric
          index="03"
          value={overview.metrics.openActionCount}
          label="开放任务"
          detail={`${overview.metrics.overdueActionCount} 项已经逾期`}
          attention={overview.metrics.overdueActionCount > 0}
        />
        <ReviewMetric
          index="04"
          value={`${overview.metrics.closureRate}%`}
          label="闭环比例"
          detail="已关闭评审 ÷ 全部评审"
        />
      </div>

      <section className="studio-review-create">
        <header>
          <small>01 / OPEN A REVIEW</small>
          <h3>从一个明确问题开始。</h3>
          <p>
            评审不是评分。先写清楚需要判断的设计问题，再选择系列、Look 与时间。
          </p>
        </header>
        <form onSubmit={createReview}>
          <label className="is-wide">
            <span>评审主题 *</span>
            <input
              required
              maxLength={240}
              value={createForm.title}
              placeholder="例如：Look 06 肩线与身体比例复审"
              onChange={(event) =>
                setCreateForm({ ...createForm, title: event.target.value })
              }
            />
          </label>
          <label>
            <span>评审类型</span>
            <select
              value={createForm.reviewType}
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  reviewType: event.target.value as DesignReviewType,
                })
              }
            >
              {reviewTypes.map((item) => (
                <option value={item.value} key={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>初始状态</span>
            <select
              value={createForm.status}
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  status: event.target.value as DesignReviewStatus,
                })
              }
            >
              {reviewStatuses.slice(0, 2).map((item) => (
                <option value={item.value} key={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>关联系列</span>
            <select
              value={createForm.collectionId}
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  collectionId: event.target.value,
                  workId: "",
                })
              }
            >
              <option value="">全局 / 不指定系列</option>
              {overview.references.collections.map((collection) => (
                <option value={collection.id} key={collection.id}>
                  {collection.title} / {collection.season} {collection.year}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>关联 Look</span>
            <select
              value={createForm.workId}
              onChange={(event) =>
                setCreateForm({ ...createForm, workId: event.target.value })
              }
            >
              <option value="">系列级 / 不指定 Look</option>
              {availableCreateWorks.map((work) => (
                <option value={work.id} key={work.id}>
                  {work.lookNumber || "—"} / {work.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>评审人 / 主持</span>
            <input
              maxLength={180}
              value={createForm.reviewerName}
              placeholder="设计师 / 版师 / 造型"
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  reviewerName: event.target.value,
                })
              }
            />
          </label>
          <label>
            <span>评审时间</span>
            <input
              type="datetime-local"
              value={createForm.scheduledAt}
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  scheduledAt: event.target.value,
                })
              }
            />
          </label>
          <label className="is-wide">
            <span>需要回答的设计问题</span>
            <textarea
              rows={3}
              maxLength={4000}
              value={createForm.brief}
              placeholder="写下评审目标、不可改变的设计意图，以及需要被验证的部分。"
              onChange={(event) =>
                setCreateForm({ ...createForm, brief: event.target.value })
              }
            />
          </label>
          <button type="submit" disabled={creating}>
            {creating ? "正在建立…" : "建立评审 →"}
          </button>
        </form>
      </section>

      <div className="studio-review-workbench">
        <aside className="studio-review-index">
          <header>
            <div>
              <small>02 / REVIEW INDEX</small>
              <h3>评审索引</h3>
            </div>
            <strong>{visibleReviews.length.toString().padStart(2, "0")}</strong>
          </header>
          <div className="studio-review-filters">
            {(["active", "all", "decided", "closed"] as ReviewFilter[]).map(
              (value) => (
                <button
                  type="button"
                  className={filter === value ? "is-active" : ""}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  key={value}
                >
                  {filterLabel(value)}
                </button>
              ),
            )}
            <input
              type="search"
              value={query}
              placeholder="主题 / 系列 / Look"
              aria-label="搜索设计评审"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="studio-review-list">
            {visibleReviews.length === 0 ? (
              <p>当前筛选下没有评审。</p>
            ) : (
              visibleReviews.map((workspace) => (
                <button
                  type="button"
                  className={
                    workspace.review.id === selectedId ? "is-active" : ""
                  }
                  onClick={() => selectReview(workspace)}
                  key={workspace.review.id}
                >
                  <span>{workspace.review.reviewCode}</span>
                  <b className={`is-${workspace.review.decision}`}>
                    {decisionLabel(workspace.review.decision)}
                  </b>
                  <strong>{workspace.review.title}</strong>
                  <small>
                    {workspace.work?.title ??
                      workspace.collection?.title ??
                      "ATELIER / 全局"}
                  </small>
                  <i>
                    {workspace.summary.openActions} OPEN /{" "}
                    {workspace.summary.completion}%
                  </i>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="studio-review-dossier">
          {!selected || !editForm ? (
            <div className="studio-review-empty">
              <span>◇</span>
              <h3>选择一项评审。</h3>
              <p>在右侧形成设计判断与修改闭环。</p>
            </div>
          ) : (
            <>
              <header>
                <div>
                  <small>
                    {selected.review.reviewCode} /{" "}
                    {reviewTypeLabel(selected.review.reviewType)}
                  </small>
                  <h3>{selected.review.title}</h3>
                  <p>
                    {selected.work?.title ??
                      selected.collection?.title ??
                      "ATELIER / 全局评审"}
                  </p>
                </div>
                <aside>
                  <span>{selected.summary.completion}%</span>
                  <small>ACTION CLOSURE</small>
                </aside>
              </header>

              <form className="studio-review-editor" onSubmit={saveReview}>
                <div className="studio-review-editor-grid">
                  <label className="is-wide">
                    <span>评审主题 *</span>
                    <input
                      required
                      maxLength={240}
                      value={editForm.title}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          title: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>类型</span>
                    <select
                      value={editForm.reviewType}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          reviewType: event.target.value as DesignReviewType,
                        })
                      }
                    >
                      {reviewTypes.map((item) => (
                        <option value={item.value} key={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>流程状态</span>
                    <select
                      value={editForm.status}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          status: event.target.value as DesignReviewStatus,
                        })
                      }
                    >
                      {reviewStatuses.map((item) => (
                        <option value={item.value} key={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>评审人 / 主持</span>
                    <input
                      maxLength={180}
                      value={editForm.reviewerName}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          reviewerName: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>评审时间</span>
                    <input
                      type="datetime-local"
                      value={editForm.scheduledAt}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          scheduledAt: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="is-wide">
                    <span>评审问题 / BRIEF</span>
                    <textarea
                      rows={3}
                      maxLength={4000}
                      value={editForm.brief}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          brief: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="is-wide">
                    <span>观察记录 / OBSERVATIONS</span>
                    <textarea
                      rows={6}
                      maxLength={8000}
                      value={editForm.observations}
                      placeholder="只记录可观察事实、试衣反馈、比例、材料与工艺表现；先不下结论。"
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          observations: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                <fieldset className="studio-review-decisions">
                  <legend>设计结论 / DESIGN DECISION</legend>
                  {decisions.map((item) => (
                    <label
                      className={
                        editForm.decision === item.value ? "is-active" : ""
                      }
                      key={item.value}
                    >
                      <input
                        type="radio"
                        name="design-decision"
                        value={item.value}
                        checked={editForm.decision === item.value}
                        onChange={() =>
                          setEditForm({
                            ...editForm,
                            decision: item.value,
                            status:
                              item.value === "pending"
                                ? ["decided", "closed"].includes(
                                    editForm.status,
                                  )
                                  ? "in_review"
                                  : editForm.status
                                : ["planned", "in_review"].includes(
                                      editForm.status,
                                    )
                                  ? "decided"
                                  : editForm.status,
                          })
                        }
                      />
                      <span>{item.english}</span>
                      <strong>{item.label}</strong>
                    </label>
                  ))}
                </fieldset>

                <label className="studio-review-conclusion">
                  <span>结论与判断依据 *</span>
                  <textarea
                    rows={5}
                    maxLength={5000}
                    value={editForm.conclusion}
                    placeholder="形成结论时必须说明保留、修改、暂缓或退出本季的依据。"
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        conclusion: event.target.value,
                      })
                    }
                  />
                </label>
                <button
                  className="studio-review-save"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "正在保存判断…" : "保存评审判断 →"}
                </button>
              </form>

              <section className="studio-review-actions">
                <header>
                  <div>
                    <small>03 / REVISION ACTIONS</small>
                    <h4>修改任务</h4>
                  </div>
                  <span>
                    {selected.summary.openActions} OPEN /{" "}
                    {selected.summary.overdueActions} OVERDUE
                  </span>
                </header>
                <form onSubmit={createAction}>
                  <label className="is-wide">
                    <span>修改任务 *</span>
                    <input
                      required
                      maxLength={360}
                      value={actionForm.title}
                      placeholder="例如：收窄肩宽 1.5 cm，并保留后背量感"
                      onChange={(event) =>
                        setActionForm({
                          ...actionForm,
                          title: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>优先级</span>
                    <select
                      value={actionForm.priority}
                      onChange={(event) =>
                        setActionForm({
                          ...actionForm,
                          priority: event.target
                            .value as DesignReviewActionPriority,
                        })
                      }
                    >
                      {actionPriorities.map((item) => (
                        <option value={item.value} key={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>负责人</span>
                    <input
                      maxLength={180}
                      value={actionForm.ownerName}
                      onChange={(event) =>
                        setActionForm({
                          ...actionForm,
                          ownerName: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>截止时间</span>
                    <input
                      type="datetime-local"
                      value={actionForm.dueAt}
                      onChange={(event) =>
                        setActionForm({
                          ...actionForm,
                          dueAt: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="is-wide">
                    <span>执行说明</span>
                    <textarea
                      rows={2}
                      maxLength={4000}
                      value={actionForm.notes}
                      onChange={(event) =>
                        setActionForm({
                          ...actionForm,
                          notes: event.target.value,
                        })
                      }
                    />
                  </label>
                  <button type="submit" disabled={savingActionId === "new"}>
                    {savingActionId === "new" ? "正在加入…" : "加入修改任务 +"}
                  </button>
                </form>

                <div className="studio-review-action-list">
                  {selected.actions.length === 0 ? (
                    <p>尚无修改任务；若结论为通过，可直接关闭评审。</p>
                  ) : (
                    selected.actions.map((action, index) => (
                      <article
                        className={`is-${action.status} is-${action.priority}`}
                        key={action.id}
                      >
                        <span>{(index + 1).toString().padStart(2, "0")}</span>
                        <div>
                          <small>
                            {action.priority.toUpperCase()} /{" "}
                            {action.dueAt
                              ? formatDateTime(action.dueAt)
                              : "NO DEADLINE"}
                          </small>
                          <strong>{action.title}</strong>
                          <p>
                            {[action.ownerName, action.notes]
                              .filter(Boolean)
                              .join(" · ") || "尚无执行说明"}
                          </p>
                        </div>
                        <nav aria-label={`更新任务：${action.title}`}>
                          <button
                            type="button"
                            disabled={savingActionId === action.id}
                            className={
                              action.status === "in_progress"
                                ? "is-active"
                                : ""
                            }
                            onClick={() =>
                              void changeActionStatus(
                                action.id,
                                "in_progress",
                              )
                            }
                          >
                            进行中
                          </button>
                          <button
                            type="button"
                            disabled={savingActionId === action.id}
                            className={
                              action.status === "done" ? "is-active" : ""
                            }
                            onClick={() =>
                              void changeActionStatus(action.id, "done")
                            }
                          >
                            完成
                          </button>
                        </nav>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </section>
      </div>
    </section>
  );
}

function ReviewMetric(props: {
  index: string;
  value: number | string;
  label: string;
  detail: string;
  attention?: boolean;
}) {
  return (
    <article className={props.attention ? "is-attention" : ""}>
      <span>{props.index}</span>
      <strong>{props.value}</strong>
      <h3>{props.label}</h3>
      <p>{props.detail}</p>
    </article>
  );
}

function reviewEditForm(workspace: DesignReviewWorkspace) {
  return {
    title: workspace.review.title,
    reviewType: workspace.review.reviewType as DesignReviewType,
    status: workspace.review.status as DesignReviewStatus,
    decision: workspace.review.decision as DesignReviewDecision,
    collectionId: workspace.review.collectionId ?? "",
    workId: workspace.review.workId ?? "",
    brief: workspace.review.brief,
    observations: workspace.review.observations,
    conclusion: workspace.review.conclusion,
    reviewerName: workspace.review.reviewerName,
    scheduledAt: toLocalDateTime(workspace.review.scheduledAt),
  };
}

async function requestOverview(): Promise<DesignReviewOverview> {
  const response = await fetch("/api/studio/design-reviews", {
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok || !payload.overview) {
    throw new Error(payload.error || "无法读取设计评审台。");
  }
  return payload.overview;
}

function filterLabel(value: ReviewFilter): string {
  return value === "active"
    ? "进行中"
    : value === "decided"
      ? "有结论"
      : value === "closed"
        ? "已闭环"
        : "全部";
}

function reviewTypeLabel(value: string): string {
  return reviewTypes.find((item) => item.value === value)?.label ?? value;
}

function decisionLabel(value: DesignReviewDecision): string {
  return decisions.find((item) => item.value === value)?.label ?? value;
}

function toLocalDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalDateTime(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
