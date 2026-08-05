"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  ConservationCheckResult,
  ConservationCondition,
  ConservationImageAngle,
  ConservationOverview,
  ConservationReportDecision,
  ConservationReportStatus,
  ConservationSeverity,
  ConservationWorkspace,
} from "@/lib/conservation-reports";

type ApiPayload = {
  overview?: ConservationOverview;
  report?: { id: string };
  check?: { id: string };
  image?: { id: string };
  error?: string;
};

const statusLabels: Record<ConservationReportStatus, string> = {
  draft: "草稿 / DRAFT",
  in_review: "复核中 / IN REVIEW",
  approved: "已批准 / APPROVED",
  closed: "已关闭 / CLOSED",
  void: "已作废 / VOID",
};

const transitions: Record<ConservationReportStatus, ConservationReportStatus[]> = {
  draft: ["draft", "in_review", "void"],
  in_review: ["in_review", "draft", "approved", "void"],
  approved: ["approved", "closed"],
  closed: ["closed"],
  void: ["void"],
};

const decisions: Array<{ value: ConservationReportDecision; label: string }> = [
  { value: "pending", label: "待决定 / PENDING" },
  { value: "monitor", label: "持续观察 / MONITOR" },
  { value: "treat", label: "需要处理 / TREAT" },
  { value: "ready_for_use", label: "可安全使用 / READY" },
  { value: "archive", label: "限制使用并归档 / ARCHIVE" },
];

const conditions: Array<{ value: ConservationCondition; label: string }> = [
  { value: "not_checked", label: "未检查" },
  { value: "excellent", label: "极佳 / EXCELLENT" },
  { value: "good", label: "良好 / GOOD" },
  { value: "worn", label: "有使用痕迹 / WORN" },
  { value: "damaged", label: "受损 / DAMAGED" },
  { value: "critical", label: "关键风险 / CRITICAL" },
];

const angles: Array<{ value: ConservationImageAngle; label: string }> = [
  { value: "overall", label: "整体 / OVERALL" },
  { value: "front", label: "正面 / FRONT" },
  { value: "back", label: "背面 / BACK" },
  { value: "interior", label: "内部 / INTERIOR" },
  { value: "detail", label: "细节 / DETAIL" },
  { value: "label", label: "标识 / LABEL" },
  { value: "damage", label: "受损位置 / DAMAGE" },
  { value: "other", label: "其他 / OTHER" },
];

const emptyCreate = {
  sampleAssetId: "",
  assessedAt: "",
  assessmentLocation: "",
};

const emptyImage = {
  file: null as File | null,
  angle: "overall" as ConservationImageAngle,
  caption: "",
  altText: "",
};

type EditForm = ReturnType<typeof editFormFor>;
type Filter = "active" | "attention" | "approved" | "all";

