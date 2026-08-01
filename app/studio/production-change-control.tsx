"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  ProductionExceptionActionType,
  ProductionExceptionCategory,
  ProductionExceptionDecision,
  ProductionExceptionOverview,
  ProductionExceptionSeverity,
  ProductionExceptionStatus,
  ProductionExceptionWorkspace,
} from "@/lib/production-exceptions";

type ApiPayload = {
  overview?: ProductionExceptionOverview;
  exception?: { id: string };
  action?: { id: string };
  error?: string;
};

const categories: Array<{
  value: ProductionExceptionCategory;
  label: string;
}> = [
  { value: "material", label: "材料 / MATERIAL" },
  { value: "color", label: "色彩 / COLOR" },
  { value: "construction", label: "工艺 / CONSTRUCTION" },
  { value: "measurement", label: "尺寸 / MEASUREMENT" },
  { value: "finish", label: "表面与后整理 / FINISH" },
  { value: "label", label: "标识 / LABEL" },
  { value: "packaging", label: "包装 / PACKAGING" },
  { value: "schedule", label: "时间 / SCHEDULE" },
  { value: "other", label: "其他 / OTHER" },
];

const severities: Array<{
  value: ProductionExceptionSeverity;
  label: string;
}> = [
  { value: "low", label: "低 / LOW" },
  { value: "medium", label: "中 / MEDIUM" },
  { value: "high", label: "高 / HIGH" },
  { value: "critical", label: "关键 / CRITICAL" },
];

const decisions: Array<{
  value: ProductionExceptionDecision;
  label: string;
}> = [
  { value: "pending", label: "待决定 / PENDING" },
  { value: "accept_once", label: "单次接受 / ACCEPT ONCE" },
  { value: "rework", label: "返工 / REWORK" },
  { value: "revise_definition", label: "修改产品定义 / REVISE DEFINITION" },
  { value: "reject", label: "拒绝偏差 / REJECT" },
  { value: "hold", label: "暂缓 / HOLD" },
];

const actionTypes: Array<{
  value: ProductionExceptionActionType;
  label: string;
}> = [
  { value: "review_note", label: "复核记录 / REVIEW" },
  { value: "evidence", label: "证据补充 / EVIDENCE" },
  { value: "response", label: "处置反馈 / RESPONSE" },
  { value: "decision", label: "决定说明 / DECISION" },
  { value: "verification", label: "核验事实 / VERIFICATION" },
];

const statusLabels: Record<ProductionExceptionStatus, string> = {
  open: "已报告 / OPEN",
  in_review: "复核中 / IN REVIEW",
  decided: "已决定 / DECIDED",
  verified: "已验证 / VERIFIED",
  closed: "已关闭 / CLOSED",
  withdrawn: "已撤回 / WITHDRAWN",
};

const transitions: Record<
  ProductionExceptionStatus,
  ProductionExceptionStatus[]
> = {
  open: ["open", "in_review", "withdrawn"],
  in_review: ["in_review", "decided", "withdrawn"],
  decided: ["decided", "verified"],
  verified: ["verified", "closed"],
  closed: ["closed"],
  withdrawn: ["withdrawn"],
};

const emptyCreate = {
  productionReleaseId: "",
  category: "construction" as ProductionExceptionCategory,
  severity: "medium" as ProductionExceptionSeverity,
  title: "",
  sourceName: "",
  sourceReference: "",
  affectedScope: "",
  observedDeviation: "",
  evidenceReference: "",
  ownerName: "",
  discoveredAt: "",
  dueAt: "",
};

const emptyAction = {
  actionType: "review_note" as ProductionExceptionActionType,
  note: "",
  reference: "",
};

type EditForm = ReturnType<typeof editFormFor>;
type Filter = "active" | "attention" | "critical" | "closed" | "all";

