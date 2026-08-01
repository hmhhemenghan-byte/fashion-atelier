"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  SampleSignoffCheck,
  SampleSignoffImage,
} from "@/db/schema";
import type {
  SampleSignoffCheckResult,
  SampleSignoffDecision,
  SampleSignoffImageAngle,
  SampleSignoffImageStatus,
  SampleSignoffOverview,
  SampleSignoffStatus,
  SampleSignoffType,
  SampleSignoffWorkspace,
} from "@/lib/sample-signoffs";

type ApiPayload = {
  overview?: SampleSignoffOverview;
  signoff?: { id: string };
  check?: { id: string };
  image?: { id: string };
  error?: string;
};

type GateFilter =
  | "active"
  | "all"
  | "review"
  | "approved"
  | "sealed"
  | "attention";

const signoffTypes: Array<{
  value: SampleSignoffType;
  label: string;
}> = [
  { value: "preproduction", label: "产前样 / PRE-PRODUCTION" },
  { value: "final", label: "最终样 / FINAL" },
  { value: "showroom", label: "展厅样 / SHOWROOM" },
  { value: "reference", label: "参考样 / REFERENCE" },
];

const signoffStatuses: Array<{
  value: SampleSignoffStatus;
  label: string;
}> = [
  { value: "draft", label: "草稿 / DRAFT" },
  { value: "in_review", label: "核对中 / IN REVIEW" },
  { value: "approved", label: "已批准 / APPROVED" },
  { value: "void", label: "作废 / VOID" },
];

const signoffDecisions: Array<{
  value: SampleSignoffDecision;
  label: string;
}> = [
  { value: "pending", label: "待判断 / PENDING" },
  { value: "approve", label: "通过 / APPROVE" },
  { value: "revise", label: "修改 / REVISE" },
  { value: "hold", label: "暂缓 / HOLD" },
];

const checkResults: Array<{
  value: SampleSignoffCheckResult;
  label: string;
}> = [
  { value: "pending", label: "待核对 / PENDING" },
  { value: "pass", label: "通过 / PASS" },
  { value: "fail", label: "不通过 / FAIL" },
  { value: "na", label: "不适用 / N/A" },
];

const imageAngles: Array<{
  value: SampleSignoffImageAngle;
  label: string;
}> = [
  { value: "front", label: "正面 / FRONT" },
  { value: "side", label: "侧面 / SIDE" },
  { value: "back", label: "背面 / BACK" },
  { value: "detail", label: "细节 / DETAIL" },
  { value: "label", label: "标识 / LABEL" },
  { value: "seal", label: "封样标识 / SEAL" },
  { value: "other", label: "其他 / OTHER" },
];

const emptyCreate = {
  sourceId: "",
  sampleType: "preproduction" as SampleSignoffType,
  sampleSize: "",
  makerReference: "",
  receivedAt: "",
  physicalLocation: "",
  notes: "",
};

const emptyImage = {
  angle: "front" as SampleSignoffImageAngle,
  caption: "",
  altText: "",
  sortOrder: "0",
};

type SignoffEdit = ReturnType<typeof signoffEditForm>;