export default function ConservationAtelier() {
  const [overview, setOverview] = useState<ConservationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [query, setQuery] = useState("");
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [imageForm, setImageForm] = useState(emptyImage);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingCheckId, setSavingCheckId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await requestOverview();
        if (cancelled) return;
        const first = next.reports[0] ?? null;
        setOverview(next);
        setSelectedId(first?.report.id ?? null);
        setEditForm(first ? editFormFor(first) : null);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "无法读取作品养护室。");
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
    return overview.reports.filter((workspace) => {
      const { report, asset, work, summary } = workspace;
      if (filter === "active" && ["approved", "closed", "void"].includes(report.status)) return false;
      if (filter === "attention" && summary.criticalChecks === 0 && !summary.overdue) return false;
      if (filter === "approved" && !["approved", "closed"].includes(report.status)) return false;
      if (!needle) return true;
      return [report.reportCode, asset?.assetCode, asset?.workTitle, work?.title, work?.lookNumber]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [filter, overview, query]);

  const selected = overview?.reports.find((workspace) => workspace.report.id === selectedId) ?? null;
  const selectedSource = overview?.references.assets.find(
    (asset) => asset.sampleAssetId === createForm.sampleAssetId,
  );

  async function refresh(successMessage = "", preferredId: string | null = selectedId) {
    setError("");
    if (successMessage) setMessage(successMessage);
    const next = await requestOverview();
    const nextSelected =
      next.reports.find((workspace) => workspace.report.id === preferredId) ??
      next.reports[0] ??
      null;
    setOverview(next);
    setSelectedId(nextSelected?.report.id ?? null);
    setEditForm(nextSelected ? editFormFor(nextSelected) : null);
    window.dispatchEvent(new Event("nera:conservation-updated"));
  }

  function selectReport(workspace: ConservationWorkspace) {
    setSelectedId(workspace.report.id);
    setEditForm(editFormFor(workspace));
    setImageForm(emptyImage);
    setError("");
    setMessage("");
  }

  async function createReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSource) return setError("请选择可检查的实物档案。");
    setCreating(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/studio/conservation-reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.report) throw new Error(payload.error || "建立养护报告失败。");
      setCreateForm(emptyCreate);
      await refresh("新一轮养护检查已建立；实物库存状态没有被自动改写。", payload.report.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "建立养护报告失败。");
    } finally {
      setCreating(false);
    }
  }

  async function saveReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !editForm) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/studio/conservation-reports/${encodeURIComponent(selected.report.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            selected.report.status === "approved" && editForm.status === "closed"
              ? { status: "closed" }
              : editForm,
          ),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.report) throw new Error(payload.error || "保存养护报告失败。");
      await refresh(
        editForm.status === "approved"
          ? "人工养护结论已经批准并冻结。"
          : editForm.status === "closed"
            ? "该轮养护报告已经关闭；后续变化需建立新一轮。"
            : "养护报告已经保存。",
        selected.report.id,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存养护报告失败。");
    } finally {
      setSaving(false);
    }
  }

  async function updateCheck(
    id: string,
    result: ConservationCheckResult,
    severity: ConservationSeverity,
    observation: string,
    treatmentNote: string,
  ) {
    setSavingCheckId(id);
    setError("");
    try {
      const response = await fetch(
        `/api/studio/conservation-reports/checks/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ result, severity, observation, treatmentNote }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.check) throw new Error(payload.error || "保存部位检查失败。");
      await refresh("部位检查事实已经保存。", selectedId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存部位检查失败。");
    } finally {
      setSavingCheckId(null);
    }
  }

  async function uploadEvidence(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !imageForm.file) return setError("请选择状态证据图片。");
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("image", imageForm.file);
      body.append("angle", imageForm.angle);
      body.append("caption", imageForm.caption);
      body.append("altText", imageForm.altText);
      const response = await fetch(
        `/api/studio/conservation-reports/${encodeURIComponent(selected.report.id)}/images`,
        { method: "POST", body },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.image) throw new Error(payload.error || "上传养护证据失败。");
      setImageForm(emptyImage);
      await refresh("私密状态证据已经上传。", selected.report.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "上传养护证据失败。");
    } finally {
      setUploading(false);
    }
  }

  async function removeEvidence(id: string) {
    setError("");
    try {
      const response = await fetch(
        `/api/studio/conservation-reports/images/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "removed" }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.image) throw new Error(payload.error || "移除证据失败。");
      await refresh("证据已从本轮有效记录中移除。", selectedId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "移除证据失败。");
    }
  }

  return (
    <section
      className="production-change-control production-acceptance conservation-atelier"
      id="conservation-atelier"
      aria-labelledby="conservation-atelier-title"
    >
      <header className="production-change-hero">
        <div>
          <span>28 / CONSERVATION ATELIER</span>
          <h2 id="conservation-atelier-title">
            READ THE WEAR.<br />
            <i>PRESERVE THE FORM.</i>
          </h2>
          <p>
            对真实样衣进行部位检查、记录状态证据、提出处理与保存建议，
            让每次人工判断形成可追溯、不可覆盖的养护事实。
          </p>
        </div>
        <div className="production-change-mark" aria-hidden="true">
          <b>✦</b>
          <span>PHYSICAL STEWARDSHIP</span>
        </div>
      </header>

      <div className="production-change-metrics">
        <Metric label="TOTAL" value={overview?.metrics.total ?? 0} />
        <Metric label="IN REVIEW" value={overview?.metrics.inReview ?? 0} />
        <Metric label="APPROVED" value={overview?.metrics.approved ?? 0} />
        <Metric label="TREATMENT" value={overview?.metrics.treatment ?? 0} />
        <Metric label="ATTENTION" value={overview?.metrics.attention ?? 0} alert />
      </div>

      <div className="production-change-principles">
        <p><span>01</span>养护报告引用实物档案，但不自动改写库存状态。</p>
        <p><span>02</span>六个部位检查与私密影像共同构成状态证据。</p>
        <p><span>03</span>高风险未解决时，系统拒绝批准人工结论。</p>
      </div>

      {(error || message) && (
        <div className={`production-change-notice${error ? " is-error" : ""}`} role="status">
          {error || message}
        </div>
      )}

      <div className="production-change-layout">
        <aside className="production-change-create">
          <header>
            <span>NEW CONDITION REPORT / 新检查</span>
            <h3>从可确认的实物开始。</h3>
          </header>
          <form onSubmit={createReport}>
            <Field label="实物档案 / SAMPLE ASSET">
              <select
                value={createForm.sampleAssetId}
                onChange={(event) => setCreateForm((current) => ({ ...current, sampleAssetId: event.target.value }))}
                required
              >
                <option value="">选择实物档案</option>
                {overview?.references.assets.map((asset) => (
                  <option value={asset.sampleAssetId} key={asset.sampleAssetId}>
                    {asset.assetCode} · {asset.workTitle} · R{asset.latestSequence + 1}
                  </option>
                ))}
              </select>
            </Field>
            {selectedSource && (
              <div className="production-change-source">
                <div
                  className="production-change-source-image"
                  style={selectedSource.imageUrl ? { backgroundImage: `url("${selectedSource.imageUrl.replaceAll('"', "%22")}")` } : undefined}
                  aria-hidden="true"
                />
                <div>
                  <b>{selectedSource.workTitle}</b>
                  <span>{selectedSource.assetCode}</span>
                  <small>{selectedSource.condition.toUpperCase()} · {selectedSource.currentLocation}</small>
                </div>
              </div>
            )}
            <Field label="检查时间">
              <input type="datetime-local" value={createForm.assessedAt} onChange={(event) => setCreateForm((current) => ({ ...current, assessedAt: event.target.value }))} />
            </Field>
            <Field label="检查地点">
              <input value={createForm.assessmentLocation} onChange={(event) => setCreateForm((current) => ({ ...current, assessmentLocation: event.target.value }))} placeholder={selectedSource?.currentLocation || "MAIN RACK"} />
            </Field>
            <button type="submit" disabled={creating || !selectedSource}>
              {creating ? "CREATING…" : "CREATE REPORT →"}
            </button>
          </form>
          <div className="production-change-export">
            <Link href="/api/studio/conservation-reports?format=reports">REPORTS CSV</Link>
            <Link href="/api/studio/conservation-reports?format=checks">CHECKS CSV</Link>
            <Link href="/api/studio/conservation-reports?format=images">EVIDENCE CSV</Link>
            <Link href="/api/studio/conservation-reports?format=json">FULL JSON</Link>
          </div>
        </aside>

        <div className="production-change-workbench">
          <div className="production-change-toolbar">
            <div>
              {(["active", "attention", "approved", "all"] as Filter[]).map((item) => (
                <button type="button" className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)} key={item}>
                  {item.toUpperCase()}
                </button>
              ))}
            </div>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索报告、实物或 Look" />
          </div>

          {loading ? (
            <p className="production-change-empty">正在读取养护报告…</p>
          ) : visible.length === 0 ? (
            <p className="production-change-empty">当前筛选下没有养护报告。</p>
          ) : (
            <div className="production-change-list">
              {visible.map((workspace) => (
                <button type="button" className={workspace.report.id === selectedId ? "is-active" : ""} onClick={() => selectReport(workspace)} key={workspace.report.id}>
                  <span>{workspace.report.reportCode}</span>
                  <strong>{workspace.work?.title || workspace.asset?.workTitle || "UNTITLED"}</strong>
                  <small>{workspace.asset?.assetCode || "NO ASSET"} · {statusLabels[workspace.report.status]}</small>
                  <i>{workspace.summary.stableChecks}/6 STABLE</i>
                </button>
              ))}
            </div>
          )}

          {selected && editForm && (
            <div className="production-change-detail">
              <header>
                <div>
                  <span>{selected.report.reportCode} / ROUND {selected.report.sequence}</span>
                  <h3>{selected.work?.title || selected.asset?.workTitle}</h3>
                  <p>{selected.asset?.assetCode} · {selected.asset?.currentLocation}</p>
                </div>
                <div>
                  <b>{selected.summary.approvalReady ? "READY" : selected.summary.overdue ? "OVERDUE" : "INCOMPLETE"}</b>
                  {selected.provenance && (
                    <Link href={`/provenance/${selected.provenance.slug}`} target="_blank">OPEN PROVENANCE ↗</Link>
                  )}
                </div>
              </header>

              <form className="production-change-form" onSubmit={saveReport}>
                <div className="production-change-grid">
                  <Field label="报告状态">
                    <select value={editForm.status} onChange={(event) => updateEdit(setEditForm, "status", event.target.value as ConservationReportStatus)} disabled={["closed", "void"].includes(selected.report.status)}>
                      {transitions[selected.report.status].map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}
                    </select>
                  </Field>
                  <Field label="人工决定">
                    <select value={editForm.decision} onChange={(event) => updateEdit(setEditForm, "decision", event.target.value as ConservationReportDecision)} disabled={isFrozen(selected)}>
                      {decisions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                    </select>
                  </Field>
                  <Field label="检查时间">
                    <input type="datetime-local" value={editForm.assessedAt} onChange={(event) => updateEdit(setEditForm, "assessedAt", event.target.value)} disabled={isFrozen(selected)} />
                  </Field>
                  <Field label="检查地点">
                    <input value={editForm.assessmentLocation} onChange={(event) => updateEdit(setEditForm, "assessmentLocation", event.target.value)} disabled={isFrozen(selected)} />
                  </Field>
                  <Field label="总体状态">
                    <select value={editForm.overallCondition} onChange={(event) => updateEdit(setEditForm, "overallCondition", event.target.value as ConservationCondition)} disabled={isFrozen(selected)}>
                      {conditions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                    </select>
                  </Field>
                  <Field label="下次复查">
                    <input type="datetime-local" value={editForm.nextReviewAt} onChange={(event) => updateEdit(setEditForm, "nextReviewAt", event.target.value)} disabled={isFrozen(selected)} />
                  </Field>
                  <Field label="处理完成时间">
                    <input type="datetime-local" value={editForm.treatmentCompletedAt} onChange={(event) => updateEdit(setEditForm, "treatmentCompletedAt", event.target.value)} disabled={isFrozen(selected)} />
                  </Field>
                </div>
                <Field label="状态总结">
                  <textarea value={editForm.conditionSummary} onChange={(event) => updateEdit(setEditForm, "conditionSummary", event.target.value)} disabled={isFrozen(selected)} />
                </Field>
                <Field label="处理方案">
                  <textarea value={editForm.proposedTreatment} onChange={(event) => updateEdit(setEditForm, "proposedTreatment", event.target.value)} disabled={isFrozen(selected)} />
                </Field>
                <div className="production-change-grid">
                  <Field label="使用与搬运限制">
                    <textarea value={editForm.handlingRestriction} onChange={(event) => updateEdit(setEditForm, "handlingRestriction", event.target.value)} disabled={isFrozen(selected)} />
                  </Field>
                  <Field label="保存建议">
                    <textarea value={editForm.storageGuidance} onChange={(event) => updateEdit(setEditForm, "storageGuidance", event.target.value)} disabled={isFrozen(selected)} />
                  </Field>
                </div>
                <Field label="环境观察">
                  <textarea value={editForm.environmentalNotes} onChange={(event) => updateEdit(setEditForm, "environmentalNotes", event.target.value)} disabled={isFrozen(selected)} />
                </Field>
                <Field label="人工结论依据">
                  <textarea value={editForm.approvalNote} onChange={(event) => updateEdit(setEditForm, "approvalNote", event.target.value)} disabled={isFrozen(selected)} />
                </Field>
                {selected.summary.missingFields.length > 0 && <p className="production-change-blocker">待补齐：{selected.summary.missingFields.join("、")}</p>}
                {!(["closed", "void"].includes(selected.report.status)) && (
                  <button type="submit" disabled={saving}>
                    {saving ? "SAVING…" : editForm.status === "approved" ? "APPROVE & FREEZE →" : "SAVE REPORT →"}
                  </button>
                )}
              </form>

              <div className="production-change-actions">
                <header>
                  <div>
                    <span>CONDITION CHECKS / 部位检查</span>
                    <h3>六个位置，逐项记录真实状态。</h3>
                  </div>
                  <b>{selected.summary.stableChecks}/6</b>
                </header>
                <div className="production-change-action-list">
                  {selected.checks.map((check, index) => (
                    <CheckEditor index={index + 1} check={check} frozen={isFrozen(selected)} saving={savingCheckId === check.id} onSave={updateCheck} key={check.id} />
                  ))}
                </div>
              </div>

              <div className="production-acceptance-evidence">
                <header>
                  <div>
                    <span>PRIVATE CONDITION EVIDENCE / 私密状态证据</span>
                    <h3>只用于养护判断，不进入公开作品页。</h3>
                  </div>
                  <b>{selected.summary.activeImages}/12</b>
                </header>
                <div className="production-acceptance-images">
                  {selected.images.filter((image) => image.status === "active").map((image) => (
                    <figure key={image.id}>
                      <Image src={image.imageUrl} alt={image.altText} width={900} height={1100} unoptimized />
                      <figcaption>
                        <b>{image.angle.toUpperCase()}</b>
                        <span>{image.caption || image.altText}</span>
                        {!isFrozen(selected) && <button type="button" onClick={() => void removeEvidence(image.id)}>移除</button>}
                      </figcaption>
                    </figure>
                  ))}
                </div>
                {!isFrozen(selected) && (
                  <form className="production-acceptance-upload" onSubmit={uploadEvidence}>
                    <Field label="证据图片">
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))} required />
                    </Field>
                    <Field label="角度 / 类型">
                      <select value={imageForm.angle} onChange={(event) => setImageForm((current) => ({ ...current, angle: event.target.value as ConservationImageAngle }))}>
                        {angles.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                      </select>
                    </Field>
                    <Field label="说明">
                      <input value={imageForm.caption} onChange={(event) => setImageForm((current) => ({ ...current, caption: event.target.value }))} />
                    </Field>
                    <Field label="无障碍描述">
                      <input value={imageForm.altText} onChange={(event) => setImageForm((current) => ({ ...current, altText: event.target.value }))} />
                    </Field>
                    <button type="submit" disabled={uploading}>{uploading ? "UPLOADING…" : "UPLOAD PRIVATE EVIDENCE →"}</button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CheckEditor({
  index,
  check,
  frozen,
  saving,
  onSave,
}: {
  index: number;
  check: ConservationWorkspace["checks"][number];
  frozen: boolean;
  saving: boolean;
  onSave: (
    id: string,
    result: ConservationCheckResult,
    severity: ConservationSeverity,
    observation: string,
    treatmentNote: string,
  ) => Promise<void>;
}) {
  const [result, setResult] = useState<ConservationCheckResult>(check.result);
  const [severity, setSeverity] = useState<ConservationSeverity>(check.severity);
  const [observation, setObservation] = useState(check.observation);
  const [treatmentNote, setTreatmentNote] = useState(check.treatmentNote);
  return (
    <article className={`production-change-action is-${result}`}>
      <span>{String(index).padStart(2, "0")} / {check.category.toUpperCase()}</span>
      <h4>{check.title}</h4>
      <p>{check.requirement}</p>
      <div className="production-change-grid">
        <select value={result} onChange={(event) => setResult(event.target.value as ConservationCheckResult)} disabled={frozen} aria-label={`${check.title} 检查结果`}>
          <option value="pending">待检查 / PENDING</option>
          <option value="stable">稳定 / STABLE</option>
          <option value="attention">需关注 / ATTENTION</option>
          <option value="treatment">需处理 / TREATMENT</option>
          <option value="resolved">已解决 / RESOLVED</option>
          <option value="na">不适用 / N/A</option>
        </select>
        <select value={severity} onChange={(event) => setSeverity(event.target.value as ConservationSeverity)} disabled={frozen} aria-label={`${check.title} 风险级别`}>
          <option value="none">无风险 / NONE</option>
          <option value="low">低 / LOW</option>
          <option value="medium">中 / MEDIUM</option>
          <option value="high">高 / HIGH</option>
          <option value="critical">关键 / CRITICAL</option>
        </select>
      </div>
      <textarea value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="记录可观察的状态事实。" disabled={frozen} />
      <textarea value={treatmentNote} onChange={(event) => setTreatmentNote(event.target.value)} placeholder="需要处理时写明建议，不把建议冒充已执行。" disabled={frozen} />
      {!frozen && <button type="button" disabled={saving} onClick={() => void onSave(check.id, result, severity, observation, treatmentNote)}>{saving ? "SAVING…" : "SAVE CHECK"}</button>}
    </article>
  );
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return <div className={alert && value > 0 ? "is-alert" : ""}><span>{label}</span><strong>{String(value).padStart(2, "0")}</strong></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span>{label}</span>{children}</label>;
}

function editFormFor(workspace: ConservationWorkspace) {
  const { report } = workspace;
  return {
    status: report.status,
    decision: report.decision,
    assessedAt: toLocalDateTime(report.assessedAt),
    assessmentLocation: report.assessmentLocation,
    overallCondition: report.overallCondition,
    conditionSummary: report.conditionSummary,
    proposedTreatment: report.proposedTreatment,
    handlingRestriction: report.handlingRestriction,
    storageGuidance: report.storageGuidance,
    environmentalNotes: report.environmentalNotes,
    nextReviewAt: toLocalDateTime(report.nextReviewAt),
    treatmentCompletedAt: toLocalDateTime(report.treatmentCompletedAt),
    approvalNote: report.approvalNote,
  };
}

function updateEdit<K extends keyof EditForm>(
  setter: React.Dispatch<React.SetStateAction<EditForm | null>>,
  key: K,
  value: EditForm[K],
) {
  setter((current) => current ? { ...current, [key]: value } : current);
}

function isFrozen(workspace: ConservationWorkspace) {
  return ["approved", "closed", "void"].includes(workspace.report.status);
}

async function requestOverview() {
  const response = await fetch("/api/studio/conservation-reports", { cache: "no-store" });
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok || !payload.overview) throw new Error(payload.error || "无法读取作品养护室。");
  return payload.overview;
}

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
