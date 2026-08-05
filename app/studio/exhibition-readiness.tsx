"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  ExhibitionCheckResult,
  ExhibitionDecision,
  ExhibitionDisplayMode,
  ExhibitionImageAngle,
  ExhibitionOverview,
  ExhibitionPlanStatus,
  ExhibitionPurpose,
  ExhibitionWorkspace,
} from "@/lib/exhibition-readiness";

type ApiPayload = {
  overview?: ExhibitionOverview;
  plan?: { id: string };
  check?: { id: string };
  image?: { id: string };
  error?: string;
};
type Filter = "active" | "attention" | "approved" | "all";
type EditForm = ReturnType<typeof editFormFor>;

const statusLabels: Record<ExhibitionPlanStatus, string> = {
  draft: "草稿 / DRAFT",
  in_review: "复核中 / IN REVIEW",
  approved: "已批准 / APPROVED",
  closed: "已撤展 / CLOSED",
  void: "已作废 / VOID",
};
const transitions: Record<ExhibitionPlanStatus, ExhibitionPlanStatus[]> = {
  draft: ["draft", "in_review", "void"],
  in_review: ["in_review", "draft", "approved", "void"],
  approved: ["approved", "closed"],
  closed: ["closed"],
  void: ["void"],
};
const decisions: Array<{ value: ExhibitionDecision; label: string }> = [
  { value: "pending", label: "待判断 / PENDING" },
  { value: "ready", label: "可展示 / READY" },
  { value: "ready_with_limits", label: "限制展示 / READY WITH LIMITS" },
  { value: "hold", label: "暂缓 / HOLD" },
  { value: "not_for_display", label: "不宜展示 / NOT FOR DISPLAY" },
];
const purposes: Array<{ value: ExhibitionPurpose; label: string }> = [
  { value: "exhibition", label: "展览 / EXHIBITION" },
  { value: "editorial", label: "编辑拍摄 / EDITORIAL" },
  { value: "press", label: "媒体展示 / PRESS" },
  { value: "presentation", label: "专业呈现 / PRESENTATION" },
  { value: "archive_view", label: "档案研究 / ARCHIVE VIEW" },
];
const displayModes: Array<{ value: ExhibitionDisplayMode; label: string }> = [
  { value: "mannequin", label: "模特台 / MANNEQUIN" },
  { value: "flat", label: "平面支撑 / FLAT" },
  { value: "hanging", label: "悬挂 / HANGING" },
  { value: "case", label: "展柜 / CASE" },
  { value: "custom", label: "定制支撑 / CUSTOM" },
];
const angles: Array<{ value: ExhibitionImageAngle; label: string }> = [
  { value: "overall", label: "整体 / OVERALL" },
  { value: "mount", label: "支撑 / MOUNT" },
  { value: "front", label: "正面 / FRONT" },
  { value: "back", label: "背面 / BACK" },
  { value: "detail", label: "细节 / DETAIL" },
  { value: "installation", label: "安装 / INSTALLATION" },
  { value: "environment", label: "环境 / ENVIRONMENT" },
  { value: "other", label: "其他 / OTHER" },
];