export default function FinalSampleGate() {
  const [overview, setOverview] = useState<SampleSignoffOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<GateFilter>("active");
  const [query, setQuery] = useState("");
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [editForm, setEditForm] = useState<SignoffEdit | null>(null);
  const [imageForm, setImageForm] = useState(emptyImage);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await requestOverview();
        if (cancelled) return;
        setOverview(next);
        const first = next.signoffs[0] ?? null;
        setSelectedId(first?.signoff.id ?? null);
        setEditForm(first ? signoffEditForm(first) : null);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "无法读取封样签核台。",
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

  const visibleSignoffs = useMemo(() => {
    if (!overview) return [];
    const needle = query.trim().toLocaleLowerCase();
    return overview.signoffs.filter((workspace) => {
      const { signoff, work, technicalPack, summary } = workspace;
      if (
        filter === "active" &&
        ["sealed", "void"].includes(signoff.status)
      ) {
        return false;
      }
      if (filter === "review" && signoff.status !== "in_review") return false;
      if (filter === "approved" && signoff.status !== "approved") return false;
      if (filter === "sealed" && signoff.status !== "sealed") return false;
      if (
        filter === "attention" &&
        summary.failedChecks === 0 &&
        summary.missingFields.length === 0
      ) {
        return false;
      }
      if (!needle) return true;
      return [
        signoff.signoffCode,
        signoff.sealCode,
        work?.title,
        work?.lookNumber,
        work?.collection,
        technicalPack?.techPackCode,
        signoff.makerReference,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [filter, overview, query]);

  const selected =
    overview?.signoffs.find(
      (workspace) => workspace.signoff.id === selectedId,
    ) ?? null;
  const selectedSource = overview?.references.eligibleSources.find(
    (source) => source.technicalPackId === createForm.sourceId,
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
      next.signoffs.find(
        (workspace) => workspace.signoff.id === preferredId,
      ) ??
      next.signoffs[0] ??
      null;
    setSelectedId(nextSelected?.signoff.id ?? null);
    setEditForm(nextSelected ? signoffEditForm(nextSelected) : null);
    window.dispatchEvent(new Event("nera:sample-signoff-updated"));
  }

  function selectSignoff(workspace: SampleSignoffWorkspace) {
    setSelectedId(workspace.signoff.id);
    setEditForm(signoffEditForm(workspace));
    setError("");
    setMessage("");
    setImageForm(emptyImage);
    setImageFile(null);
  }

  async function createSignoff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSource) {
      setError("请选择已经批准试身的技术包。");
      return;
    }
    setCreating(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/studio/sample-signoffs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          technicalPackId: selectedSource.technicalPackId,
          fittingSessionId: selectedSource.fittingSessionId,
          sampleType: createForm.sampleType,
          sampleSize: createForm.sampleSize,
          makerReference: createForm.makerReference,
          receivedAt: createForm.receivedAt || null,
          physicalLocation: createForm.physicalLocation,
          notes: createForm.notes,
        }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.signoff) {
        throw new Error(payload.error || "建立封样签核失败。");
      }
      setCreateForm(emptyCreate);
      await refresh(
        "封样核对已建立，八项人工核对表已就位。",
        payload.signoff.id,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "建立封样签核失败。",
      );
    } finally {
      setCreating(false);
    }
  }

  async function saveSignoff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !editForm) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/studio/sample-signoffs/${encodeURIComponent(selected.signoff.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...editForm,
            receivedAt: editForm.receivedAt || null,
            reviewedAt: editForm.reviewedAt || null,
          }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.signoff) {
        throw new Error(payload.error || "保存封样事实失败。");
      }
      await refresh(
        editForm.status === "approved"
          ? "最终样衣已由设计师批准；实物确认后可生成封样标识。"
          : "封样事实已保存。",
        selected.signoff.id,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "保存封样事实失败。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function sealSignoff() {
    if (!selected || selected.signoff.status !== "approved") return;
    setSealing(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/studio/sample-signoffs/${encodeURIComponent(selected.signoff.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "sealed" }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.signoff) {
        throw new Error(payload.error || "生成封样标识失败。");
      }
      await refresh(
        "封样标识已生成，最终样衣事实永久冻结。",
        selected.signoff.id,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "生成封样标识失败。",
      );
    } finally {
      setSealing(false);
    }
  }

  async function saveCheck(
    id: string,
    patch: {
      result: SampleSignoffCheckResult;
      observation: string;
    },
  ) {
    setSavingItemId(id);
    setError("");
    try {
      const response = await fetch(
        `/api/studio/sample-signoffs/checks/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.check) {
        throw new Error(payload.error || "保存核对结果失败。");
      }
      await refresh("核对结果已保存。", selectedId);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "保存核对结果失败。",
      );
    } finally {
      setSavingItemId(null);
    }
  }

  async function uploadImage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !imageFile) {
      setError("请选择封样证据图片。");
      return;
    }
    setUploadingImage(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      form.set("image", imageFile);
      form.set("angle", imageForm.angle);
      form.set("caption", imageForm.caption);
      form.set("altText", imageForm.altText);
      form.set("sortOrder", imageForm.sortOrder);
      const response = await fetch(
        `/api/studio/sample-signoffs/${encodeURIComponent(selected.signoff.id)}/images`,
        { method: "POST", body: form },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.image) {
        throw new Error(payload.error || "上传封样证据失败。");
      }
      setImageForm(emptyImage);
      setImageFile(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      await refresh("封样证据已存入私密档案。", selected.signoff.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "上传封样证据失败。",
      );
    } finally {
      setUploadingImage(false);
    }
  }

  async function saveImage(
    id: string,
    patch: {
      angle: SampleSignoffImageAngle;
      caption: string;
      altText: string;
      status: SampleSignoffImageStatus;
      sortOrder: string;
    },
  ) {
    setSavingItemId(id);
    setError("");
    try {
      const response = await fetch(
        `/api/studio/sample-signoffs/images/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.image) {
        throw new Error(payload.error || "更新封样证据失败。");
      }
      await refresh("证据记录已保存。", selectedId);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "更新封样证据失败。",
      );
    } finally {
      setSavingItemId(null);
    }
  }

  if (loading) {
    return (
      <section className="sample-gate is-loading" id="final-sample-gate">
        FINAL SAMPLE GATE / LOADING
      </section>
    );
  }

  const frozen = selected
    ? ["approved", "sealed", "void"].includes(selected.signoff.status)
    : false;

  return (
    <section className="sample-gate" id="final-sample-gate">
      <header className="sample-gate-hero">
        <div className="sample-gate-hero-copy">
          <p className="sample-gate-kicker">PHASE 23 / FINAL SAMPLE GATE</p>
          <h2>
            SEAL THE
            <br />
            <i>REFERENCE.</i>
          </h2>
          <p>
            将最终样衣与已批准的技术包、试身、材料和工艺逐项对齐。系统保存核对事实，封样决定只由设计师完成。
          </p>
        </div>
        <aside className="sample-gate-seal" aria-hidden="true">
          <span>NÉRA</span>
          <strong>23</strong>
          <small>FINAL SAMPLE / CONTROLLED</small>
        </aside>
        <div className="sample-gate-hero-rule">
          <span>COMPARE → APPROVE → SEAL</span>
          <span>NO PRODUCTION ORDER</span>
        </div>
      </header>

      {overview && (
        <div className="sample-gate-metrics">
          <Metric
            value={overview.metrics.signoffCount}
            label="GATES"
            detail="全部封样轮次"
          />
          <Metric
            value={overview.metrics.reviewCount}
            label="IN REVIEW"
            detail="正在人工核对"
            accent
          />
          <Metric
            value={overview.metrics.approvedCount}
            label="APPROVED"
            detail="已批准待封存"
          />
          <Metric
            value={overview.metrics.sealedCount}
            label="SEALED"
            detail="最终参考样"
          />
          <Metric
            value={
              overview.metrics.incompleteCount +
              overview.metrics.failedCheckCount
            }
            label="ATTENTION"
            detail="缺口或失败核对"
            attention
          />
        </div>
      )}

      <div className="sample-gate-principles">
        <span>01</span>
        <p>封样只能引用最新的批准试身和明确的技术包修订。</p>
        <span>02</span>
        <p>八项关键核对全部通过后，系统才接受人工批准。</p>
        <span>03</span>
        <p>生成封样标识后不可改写；变化必须建立新轮次。</p>
      </div>

      {(error || message) && (
        <p className={`sample-gate-notice${error ? " is-error" : ""}`}>
          {error || message}
        </p>
      )}

      <section className="sample-gate-create">
        <SectionTitle
          number="01"
          eyebrow="NEW CONTROL GATE"
          title="建立最终样衣核对"
        />
        <form className="sample-gate-create-form" onSubmit={createSignoff}>
          <label className="is-wide">
            <span>APPROVED SOURCE / 已批准来源</span>
            <select
              required
              value={createForm.sourceId}
              onChange={(event) => {
                const source = overview?.references.eligibleSources.find(
                  (item) => item.technicalPackId === event.target.value,
                );
                setCreateForm((current) => ({
                  ...current,
                  sourceId: event.target.value,
                  sampleSize: current.sampleSize || source?.sampleSize || "",
                }));
              }}
            >
              <option value="">选择技术包与最新批准试身</option>
              {overview?.references.eligibleSources.map((source) => (
                <option
                  key={source.technicalPackId}
                  value={source.technicalPackId}
                >
                  {source.techPackCode} · {source.fittingCode} ·{" "}
                  {source.lookNumber || source.workTitle}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>SAMPLE TYPE / 样衣类型</span>
            <select
              value={createForm.sampleType}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  sampleType: event.target.value as SampleSignoffType,
                }))
              }
            >
              {signoffTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>SAMPLE SIZE / 样衣尺码</span>
            <input
              value={createForm.sampleSize}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  sampleSize: event.target.value,
                }))
              }
              placeholder="例如 36 / BASE SIZE"
            />
          </label>
          <label>
            <span>RECEIVED AT / 收样时间</span>
            <input
              type="datetime-local"
              value={createForm.receivedAt}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  receivedAt: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>MAKER REF / 制作参考</span>
            <input
              value={createForm.makerReference}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  makerReference: event.target.value,
                }))
              }
              placeholder="内部版房或样衣编号"
            />
          </label>
          <label className="is-wide">
            <span>PHYSICAL LOCATION / 实物位置</span>
            <input
              value={createForm.physicalLocation}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  physicalLocation: event.target.value,
                }))
              }
              placeholder="例如 ATELIER / RAIL A / BAG 04"
            />
          </label>
          <label className="is-wide">
            <span>NOTES / 准备说明</span>
            <textarea
              rows={3}
              value={createForm.notes}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="记录样衣来源、交接条件或本轮需要特别核对的事实。"
            />
          </label>
          {selectedSource && (
            <div className="sample-gate-source-card">
              <span
                className="sample-gate-source-image"
                role="img"
                aria-label={`${selectedSource.workTitle} 作品图`}
                style={{
                  backgroundImage: `url("${selectedSource.workImageUrl}")`,
                }}
              />
              <div>
                <small>{selectedSource.collection}</small>
                <strong>
                  {selectedSource.lookNumber || "LOOK"} /{" "}
                  {selectedSource.workTitle}
                </strong>
                <p>
                  {selectedSource.techPackCode} ·{" "}
                  {selectedSource.sampleStage.toUpperCase()} ·{" "}
                  {selectedSource.fittingCode}
                </p>
              </div>
            </div>
          )}
          <button type="submit" disabled={creating}>
            {creating ? "正在建立…" : "建立封样核对"}
          </button>
        </form>
      </section>

      <div className="sample-gate-workbench">
        <aside className="sample-gate-index">
          <SectionTitle
            number="02"
            eyebrow="GATE INDEX"
            title="封样台账"
            compact
          />
          <div className="sample-gate-filters">
            {(
              [
                ["active", "进行中"],
                ["all", "全部"],
                ["review", "核对中"],
                ["approved", "已批准"],
                ["sealed", "已封样"],
                ["attention", "需处理"],
              ] as Array<[GateFilter, string]>
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
          <input
            className="sample-gate-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索 Look、技术包或封样编号"
            aria-label="搜索封样台账"
          />
          <div className="sample-gate-list">
            {visibleSignoffs.map((workspace) => (
              <button
                key={workspace.signoff.id}
                type="button"
                className={
                  selectedId === workspace.signoff.id ? "is-active" : ""
                }
                onClick={() => selectSignoff(workspace)}
              >
                <span>
                  {workspace.work?.lookNumber ||
                    `G${String(workspace.signoff.round).padStart(2, "0")}`}
                </span>
                <div>
                  <small>{workspace.signoff.signoffCode}</small>
                  <strong>
                    {workspace.work?.title ?? "未找到的 Look"}
                  </strong>
                  <p>
                    {workspace.signoff.status.toUpperCase()} ·{" "}
                    {workspace.summary.completeness}% ·{" "}
                    {workspace.summary.failedChecks} FAIL
                  </p>
                </div>
              </button>
            ))}
            {visibleSignoffs.length === 0 && (
              <p className="sample-gate-empty">当前筛选下没有封样记录。</p>
            )}
          </div>
        </aside>

        <main className="sample-gate-dossier">
          {!selected || !editForm ? (
            <div className="sample-gate-empty is-large">
              <span>23</span>
              <h3>等待第一件最终样衣</h3>
              <p>批准试身后，在左侧建立封样核对。</p>
            </div>
          ) : (
            <>
              <header className="sample-gate-dossier-head">
                <div>
                  <small>
                    {selected.signoff.signoffCode} / ROUND{" "}
                    {String(selected.signoff.round).padStart(2, "0")}
                  </small>
                  <h3>
                    {selected.work?.lookNumber || "LOOK"} /{" "}
                    {selected.work?.title}
                  </h3>
                  <p>
                    {selected.technicalPack?.techPackCode} ·{" "}
                    {selected.fittingSession?.fittingCode}
                  </p>
                </div>
                <StatusStamp
                  status={selected.signoff.status}
                  sealCode={selected.signoff.sealCode}
                />
              </header>

              <div className="sample-gate-readiness">
                <div>
                  <span>FACT COMPLETENESS</span>
                  <strong>{selected.summary.completeness}%</strong>
                </div>
                <div>
                  <span>CHECKS</span>
                  <strong>
                    {selected.summary.passedChecks}/8 PASS
                  </strong>
                </div>
                <div>
                  <span>EVIDENCE</span>
                  <strong>{selected.summary.activeImages}/10</strong>
                </div>
                <div>
                  <span>APPROVAL</span>
                  <strong>
                    {selected.summary.approvalReady
                      ? "READY"
                      : "NOT READY"}
                  </strong>
                </div>
              </div>

              {selected.technicalPack &&
                !["preproduction", "final"].includes(
                  selected.technicalPack.sampleStage,
                ) && (
                  <p className="sample-gate-stage-warning">
                    当前技术包仍为{" "}
                    {selected.technicalPack.sampleStage.toUpperCase()} 阶段；
                    批准封样前请在技术工艺室推进到 PRE-PRODUCTION 或 FINAL。
                  </p>
                )}

              <form
                className="sample-gate-edit-form"
                onSubmit={saveSignoff}
              >
                <SectionTitle
                  number="03"
                  eyebrow="CONTROL DOSSIER"
                  title="最终样衣事实"
                  compact
                />
                <div className="sample-gate-form-grid">
                  <Field label="STATUS / 状态">
                    <select
                      disabled={frozen}
                      value={editForm.status}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          status: event.target.value as SampleSignoffStatus,
                        })
                      }
                    >
                      {signoffStatuses.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="DECISION / 设计结论">
                    <select
                      disabled={frozen}
                      value={editForm.decision}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          decision: event.target.value as SampleSignoffDecision,
                        })
                      }
                    >
                      {signoffDecisions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="SAMPLE TYPE / 样衣类型">
                    <select
                      disabled={frozen}
                      value={editForm.sampleType}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          sampleType: event.target.value as SampleSignoffType,
                        })
                      }
                    >
                      {signoffTypes.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <TextField
                    label="SAMPLE SIZE / 样衣尺码"
                    value={editForm.sampleSize}
                    disabled={frozen}
                    onChange={(value) =>
                      setEditForm({ ...editForm, sampleSize: value })
                    }
                  />
                  <DateField
                    label="RECEIVED AT / 收样时间"
                    value={editForm.receivedAt}
                    disabled={frozen}
                    onChange={(value) =>
                      setEditForm({ ...editForm, receivedAt: value })
                    }
                  />
                  <DateField
                    label="REVIEWED AT / 审阅时间"
                    value={editForm.reviewedAt}
                    disabled={frozen}
                    onChange={(value) =>
                      setEditForm({ ...editForm, reviewedAt: value })
                    }
                  />
                  <TextField
                    label="MAKER REF / 制作参考"
                    value={editForm.makerReference}
                    disabled={frozen}
                    onChange={(value) =>
                      setEditForm({ ...editForm, makerReference: value })
                    }
                  />
                  <TextField
                    label="PHYSICAL LOCATION / 实物位置"
                    value={editForm.physicalLocation}
                    disabled={frozen}
                    onChange={(value) =>
                      setEditForm({ ...editForm, physicalLocation: value })
                    }
                  />
                  <TextField
                    label="MATERIAL LOT / 面料批次"
                    value={editForm.materialLotReference}
                    disabled={frozen}
                    onChange={(value) =>
                      setEditForm({
                        ...editForm,
                        materialLotReference: value,
                      })
                    }
                  />
                  <TextField
                    label="COLOR STANDARD / 颜色标准"
                    value={editForm.colorStandardReference}
                    disabled={frozen}
                    onChange={(value) =>
                      setEditForm({
                        ...editForm,
                        colorStandardReference: value,
                      })
                    }
                  />
                  <AreaField
                    label="OVERALL OBSERVATION / 总体核对"
                    value={editForm.overallObservation}
                    disabled={frozen}
                    onChange={(value) =>
                      setEditForm({
                        ...editForm,
                        overallObservation: value,
                      })
                    }
                    wide
                  />
                  <AreaField
                    label="APPROVAL NOTE / 批准说明"
                    value={editForm.approvalNote}
                    disabled={frozen}
                    onChange={(value) =>
                      setEditForm({ ...editForm, approvalNote: value })
                    }
                    wide
                  />
                  <AreaField
                    label="INTERNAL NOTES / 内部说明"
                    value={editForm.notes}
                    disabled={frozen}
                    onChange={(value) =>
                      setEditForm({ ...editForm, notes: value })
                    }
                    wide
                  />
                </div>
                {selected.summary.missingFields.length > 0 && !frozen && (
                  <p className="sample-gate-missing">
                    APPROVAL NEEDS /{" "}
                    {selected.summary.missingFields.join(" · ")}
                  </p>
                )}
                {!frozen && (
                  <button
                    className="sample-gate-primary"
                    type="submit"
                    disabled={saving}
                  >
                    {saving ? "正在保存…" : "保存封样事实"}
                  </button>
                )}
                {selected.signoff.status === "approved" && (
                  <button
                    className="sample-gate-seal-button"
                    type="button"
                    disabled={sealing}
                    onClick={() => void sealSignoff()}
                  >
                    {sealing
                      ? "正在生成封样标识…"
                      : "确认实物并生成封样标识"}
                  </button>
                )}
              </form>

              <section className="sample-gate-checks">
                <SectionTitle
                  number="04"
                  eyebrow="EIGHT-POINT CONTROL"
                  title="关键核对表"
                  compact
                />
                <div className="sample-gate-check-grid">
                  {selected.checks.map((check) => (
                    <CheckCard
                      key={`${check.id}:${check.updatedAt}`}
                      check={check}
                      frozen={frozen}
                      saving={savingItemId === check.id}
                      onSave={(patch) => void saveCheck(check.id, patch)}
                    />
                  ))}
                </div>
              </section>

              <section className="sample-gate-evidence">
                <SectionTitle
                  number="05"
                  eyebrow="PRIVATE EVIDENCE"
                  title="封样证据"
                  compact
                />
                {!frozen && (
                  <form
                    className="sample-gate-evidence-form"
                    onSubmit={uploadImage}
                  >
                    <label className="sample-gate-file">
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) =>
                          setImageFile(event.target.files?.[0] ?? null)
                        }
                      />
                      <span>
                        {imageFile ? imageFile.name : "选择封样证据图片"}
                      </span>
                    </label>
                    <select
                      value={imageForm.angle}
                      onChange={(event) =>
                        setImageForm({
                          ...imageForm,
                          angle: event.target
                            .value as SampleSignoffImageAngle,
                        })
                      }
                    >
                      {imageAngles.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={imageForm.caption}
                      onChange={(event) =>
                        setImageForm({
                          ...imageForm,
                          caption: event.target.value,
                        })
                      }
                      placeholder="证据说明"
                    />
                    <input
                      value={imageForm.altText}
                      onChange={(event) =>
                        setImageForm({
                          ...imageForm,
                          altText: event.target.value,
                        })
                      }
                      placeholder="无障碍图片描述"
                    />
                    <button type="submit" disabled={uploadingImage}>
                      {uploadingImage ? "正在上传…" : "上传私密证据"}
                    </button>
                  </form>
                )}
                <div className="sample-gate-image-grid">
                  {selected.images.map((image) => (
                    <ImageCard
                      key={`${image.id}:${image.updatedAt}`}
                      image={image}
                      frozen={frozen}
                      saving={savingItemId === image.id}
                      onSave={(patch) => void saveImage(image.id, patch)}
                    />
                  ))}
                  {selected.images.length === 0 && (
                    <p className="sample-gate-empty">
                      尚无封样证据。批准前至少保存两张不同角度或细节图片。
                    </p>
                  )}
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      <footer className="sample-gate-export">
        <div>
          <span>CONTROLLED EXPORTS</span>
          <p>签核、八项核对与私密证据索引可独立带走。</p>
        </div>
        <Link href="/api/studio/sample-signoffs?format=signoffs">
          SIGNOFF CSV
        </Link>
        <Link href="/api/studio/sample-signoffs?format=checks">
          CHECKS CSV
        </Link>
        <Link href="/api/studio/sample-signoffs?format=images">
          EVIDENCE CSV
        </Link>
        <Link href="/api/studio/sample-signoffs?format=json">FULL JSON</Link>
      </footer>
    </section>
  );
}

