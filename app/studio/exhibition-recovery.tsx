"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  ExhibitionRecoveryCheckResult,
  ExhibitionRecoveryDecision,
  ExhibitionRecoveryImageAngle,
  ExhibitionRecoveryOverview,
  ExhibitionRecoveryStatus,
  ExhibitionRecoveryWorkspace,
} from "@/lib/exhibition-recovery";

type ApiPayload = { overview?: ExhibitionRecoveryOverview; recovery?: { id: string }; check?: { id: string }; image?: { id: string }; error?: string };
type Filter = "open" | "attention" | "released" | "all";
type RecoveryForm = ReturnType<typeof recoveryFormFor>;

const statusLabels: Record<ExhibitionRecoveryStatus, string> = {
  intake: "接收中 / INTAKE", stabilizing: "静置中 / STABILIZING", in_review: "复核中 / IN REVIEW",
  released: "已回库 / RELEASED", referred: "已转养护 / REFERRED", void: "已作废 / VOID",
};
const transitions: Record<ExhibitionRecoveryStatus, ExhibitionRecoveryStatus[]> = {
  intake: ["intake", "stabilizing", "in_review", "referred", "void"],
  stabilizing: ["stabilizing", "in_review", "referred", "void"],
  in_review: ["in_review", "intake", "stabilizing", "released", "referred", "void"],
  released: ["released"], referred: ["referred"], void: ["void"],
};
const decisions: Array<{ value: ExhibitionRecoveryDecision; label: string }> = [
  { value: "pending", label: "待判断 / PENDING" }, { value: "return_to_storage", label: "直接回库 / RETURN TO STORAGE" },
  { value: "rest_then_store", label: "静置后回库 / REST THEN STORE" }, { value: "conservation_review", label: "转养护复核 / CONSERVATION REVIEW" },
  { value: "quarantine", label: "隔离观察 / QUARANTINE" },
];
const checkResults: Array<{ value: ExhibitionRecoveryCheckResult; label: string }> = [
  { value: "pending", label: "待核对 / PENDING" }, { value: "pass", label: "通过 / PASS" },
  { value: "attention", label: "需关注 / ATTENTION" }, { value: "blocked", label: "阻塞 / BLOCKED" }, { value: "na", label: "不适用 / N/A" },
];
const imageAngles: Array<{ value: ExhibitionRecoveryImageAngle; label: string }> = [
  { value: "intake", label: "接收 / INTAKE" }, { value: "unpacking", label: "开箱 / UNPACKING" },
  { value: "condition", label: "品相 / CONDITION" }, { value: "support", label: "支撑 / SUPPORT" },
  { value: "packing", label: "包装 / PACKING" }, { value: "storage", label: "回库 / STORAGE" }, { value: "other", label: "其他 / OTHER" },
];