export default function ExhibitionReadiness() {
  const [overview, setOverview] = useState<ExhibitionOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingCheckId, setSavingCheckId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createForm, setCreateForm] = useState({ conservationReportId: "", title: "", venue: "", installAt: "", deinstallAt: "" });
  const [imageForm, setImageForm] = useState<{ file: File | null; angle: ExhibitionImageAngle; caption: string; altText: string }>({ file: null, angle: "overall", caption: "", altText: "" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await requestOverview();
        if (cancelled) return;
        const first = next.plans[0] ?? null;
        setOverview(next);
        setSelectedId(first?.plan.id ?? null);
        setEditForm(first ? editFormFor(first) : null);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "无法读取展陈准备室。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function loadOverview(preferredId?: string | null) {
    setLoading(true); setError("");
    try {
      const next = await requestOverview();
      setOverview(next);
      const id = preferredId && next.plans.some((item) => item.plan.id === preferredId)
        ? preferredId : selectedId && next.plans.some((item) => item.plan.id === selectedId)
          ? selectedId : next.plans[0]?.plan.id ?? null;
      setSelectedId(id);
      const workspace = next.plans.find((item) => item.plan.id === id) ?? null;
      setEditForm(workspace ? editFormFor(workspace) : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法读取展陈准备室。");
    } finally { setLoading(false); }
  }

  const selected = overview?.plans.find((item) => item.plan.id === selectedId) ?? null;
  const selectedSource = overview?.references.sources.find((item) => item.conservationReportId === createForm.conservationReportId) ?? null;
  const visible = useMemo(() => {
    if (!overview) return [];
    const needle = query.trim().toLowerCase();
    return overview.plans.filter((item) => {
      if (filter === "active" && ["closed", "void"].includes(item.plan.status)) return false;
      if (filter === "attention" && !item.summary.overdueDeinstall && !item.summary.upcomingUnapproved && item.summary.blockedChecks === 0) return false;
      if (filter === "approved" && item.plan.status !== "approved") return false;
      if (!needle) return true;
      return [item.plan.planCode, item.plan.title, item.plan.venue, item.asset?.assetCode, item.work?.title]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [overview, filter, query]);

  function selectPlan(workspace: ExhibitionWorkspace) {
    setSelectedId(workspace.plan.id);
    setEditForm(editFormFor(workspace));
    setError(""); setMessage("");
  }

  async function refresh(note: string, preferredId?: string | null) {
    await loadOverview(preferredId);
    setMessage(note);
    window.dispatchEvent(new Event("nera:exhibition-updated"));
  }

  async function createPlan(event: React.FormEvent) {
    event.preventDefault(); setCreating(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/studio/exhibition-readiness", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(createForm),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.plan) throw new Error(payload.error || "建立展陈方案失败。");
      setCreateForm({ conservationReportId: "", title: "", venue: "", installAt: "", deinstallAt: "" });
      await refresh("展陈方案已建立，七项人工核对已经生成。", payload.plan.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "建立展陈方案失败。"); }
    finally { setCreating(false); }
  }

  async function savePlan(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !editForm) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const body = selected.plan.status === "approved" && editForm.status === "closed"
        ? { status: "closed" }
        : editForm;
      const response = await fetch(`/api/studio/exhibition-readiness/${selected.plan.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.plan) throw new Error(payload.error || "保存展陈方案失败。");
      await refresh(editForm.status === "approved" ? "人工展陈决定已批准并冻结。" : editForm.status === "closed" ? "撤展事实已关闭。" : "展陈方案已保存。", selected.plan.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存展陈方案失败。"); }
    finally { setSaving(false); }
  }

  async function updateCheck(id: string, result: ExhibitionCheckResult, observation: string, critical: boolean) {
    setSavingCheckId(id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/studio/exhibition-readiness/checks/${id}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ result, observation, critical }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.check) throw new Error(payload.error || "保存核对失败。");
      await refresh("展陈核对已保存。", selectedId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存核对失败。"); }
    finally { setSavingCheckId(""); }
  }

  async function uploadEvidence(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !imageForm.file) return;
    setUploading(true); setError(""); setMessage("");
    try {
      const form = new FormData();
      form.set("image", imageForm.file); form.set("angle", imageForm.angle);
      form.set("caption", imageForm.caption); form.set("altText", imageForm.altText);
      const response = await fetch(`/api/studio/exhibition-readiness/${selected.plan.id}/images`, { method: "POST", body: form });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.image) throw new Error(payload.error || "上传展陈证据失败。");
      setImageForm({ file: null, angle: "overall", caption: "", altText: "" });
      await refresh("私密试装证据已保存。", selected.plan.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "上传展陈证据失败。"); }
    finally { setUploading(false); }
  }

  async function removeEvidence(id: string) {
    setError(""); setMessage("");
    try {
      const response = await fetch(`/api/studio/exhibition-readiness/images/${id}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "removed" }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.image) throw new Error(payload.error || "移除证据失败。");
      await refresh("证据已从本轮有效记录中移除。", selectedId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "移除证据失败。"); }
  }

  return (
    <section className="production-change-control production-acceptance conservation-atelier exhibition-readiness" id="exhibition-readiness" aria-labelledby="exhibition-readiness-title">
      <header className="production-change-hero">
        <div>
          <span>29 / EXHIBITION READINESS</span>
          <h2 id="exhibition-readiness-title">MOUNT THE FORM.<br /><i>PROTECT THE WORK.</i></h2>
          <p>把养护事实转化为可执行的支撑、环境、安装与撤展边界，让每次公开呈现都经过设计师人工放行。</p>
        </div>
        <div className="production-change-mark" aria-hidden="true"><b>◇</b><span>DISPLAY STEWARDSHIP</span></div>
      </header>

      <div className="production-change-metrics">
        <Metric label="TOTAL" value={overview?.metrics.total ?? 0} />
        <Metric label="IN REVIEW" value={overview?.metrics.inReview ?? 0} />
        <Metric label="APPROVED" value={overview?.metrics.approved ?? 0} />
        <Metric label="UPCOMING" value={overview?.metrics.upcoming ?? 0} />
        <Metric label="ATTENTION" value={overview?.metrics.attention ?? 0} alert />
      </div>

      <div className="production-change-principles">
        <p><span>01</span>只从已批准养护事实建立展陈方案。</p>
        <p><span>02</span>支撑、光照、环境、安装与撤展逐项人工核对。</p>
        <p><span>03</span>批准只冻结展示边界，不自动改变实物状态。</p>
      </div>

      {(error || message) && <div className={`production-change-notice${error ? " is-error" : ""}`} role="status">{error || message}</div>}

      <div className="production-change-layout">
        <aside className="production-change-create">
          <header><span>NEW DISPLAY PLAN / 新方案</span><h3>从最近一次养护结论开始。</h3></header>
          <form onSubmit={createPlan}>
            <Field label="养护来源 / CONSERVATION REPORT">
              <select value={createForm.conservationReportId} onChange={(event) => setCreateForm((current) => ({ ...current, conservationReportId: event.target.value }))} required>
                <option value="">选择已批准养护报告</option>
                {overview?.references.sources.map((source) => <option value={source.conservationReportId} key={source.conservationReportId}>{source.reportCode} · {source.assetCode} · R{source.latestSequence + 1}</option>)}
              </select>
            </Field>
            {selectedSource && <div className="production-change-source">
              <div className="production-change-source-image" style={selectedSource.imageUrl ? { backgroundImage: `url("${selectedSource.imageUrl.replaceAll('"', "%22")}")` } : undefined} aria-hidden="true" />
              <div><b>{selectedSource.workTitle}</b><span>{selectedSource.assetCode}</span><small>{selectedSource.condition.toUpperCase()} · {selectedSource.currentLocation}</small></div>
            </div>}
            <Field label="方案标题"><input value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} placeholder="AW27 ARCHIVE PRESENTATION" required /></Field>
            <Field label="展示地点"><input value={createForm.venue} onChange={(event) => setCreateForm((current) => ({ ...current, venue: event.target.value }))} placeholder="ATELIER GALLERY" required /></Field>
            <Field label="安装时间"><input type="datetime-local" value={createForm.installAt} onChange={(event) => setCreateForm((current) => ({ ...current, installAt: event.target.value }))} /></Field>
            <Field label="撤展时间"><input type="datetime-local" value={createForm.deinstallAt} onChange={(event) => setCreateForm((current) => ({ ...current, deinstallAt: event.target.value }))} /></Field>
            <button type="submit" disabled={creating || !selectedSource}>{creating ? "CREATING…" : "CREATE DISPLAY PLAN →"}</button>
          </form>
          <div className="production-change-export">
            <Link href="/api/studio/exhibition-readiness?format=plans">PLANS CSV</Link>
            <Link href="/api/studio/exhibition-readiness?format=checks">CHECKS CSV</Link>
            <Link href="/api/studio/exhibition-readiness?format=images">EVIDENCE CSV</Link>
            <Link href="/api/studio/exhibition-readiness?format=json">FULL JSON</Link>
          </div>
        </aside>

        <div className="production-change-workbench">
          <div className="production-change-toolbar">
            <div>{(["active", "attention", "approved", "all"] as Filter[]).map((item) => <button type="button" className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)} key={item}>{item.toUpperCase()}</button>)}</div>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索方案、地点、实物或 Look" />
          </div>
          {loading ? <p className="production-change-empty">正在读取展陈方案…</p> : visible.length === 0 ? <p className="production-change-empty">当前筛选下没有展陈方案。</p> : (
            <div className="production-change-list">{visible.map((workspace) => <button type="button" className={workspace.plan.id === selectedId ? "is-active" : ""} onClick={() => selectPlan(workspace)} key={workspace.plan.id}>
              <span>{workspace.plan.planCode}</span><strong>{workspace.plan.title || workspace.work?.title || "UNTITLED"}</strong>
              <small>{workspace.plan.venue || "NO VENUE"} · {statusLabels[workspace.plan.status]}</small><i>{workspace.summary.passedChecks}/7 CLEAR</i>
            </button>)}</div>
          )}

          {selected && editForm && <div className="production-change-detail">
            <header><div><span>{selected.plan.planCode} / ROUND {selected.plan.sequence}</span><h3>{selected.plan.title || selected.work?.title}</h3><p>{selected.asset?.assetCode} · {selected.conservation?.reportCode}</p></div>
              <div><b>{selected.summary.approvalReady ? "READY" : selected.summary.overdueDeinstall ? "DEINSTALL DUE" : selected.summary.upcomingUnapproved ? "UPCOMING" : "INCOMPLETE"}</b><a href="#conservation-atelier">OPEN CONSERVATION ↓</a></div></header>

            <form className="production-change-form" onSubmit={savePlan}>
              <div className="production-change-grid">
                <Field label="方案状态"><select value={editForm.status} onChange={(event) => updateEdit(setEditForm, "status", event.target.value as ExhibitionPlanStatus)} disabled={["closed", "void"].includes(selected.plan.status)}>{transitions[selected.plan.status].map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}</select></Field>
                <Field label="人工决定"><select value={editForm.decision} onChange={(event) => updateEdit(setEditForm, "decision", event.target.value as ExhibitionDecision)} disabled={isFrozen(selected)}>{decisions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field>
                <Field label="展示用途"><select value={editForm.purpose} onChange={(event) => updateEdit(setEditForm, "purpose", event.target.value as ExhibitionPurpose)} disabled={isFrozen(selected)}>{purposes.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field>
                <Field label="展示方式"><select value={editForm.displayMode} onChange={(event) => updateEdit(setEditForm, "displayMode", event.target.value as ExhibitionDisplayMode)} disabled={isFrozen(selected)}>{displayModes.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field>
                <Field label="方案标题"><input value={editForm.title} onChange={(event) => updateEdit(setEditForm, "title", event.target.value)} disabled={isFrozen(selected)} /></Field>
                <Field label="展示地点"><input value={editForm.venue} onChange={(event) => updateEdit(setEditForm, "venue", event.target.value)} disabled={isFrozen(selected)} /></Field>
                <Field label="安装时间"><input type="datetime-local" value={editForm.installAt} onChange={(event) => updateEdit(setEditForm, "installAt", event.target.value)} disabled={isFrozen(selected)} /></Field>
                <Field label="撤展时间"><input type="datetime-local" value={editForm.deinstallAt} onChange={(event) => updateEdit(setEditForm, "deinstallAt", event.target.value)} disabled={isFrozen(selected)} /></Field>
              </div>
              <div className="production-change-grid">
                <Field label="最高照度 / LUX"><input type="number" min="0" value={editForm.maxLux} onChange={(event) => updateEdit(setEditForm, "maxLux", event.target.value)} disabled={isFrozen(selected)} /></Field>
                <Field label="UV 上限 / µW/Lm"><input type="number" min="0" value={editForm.uvLimit} onChange={(event) => updateEdit(setEditForm, "uvLimit", event.target.value)} disabled={isFrozen(selected)} /></Field>
                <Field label="湿度下限 / %RH"><input type="number" min="0" max="100" value={editForm.rhMin} onChange={(event) => updateEdit(setEditForm, "rhMin", event.target.value)} disabled={isFrozen(selected)} /></Field>
                <Field label="湿度上限 / %RH"><input type="number" min="0" max="100" value={editForm.rhMax} onChange={(event) => updateEdit(setEditForm, "rhMax", event.target.value)} disabled={isFrozen(selected)} /></Field>
                <Field label="温度下限 / °C"><input type="number" min="0" value={editForm.tempMin} onChange={(event) => updateEdit(setEditForm, "tempMin", event.target.value)} disabled={isFrozen(selected)} /></Field>
                <Field label="温度上限 / °C"><input type="number" min="0" value={editForm.tempMax} onChange={(event) => updateEdit(setEditForm, "tempMax", event.target.value)} disabled={isFrozen(selected)} /></Field>
                <Field label="最大展示天数"><input type="number" min="1" value={editForm.maxDisplayDays} onChange={(event) => updateEdit(setEditForm, "maxDisplayDays", event.target.value)} disabled={isFrozen(selected)} /></Field>
              </div>
              <Field label="安装与固定方式"><textarea value={editForm.mountingMethod} onChange={(event) => updateEdit(setEditForm, "mountingMethod", event.target.value)} disabled={isFrozen(selected)} /></Field>
              <div className="production-change-grid">
                <Field label="支撑与受力要求"><textarea value={editForm.supportRequirements} onChange={(event) => updateEdit(setEditForm, "supportRequirements", event.target.value)} disabled={isFrozen(selected)} /></Field>
                <Field label="穿装与拆卸说明"><textarea value={editForm.dressingInstructions} onChange={(event) => updateEdit(setEditForm, "dressingInstructions", event.target.value)} disabled={isFrozen(selected)} /></Field>
                <Field label="操作团队"><textarea value={editForm.handlingTeam} onChange={(event) => updateEdit(setEditForm, "handlingTeam", event.target.value)} disabled={isFrozen(selected)} /></Field>
                <Field label="安全屏障"><textarea value={editForm.securityBarrier} onChange={(event) => updateEdit(setEditForm, "securityBarrier", event.target.value)} disabled={isFrozen(selected)} /></Field>
              </div>
              <Field label="应急处置说明"><textarea value={editForm.emergencyInstructions} onChange={(event) => updateEdit(setEditForm, "emergencyInstructions", event.target.value)} disabled={isFrozen(selected)} /></Field>
              <Field label="安装补充说明"><textarea value={editForm.installationNotes} onChange={(event) => updateEdit(setEditForm, "installationNotes", event.target.value)} disabled={isFrozen(selected)} /></Field>
              <Field label="人工决定依据"><textarea value={editForm.approvalNote} onChange={(event) => updateEdit(setEditForm, "approvalNote", event.target.value)} disabled={isFrozen(selected)} /></Field>
              {selected.summary.missingFields.length > 0 && <p className="production-change-blocker">待补齐：{selected.summary.missingFields.join("、")}</p>}
              {!(["closed", "void"].includes(selected.plan.status)) && <button type="submit" disabled={saving}>{saving ? "SAVING…" : editForm.status === "approved" ? "APPROVE & FREEZE →" : editForm.status === "closed" ? "CLOSE AFTER DEINSTALL →" : "SAVE DISPLAY PLAN →"}</button>}
            </form>

            <div className="production-change-actions">
              <header><div><span>DISPLAY SAFETY CHECKS / 展陈核对</span><h3>七项边界，逐项确认真实条件。</h3></div><b>{selected.summary.passedChecks}/7</b></header>
              <div className="production-change-action-list">{selected.checks.map((check, index) => <CheckEditor index={index + 1} check={check} frozen={isFrozen(selected)} saving={savingCheckId === check.id} onSave={updateCheck} key={check.id} />)}</div>
            </div>

            <div className="production-acceptance-evidence">
              <header><div><span>PRIVATE MOUNT TEST / 私密试装证据</span><h3>只用于展示安全判断，不进入公开作品页。</h3></div><b>{selected.summary.activeImages}/12</b></header>
              <div className="production-acceptance-images">{selected.images.filter((image) => image.status === "active").map((image) => <figure key={image.id}>
                <Image src={image.imageUrl} alt={image.altText} width={900} height={1100} unoptimized />
                <figcaption><b>{image.angle.toUpperCase()}</b><span>{image.caption || image.altText}</span>{!isFrozen(selected) && <button type="button" onClick={() => void removeEvidence(image.id)}>移除</button>}</figcaption>
              </figure>)}</div>
              {!isFrozen(selected) && <form className="production-acceptance-upload" onSubmit={uploadEvidence}>
                <Field label="证据图片"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))} required /></Field>
                <Field label="证据类型"><select value={imageForm.angle} onChange={(event) => setImageForm((current) => ({ ...current, angle: event.target.value as ExhibitionImageAngle }))}>{angles.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field>
                <Field label="说明"><input value={imageForm.caption} onChange={(event) => setImageForm((current) => ({ ...current, caption: event.target.value }))} /></Field>
                <Field label="无障碍描述"><input value={imageForm.altText} onChange={(event) => setImageForm((current) => ({ ...current, altText: event.target.value }))} /></Field>
                <button type="submit" disabled={uploading}>{uploading ? "UPLOADING…" : "UPLOAD PRIVATE MOUNT TEST →"}</button>
              </form>}
            </div>
          </div>}
        </div>
      </div>
    </section>
  );
}