function CheckCard(props: {
  check: SampleSignoffCheck;
  frozen: boolean;
  saving: boolean;
  onSave: (patch: {
    result: SampleSignoffCheckResult;
    observation: string;
  }) => void;
}) {
  const [result, setResult] = useState(
    props.check.result as SampleSignoffCheckResult,
  );
  const [observation, setObservation] = useState(props.check.observation);

  return (
    <article
      className={`sample-gate-check is-${props.check.result}`}
    >
      <header>
        <span>{String(props.check.sortOrder + 1).padStart(2, "0")}</span>
        <div>
          <small>{props.check.category.toUpperCase()}</small>
          <strong>{props.check.title}</strong>
        </div>
      </header>
      <p>{props.check.requirement}</p>
      <select
        disabled={props.frozen}
        value={result}
        onChange={(event) =>
          setResult(event.target.value as SampleSignoffCheckResult)
        }
      >
        {checkResults.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <textarea
        rows={3}
        disabled={props.frozen}
        value={observation}
        onChange={(event) => setObservation(event.target.value)}
        placeholder="记录实物观察、差异或核对依据。"
      />
      {!props.frozen && (
        <button
          type="button"
          disabled={props.saving}
          onClick={() => props.onSave({ result, observation })}
        >
          {props.saving ? "保存中…" : "保存核对"}
        </button>
      )}
    </article>
  );
}

function ImageCard(props: {
  image: SampleSignoffImage & { imageUrl: string };
  frozen: boolean;
  saving: boolean;
  onSave: (patch: {
    angle: SampleSignoffImageAngle;
    caption: string;
    altText: string;
    status: SampleSignoffImageStatus;
    sortOrder: string;
  }) => void;
}) {
  const [form, setForm] = useState({
    angle: props.image.angle as SampleSignoffImageAngle,
    caption: props.image.caption,
    altText: props.image.altText,
    status: props.image.status as SampleSignoffImageStatus,
    sortOrder: String(props.image.sortOrder),
  });

  return (
    <article
      className={`sample-gate-image-card${
        props.image.status === "removed" ? " is-removed" : ""
      }`}
    >
      <span
        className="sample-gate-image"
        role="img"
        aria-label={props.image.altText}
        style={{ backgroundImage: `url("${props.image.imageUrl}")` }}
      />
      <div>
        <select
          disabled={props.frozen}
          value={form.angle}
          onChange={(event) =>
            setForm({
              ...form,
              angle: event.target.value as SampleSignoffImageAngle,
            })
          }
        >
          {imageAngles.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          disabled={props.frozen}
          value={form.caption}
          onChange={(event) =>
            setForm({ ...form, caption: event.target.value })
          }
          placeholder="证据说明"
        />
        <input
          disabled={props.frozen}
          value={form.altText}
          onChange={(event) =>
            setForm({ ...form, altText: event.target.value })
          }
          placeholder="图片描述"
        />
        {!props.frozen && (
          <div className="sample-gate-image-actions">
            <button
              type="button"
              disabled={props.saving}
              onClick={() => props.onSave(form)}
            >
              {props.saving ? "保存中…" : "保存证据"}
            </button>
            <button
              type="button"
              onClick={() =>
                props.onSave({
                  ...form,
                  status:
                    form.status === "active" ? "removed" : "active",
                })
              }
            >
              {form.status === "active" ? "移出核对" : "恢复证据"}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function Metric(props: {
  value: number;
  label: string;
  detail: string;
  accent?: boolean;
  attention?: boolean;
}) {
  return (
    <div
      className={`sample-gate-metric${props.accent ? " is-accent" : ""}${
        props.attention ? " is-attention" : ""
      }`}
    >
      <strong>{String(props.value).padStart(2, "0")}</strong>
      <span>{props.label}</span>
      <small>{props.detail}</small>
    </div>
  );
}

function SectionTitle(props: {
  number: string;
  eyebrow: string;
  title: string;
  compact?: boolean;
}) {
  return (
    <header
      className={`sample-gate-section-title${
        props.compact ? " is-compact" : ""
      }`}
    >
      <span>{props.number}</span>
      <div>
        <small>{props.eyebrow}</small>
        <h3>{props.title}</h3>
      </div>
    </header>
  );
}

function StatusStamp(props: {
  status: string;
  sealCode: string | null;
}) {
  return (
    <div className={`sample-gate-status is-${props.status}`}>
      <span>{props.status.toUpperCase()}</span>
      <small>{props.sealCode || "MANUAL CONTROL"}</small>
    </div>
  );
}

function Field(props: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={props.wide ? "is-wide" : ""}>
      <span>{props.label}</span>
      {props.children}
    </label>
  );
}

function TextField(props: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={props.label}>
      <input
        disabled={props.disabled}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </Field>
  );
}

function DateField(props: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={props.label}>
      <input
        type="datetime-local"
        disabled={props.disabled}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </Field>
  );
}

function AreaField(props: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  wide?: boolean;
}) {
  return (
    <Field label={props.label} wide={props.wide}>
      <textarea
        rows={4}
        disabled={props.disabled}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </Field>
  );
}

function signoffEditForm(workspace: SampleSignoffWorkspace) {
  const { signoff } = workspace;
  return {
    sampleType: signoff.sampleType as SampleSignoffType,
    status: signoff.status as SampleSignoffStatus,
    decision: signoff.decision as SampleSignoffDecision,
    sampleSize: signoff.sampleSize,
    makerReference: signoff.makerReference,
    receivedAt: toLocalDateTime(signoff.receivedAt),
    reviewedAt: toLocalDateTime(signoff.reviewedAt),
    physicalLocation: signoff.physicalLocation,
    materialLotReference: signoff.materialLotReference,
    colorStandardReference: signoff.colorStandardReference,
    overallObservation: signoff.overallObservation,
    approvalNote: signoff.approvalNote,
    notes: signoff.notes,
  };
}

async function requestOverview() {
  const response = await fetch("/api/studio/sample-signoffs", {
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok || !payload.overview) {
    throw new Error(payload.error || "无法读取封样签核台。");
  }
  return payload.overview;
}

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