export default function ProductionChangeControl() {
  const [overview, setOverview] =
    useState<ProductionExceptionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [query, setQuery] = useState("");
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [actionForm, setActionForm] = useState(emptyAction);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingAction, setAddingAction] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await requestOverview();
        if (cancelled) return;
        const first = next.exceptions[0] ?? null;
        setOverview(next);
        setSelectedId(first?.exception.id ?? null);
        setEditForm(first ? editFormFor(first) : null);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "无法读取生产变更控制台。",
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

  const visible = useMemo(() => {
    if (!overview) return [];
    const needle = query.trim().toLocaleLowerCase();
    return overview.exceptions.filter((workspace) => {
      const { exception, release, work, summary } = workspace;
      if (
        filter === "active" &&
        ["closed", "withdrawn"].includes(exception.status)
      ) {
        return false;
      }
      if (filter === "attention" && !summary.attention) return false;
      if (
        filter === "critical" &&
        !["high", "critical"].includes(exception.severity)
      ) {
        return false;
      }
      if (filter === "closed" && exception.status !== "closed") return false;
      if (!needle) return true;
      return [
        exception.exceptionCode,
        exception.title,
        exception.sourceName,
        exception.ownerName,
        release?.releaseCode,
        release?.authorizationCode,
        work?.lookNumber,
        work?.title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [filter, overview, query]);

  const selected =
    overview?.exceptions.find(
      (workspace) => workspace.exception.id === selectedId,
    ) ?? null;
  const selectedSource = overview?.references.releasedSources.find(
    (source) =>
      source.productionReleaseId === createForm.productionReleaseId,
  );

  async function refresh(
    successMessage = "",
    preferredId: string | null = selectedId,
  ) {
    setError("");
    if (successMessage) setMessage(successMessage);
    const next = await requestOverview();
    const nextSelected =
      next.exceptions.find(
        (workspace) => workspace.exception.id === preferredId,
      ) ??
      next.exceptions[0] ??
      null;
    setOverview(next);
    setSelectedId(nextSelected?.exception.id ?? null);
    setEditForm(nextSelected ? editFormFor(nextSelected) : null);
    window.dispatchEvent(new Event("nera:production-exception-updated"));
  }

  function selectException(workspace: ProductionExceptionWorkspace) {
    setSelectedId(workspace.exception.id);
    setEditForm(editFormFor(workspace));
    setActionForm(emptyAction);
    setError("");
    setMessage("");
  }

  async function createException(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSource) {
      setError("请选择已经生成 NERA-GO 的生产放行。");
      return;
    }
    setCreating(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/studio/production-exceptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          discoveredAt: createForm.discoveredAt || null,
          dueAt: createForm.dueAt || null,
        }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.exception) {
        throw new Error(payload.error || "建立生产偏差记录失败。");
      }
      setCreateForm(emptyCreate);
      await refresh(
        "偏差已经进入人工复核队列，原生产放行未被改写。",
        payload.exception.id,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "建立生产偏差记录失败。",
      );
    } finally {
      setCreating(false);
    }
  }

  async function saveException(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !editForm) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/studio/production-exceptions/${encodeURIComponent(selected.exception.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...editForm,
            discoveredAt: editForm.discoveredAt || null,
            dueAt: editForm.dueAt || null,
          }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.exception) {
        throw new Error(payload.error || "保存生产偏差失败。");
      }
      await refresh(statusMessage(editForm.status), selected.exception.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "保存生产偏差失败。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function addAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setAddingAction(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/studio/production-exceptions/${encodeURIComponent(selected.exception.id)}/actions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(actionForm),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.action) {
        throw new Error(payload.error || "追加偏差记录失败。");
      }
      setActionForm(emptyAction);
      await refresh("新的人工记录已经追加到时间线。", selected.exception.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "追加偏差记录失败。",
      );
    } finally {
      setAddingAction(false);
    }
  }

  return (
    <section
      className="production-change-control"
      id="production-change-control"
      aria-labelledby="production-change-title"
    >
      <header className="production-change-hero">
        <div>
          <span>25 / PRODUCTION CHANGE CONTROL</span>
          <h2 id="production-change-title">
            HOLD THE LINE.<br />
            <i>PROTECT THE INTENT.</i>
          </h2>
          <p>
            放行后的材料、色彩、尺寸和工艺偏差不应藏进消息记录。
            把事实、影响、设计决定与验证过程锁在同一条可追溯链路中。
          </p>
        </div>
        <div className="production-change-mark" aria-hidden="true">
          <b>Δ</b>
          <span>MANUAL AUTHORITY</span>
        </div>
      </header>

      <div className="production-change-metrics">
        <Metric label="TOTAL CASES" value={overview?.metrics.total ?? 0} />
        <Metric label="OPEN" value={overview?.metrics.open ?? 0} />
        <Metric label="IN REVIEW" value={overview?.metrics.inReview ?? 0} />
        <Metric
          label="CRITICAL OPEN"
          value={overview?.metrics.criticalOpen ?? 0}
          alert
        />
        <Metric
          label="OVERDUE"
          value={overview?.metrics.overdue ?? 0}
          alert
        />
      </div>

      <div className="production-change-principles">
        <p><span>01</span>只有已经授权的 NERA-GO 可以成为偏差来源。</p>
        <p><span>02</span>接受一次偏差，不会自动改写封样或技术包。</p>
        <p><span>03</span>决定、验证、关闭必须由设计师逐步确认。</p>
      </div>

      {(error || message) && (
        <div
          className={`production-change-notice${error ? " is-error" : ""}`}
          role="status"
        >
          {error || message}
        </div>
      )}

      <div className="production-change-layout">
        <aside className="production-change-create">
          <header>
            <span>NEW DEVIATION / 新偏差</span>
            <h3>从已放行定义开始。</h3>
          </header>
          <form onSubmit={createException}>
            <Field label="NERA-GO / 生产放行">
              <select
                value={createForm.productionReleaseId}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    productionReleaseId: event.target.value,
                  }))
                }
                required
              >
                <option value="">选择已授权放行</option>
                {overview?.references.releasedSources.map((source) => (
                  <option
                    value={source.productionReleaseId}
                    key={source.productionReleaseId}
                  >
                    {source.lookNumber} · {source.releaseCode} · {source.openExceptionCount} OPEN
                  </option>
                ))}
              </select>
            </Field>
            {selectedSource && (
              <div className="production-change-source">
                <div
                  className="production-change-source-image"
                  style={{
                    backgroundImage: `url("${selectedSource.imageUrl.replaceAll('"', "%22")}")`,
                  }}
                  aria-hidden="true"
                />
                <div>
                  <b>{selectedSource.workTitle}</b>
                  <span>{selectedSource.authorizationCode}</span>
                  <small>{selectedSource.factoryName || "执行方待记录"}</small>
                </div>
              </div>
            )}
            <Field label="偏差标题">
              <input
                value={createForm.title}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="例如：主面料批次光泽偏离封样"
                required
              />
            </Field>
            <div className="production-change-form-grid">
              <Field label="类别">
                <select
                  value={createForm.category}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      category: event.target.value as ProductionExceptionCategory,
                    }))
                  }
                >
                  {categories.map((item) => (
                    <option value={item.value} key={item.value}>{item.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="严重程度">
                <select
                  value={createForm.severity}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      severity: event.target.value as ProductionExceptionSeverity,
                    }))
                  }
                >
                  {severities.map((item) => (
                    <option value={item.value} key={item.value}>{item.label}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="偏差事实">
              <textarea
                value={createForm.observedDeviation}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    observedDeviation: event.target.value,
                  }))
                }
                placeholder="只记录实际观察，不推断决定。"
              />
            </Field>
            <Field label="影响范围">
              <input
                value={createForm.affectedScope}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    affectedScope: event.target.value,
                  }))
                }
                placeholder="色组、尺码、工序或批次范围"
              />
            </Field>
            <div className="production-change-form-grid">
              <Field label="来源">
                <input
                  value={createForm.sourceName}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      sourceName: event.target.value,
                    }))
                  }
                  placeholder="版房 / QC / 工作室"
                />
              </Field>
              <Field label="内部参考">
                <input
                  value={createForm.sourceReference}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      sourceReference: event.target.value,
                    }))
                  }
                  placeholder="批次、票据或消息编号"
                />
              </Field>
              <Field label="发现日期">
                <input
                  type="date"
                  value={createForm.discoveredAt}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      discoveredAt: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="复核期限">
                <input
                  type="date"
                  value={createForm.dueAt}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      dueAt: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
            <Field label="负责人">
              <input
                value={createForm.ownerName}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    ownerName: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="证据引用">
              <input
                value={createForm.evidenceReference}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    evidenceReference: event.target.value,
                  }))
                }
                placeholder="内部路径、文件名或外部链接"
              />
            </Field>
            <button type="submit" disabled={creating}>
              {creating ? "CREATING…" : "OPEN DEVIATION CASE →"}
            </button>
          </form>
        </aside>

        <div className="production-change-register">
          <header>
            <div>
              <span>EXCEPTION REGISTER</span>
              <h3>偏差与变更台账</h3>
            </div>
            <nav aria-label="偏差筛选">
              {(["active", "attention", "critical", "closed", "all"] as Filter[]).map(
                (item) => (
                  <button
                    type="button"
                    className={filter === item ? "is-active" : ""}
                    onClick={() => setFilter(item)}
                    key={item}
                  >
                    {item.toUpperCase()}
                  </button>
                ),
              )}
            </nav>
          </header>
          <input
            className="production-change-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索编号、Look、来源、负责人…"
            aria-label="搜索生产偏差"
          />
          <div className="production-change-list">
            {loading ? (
              <p className="production-change-empty">正在读取偏差台账…</p>
            ) : visible.length > 0 ? (
              visible.map((workspace) => (
                <button
                  type="button"
                  className={`production-change-row severity-${workspace.exception.severity}${selectedId === workspace.exception.id ? " is-selected" : ""}`}
                  onClick={() => selectException(workspace)}
                  key={workspace.exception.id}
                >
                  <span>{workspace.exception.exceptionCode}</span>
                  <div>
                    <b>{workspace.exception.title}</b>
                    <small>
                      {workspace.work?.lookNumber || "LOOK"} · {workspace.release?.releaseCode || "RELEASE"}
                    </small>
                  </div>
                  <em>{statusLabels[workspace.exception.status]}</em>
                  <strong>{workspace.exception.severity.toUpperCase()}</strong>
                  <i>{workspace.summary.overdue ? "OVERDUE" : `${workspace.summary.ageDays}D`}</i>
                </button>
              ))
            ) : (
              <p className="production-change-empty">当前筛选下没有偏差记录。</p>
            )}
          </div>
          <footer>
            <Link href="/api/studio/production-exceptions?format=exceptions">CASES CSV</Link>
            <Link href="/api/studio/production-exceptions?format=actions">TIMELINE CSV</Link>
            <Link href="/api/studio/production-exceptions?format=json">FULL JSON</Link>
          </footer>
        </div>
      </div>

      {selected && editForm && (
        <div className="production-change-dossier">
          <header>
            <div>
              <span>{selected.exception.exceptionCode}</span>
              <h3>{selected.exception.title}</h3>
              <p>
                {selected.work?.lookNumber} · {selected.release?.authorizationCode}
              </p>
            </div>
            <div className={`production-change-status severity-${selected.exception.severity}`}>
              <b>{selected.exception.severity.toUpperCase()}</b>
              <span>{statusLabels[selected.exception.status]}</span>
            </div>
          </header>

          <div className="production-change-dossier-grid">
            <form className="production-change-editor" onSubmit={saveException}>
              <header>
                <span>DESIGN AUTHORITY / 设计权限</span>
                <p>一旦进入已决定，决定内容冻结；验证和关闭仍需单独确认。</p>
              </header>
              <div className="production-change-form-grid">
                <Field label="状态">
                  <select
                    value={editForm.status}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? {
                              ...current,
                              status: event.target.value as ProductionExceptionStatus,
                            }
                          : current,
                      )
                    }
                    disabled={isFrozen(selected)}
                  >
                    {transitions[selected.exception.status].map((status) => (
                      <option value={status} key={status}>{statusLabels[status]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="设计决定">
                  <select
                    value={editForm.decision}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? {
                              ...current,
                              decision: event.target.value as ProductionExceptionDecision,
                            }
                          : current,
                      )
                    }
                    disabled={["decided", "verified", "closed", "withdrawn"].includes(selected.exception.status)}
                  >
                    {decisions.map((item) => (
                      <option value={item.value} key={item.value}>{item.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="类别">
                  <select
                    value={editForm.category}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? {
                              ...current,
                              category: event.target.value as ProductionExceptionCategory,
                            }
                          : current,
                      )
                    }
                    disabled={isFrozen(selected)}
                  >
                    {categories.map((item) => (
                      <option value={item.value} key={item.value}>{item.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="严重程度">
                  <select
                    value={editForm.severity}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? {
                              ...current,
                              severity: event.target.value as ProductionExceptionSeverity,
                            }
                          : current,
                      )
                    }
                    disabled={isFrozen(selected)}
                  >
                    {severities.map((item) => (
                      <option value={item.value} key={item.value}>{item.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="偏差标题">
                <input
                  value={editForm.title}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, title: event.target.value } : current,
                    )
                  }
                  disabled={isFrozen(selected)}
                />
              </Field>
              <Field label="偏差事实">
                <textarea
                  value={editForm.observedDeviation}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current
                        ? { ...current, observedDeviation: event.target.value }
                        : current,
                    )
                  }
                  disabled={isFrozen(selected)}
                />
              </Field>
              <div className="production-change-form-grid">
                <Field label="影响范围">
                  <textarea
                    value={editForm.affectedScope}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? { ...current, affectedScope: event.target.value }
                          : current,
                      )
                    }
                    disabled={isFrozen(selected)}
                  />
                </Field>
                <Field label="建议处置">
                  <textarea
                    value={editForm.proposedResponse}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? { ...current, proposedResponse: event.target.value }
                          : current,
                      )
                    }
                    disabled={isFrozen(selected)}
                  />
                </Field>
                <Field label="设计影响">
                  <textarea
                    value={editForm.designImpact}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? { ...current, designImpact: event.target.value }
                          : current,
                      )
                    }
                    disabled={isFrozen(selected)}
                  />
                </Field>
                <Field label="质量风险">
                  <textarea
                    value={editForm.qualityRisk}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? { ...current, qualityRisk: event.target.value }
                          : current,
                      )
                    }
                    disabled={isFrozen(selected)}
                  />
                </Field>
              </div>
              <div className="production-change-form-grid">
                <Field label="负责人">
                  <input
                    value={editForm.ownerName}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current ? { ...current, ownerName: event.target.value } : current,
                      )
                    }
                    disabled={isFrozen(selected)}
                  />
                </Field>
                <Field label="证据引用">
                  <input
                    value={editForm.evidenceReference}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? { ...current, evidenceReference: event.target.value }
                          : current,
                      )
                    }
                    disabled={isFrozen(selected)}
                  />
                </Field>
                <Field label="发现日期">
                  <input
                    type="date"
                    value={editForm.discoveredAt}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? { ...current, discoveredAt: event.target.value }
                          : current,
                      )
                    }
                    disabled={isFrozen(selected)}
                  />
                </Field>
                <Field label="复核期限">
                  <input
                    type="date"
                    value={editForm.dueAt}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current ? { ...current, dueAt: event.target.value } : current,
                      )
                    }
                    disabled={isFrozen(selected)}
                  />
                </Field>
              </div>
              <Field label="验证记录">
                <textarea
                  value={editForm.verificationNote}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current
                        ? { ...current, verificationNote: event.target.value }
                        : current,
                    )
                  }
                  disabled={isFrozen(selected)}
                  placeholder="记录实际返工、替换或接受后的核验结果。"
                />
              </Field>
              <div className="production-change-form-grid">
                <Field label="最终闭环">
                  <textarea
                    value={editForm.resolutionNote}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? { ...current, resolutionNote: event.target.value }
                          : current,
                      )
                    }
                    disabled={isFrozen(selected)}
                  />
                </Field>
                <Field label="后续放行编号">
                  <input
                    value={editForm.successorReleaseCode}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? { ...current, successorReleaseCode: event.target.value }
                          : current,
                      )
                    }
                    disabled={isFrozen(selected)}
                    placeholder="仅修改产品定义时必填"
                  />
                </Field>
              </div>
              {!isFrozen(selected) && (
                <button type="submit" disabled={saving}>
                  {saving ? "SAVING…" : "SAVE & CONFIRM STEP →"}
                </button>
              )}
            </form>

            <aside className="production-change-timeline">
              <header>
                <span>FACT TIMELINE</span>
                <h4>人工证据链</h4>
              </header>
              <ol>
                {selected.actions.map((action, index) => (
                  <li key={action.id}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <b>{action.actionType.replaceAll("_", " ").toUpperCase()}</b>
                      <p>{action.note}</p>
                      {action.reference && (
                        <code>{action.reference}</code>
                      )}
                      <small>{formatDateTime(action.occurredAt)} · {action.createdBy}</small>
                    </div>
                  </li>
                ))}
              </ol>
              {!isFrozen(selected) && (
                <form onSubmit={addAction}>
                  <Field label="记录类型">
                    <select
                      value={actionForm.actionType}
                      onChange={(event) =>
                        setActionForm((current) => ({
                          ...current,
                          actionType: event.target.value as ProductionExceptionActionType,
                        }))
                      }
                    >
                      {actionTypes.map((item) => (
                        <option value={item.value} key={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="事实记录">
                    <textarea
                      value={actionForm.note}
                      onChange={(event) =>
                        setActionForm((current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                      required
                    />
                  </Field>
                  <Field label="证据引用">
                    <input
                      value={actionForm.reference}
                      onChange={(event) =>
                        setActionForm((current) => ({
                          ...current,
                          reference: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <button type="submit" disabled={addingAction}>
                    {addingAction ? "ADDING…" : "ADD TO TIMELINE +"}
                  </button>
                </form>
              )}
            </aside>
          </div>
        </div>
      )}

      <footer className="production-change-footer">
        <b>NO AUTO APPROVAL.</b>
        <span>NO PO · NO ERP WRITE · NO FACTORY MESSAGE · NO SILENT SPEC CHANGE</span>
      </footer>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="production-change-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Metric({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div className={alert && value > 0 ? "is-alert" : ""}>
      <span>{label}</span>
      <b>{String(value).padStart(2, "0")}</b>
    </div>
  );
}

function editFormFor(workspace: ProductionExceptionWorkspace) {
  const record = workspace.exception;
  return {
    category: record.category as ProductionExceptionCategory,
    severity: record.severity as ProductionExceptionSeverity,
    status: record.status as ProductionExceptionStatus,
    decision: record.decision as ProductionExceptionDecision,
    title: record.title,
    sourceName: record.sourceName,
    sourceReference: record.sourceReference,
    affectedScope: record.affectedScope,
    observedDeviation: record.observedDeviation,
    proposedResponse: record.proposedResponse,
    designImpact: record.designImpact,
    qualityRisk: record.qualityRisk,
    evidenceReference: record.evidenceReference,
    ownerName: record.ownerName,
    discoveredAt: record.discoveredAt ?? "",
    dueAt: record.dueAt ?? "",
    verificationNote: record.verificationNote,
    resolutionNote: record.resolutionNote,
    successorReleaseCode: record.successorReleaseCode,
  };
}

function isFrozen(workspace: ProductionExceptionWorkspace) {
  return ["closed", "withdrawn"].includes(workspace.exception.status);
}

function statusMessage(status: ProductionExceptionStatus) {
  if (status === "decided") return "设计决定已经冻结，等待实际处置与验证。";
  if (status === "verified") return "实际处置已经人工验证，等待最终关闭。";
  if (status === "closed") return "偏差记录已闭环并冻结。";
  if (status === "withdrawn") return "偏差记录已撤回并冻结。";
  return "偏差事实已经保存。";
}

async function requestOverview() {
  const response = await fetch("/api/studio/production-exceptions", {
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok || !payload.overview) {
    throw new Error(payload.error || "无法读取生产变更控制台。");
  }
  return payload.overview;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
