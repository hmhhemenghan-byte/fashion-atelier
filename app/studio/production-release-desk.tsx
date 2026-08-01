"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ProductionReleaseCheck } from "@/db/schema";
import type {
  ProductionReleaseCheckResult,
  ProductionReleaseDecision,
  ProductionReleaseMode,
  ProductionReleaseOverview,
  ProductionReleaseStatus,
  ProductionReleaseWorkspace,
} from "@/lib/production-releases";

type ApiPayload = {
  overview?: ProductionReleaseOverview;
  release?: { id: string };
  check?: { id: string };
  error?: string;
};

type ReleaseFilter =
  | "active"
  | "all"
  | "review"
  | "ready"
  | "released"
  | "attention";

const releaseModes: Array<{
  value: ProductionReleaseMode;
  label: string;
}> = [
  { value: "atelier", label: "工作室制作 / ATELIER" },
  { value: "small_batch", label: "小批次 / SMALL BATCH" },
  { value: "production", label: "生产准备 / PRODUCTION" },
  { value: "reference", label: "参考放行 / REFERENCE" },
];

const releaseStatuses: Array<{
  value: ProductionReleaseStatus;
  label: string;
}> = [
  { value: "draft", label: "草稿 / DRAFT" },
  { value: "in_review", label: "核对中 / IN REVIEW" },
  { value: "ready", label: "已批准 / READY" },
  { value: "void", label: "作废 / VOID" },
];

const releaseDecisions: Array<{
  value: ProductionReleaseDecision;
  label: string;
}> = [
  { value: "pending", label: "待判断 / PENDING" },
  { value: "release", label: "放行 / RELEASE" },
  { value: "revise", label: "修改 / REVISE" },
  { value: "hold", label: "暂缓 / HOLD" },
];

const checkResults: Array<{
  value: ProductionReleaseCheckResult;
  label: string;
}> = [
  { value: "pending", label: "待核对 / PENDING" },
  { value: "ready", label: "准备完成 / READY" },
  { value: "blocked", label: "阻塞 / BLOCKED" },
  { value: "na", label: "不适用 / N/A" },
];

const emptyCreate = {
  sampleSignoffId: "",
  releaseMode: "atelier" as ProductionReleaseMode,
  factoryName: "",
  factoryReference: "",
  sizeRange: "",
  colorways: "",
  plannedWindowStart: "",
  plannedWindowEnd: "",
  internalNotes: "",
};

type ReleaseEdit = ReturnType<typeof releaseEditForm>;