export default function ExhibitionRecovery() {
  const [overview, setOverview] = useState<ExhibitionRecoveryOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RecoveryForm | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createForm, setCreateForm] = useState({ exhibitionWatchId: "", handler: "", receivedAt: toLocalDateTime(new Date().toISOString()), intakeLocation: "" });
  const [imageForm, setImageForm] = useState<{ file: File | null; angle: ExhibitionRecoveryImageAngle; caption: string; altText: string }>({ file: null, angle: "intake", caption: "", altText: "" });

  useEffect(() => {
    let cancelled = false;
    requestOverview().then((next) => {
      if (cancelled) return;
      const first = next.recoveries[0] ?? null;
      setOverview(next); setSelectedId(first?.recovery.id ?? null); setEditForm(first ? recoveryFormFor(first) : null);
    }).catch((cause) => { if (!cancelled) setError(errorMessage(cause, "无法读取展后复原台。")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const selected = overview?.recoveries.find((item) => item.recovery.id === selectedId) ?? null;
  const visible = useMemo(() => {
    if (!overview) return [];
    const needle = query.trim().toLowerCase();
    return overview.recoveries.filter((item) => {
      if (filter === "open" && ["released", "referred", "void"].includes(item.recovery.status)) return false;
      if (filter === "attention" && item.summary.blockedChecks === 0 && !item.summary.stabilizationDue && !item.recovery.treatmentRequired) return false;
      if (filter === "released" && !["released", "referred"].includes(item.recovery.status)) return false;
      if (!needle) return true;
      return [item.recovery.recoveryCode, item.watch?.watch.watchCode, item.watch?.plan?.asset?.assetCode, item.watch?.plan?.work?.title, item.recovery.storageLocation].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [overview, filter, query]);

  async function reload(note: string, preferredId?: string | null) {
    setLoading(true); setError("");
    try {
      const next = await requestOverview();
      const id = preferredId && next.recoveries.some((item) => item.recovery.id === preferredId) ? preferredId : selectedId && next.recoveries.some((item) => item.recovery.id === selectedId) ? selectedId : next.recoveries[0]?.recovery.id ?? null;
      const workspace = next.recoveries.find((item) => item.recovery.id === id) ?? null;
      setOverview(next); setSelectedId(id); setEditForm(workspace ? recoveryFormFor(workspace) : null); setMessage(note);
      window.dispatchEvent(new Event("nera:exhibition-recovery-updated"));
    } catch (cause) { setError(errorMessage(cause, "无法刷新展后复原台。")); }
    finally { setLoading(false); }
  }

  async function createRecovery(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const payload = await api("/api/studio/exhibition-recovery", "POST", createForm);
      if (!payload.recovery) throw new Error("建立展后复原记录失败。");
      setCreateForm({ exhibitionWatchId: "", handler: "", receivedAt: toLocalDateTime(new Date().toISOString()), intakeLocation: "" });
      await reload("展后接收已登记，六项人工核对已建立。", payload.recovery.id);
    } catch (cause) { setError(errorMessage(cause, "建立展后复原记录失败。")); }
    finally { setBusy(false); }
  }

  async function saveRecovery(event: React.FormEvent) {
    event.preventDefault(); if (!selected || !editForm) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/api/studio/exhibition-recovery/${selected.recovery.id}`, "PATCH", editForm);
      const terminal = ["released", "referred", "void"].includes(editForm.status);
      await reload(terminal ? "展后复原结论已签核并冻结。" : "接收、复原与人工判断已保存。", selected.recovery.id);
    } catch (cause) { setError(errorMessage(cause, "保存展后复原记录失败。")); }
    finally { setBusy(false); }
  }

  async function saveCheck(id: string, result: ExhibitionRecoveryCheckResult, observation: string) {
    if (!selected) return; setBusy(true); setError("");
    try { await api(`/api/studio/exhibition-recovery/checks/${id}`, "PATCH", { result, observation }); await reload("复原核对已保存。", selected.recovery.id); }
    catch (cause) { setError(errorMessage(cause, "保存复原核对失败。")); }
    finally { setBusy(false); }
  }

  async function uploadEvidence(event: React.FormEvent) {
    event.preventDefault(); if (!selected || !imageForm.file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const form = new FormData(); form.set("image", imageForm.file); form.set("angle", imageForm.angle); form.set("caption", imageForm.caption); form.set("altText", imageForm.altText);
      const response = await fetch(`/api/studio/exhibition-recovery/${selected.recovery.id}/images`, { method: "POST", body: form });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.image) throw new Error(payload.error || "上传接收证据失败。");
      setImageForm({ file: null, angle: "intake", caption: "", altText: "" }); await reload("私密展后证据已保存。", selected.recovery.id);
    } catch (cause) { setError(errorMessage(cause, "上传接收证据失败。")); }
    finally { setBusy(false); }
  }

  async function removeEvidence(id: string) {
    if (!selected) return; setBusy(true); setError("");
    try { await api(`/api/studio/exhibition-recovery/images/${id}`, "PATCH", { status: "removed" }); await reload("证据已移出有效清单。", selected.recovery.id); }
    catch (cause) { setError(errorMessage(cause, "更新证据失败。")); }
    finally { setBusy(false); }
  }

  const frozen = selected ? ["released", "referred", "void"].includes(selected.recovery.status) : false;
  return <section className="production-change-control production-acceptance conservation-atelier exhibition-readiness exhibition-watch exhibition-recovery" id="exhibition-recovery" aria-labelledby="exhibition-recovery-title">
    <div className="production-change-intro"><span>PHASE 31 / EXHIBITION RECOVERY</span><h2 id="exhibition-recovery-title">CLOSE THE DISPLAY.<br /><i>RESTORE THE WORK.</i></h2><p>从撤展交接到静置、复原与回库，把作品离场后的实物状态变成可核对、可分流、不可覆盖的人工事实。</p></div>
    <div className="production-change-metrics"><Metric label="RECOVERIES" value={overview?.metrics.total ?? 0} /><Metric label="STABILIZING" value={overview?.metrics.stabilizing ?? 0} /><Metric label="IN REVIEW" value={overview?.metrics.inReview ?? 0} /><Metric label="ATTENTION" value={overview?.metrics.attention ?? 0} alert /><Metric label="RELEASED" value={overview?.metrics.released ?? 0} /></div>
    {(error || message) && <p className={error ? "production-change-alert is-error" : "production-change-alert"} role="status">{error || message}</p>}
    <div className="production-change-layout">
      <aside className="production-change-sidebar">
        <form onSubmit={createRecovery}><span>RECEIVE AFTER DISPLAY / 展后接收</span>
          <Field label="已完成撤展的监测"><select required value={createForm.exhibitionWatchId} onChange={(event) => setCreateForm((current) => ({ ...current, exhibitionWatchId: event.target.value }))}><option value="">选择撤展记录</option>{overview?.references.deinstalledWatches.map((item) => <option value={item.exhibitionWatchId} key={item.exhibitionWatchId}>{item.watchCode} · {item.assetCode || item.workTitle}</option>)}</select></Field>
          <Field label="接收负责人"><input required value={createForm.handler} onChange={(event) => setCreateForm((current) => ({ ...current, handler: event.target.value }))} /></Field>
          <Field label="接收时间"><input type="datetime-local" value={createForm.receivedAt} onChange={(event) => setCreateForm((current) => ({ ...current, receivedAt: event.target.value }))} /></Field>
          <Field label="接收地点"><input required value={createForm.intakeLocation} onChange={(event) => setCreateForm((current) => ({ ...current, intakeLocation: event.target.value }))} /></Field>
          <button type="submit" disabled={busy}>OPEN RECOVERY RECORD →</button>
        </form>
        <div className="production-change-export"><Link href="/api/studio/exhibition-recovery?format=recoveries">RECOVERIES CSV</Link><Link href="/api/studio/exhibition-recovery?format=checks">CHECKS CSV</Link><Link href="/api/studio/exhibition-recovery?format=images">EVIDENCE CSV</Link><Link href="/api/studio/exhibition-recovery?format=json">FULL JSON</Link></div>
      </aside>
      <div className="production-change-workbench">
        <div className="production-change-toolbar"><div>{(["open", "attention", "released", "all"] as Filter[]).map((item) => <button type="button" className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)} key={item}>{item.toUpperCase()}</button>)}</div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索复原、监测、实物或位置" /></div>
        {loading ? <p className="production-change-empty">正在读取展后复原记录…</p> : visible.length === 0 ? <p className="production-change-empty">当前筛选下没有复原记录。</p> : <div className="production-change-list">{visible.map((workspace) => <button type="button" className={workspace.recovery.id === selectedId ? "is-active" : ""} onClick={() => { setSelectedId(workspace.recovery.id); setEditForm(recoveryFormFor(workspace)); setError(""); setMessage(""); }} key={workspace.recovery.id}><span>{workspace.recovery.recoveryCode}</span><strong>{workspace.watch?.plan?.work?.title || workspace.watch?.plan?.asset?.workTitle || "UNTITLED"}</strong><small>{workspace.watch?.plan?.asset?.assetCode} · {statusLabels[workspace.recovery.status]}</small><i>{workspace.summary.blockedChecks ? `${workspace.summary.blockedChecks} BLOCKED` : workspace.summary.stabilizationDue ? "REST COMPLETE" : `${workspace.summary.passedChecks}/6 CHECKS`}</i></button>)}</div>}

        {selected && editForm && <div className="production-change-detail">
          <header><div><span>{selected.recovery.recoveryCode}</span><h3>{selected.watch?.plan?.work?.title || selected.watch?.plan?.asset?.workTitle || "展后复原"}</h3><p>{selected.watch?.watch.watchCode} · {selected.watch?.plan?.asset?.assetCode}</p></div><div><b>{selected.summary.releaseReady ? "READY FOR RELEASE" : statusLabels[selected.recovery.status]}</b><a href="#exhibition-watch">OPEN EXHIBITION WATCH ↑</a></div></header>
          <form className="production-change-form" onSubmit={saveRecovery}>
            <div className="production-change-grid"><Field label="复原状态"><select value={editForm.status} disabled={frozen} onChange={(event) => updateForm(setEditForm, "status", event.target.value as ExhibitionRecoveryStatus)}>{transitions[selected.recovery.status].map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}</select></Field><Field label="人工去向"><select value={editForm.decision} disabled={frozen} onChange={(event) => updateForm(setEditForm, "decision", event.target.value as ExhibitionRecoveryDecision)}>{decisions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field><Field label="接收负责人"><input value={editForm.handler} disabled={frozen} onChange={(event) => updateForm(setEditForm, "handler", event.target.value)} /></Field><Field label="接收时间"><input type="datetime-local" value={editForm.receivedAt} disabled={frozen} onChange={(event) => updateForm(setEditForm, "receivedAt", event.target.value)} /></Field><Field label="接收地点"><input value={editForm.intakeLocation} disabled={frozen} onChange={(event) => updateForm(setEditForm, "intakeLocation", event.target.value)} /></Field><Field label="保存位置"><input value={editForm.storageLocation} disabled={frozen} onChange={(event) => updateForm(setEditForm, "storageLocation", event.target.value)} /></Field></div>
            <div className="production-change-grid"><Field label="包装到达状态"><textarea value={editForm.packingCondition} disabled={frozen} onChange={(event) => updateForm(setEditForm, "packingCondition", event.target.value)} /></Field><Field label="运输交接状态"><textarea value={editForm.transitCondition} disabled={frozen} onChange={(event) => updateForm(setEditForm, "transitCondition", event.target.value)} /></Field><Field label="开箱观察"><textarea value={editForm.unpackingObservation} disabled={frozen} onChange={(event) => updateForm(setEditForm, "unpackingObservation", event.target.value)} /></Field><Field label="支撑拆除记录"><textarea value={editForm.supportRemovalNote} disabled={frozen} onChange={(event) => updateForm(setEditForm, "supportRemovalNote", event.target.value)} /></Field></div>
            <Field label="展后品相复查"><textarea value={editForm.postDisplayCondition} disabled={frozen} onChange={(event) => updateForm(setEditForm, "postDisplayCondition", event.target.value)} /></Field>
            <div className="production-change-grid"><Field label="静置截止时间"><input type="datetime-local" value={editForm.acclimatizationUntil} disabled={frozen} onChange={(event) => updateForm(setEditForm, "acclimatizationUntil", event.target.value)} /></Field><Field label="养护或隔离说明"><textarea value={editForm.treatmentNote} disabled={frozen} onChange={(event) => updateForm(setEditForm, "treatmentNote", event.target.value)} /></Field></div>
            <label className="production-change-check"><input type="checkbox" checked={editForm.treatmentRequired} disabled={frozen} onChange={(event) => updateForm(setEditForm, "treatmentRequired", event.target.checked)} /><span>需要养护、修复或隔离复核</span></label>
            <Field label="人工结论与依据"><textarea value={editForm.recoveryNote} disabled={frozen} onChange={(event) => updateForm(setEditForm, "recoveryNote", event.target.value)} /></Field>
            {!frozen && <><p className="production-change-note">最终回库或转养护会冻结本次事实。仍需补齐：{selected.summary.missingFields.join("、") || "无"}。</p><button type="submit" disabled={busy}>{["released", "referred", "void"].includes(editForm.status) ? "SIGN & FREEZE RECOVERY →" : "SAVE RECOVERY FACTS →"}</button></>}
          </form>

          <div className="production-change-form"><header><div><span>SIX HUMAN CHECKS / 六项人工核对</span><h3>每一项都保存结果和观察依据。</h3></div></header><div className="production-change-checklist">{selected.checks.map((check) => <CheckEditor check={check} frozen={frozen} busy={busy} onSave={saveCheck} key={`${check.id}-${check.updatedAt}`} />)}</div></div>

          <div className="production-change-form"><header><div><span>PRIVATE RECOVERY EVIDENCE / 私密证据</span><h3>接收、开箱、品相与回库影像不进入公开作品页。</h3></div></header>
            {!frozen && <form onSubmit={uploadEvidence}><div className="production-change-grid"><Field label="影像文件"><input type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => setImageForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))} /></Field><Field label="证据角度"><select value={imageForm.angle} onChange={(event) => setImageForm((current) => ({ ...current, angle: event.target.value as ExhibitionRecoveryImageAngle }))}>{imageAngles.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field><Field label="说明"><input value={imageForm.caption} onChange={(event) => setImageForm((current) => ({ ...current, caption: event.target.value }))} /></Field><Field label="图片描述"><input required value={imageForm.altText} onChange={(event) => setImageForm((current) => ({ ...current, altText: event.target.value }))} /></Field></div><button type="submit" disabled={busy || !imageForm.file}>UPLOAD PRIVATE EVIDENCE →</button></form>}
            <div className="production-change-gallery">{selected.images.filter((item) => item.status === "active").map((item) => <figure key={item.id}><Image src={item.imageUrl} width={480} height={600} sizes="(max-width: 760px) 100vw, 240px" alt={item.altText} /><figcaption><span>{item.angle.toUpperCase()}</span><p>{item.caption || item.altText}</p>{!frozen && <button type="button" disabled={busy} onClick={() => void removeEvidence(item.id)}>REMOVE</button>}</figcaption></figure>)}</div>
          </div>
        </div>}
      </div>
    </div>
  </section>;
}

function CheckEditor({ check, frozen, busy, onSave }: { check: ExhibitionRecoveryWorkspace["checks"][number]; frozen: boolean; busy: boolean; onSave: (id: string, result: ExhibitionRecoveryCheckResult, observation: string) => Promise<void> }) {
  const [result, setResult] = useState<ExhibitionRecoveryCheckResult>(check.result as ExhibitionRecoveryCheckResult);
  const [observation, setObservation] = useState(check.observation);
  return <div className="production-change-check-row"><div><span>{check.category.toUpperCase()} · {check.critical ? "REQUIRED" : "OPTIONAL"}</span><strong>{check.title}</strong><p>{check.requirement}</p></div><select value={result} disabled={frozen} onChange={(event) => setResult(event.target.value as ExhibitionRecoveryCheckResult)}>{checkResults.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select><textarea value={observation} disabled={frozen} onChange={(event) => setObservation(event.target.value)} placeholder="记录观察、差异或放行依据" />{!frozen && <button type="button" disabled={busy} onClick={() => void onSave(check.id, result, observation)}>SAVE CHECK</button>}</div>;
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) { return <div className={alert && value > 0 ? "is-alert" : ""}><span>{label}</span><strong>{value}</strong></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span>{label}</span>{children}</label>; }
function recoveryFormFor(workspace: ExhibitionRecoveryWorkspace) { const item = workspace.recovery; return { status: item.status as ExhibitionRecoveryStatus, decision: item.decision as ExhibitionRecoveryDecision, receivedAt: toLocalDateTime(item.receivedAt), handler: item.handler, intakeLocation: item.intakeLocation, packingCondition: item.packingCondition, transitCondition: item.transitCondition, unpackingObservation: item.unpackingObservation, supportRemovalNote: item.supportRemovalNote, postDisplayCondition: item.postDisplayCondition, acclimatizationUntil: toLocalDateTime(item.acclimatizationUntil), treatmentRequired: item.treatmentRequired, treatmentNote: item.treatmentNote, storageLocation: item.storageLocation, recoveryNote: item.recoveryNote }; }
function updateForm<K extends keyof RecoveryForm>(setter: React.Dispatch<React.SetStateAction<RecoveryForm | null>>, key: K, value: RecoveryForm[K]) { setter((current) => current ? { ...current, [key]: value } : current); }
function toLocalDateTime(value: string | null | undefined) { if (!value) return ""; const date = new Date(value); if (Number.isNaN(date.getTime())) return ""; const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000); return shifted.toISOString().slice(0, 16); }
function errorMessage(cause: unknown, fallback: string) { return cause instanceof Error ? cause.message : fallback; }
async function requestOverview() { const response = await fetch("/api/studio/exhibition-recovery", { cache: "no-store" }); const payload = (await response.json()) as ApiPayload; if (!response.ok || !payload.overview) throw new Error(payload.error || "无法读取展后复原台。"); return payload.overview; }
async function api(url: string, method: "POST" | "PATCH", body: unknown) { const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const payload = (await response.json()) as ApiPayload; if (!response.ok) throw new Error(payload.error || "操作失败。"); return payload; }
