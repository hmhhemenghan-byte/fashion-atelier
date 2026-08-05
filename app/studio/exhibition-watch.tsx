"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  ExhibitionWatchDecision,
  ExhibitionWatchOverview,
  ExhibitionWatchStatus,
  ExhibitionWatchWorkspace,
  WatchConditionResult,
  WatchDisposition,
  WatchImageAngle,
  WatchIncidentType,
  WatchPestResult,
} from "@/lib/exhibition-watch";

type ApiPayload = { overview?: ExhibitionWatchOverview; watch?: { id: string }; observation?: { id: string }; image?: { id: string }; error?: string };
type Filter = "active" | "attention" | "due" | "all";
type WatchForm = ReturnType<typeof watchFormFor>;

const statusLabels: Record<ExhibitionWatchStatus, string> = {
  active: "监测中 / ACTIVE", paused: "已暂停 / PAUSED", deinstalled: "已撤展 / DEINSTALLED", closed: "已关闭 / CLOSED",
};
const transitions: Record<ExhibitionWatchStatus, ExhibitionWatchStatus[]> = {
  active: ["active", "paused", "deinstalled"], paused: ["paused", "active", "deinstalled"], deinstalled: ["deinstalled", "closed"], closed: ["closed"],
};
const conditionOptions: Array<{ value: WatchConditionResult; label: string }> = [
  { value: "stable", label: "稳定 / STABLE" }, { value: "attention", label: "需关注 / ATTENTION" }, { value: "critical", label: "关键异常 / CRITICAL" },
];
const incidentOptions: Array<{ value: WatchIncidentType; label: string }> = [
  { value: "none", label: "无事件 / NONE" }, { value: "physical", label: "物理损伤 / PHYSICAL" }, { value: "climate", label: "环境 / CLIMATE" },
  { value: "light", label: "光照 / LIGHT" }, { value: "security", label: "安全 / SECURITY" }, { value: "pest", label: "虫害 / PEST" },
  { value: "handling", label: "操作 / HANDLING" }, { value: "other", label: "其他 / OTHER" },
];
const dispositionOptions: Array<{ value: WatchDisposition; label: string }> = [
  { value: "continue", label: "继续展示 / CONTINUE" }, { value: "limit", label: "限制继续 / LIMIT" }, { value: "pause", label: "暂停展示 / PAUSE" },
  { value: "deinstall", label: "立即撤展 / DEINSTALL" }, { value: "conservator_review", label: "养护复核 / CONSERVATOR REVIEW" },
];
const imageAngles: Array<{ value: WatchImageAngle; label: string }> = [
  { value: "overall", label: "整体 / OVERALL" }, { value: "condition", label: "品相 / CONDITION" }, { value: "support", label: "支撑 / SUPPORT" },
  { value: "environment", label: "环境 / ENVIRONMENT" }, { value: "incident", label: "事件 / INCIDENT" }, { value: "deinstallation", label: "撤展 / DEINSTALLATION" }, { value: "other", label: "其他 / OTHER" },
];