export default function ProductionReleaseDesk() {
  const [overview, setOverview] =
    useState<ProductionReleaseOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReleaseFilter>("active");
  const [query, setQuery] = useState("");
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [editForm, setEditForm] = useState<ReleaseEdit | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [savingCheckId, setSavingCheckId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await requestOverview();
        if (cancelled) return;
        setOverview(next);
        const first = next.releases[0] ?? null;
        setSelectedId(first?.release.id ?? null);
        setEditForm(first ? releaseEditForm(first) : null);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "无法读取生产放行台。",
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

  const visibleReleases = useMemo(() => {
    if (!overview) return [];
    const needle = query.trim().toLocaleLowerCase();
    return overview.releases.filter((workspace) => {
      const { release, work, technicalPack, sampleSignoff, summary } =
        workspace;
      if (
        filter === "active" &&
        ["released", "superseded", "void"].includes(release.status)
      ) {
        return false;
      }
      if (filter === "review" && release.status !== "in_review") return false;
      if (filter === "ready" && release.status !== "ready") return false;
      if (filter === "released" && release.status !== "released") return false;
      if (
        filter === "attention" &&
        summary.blockedChecks === 0 &&
        summary.missingFields.length === 0
      ) {
        return false;
      }
      if (!needle) return true;
      return [
        release.releaseCode,
        release.authorizationCode,
        release.factoryName,
        release.factoryReference,
        work?.title,
        work?.lookNumber,
        work?.collection,
        technicalPack?.techPackCode,
        sampleSignoff?.sealCode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [filter, overview, query]);

  const selected =
    overview?.releases.find(
      (workspace) => workspace.release.id === selectedId,
    ) ?? null;
  const selectedSource = overview?.references.eligibleSources.find(
    (source) => source.sampleSignoffId === createForm.sampleSignoffId,
  );

  async function refresh(
    successMessage = "",
    preferredId: string | null = selectedId,
  ) {
    setError("");
    if (successMessage) setMessage(successMessage);
    const next = await requestOverview();
    setOverview(next);
    const nextSelected =
      next.releases.find(
        (workspace) => workspace.release.id === preferredId,
      ) ??
      next.releases[0] ??
      null;
    setSelectedId(nextSelected?.release.id ?? null);
    setEditForm(nextSelected ? releaseEditForm(nextSelected) : null);
    window.dispatchEvent(new Event("nera:production-release-updated"));
  }

  function selectRelease(workspace: ProductionReleaseWorkspace) {
    setSelectedId(workspace.release.id);
    setEditForm(releaseEditForm(workspace));
    setError("");
    setMessage("");
  }

  async function createRelease(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSource) {
      setError("请选择已经生成封样标识的最终样衣。");
      return;
    }
    setCreating(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/studio/production-releases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          plannedWindowStart: createForm.plannedWindowStart || null,
          plannedWindowEnd: createForm.plannedWindowEnd || null,
        }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.release) {
        throw new Error(payload.error || "建立生产放行包失败。");
      }
      setCreateForm(emptyCreate);
      await refresh(
        "生产放行包已建立，八项准备核对已就位。",
        payload.release.id,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "建立生产放行包失败。",
      );
    } finally {
      setCreating(false);
    }
  }

  async function saveRelease(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !editForm) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/studio/production-releases/${encodeURIComponent(selected.release.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...editForm,
            plannedWindowStart: editForm.plannedWindowStart || null,
            plannedWindowEnd: editForm.plannedWindowEnd || null,
          }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.release) {
        throw new Error(payload.error || "保存生产放行事实失败。");
      }
      await refresh(
        editForm.status === "ready"
          ? "生产放行包已由设计师批准；最终确认后可生成放行标识。"
          : "生产放行事实已保存。",
        selected.release.id,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "保存生产放行事实失败。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function authorizeRelease() {
    if (!selected || selected.release.status !== "ready") return;
    setAuthorizing(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/studio/production-releases/${encodeURIComponent(selected.release.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "released" }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.release) {
        throw new Error(payload.error || "生成生产放行标识失败。");
      }
      await refresh(
        "生产定义已冻结并生成唯一放行标识；系统未向任何外部人员发送信息。",
        selected.release.id,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "生成生产放行标识失败。",
      );
    } finally {
      setAuthorizing(false);
    }
  }

  async function saveCheck(
    check: ProductionReleaseCheck,
    result: ProductionReleaseCheckResult,
    observation: string,
  ) {
    setSavingCheckId(check.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/studio/production-releases/checks/${encodeURIComponent(check.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ result, observation }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.check) {
        throw new Error(payload.error || "保存准备核对失败。");
      }
      await refresh("准备核对已保存。", selected?.release.id ?? null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "保存准备核对失败。",
      );
    } finally {
      setSavingCheckId(null);
    }
  }

  if (loading) {
    return (
      <section className="production-release is-loading">
        <p>正在汇集封样与生产准备事实…</p>
      </section>
    );
  }

  if (!overview) {
    return (
      <section className="production-release is-loading is-error">
        <p>{error || "生产放行台暂时不可用。"}</p>
      </section>
    );
  }

  return (
    <section
      className="production-release"
      id="production-release-desk"
      aria-labelledby="production-release-title"
    >
      <header className="production-release-hero">
        <div className="production-release-hero-copy">
          <p className="production-release-kicker">
            24 / PRODUCTION RELEASE DESK
          </p>
          <h2 id="production-release-title">
            RELEASE THE
            <i> DEFINITION.</i>
          </h2>
          <p>
            把封样、最终修订、尺码范围与质量边界整理为一份可追溯的人工放行事实。
            它不会下单、不会联系工厂，也不会替设计师批准生产。
          </p>
        </div>
        <div className="production-release-ticket" aria-hidden="true">
          <span>NÉRA / CONTROL</span>
          <strong>GO</strong>
          <small>THE DEFINITION PRECEDES THE LINE.</small>
          <b>24</b>
        </div>
        <div className="production-release-hero-rule">
          <span>SEALED SAMPLE → CONTROL PACK → HUMAN RELEASE</span>
          <span>NO PO / NO AUTO SEND</span>
        </div>
      </header>

      <div className="production-release-metrics">
        <Metric
          value={overview.metrics.releaseCount}
          label="PACKS"
          detail="全部放行包"
        />
        <Metric
          value={
            overview.metrics.draftCount + overview.metrics.reviewCount
          }
          label="IN CONTROL"
          detail="草稿或核对中"
        />
        <Metric
          value={overview.metrics.readyCount}
          label="READY"
          detail="已批准待授权"
          accent
        />
        <Metric
          value={overview.metrics.releasedCount}
          label="RELEASED"
          detail="已生成放行标识"
        />
        <Metric
          value={
            overview.metrics.attentionCount +
            overview.metrics.sealedSamplesWithoutReleaseCount
          }
          label="ATTENTION"
          detail="缺口或待建立"
          attention
        />
      </div>

      <div className="production-release-principles">
        <span>01</span>
        <p>生产放行只从已封存、带唯一封样标识的最终样衣开始。</p>
        <span>02</span>
        <p>八项准备事实全部完成且没有开放风险，才允许设计师批准。</p>
        <span>03</span>
        <p>生成放行标识后永久冻结；变化必须建立新的封样与放行序列。</p>
      </div>

      {(error || message) && (
        <p
          className={`production-release-notice${error ? " is-error" : ""}`}
          role="status"
        >
          {error || message}
        </p>
      )}

      <section className="production-release-create">
        <SectionTitle
          number="01"
          eyebrow="NEW RELEASE PACK"
          title="从封样建立生产放行包"
        />
        <form
          className="production-release-create-form"
          onSubmit={createRelease}
        >
          <label className="is-wide">
            <span>SEALED SOURCE / 已封样来源</span>
            <select
              required
              value={createForm.sampleSignoffId}
              onChange={(event) => {
                const source = overview.references.eligibleSources.find(
                  (item) => item.sampleSignoffId === event.target.value,
                );
                setCreateForm((current) => ({
                  ...current,
                  sampleSignoffId: event.target.value,
                  sizeRange:
                    current.sizeRange ||
                    source?.sampleSize ||
                    source?.baseSize ||
                    "",
                }));
              }}
            >
              <option value="">选择封样标识、技术包与 Look</option>
              {overview.references.eligibleSources.map((source) => (
                <option
                  key={source.sampleSignoffId}
                  value={source.sampleSignoffId}
                >
                  {source.sealCode} · {source.techPackCode} ·{" "}
                  {source.lookNumber || source.workTitle}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>RELEASE MODE / 放行方式</span>
            <select
              value={createForm.releaseMode}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  releaseMode: event.target.value as ProductionReleaseMode,
                }))
              }
            >
              {releaseModes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>MAKER / 执行方或版房</span>
            <input
              value={createForm.factoryName}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  factoryName: event.target.value,
                }))
              }
              placeholder="内部工作室、版房或生产伙伴"
            />
          </label>
          <label>
            <span>MAKER REF / 执行参考</span>
            <input
              value={createForm.factoryReference}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  factoryReference: event.target.value,
                }))
              }
              placeholder="内部参考编号，不发送"
            />
          </label>
          <label>
            <span>SIZE RANGE / 尺码范围</span>
            <input
              value={createForm.sizeRange}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  sizeRange: event.target.value,
                }))
              }
              placeholder="例如 34—42 / BASE 36"
            />
          </label>
          <label className="is-wide">
            <span>COLORWAYS / 生产色组</span>
            <input
              value={createForm.colorways}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  colorways: event.target.value,
                }))
              }
              placeholder="例如 Noir 01 / Oxblood 07"
            />
          </label>
          <label>
            <span>WINDOW START / 计划开始</span>
            <input
              type="date"
              value={createForm.plannedWindowStart}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  plannedWindowStart: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>WINDOW END / 计划结束</span>
            <input
              type="date"
              value={createForm.plannedWindowEnd}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  plannedWindowEnd: event.target.value,
                }))
              }
            />
          </label>
          <label className="is-wide">
            <span>INTERNAL NOTE / 内部说明</span>
            <textarea
              value={createForm.internalNotes}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  internalNotes: event.target.value,
                }))
              }
              placeholder="记录范围、责任边界或尚需人工确认的上下文"
            />
          </label>
          {selectedSource && (
            <div className="production-release-source-preview">
              <div
                role="img"
                aria-label={`${selectedSource.workTitle} 作品图`}
                style={{
                  backgroundImage: `url("${selectedSource.workImageUrl}")`,
                }}
              />
              <p>
                <span>{selectedSource.sealCode}</span>
                <strong>
                  {selectedSource.lookNumber || selectedSource.workTitle}
                </strong>
                <small>
                  {selectedSource.techPackCode} · REV{" "}
                  {selectedSource.revision}
                </small>
              </p>
            </div>
          )}
          <button
            className="production-release-primary"
            type="submit"
            disabled={creating}
          >
            {creating ? "正在建立…" : "建立放行包 →"}
          </button>
        </form>
      </section>

      <section className="production-release-control">
        <SectionTitle
          number="02"
          eyebrow="CONTROL REGISTER"
          title="核对、批准并冻结生产定义"
        />
        <div className="production-release-toolbar">
          <div>
            {(
              [
                ["active", "ACTIVE"],
                ["all", "ALL"],
                ["review", "REVIEW"],
                ["ready", "READY"],
                ["released", "RELEASED"],
                ["attention", "ATTENTION"],
              ] as Array<[ReleaseFilter, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filter === value ? "is-active" : ""}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <label>
            <span className="sr-only">搜索生产放行包</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="SEARCH RELEASE / LOOK / MAKER"
            />
          </label>
        </div>

        <div className="production-release-workbench">
          <div className="production-release-list">
            {visibleReleases.length === 0 && (
              <p className="production-release-empty">
                当前筛选下没有生产放行记录。
              </p>
            )}
            {visibleReleases.map((workspace) => (
              <button
                key={workspace.release.id}
                type="button"
                className={
                  workspace.release.id === selectedId ? "is-active" : ""
                }
                onClick={() => selectRelease(workspace)}
              >
                <span>{workspace.release.releaseCode}</span>
                <strong>
                  {workspace.work?.lookNumber ||
                    workspace.work?.title ||
                    "UNTITLED"}
                </strong>
                <small>
                  {workspace.release.factoryName || "MAKER NOT SET"} ·{" "}
                  {statusLabel(workspace.release.status)}
                </small>
                <b>{workspace.summary.completeness}%</b>
              </button>
            ))}
          </div>

          <div className="production-release-dossier">
            {!selected || !editForm ? (
              <div className="production-release-empty is-dossier">
                <strong>NO RELEASE SELECTED</strong>
                <p>建立或选择一份生产放行包后，在这里完成核对。</p>
              </div>
            ) : (
              <>
                <header className="production-release-dossier-head">
                  <div
                    className="production-release-work-image"
                    role="img"
                    aria-label={`${selected.work?.title || "Look"} 作品图`}
                    style={{
                      backgroundImage: `url("${selected.work?.imageUrl || ""}")`,
                    }}
                  />
                  <div>
                    <small>CONTROL DOSSIER</small>
                    <h3>
                      {selected.work?.lookNumber || selected.work?.title}
                    </h3>
                    <p>
                      {selected.release.releaseCode} ·{" "}
                      {selected.technicalPack?.techPackCode} ·{" "}
                      {selected.sampleSignoff?.sealCode}
                    </p>
                    {selected.release.authorizationCode && (
                      <code>{selected.release.authorizationCode}</code>
                    )}
                  </div>
                  <StatusBadge status={selected.release.status} />
                </header>

                <div className="production-release-readiness">
                  <div>
                    <span>COMPLETENESS</span>
                    <strong>{selected.summary.completeness}%</strong>
                  </div>
                  <div>
                    <span>READY CHECKS</span>
                    <strong>{selected.summary.readyChecks}/8</strong>
                  </div>
                  <div>
                    <span>BLOCKED</span>
                    <strong>{selected.summary.blockedChecks}</strong>
                  </div>
                  <p>
                    {selected.summary.approvalReady
                      ? "全部准备事实已经满足，可以由设计师批准。"
                      : selected.summary.missingFields.length > 0
                        ? `仍需处理：${selected.summary.missingFields.join("、")}。`
                        : "请完成八项人工核对并明确设计师结论。"}
                  </p>
                </div>

                <form
                  className="production-release-edit-form"
                  onSubmit={saveRelease}
                >
                  <label>
                    <span>STATUS / 状态</span>
                    <select
                      value={editForm.status}
                      disabled={isFrozen(selected.release.status)}
                      onChange={(event) =>
                        setEditForm((current) =>
                          current
                            ? {
                                ...current,
                                status: event.target
                                  .value as ProductionReleaseStatus,
                              }
                            : current,
                        )
                      }
                    >
                      {releaseStatuses.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>DECISION / 设计师结论</span>
                    <select
                      value={editForm.decision}
                      disabled={isFrozen(selected.release.status)}
                      onChange={(event) =>
                        setEditForm((current) =>
                          current
                            ? {
                                ...current,
                                decision: event.target
                                  .value as ProductionReleaseDecision,
                              }
                            : current,
                        )
                      }
                    >
                      {releaseDecisions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>MODE / 放行方式</span>
                    <select
                      value={editForm.releaseMode}
                      disabled={isFrozen(selected.release.status)}
                      onChange={(event) =>
                        setEditForm((current) =>
                          current
                            ? {
                                ...current,
                                releaseMode: event.target
                                  .value as ProductionReleaseMode,
                              }
                            : current,
                        )
                      }
                    >
                      {releaseModes.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <TextField
                    label="MAKER / 执行方或版房"
                    value={editForm.factoryName}
                    disabled={isFrozen(selected.release.status)}
                    onChange={(value) =>
                      setEditForm((current) =>
                        current ? { ...current, factoryName: value } : current,
                      )
                    }
                  />
                  <TextField
                    label="MAKER REF / 执行参考"
                    value={editForm.factoryReference}
                    disabled={isFrozen(selected.release.status)}
                    onChange={(value) =>
                      setEditForm((current) =>
                        current
                          ? { ...current, factoryReference: value }
                          : current,
                      )
                    }
                  />
                  <TextField
                    label="SIZE RANGE / 尺码范围"
                    value={editForm.sizeRange}
                    disabled={isFrozen(selected.release.status)}
                    onChange={(value) =>
                      setEditForm((current) =>
                        current ? { ...current, sizeRange: value } : current,
                      )
                    }
                  />
                  <TextField
                    className="is-wide"
                    label="COLORWAYS / 生产色组"
                    value={editForm.colorways}
                    disabled={isFrozen(selected.release.status)}
                    onChange={(value) =>
                      setEditForm((current) =>
                        current ? { ...current, colorways: value } : current,
                      )
                    }
                  />
                  <label>
                    <span>WINDOW START / 计划开始</span>
                    <input
                      type="date"
                      value={editForm.plannedWindowStart}
                      disabled={isFrozen(selected.release.status)}
                      onChange={(event) =>
                        setEditForm((current) =>
                          current
                            ? {
                                ...current,
                                plannedWindowStart: event.target.value,
                              }
                            : current,
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>WINDOW END / 计划结束</span>
                    <input
                      type="date"
                      value={editForm.plannedWindowEnd}
                      disabled={isFrozen(selected.release.status)}
                      onChange={(event) =>
                        setEditForm((current) =>
                          current
                            ? {
                                ...current,
                                plannedWindowEnd: event.target.value,
                              }
                            : current,
                        )
                      }
                    />
                  </label>
                  <TextArea
                    label="QUALITY STANDARD / 质量标准"
                    value={editForm.qualityStandard}
                    disabled={isFrozen(selected.release.status)}
                    onChange={(value) =>
                      setEditForm((current) =>
                        current
                          ? { ...current, qualityStandard: value }
                          : current,
                      )
                    }
                  />
                  <TextArea
                    label="LABELS & PACKAGING / 标识与包装"
                    value={editForm.packagingInstruction}
                    disabled={isFrozen(selected.release.status)}
                    onChange={(value) =>
                      setEditForm((current) =>
                        current
                          ? { ...current, packagingInstruction: value }
                          : current,
                      )
                    }
                  />
                  <TextArea
                    label="RELEASE SUMMARY / 放行摘要"
                    value={editForm.releaseSummary}
                    disabled={isFrozen(selected.release.status)}
                    onChange={(value) =>
                      setEditForm((current) =>
                        current
                          ? { ...current, releaseSummary: value }
                          : current,
                      )
                    }
                  />
                  <TextArea
                    label="OPEN RISK / 未关闭风险"
                    value={editForm.openRisk}
                    disabled={isFrozen(selected.release.status)}
                    onChange={(value) =>
                      setEditForm((current) =>
                        current ? { ...current, openRisk: value } : current,
                      )
                    }
                    danger
                  />
                  <TextArea
                    className="is-wide"
                    label="INTERNAL NOTES / 内部说明"
                    value={editForm.internalNotes}
                    disabled={isFrozen(selected.release.status)}
                    onChange={(value) =>
                      setEditForm((current) =>
                        current ? { ...current, internalNotes: value } : current,
                      )
                    }
                  />
                  {!isFrozen(selected.release.status) && (
                    <button
                      className="production-release-primary"
                      type="submit"
                      disabled={saving}
                    >
                      {saving ? "正在保存…" : "保存生产放行事实 →"}
                    </button>
                  )}
                </form>

                <section className="production-release-checks">
                  <div>
                    <small>03 / EIGHT-POINT READINESS</small>
                    <h4>八项事实，决定是否可以放行。</h4>
                  </div>
                  <div className="production-release-check-grid">
                    {selected.checks.map((check, index) => (
                      <ReleaseCheckCard
                        key={`${check.id}-${check.updatedAt}`}
                        check={check}
                        number={String(index + 1).padStart(2, "0")}
                        frozen={isFrozen(selected.release.status)}
                        saving={savingCheckId === check.id}
                        onSave={saveCheck}
                      />
                    ))}
                  </div>
                </section>

                {selected.release.status === "ready" && (
                  <section className="production-release-authorize">
                    <div>
                      <small>FINAL HUMAN ACTION</small>
                      <h4>生成放行标识，冻结这份生产定义。</h4>
                      <p>
                        该操作只在系统内形成不可改写事实，不会发送邮件、
                        不会通知工厂，也不会生成采购或生产订单。
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={authorizing}
                      onClick={() => void authorizeRelease()}
                    >
                      {authorizing ? "正在生成…" : "确认并生成 NERA-GO →"}
                    </button>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <footer className="production-release-export">
        <div>
          <span>04 / CONTROLLED OUTPUTS</span>
          <h3>带走放行事实，不带走隐性假设。</h3>
          <p>
            CSV 适合人工核对，JSON 保留封样、技术包、Look、核对项与准备度关系。
          </p>
        </div>
        <Link href="/api/studio/production-releases?format=releases">
          RELEASES CSV ↗
        </Link>
        <Link href="/api/studio/production-releases?format=checks">
          CHECKS CSV ↗
        </Link>
        <Link href="/api/studio/production-releases?format=json">
          COMPLETE JSON ↗
        </Link>
      </footer>
    </section>
  );
}

function Metric({
  value,
  label,
  detail,
  accent = false,
  attention = false,
}: {
  value: number;
  label: string;
  detail: string;
  accent?: boolean;
  attention?: boolean;
}) {
  return (
    <div
      className={`production-release-metric${accent ? " is-accent" : ""}${attention ? " is-attention" : ""}`}
    >
      <strong>{String(value).padStart(2, "0")}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </div>
  );
}

function SectionTitle({
  number,
  eyebrow,
  title,
}: {
  number: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <header className="production-release-section-title">
      <b>{number}</b>
      <div>
        <small>{eyebrow}</small>
        <h3>{title}</h3>
      </div>
    </header>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`production-release-status is-${status}`}>
      {statusLabel(status)}
    </span>
  );
}

function TextField({
  label,
  value,
  disabled,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={className}>
      <span>{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  disabled,
  onChange,
  className = "",
  danger = false,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  className?: string;
  danger?: boolean;
}) {
  return (
    <label
      className={`${className}${danger ? " is-danger" : ""}`.trim()}
    >
      <span>{label}</span>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ReleaseCheckCard({
  check,
  number,
  frozen,
  saving,
  onSave,
}: {
  check: ProductionReleaseCheck;
  number: string;
  frozen: boolean;
  saving: boolean;
  onSave: (
    check: ProductionReleaseCheck,
    result: ProductionReleaseCheckResult,
    observation: string,
  ) => Promise<void>;
}) {
  const [result, setResult] = useState<ProductionReleaseCheckResult>(
    check.result as ProductionReleaseCheckResult,
  );
  const [observation, setObservation] = useState(check.observation);

  return (
    <article
      className={`production-release-check is-${check.result}`}
    >
      <small>{number}</small>
      <h5>{check.title}</h5>
      <p>{check.requirement}</p>
      <label>
        <span>RESULT / 结果</span>
        <select
          value={result}
          disabled={frozen}
          onChange={(event) =>
            setResult(event.target.value as ProductionReleaseCheckResult)
          }
        >
          {checkResults.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>OBSERVATION / 事实观察</span>
        <textarea
          value={observation}
          disabled={frozen}
          onChange={(event) => setObservation(event.target.value)}
          placeholder="写下核对依据、范围与仍需注意的细节"
        />
      </label>
      {!frozen && (
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave(check, result, observation)}
        >
          {saving ? "保存中…" : "保存核对"}
        </button>
      )}
    </article>
  );
}

function releaseEditForm(workspace: ProductionReleaseWorkspace) {
  const { release } = workspace;
  return {
    releaseMode: release.releaseMode as ProductionReleaseMode,
    status: release.status as ProductionReleaseStatus,
    decision: release.decision as ProductionReleaseDecision,
    factoryName: release.factoryName,
    factoryReference: release.factoryReference,
    sizeRange: release.sizeRange,
    colorways: release.colorways,
    plannedWindowStart: release.plannedWindowStart ?? "",
    plannedWindowEnd: release.plannedWindowEnd ?? "",
    qualityStandard: release.qualityStandard,
    packagingInstruction: release.packagingInstruction,
    releaseSummary: release.releaseSummary,
    openRisk: release.openRisk,
    internalNotes: release.internalNotes,
  };
}

async function requestOverview() {
  const response = await fetch("/api/studio/production-releases", {
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok || !payload.overview) {
    throw new Error(payload.error || "无法读取生产放行台。");
  }
  return payload.overview;
}

function isFrozen(status: string) {
  return ["ready", "released", "superseded", "void"].includes(status);
}

function statusLabel(status: string) {
  return (
    {
      draft: "DRAFT",
      in_review: "IN REVIEW",
      ready: "READY",
      released: "RELEASED",
      superseded: "SUPERSEDED",
      void: "VOID",
    }[status] ?? status.toUpperCase()
  );
}