function CheckEditor({ index, check, frozen, saving, onSave }: {
  index: number; check: ExhibitionWorkspace["checks"][number]; frozen: boolean; saving: boolean;
  onSave: (id: string, result: ExhibitionCheckResult, observation: string, critical: boolean) => Promise<void>;
}) {
  const [result, setResult] = useState<ExhibitionCheckResult>(check.result);
  const [observation, setObservation] = useState(check.observation);
  const [critical, setCritical] = useState(check.critical);
  return <article className={`production-change-action is-${result}`}>
    <span>{String(index).padStart(2, "0")} / {check.category.toUpperCase()}</span><h4>{check.title}</h4><p>{check.requirement}</p>
    <select value={result} onChange={(event) => setResult(event.target.value as ExhibitionCheckResult)} disabled={frozen} aria-label={`${check.title} 核对结果`}>
      <option value="pending">待核对 / PENDING</option><option value="pass">通过 / PASS</option><option value="attention">需限制 / ATTENTION</option><option value="blocked">阻塞 / BLOCKED</option><option value="na">不适用 / N/A</option>
    </select>
    <label><input type="checkbox" checked={critical} onChange={(event) => setCritical(event.target.checked)} disabled={frozen} /> 关键放行条件</label>
    <textarea value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="记录实际条件、限制或阻塞原因。" disabled={frozen} />
    {!frozen && <button type="button" disabled={saving} onClick={() => void onSave(check.id, result, observation, critical)}>{saving ? "SAVING…" : "SAVE CHECK"}</button>}
  </article>;
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return <div className={alert && value > 0 ? "is-alert" : ""}><span>{label}</span><strong>{String(value).padStart(2, "0")}</strong></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span>{label}</span>{children}</label>; }
function isFrozen(workspace: ExhibitionWorkspace) { return ["approved", "closed", "void"].includes(workspace.plan.status); }
function editFormFor(workspace: ExhibitionWorkspace) {
  const { plan } = workspace;
  return {
    status: plan.status, decision: plan.decision, title: plan.title, venue: plan.venue,
    purpose: plan.purpose, installAt: toLocalDateTime(plan.installAt), deinstallAt: toLocalDateTime(plan.deinstallAt),
    displayMode: plan.displayMode, mountingMethod: plan.mountingMethod,
    supportRequirements: plan.supportRequirements, dressingInstructions: plan.dressingInstructions,
    maxLux: String(plan.maxLux), uvLimit: String(plan.uvLimit), rhMin: String(plan.rhMin), rhMax: String(plan.rhMax),
    tempMin: String(plan.tempMin), tempMax: String(plan.tempMax), maxDisplayDays: String(plan.maxDisplayDays),
    handlingTeam: plan.handlingTeam, securityBarrier: plan.securityBarrier,
    emergencyInstructions: plan.emergencyInstructions, installationNotes: plan.installationNotes,
    approvalNote: plan.approvalNote,
  };
}
function updateEdit<K extends keyof EditForm>(setter: React.Dispatch<React.SetStateAction<EditForm | null>>, key: K, value: EditForm[K]) {
  setter((current) => current ? { ...current, [key]: value } : current);
}
async function requestOverview() {
  const response = await fetch("/api/studio/exhibition-readiness", { cache: "no-store" });
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok || !payload.overview) throw new Error(payload.error || "无法读取展陈准备室。");
  return payload.overview;
}
function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