export default function ExhibitionWatch() {
  const [overview, setOverview] = useState<ExhibitionWatchOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<WatchForm | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createForm, setCreateForm] = useState({ exhibitionReadinessPlanId: "", steward: "", openingCondition: "", monitoringIntervalHours: "24" });
  const [observationForm, setObservationForm] = useState({ observedAt: toLocalDateTime(new Date().toISOString()), lux: "", uv: "", rh: "", temperature: "", conditionResult: "stable" as WatchConditionResult, supportResult: "stable" as WatchConditionResult, pestResult: "none" as WatchPestResult, incidentType: "none" as WatchIncidentType, disposition: "continue" as WatchDisposition, observation: "", actionTaken: "" });
  const [imageForm, setImageForm] = useState<{ file: File | null; observationId: string; angle: WatchImageAngle; caption: string; altText: string }>({ file: null, observationId: "", angle: "overall", caption: "", altText: "" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await requestOverview();
        if (cancelled) return;
        const first = next.watches[0] ?? null;
        setOverview(next); setSelectedId(first?.watch.id ?? null); setEditForm(first ? watchFormFor(first) : null);
      } catch (cause) { if (!cancelled) setError(errorMessage(cause, "无法读取展期监测台。")); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const selected = overview?.watches.find((item) => item.watch.id === selectedId) ?? null;
  const visible = useMemo(() => {
    if (!overview) return [];
    const needle = query.trim().toLowerCase();
    return overview.watches.filter((item) => {
      if (filter === "active" && !["active", "paused"].includes(item.watch.status)) return false;
      if (filter === "attention" && !item.summary.latestAttention) return false;
      if (filter === "due" && !item.summary.due) return false;
      if (!needle) return true;
      return [item.watch.watchCode, item.plan?.plan.title, item.plan?.plan.venue, item.plan?.asset?.assetCode, item.plan?.work?.title].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [overview, filter, query]);

  async function reload(note: string, preferredId?: string | null) {
    setLoading(true); setError("");
    try {
      const next = await requestOverview();
      const id = preferredId && next.watches.some((item) => item.watch.id === preferredId) ? preferredId : selectedId && next.watches.some((item) => item.watch.id === selectedId) ? selectedId : next.watches[0]?.watch.id ?? null;
      setOverview(next); setSelectedId(id);
      const workspace = next.watches.find((item) => item.watch.id === id) ?? null;
      setEditForm(workspace ? watchFormFor(workspace) : null); setMessage(note);
      window.dispatchEvent(new Event("nera:exhibition-watch-updated"));
    } catch (cause) { setError(errorMessage(cause, "无法刷新展期监测台。")); }
    finally { setLoading(false); }
  }

  function selectWatch(workspace: ExhibitionWatchWorkspace) {
    setSelectedId(workspace.watch.id); setEditForm(watchFormFor(workspace)); setError(""); setMessage("");
  }

  async function createWatch(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const payload = await api("/api/studio/exhibition-watch", "POST", createForm);
      if (!payload.watch) throw new Error("建立展期监测失败。");
      setCreateForm({ exhibitionReadinessPlanId: "", steward: "", openingCondition: "", monitoringIntervalHours: "24" });
      await reload("展期监测已开启。", payload.watch.id);
    } catch (cause) { setError(errorMessage(cause, "建立展期监测失败。")); }
    finally { setBusy(false); }
  }

  async function saveWatch(event: React.FormEvent) {
    event.preventDefault(); if (!selected || !editForm) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const payload = await api(`/api/studio/exhibition-watch/${selected.watch.id}`, "PATCH", editForm);
      if (!payload.watch) throw new Error("保存展期监测失败。");
      await reload(editForm.status === "closed" ? "撤展复核已关闭并冻结。" : "监测设置与人工结论已保存。", selected.watch.id);
    } catch (cause) { setError(errorMessage(cause, "保存展期监测失败。")); }
    finally { setBusy(false); }
  }

  async function addObservation(event: React.FormEvent) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const payload = await api(`/api/studio/exhibition-watch/${selected.watch.id}/observations`, "POST", observationForm);
      if (!payload.observation) throw new Error("记录现场观察失败。");
      setObservationForm((current) => ({ ...current, observedAt: toLocalDateTime(new Date().toISOString()), observation: "", actionTaken: "" }));
      await reload("现场观察已写入不可覆盖的时间线。", selected.watch.id);
    } catch (cause) { setError(errorMessage(cause, "记录现场观察失败。")); }
    finally { setBusy(false); }
  }

  async function uploadEvidence(event: React.FormEvent) {
    event.preventDefault(); if (!selected || !imageForm.file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const form = new FormData();
      form.set("image", imageForm.file); form.set("observationId", imageForm.observationId); form.set("angle", imageForm.angle); form.set("caption", imageForm.caption); form.set("altText", imageForm.altText);
      const response = await fetch(`/api/studio/exhibition-watch/${selected.watch.id}/images`, { method: "POST", body: form });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.image) throw new Error(payload.error || "上传证据失败。");
      setImageForm({ file: null, observationId: "", angle: "overall", caption: "", altText: "" });
      await reload("私密监测证据已保存。", selected.watch.id);
    } catch (cause) { setError(errorMessage(cause, "上传证据失败。")); }
    finally { setBusy(false); }
  }

  async function removeEvidence(id: string) {
    if (!selected) return; setBusy(true); setError("");
    try { await api(`/api/studio/exhibition-watch/images/${id}`, "PATCH", { status: "removed" }); await reload("监测证据已移出有效清单。", selected.watch.id); }
    catch (cause) { setError(errorMessage(cause, "更新证据失败。")); }
    finally { setBusy(false); }
  }

  return <section className="production-change-control production-acceptance conservation-atelier exhibition-readiness exhibition-watch" id="exhibition-watch" aria-labelledby="exhibition-watch-title">
    <div className="production-change-intro"><span>PHASE 30 / EXHIBITION WATCH</span><h2 id="exhibition-watch-title">WATCH THE LIGHT.<br /><i>GUARD THE FORM.</i></h2><p>把批准后的展示变成可监测、可暂停、可提前撤展的事实。系统标出越界，不替代设计师与养护人员作决定。</p></div>
    <div className="production-change-metrics">
      <Metric label="WATCHES" value={overview?.metrics.total ?? 0} /><Metric label="ACTIVE" value={overview?.metrics.active ?? 0} /><Metric label="CHECK DUE" value={overview?.metrics.due ?? 0} alert /><Metric label="ATTENTION" value={overview?.metrics.attention ?? 0} alert /><Metric label="DEINSTALLED" value={overview?.metrics.deinstalled ?? 0} />
    </div>
    {(error || message) && <p className={error ? "production-change-alert is-error" : "production-change-alert"} role="status">{error || message}</p>}
    <div className="production-change-layout">
      <aside className="production-change-sidebar">
        <form onSubmit={createWatch}><span>OPEN A WATCH / 开启监测</span>
          <Field label="已批准展陈方案"><select value={createForm.exhibitionReadinessPlanId} onChange={(event) => setCreateForm((current) => ({ ...current, exhibitionReadinessPlanId: event.target.value }))} required><option value="">选择方案</option>{overview?.references.approvedPlans.map((item) => <option value={item.id} key={item.id}>{item.planCode} · {item.workTitle || item.title}</option>)}</select></Field>
          <Field label="监测负责人"><input value={createForm.steward} onChange={(event) => setCreateForm((current) => ({ ...current, steward: event.target.value }))} required /></Field>
          <Field label="检查间隔 / 小时"><input type="number" min="1" max="720" value={createForm.monitoringIntervalHours} onChange={(event) => setCreateForm((current) => ({ ...current, monitoringIntervalHours: event.target.value }))} /></Field>
          <Field label="开场状态"><textarea value={createForm.openingCondition} onChange={(event) => setCreateForm((current) => ({ ...current, openingCondition: event.target.value }))} required /></Field>
          <button type="submit" disabled={busy}>OPEN EXHIBITION WATCH →</button>
        </form>
        <div className="production-change-export"><Link href="/api/studio/exhibition-watch?format=watches">WATCHES CSV</Link><Link href="/api/studio/exhibition-watch?format=observations">OBSERVATIONS CSV</Link><Link href="/api/studio/exhibition-watch?format=images">EVIDENCE CSV</Link><Link href="/api/studio/exhibition-watch?format=json">FULL JSON</Link></div>
      </aside>
      <div className="production-change-workbench">
        <div className="production-change-toolbar"><div>{(["active", "attention", "due", "all"] as Filter[]).map((item) => <button type="button" className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)} key={item}>{item.toUpperCase()}</button>)}</div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索监测、地点、实物或 Look" /></div>
        {loading ? <p className="production-change-empty">正在读取展期监测…</p> : visible.length === 0 ? <p className="production-change-empty">当前筛选下没有监测记录。</p> : <div className="production-change-list">{visible.map((workspace) => <button type="button" className={workspace.watch.id === selectedId ? "is-active" : ""} onClick={() => selectWatch(workspace)} key={workspace.watch.id}><span>{workspace.watch.watchCode}</span><strong>{workspace.plan?.plan.title || workspace.plan?.work?.title || "UNTITLED"}</strong><small>{workspace.plan?.plan.venue} · {statusLabels[workspace.watch.status]}</small><i>{workspace.summary.due ? "CHECK DUE" : workspace.summary.latestAttention ? "ATTENTION" : `${workspace.summary.observationCount} LOGS`}</i></button>)}</div>}

        {selected && editForm && <div className="production-change-detail">
          <header><div><span>{selected.watch.watchCode}</span><h3>{selected.plan?.plan.title || selected.plan?.work?.title}</h3><p>{selected.plan?.asset?.assetCode} · {selected.plan?.plan.planCode}</p></div><div><b>{selected.summary.due ? "CHECK DUE" : selected.summary.latestAttention ? "ATTENTION" : selected.watch.status.toUpperCase()}</b><a href="#exhibition-readiness">OPEN DISPLAY PLAN ↑</a></div></header>
          <form className="production-change-form" onSubmit={saveWatch}>
            <div className="production-change-grid">
              <Field label="监测状态"><select value={editForm.status} onChange={(event) => updateForm(setEditForm, "status", event.target.value as ExhibitionWatchStatus)} disabled={selected.watch.status === "closed"}>{transitions[selected.watch.status].map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}</select></Field>
              <Field label="检查间隔 / 小时"><input type="number" min="1" max="720" value={editForm.monitoringIntervalHours} onChange={(event) => updateForm(setEditForm, "monitoringIntervalHours", event.target.value)} disabled={selected.watch.status === "closed"} /></Field>
              <Field label="监测负责人"><input value={editForm.steward} onChange={(event) => updateForm(setEditForm, "steward", event.target.value)} disabled={selected.watch.status === "closed"} /></Field>
              <Field label="人工结论"><select value={editForm.decision} onChange={(event) => updateForm(setEditForm, "decision", event.target.value as ExhibitionWatchDecision)} disabled={selected.watch.status === "closed"}><option value="pending">待判断 / PENDING</option><option value="continue">继续 / CONTINUE</option><option value="continue_with_limits">限制继续 / WITH LIMITS</option><option value="pause">暂停 / PAUSE</option><option value="deinstall_now">立即撤展 / DEINSTALL</option></select></Field>
            </div>
            <Field label="开场状态"><textarea value={editForm.openingCondition} onChange={(event) => updateForm(setEditForm, "openingCondition", event.target.value)} disabled={selected.watch.status === "closed"} /></Field>
            <Field label="人工决定依据"><textarea value={editForm.decisionNote} onChange={(event) => updateForm(setEditForm, "decisionNote", event.target.value)} disabled={selected.watch.status === "closed"} /></Field>
            <div className="production-change-grid"><Field label="撤展状态"><textarea value={editForm.deinstallationCondition} onChange={(event) => updateForm(setEditForm, "deinstallationCondition", event.target.value)} disabled={selected.watch.status === "closed"} /></Field><Field label="回库位置"><textarea value={editForm.returnLocation} onChange={(event) => updateForm(setEditForm, "returnLocation", event.target.value)} disabled={selected.watch.status === "closed"} /></Field></div>
            {selected.watch.status !== "closed" && <button type="submit" disabled={busy}>{editForm.status === "closed" ? "CLOSE & FREEZE WATCH →" : "SAVE HUMAN DECISION →"}</button>}
          </form>

          {!(["deinstalled", "closed"].includes(selected.watch.status)) && <form className="production-change-form" onSubmit={addObservation}>
            <header><div><span>IMMUTABLE FIELD NOTE / 现场观察</span><h3>每次观察独立写入，不覆盖历史。</h3></div></header>
            <div className="production-change-grid"><Field label="观察时间"><input type="datetime-local" value={observationForm.observedAt} onChange={(event) => setObservationForm((current) => ({ ...current, observedAt: event.target.value }))} /></Field><Field label={`照度 / 上限 ${selected.plan?.plan.maxLux ?? "—"} LUX`}><input type="number" min="0" value={observationForm.lux} onChange={(event) => setObservationForm((current) => ({ ...current, lux: event.target.value }))} /></Field><Field label={`UV / 上限 ${selected.plan?.plan.uvLimit ?? "—"}`}><input type="number" min="0" value={observationForm.uv} onChange={(event) => setObservationForm((current) => ({ ...current, uv: event.target.value }))} /></Field><Field label={`湿度 / ${selected.plan?.plan.rhMin ?? "—"}–${selected.plan?.plan.rhMax ?? "—"}%`}><input type="number" min="0" max="100" value={observationForm.rh} onChange={(event) => setObservationForm((current) => ({ ...current, rh: event.target.value }))} /></Field><Field label={`温度 / ${selected.plan?.plan.tempMin ?? "—"}–${selected.plan?.plan.tempMax ?? "—"}°C`}><input type="number" step="0.1" value={observationForm.temperature} onChange={(event) => setObservationForm((current) => ({ ...current, temperature: event.target.value }))} /></Field></div>
            <div className="production-change-grid"><Field label="作品品相"><select value={observationForm.conditionResult} onChange={(event) => setObservationForm((current) => ({ ...current, conditionResult: event.target.value as WatchConditionResult }))}>{conditionOptions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field><Field label="支撑状态"><select value={observationForm.supportResult} onChange={(event) => setObservationForm((current) => ({ ...current, supportResult: event.target.value as WatchConditionResult }))}>{conditionOptions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field><Field label="虫害迹象"><select value={observationForm.pestResult} onChange={(event) => setObservationForm((current) => ({ ...current, pestResult: event.target.value as WatchPestResult }))}><option value="none">无 / NONE</option><option value="signs">疑似 / SIGNS</option><option value="confirmed">确认 / CONFIRMED</option></select></Field><Field label="事件类型"><select value={observationForm.incidentType} onChange={(event) => setObservationForm((current) => ({ ...current, incidentType: event.target.value as WatchIncidentType }))}>{incidentOptions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field><Field label="现场决定"><select value={observationForm.disposition} onChange={(event) => setObservationForm((current) => ({ ...current, disposition: event.target.value as WatchDisposition }))}>{dispositionOptions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field></div>
            <Field label="观察事实"><textarea value={observationForm.observation} onChange={(event) => setObservationForm((current) => ({ ...current, observation: event.target.value }))} /></Field><Field label="现场处置"><textarea value={observationForm.actionTaken} onChange={(event) => setObservationForm((current) => ({ ...current, actionTaken: event.target.value }))} /></Field><button type="submit" disabled={busy}>ADD IMMUTABLE OBSERVATION →</button>
          </form>}

          <div className="production-change-actions"><header><div><span>WATCH TIMELINE / 监测时间线</span><h3>环境读数、异常与人工处置。</h3></div><b>{selected.observations.length}</b></header><div className="production-change-action-list">{selected.observations.map((item, index) => <article className={`production-change-action is-${item.conditionResult}`} key={item.id}><span>{String(selected.observations.length - index).padStart(2, "0")} / {formatDate(item.observedAt)}</span><h4>{item.disposition.toUpperCase()}</h4><p>{[item.lux === null ? null : `${item.lux} LUX`, item.uv === null ? null : `UV ${item.uv}`, item.rh === null ? null : `${item.rh}% RH`, item.temperatureTenth === null ? null : `${item.temperatureTenth / 10}°C`].filter(Boolean).join(" · ") || "NO METER READINGS"}</p><p>{item.observation || "状态稳定，无补充观察。"}</p>{item.actionTaken && <small>{item.actionTaken}</small>}<b>{item.incidentType !== "none" ? item.incidentType.toUpperCase() : item.conditionResult.toUpperCase()}</b></article>)}</div></div>

          <div className="production-acceptance-evidence"><header><div><span>PRIVATE WATCH EVIDENCE / 私密监测证据</span><h3>记录品相、支撑、环境、事件与撤展现场。</h3></div><b>{selected.summary.evidenceCount}/20</b></header><div className="production-acceptance-images">{selected.images.filter((item) => item.status === "active").map((item) => <figure key={item.id}><Image src={item.imageUrl} alt={item.altText} width={900} height={1100} unoptimized /><figcaption><b>{item.angle.toUpperCase()}</b><span>{item.caption || item.altText}</span>{selected.watch.status !== "closed" && <button type="button" onClick={() => void removeEvidence(item.id)}>移除</button>}</figcaption></figure>)}</div>{selected.watch.status !== "closed" && <form className="production-acceptance-upload" onSubmit={uploadEvidence}><Field label="证据图片"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))} required /></Field><Field label="关联观察"><select value={imageForm.observationId} onChange={(event) => setImageForm((current) => ({ ...current, observationId: event.target.value }))}><option value="">整段展期</option>{selected.observations.map((item) => <option value={item.id} key={item.id}>{formatDate(item.observedAt)}</option>)}</select></Field><Field label="证据类型"><select value={imageForm.angle} onChange={(event) => setImageForm((current) => ({ ...current, angle: event.target.value as WatchImageAngle }))}>{imageAngles.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field><Field label="说明"><input value={imageForm.caption} onChange={(event) => setImageForm((current) => ({ ...current, caption: event.target.value }))} /></Field><Field label="无障碍描述"><input value={imageForm.altText} onChange={(event) => setImageForm((current) => ({ ...current, altText: event.target.value }))} /></Field><button type="submit" disabled={busy}>UPLOAD PRIVATE EVIDENCE →</button></form>}</div>
        </div>}
      </div>
    </div>
  </section>;
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) { return <div className={alert && value > 0 ? "is-alert" : ""}><span>{label}</span><strong>{String(value).padStart(2, "0")}</strong></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span>{label}</span>{children}</label>; }
function watchFormFor(workspace: ExhibitionWatchWorkspace) { return { status: workspace.watch.status, decision: workspace.watch.decision, monitoringIntervalHours: String(workspace.watch.monitoringIntervalHours), steward: workspace.watch.steward, openingCondition: workspace.watch.openingCondition, decisionNote: workspace.watch.decisionNote, deinstallationCondition: workspace.watch.deinstallationCondition, returnLocation: workspace.watch.returnLocation }; }
function updateForm<K extends keyof WatchForm>(setter: React.Dispatch<React.SetStateAction<WatchForm | null>>, key: K, value: WatchForm[K]) { setter((current) => current ? { ...current, [key]: value } : current); }
async function requestOverview() { const response = await fetch("/api/studio/exhibition-watch", { cache: "no-store" }); const payload = (await response.json()) as ApiPayload; if (!response.ok || !payload.overview) throw new Error(payload.error || "无法读取展期监测台。"); return payload.overview; }
async function api(url: string, method: "POST" | "PATCH", body: unknown) { const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const payload = (await response.json()) as ApiPayload; if (!response.ok) throw new Error(payload.error || "操作失败。"); return payload; }
function errorMessage(cause: unknown, fallback: string) { return cause instanceof Error ? cause.message : fallback; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date); }
function toLocalDateTime(value: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) return ""; const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
