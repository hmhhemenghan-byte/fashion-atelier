"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  CuratorialOverview,
  CuratorialProjectDecision,
  CuratorialProjectStatus,
  CuratorialSelectionDecision,
  CuratorialSelectionRole,
  CuratorialWorkspace,
} from "@/lib/archive-curation";

type ApiPayload = { overview?: CuratorialOverview; project?: { id: string }; selection?: { id: string }; error?: string };
type Filter = "open" | "attention" | "approved" | "all";
type ProjectForm = ReturnType<typeof projectFormFor>;

const statusLabels: Record<CuratorialProjectStatus, string> = {
  draft: "草稿 / DRAFT", in_review: "评审中 / IN REVIEW", approved: "已批准 / APPROVED", closed: "已关闭 / CLOSED", void: "已作废 / VOID",
};
const transitions: Record<CuratorialProjectStatus, CuratorialProjectStatus[]> = {
  draft: ["draft", "in_review", "void"], in_review: ["in_review", "draft", "approved", "void"], approved: ["approved", "closed"], closed: ["closed"], void: ["void"],
};
const decisions: Array<{ value: CuratorialProjectDecision; label: string }> = [
  { value: "pending", label: "待判断 / PENDING" }, { value: "approve", label: "通过策展 / APPROVE" }, { value: "revise", label: "修改后复审 / REVISE" }, { value: "hold", label: "暂缓 / HOLD" },
];
const selectionDecisions: Array<{ value: CuratorialSelectionDecision; label: string }> = [
  { value: "proposed", label: "提议 / PROPOSED" }, { value: "include", label: "纳入 / INCLUDE" }, { value: "alternate", label: "备选 / ALTERNATE" }, { value: "hold", label: "暂缓 / HOLD" }, { value: "exclude", label: "排除 / EXCLUDE" },
];
const roles: Array<{ value: CuratorialSelectionRole; label: string }> = [
  { value: "anchor", label: "叙事锚点 / ANCHOR" }, { value: "dialogue", label: "对话 / DIALOGUE" }, { value: "context", label: "背景 / CONTEXT" }, { value: "transition", label: "转场 / TRANSITION" }, { value: "finale", label: "终章 / FINALE" },
];

export default function ArchiveCuration() {
  const [overview, setOverview] = useState<CuratorialOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProjectForm | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createForm, setCreateForm] = useState({ title: "", curator: "", venueContext: "", openingAt: "", closingAt: "" });
  const [assetId, setAssetId] = useState("");

  useEffect(() => {
    let cancelled = false;
    requestOverview().then((next) => {
      if (cancelled) return;
      const first = next.projects[0] ?? null; setOverview(next); setSelectedId(first?.project.id ?? null); setEditForm(first ? projectFormFor(first) : null);
    }).catch((cause) => { if (!cancelled) setError(errorMessage(cause, "无法读取档案策展室。")); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const selected = overview?.projects.find((item) => item.project.id === selectedId) ?? null;
  const visible = useMemo(() => {
    if (!overview) return [];
    const needle = query.trim().toLowerCase();
    return overview.projects.filter((item) => {
      if (filter === "open" && ["approved", "closed", "void"].includes(item.project.status)) return false;
      if (filter === "attention" && item.summary.blocked === 0 && !(item.project.status === "in_review" && !item.summary.approvalReady)) return false;
      if (filter === "approved" && !["approved", "closed"].includes(item.project.status)) return false;
      return !needle || [item.project.projectCode, item.project.title, item.project.curator, item.project.venueContext].some((value) => value.toLowerCase().includes(needle));
    });
  }, [overview, filter, query]);

  const availableAssets = useMemo(() => {
    const used = new Set(selected?.selections.map((item) => item.sampleAssetId) ?? []);
    return overview?.references.assets.filter((item) => !used.has(item.id)) ?? [];
  }, [overview, selected]);

  async function reload(note: string, preferredId?: string | null) {
    setLoading(true); setError("");
    try {
      const next = await requestOverview();
      const id = preferredId && next.projects.some((item) => item.project.id === preferredId) ? preferredId : selectedId && next.projects.some((item) => item.project.id === selectedId) ? selectedId : next.projects[0]?.project.id ?? null;
      const workspace = next.projects.find((item) => item.project.id === id) ?? null;
      setOverview(next); setSelectedId(id); setEditForm(workspace ? projectFormFor(workspace) : null); setMessage(note);
      window.dispatchEvent(new Event("nera:curation-updated"));
    } catch (cause) { setError(errorMessage(cause, "无法刷新档案策展室。")); }
    finally { setLoading(false); }
  }

  async function createProject(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const payload = await api("/api/studio/archive-curation", "POST", createForm);
      if (!payload.project) throw new Error("建立策展项目失败。");
      setCreateForm({ title: "", curator: "", venueContext: "", openingAt: "", closingAt: "" }); await reload("策展项目已建立。", payload.project.id);
    } catch (cause) { setError(errorMessage(cause, "建立策展项目失败。")); }
    finally { setBusy(false); }
  }

  async function saveProject(event: React.FormEvent) {
    event.preventDefault(); if (!selected || !editForm) return;
    setBusy(true); setError(""); setMessage("");
    try { await api(`/api/studio/archive-curation/${selected.project.id}`, "PATCH", selected.project.status === "approved" ? { status: editForm.status } : editForm); await reload(["approved", "closed", "void"].includes(editForm.status) ? "策展结论已签核并冻结。" : "策展命题与人工判断已保存。", selected.project.id); }
    catch (cause) { setError(errorMessage(cause, "保存策展项目失败。")); }
    finally { setBusy(false); }
  }

  async function addSelection(event: React.FormEvent) {
    event.preventDefault(); if (!selected || !assetId) return;
    setBusy(true); setError("");
    try { await api("/api/studio/archive-curation/selections", "POST", { curatorialProjectId: selected.project.id, sampleAssetId: assetId }); setAssetId(""); await reload("实物已加入策展选择。", selected.project.id); }
    catch (cause) { setError(errorMessage(cause, "加入策展选择失败。")); }
    finally { setBusy(false); }
  }

  async function saveSelection(id: string, body: unknown) {
    if (!selected) return; setBusy(true); setError("");
    try { await api(`/api/studio/archive-curation/selections/${id}`, "PATCH", body); await reload("作品角色、顺序与人工选择已保存。", selected.project.id); }
    catch (cause) { setError(errorMessage(cause, "保存策展选择失败。")); }
    finally { setBusy(false); }
  }

  const frozen = selected ? ["approved", "closed", "void"].includes(selected.project.status) : false;
  return <section className="production-change-control production-acceptance conservation-atelier exhibition-readiness archive-curation" id="archive-curation" aria-labelledby="archive-curation-title">
    <div className="production-change-intro"><span>PHASE 32 / ARCHIVE CURATION</span><h2 id="archive-curation-title">READ THE PAST.<br /><i>COMPOSE THE NEXT.</i></h2><p>把养护、展览与复原历史重新编排为策展命题。系统呈现实物边界，作品是否纳入、如何对话和何时批准始终由设计师决定。</p></div>
    <div className="production-change-metrics"><Metric label="PROJECTS" value={overview?.metrics.total ?? 0} /><Metric label="IN REVIEW" value={overview?.metrics.inReview ?? 0} /><Metric label="APPROVED" value={overview?.metrics.approved ?? 0} /><Metric label="SELECTED WORKS" value={overview?.metrics.selectedWorks ?? 0} /><Metric label="ATTENTION" value={overview?.metrics.attention ?? 0} alert /></div>
    {(error || message) && <p className={error ? "production-change-alert is-error" : "production-change-alert"} role="status">{error || message}</p>}
    <div className="production-change-layout">
      <aside className="production-change-sidebar">
        <form onSubmit={createProject}><span>NEW CURATORIAL PROJECT / 新建策展</span><Field label="项目标题"><input required value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} /></Field><Field label="策展负责人"><input required value={createForm.curator} onChange={(event) => setCreateForm((current) => ({ ...current, curator: event.target.value }))} /></Field><Field label="空间或场景"><input value={createForm.venueContext} onChange={(event) => setCreateForm((current) => ({ ...current, venueContext: event.target.value }))} /></Field><div className="production-change-grid"><Field label="开始时间"><input type="datetime-local" value={createForm.openingAt} onChange={(event) => setCreateForm((current) => ({ ...current, openingAt: event.target.value }))} /></Field><Field label="结束时间"><input type="datetime-local" value={createForm.closingAt} onChange={(event) => setCreateForm((current) => ({ ...current, closingAt: event.target.value }))} /></Field></div><button type="submit" disabled={busy}>OPEN CURATORIAL PROJECT →</button></form>
        <div className="production-change-export"><Link href="/api/studio/archive-curation?format=projects">PROJECTS CSV</Link><Link href="/api/studio/archive-curation?format=selections">SELECTIONS CSV</Link><Link href="/api/studio/archive-curation?format=json">FULL JSON</Link></div>
      </aside>
      <div className="production-change-workbench">
        <div className="production-change-toolbar"><div>{(["open", "attention", "approved", "all"] as Filter[]).map((item) => <button type="button" className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)} key={item}>{item.toUpperCase()}</button>)}</div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索策展标题、负责人或空间" /></div>
        {loading ? <p className="production-change-empty">正在读取策展项目…</p> : visible.length === 0 ? <p className="production-change-empty">当前筛选下没有策展项目。</p> : <div className="production-change-list">{visible.map((workspace) => <button type="button" className={workspace.project.id === selectedId ? "is-active" : ""} onClick={() => { setSelectedId(workspace.project.id); setEditForm(projectFormFor(workspace)); setError(""); setMessage(""); }} key={workspace.project.id}><span>{workspace.project.projectCode}</span><strong>{workspace.project.title}</strong><small>{workspace.project.curator} · {statusLabels[workspace.project.status]}</small><i>{workspace.summary.blocked ? `${workspace.summary.blocked} BLOCKED` : `${workspace.summary.included} INCLUDED`}</i></button>)}</div>}
        {selected && editForm && <div className="production-change-detail"><header><div><span>{selected.project.projectCode}</span><h3>{selected.project.title}</h3><p>{selected.project.venueContext || "CURATORIAL CONTEXT PENDING"}</p></div><div><b>{selected.summary.approvalReady ? "READY FOR APPROVAL" : statusLabels[selected.project.status]}</b><a href="#exhibition-readiness">OPEN DISPLAY READINESS ↓</a></div></header>
          <form className="production-change-form" onSubmit={saveProject}>
            <div className="production-change-grid"><Field label="项目状态"><select value={editForm.status} disabled={selected.project.status === "closed" || selected.project.status === "void"} onChange={(event) => updateForm(setEditForm, "status", event.target.value as CuratorialProjectStatus)}>{transitions[selected.project.status].map((item) => <option value={item} key={item}>{statusLabels[item]}</option>)}</select></Field><Field label="人工决定"><select value={editForm.decision} disabled={frozen} onChange={(event) => updateForm(setEditForm, "decision", event.target.value as CuratorialProjectDecision)}>{decisions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field><Field label="策展负责人"><input value={editForm.curator} disabled={frozen} onChange={(event) => updateForm(setEditForm, "curator", event.target.value)} /></Field><Field label="目标观众"><input value={editForm.audience} disabled={frozen} onChange={(event) => updateForm(setEditForm, "audience", event.target.value)} /></Field><Field label="开始时间"><input type="datetime-local" value={editForm.openingAt} disabled={frozen} onChange={(event) => updateForm(setEditForm, "openingAt", event.target.value)} /></Field><Field label="结束时间"><input type="datetime-local" value={editForm.closingAt} disabled={frozen} onChange={(event) => updateForm(setEditForm, "closingAt", event.target.value)} /></Field></div>
            <Field label="项目标题"><input value={editForm.title} disabled={frozen} onChange={(event) => updateForm(setEditForm, "title", event.target.value)} /></Field><Field label="空间或场景"><textarea value={editForm.venueContext} disabled={frozen} onChange={(event) => updateForm(setEditForm, "venueContext", event.target.value)} /></Field><Field label="策展命题"><textarea value={editForm.thesis} disabled={frozen} onChange={(event) => updateForm(setEditForm, "thesis", event.target.value)} /></Field><div className="production-change-grid"><Field label="叙事结构"><textarea value={editForm.narrative} disabled={frozen} onChange={(event) => updateForm(setEditForm, "narrative", event.target.value)} /></Field><Field label="空间编排"><textarea value={editForm.spatialNote} disabled={frozen} onChange={(event) => updateForm(setEditForm, "spatialNote", event.target.value)} /></Field><Field label="选择原则"><textarea value={editForm.selectionNote} disabled={frozen} onChange={(event) => updateForm(setEditForm, "selectionNote", event.target.value)} /></Field><Field label="人工决定依据"><textarea value={editForm.approvalNote} disabled={frozen} onChange={(event) => updateForm(setEditForm, "approvalNote", event.target.value)} /></Field></div>
            {!(["closed", "void"].includes(selected.project.status)) && <><p className="production-change-note">批准前仍需补齐：{selected.summary.missingFields.join("、") || "无"}。当前有 {selected.summary.blocked} 件纳入作品受实物事实阻塞。</p><button type="submit" disabled={busy}>{editForm.status === "approved" ? "APPROVE & FREEZE CURATION →" : editForm.status === "closed" ? "CLOSE CURATORIAL PROJECT →" : "SAVE CURATORIAL DECISION →"}</button></>}
          </form>
          <div className="production-change-form"><header><div><span>CURATORIAL EDIT / 策展选择</span><h3>顺序与关系由设计师逐件确认。</h3></div></header>
            {!frozen && <form onSubmit={addSelection}><div className="production-change-grid"><Field label="加入实物"><select value={assetId} onChange={(event) => setAssetId(event.target.value)} required><option value="">选择档案实物</option>{availableAssets.map((item) => <option value={item.id} key={item.id}>{item.assetCode} · {item.workTitle}{item.eligible ? "" : " · ATTENTION"}</option>)}</select></Field></div><button type="submit" disabled={busy || !assetId}>ADD TO CURATORIAL EDIT →</button></form>}
            <div className="production-change-checklist">{selected.selections.map((selection) => <SelectionEditor key={`${selection.id}-${selection.updatedAt}`} selection={selection} frozen={frozen} busy={busy} onSave={saveSelection} />)}</div>
          </div>
        </div>}
      </div>
    </div>
  </section>;
}

function SelectionEditor({ selection, frozen, busy, onSave }: { selection: CuratorialWorkspace["selections"][number]; frozen: boolean; busy: boolean; onSave: (id: string, body: unknown) => Promise<void> }) {
  const [form, setForm] = useState({ decision: selection.decision as CuratorialSelectionDecision, role: selection.role as CuratorialSelectionRole, sequence: String(selection.sequence), rationale: selection.rationale, displayIntent: selection.displayIntent, conservationNote: selection.conservationNote });
  const asset = selection.asset;
  return <article className="production-change-check-row"><div>{asset?.imageUrl && <Image src={asset.imageUrl} width={160} height={200} sizes="120px" alt={`${asset.workTitle} 档案实物`} />}<span>{asset?.assetCode || "UNKNOWN ASSET"} · {asset?.eligible ? "ELIGIBLE" : "ATTENTION"}</span><strong>{asset?.workTitle || "未命名作品"}</strong><p>{asset?.warnings.join(" · ") || `${asset?.latestConservation?.reportCode || "养护事实"} · ${asset?.currentLocation || "位置未记录"}`}</p></div><div className="production-change-grid"><Field label="选择"><select value={form.decision} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, decision: event.target.value as CuratorialSelectionDecision }))}>{selectionDecisions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field><Field label="叙事角色"><select value={form.role} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as CuratorialSelectionRole }))}>{roles.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field><Field label="顺序"><input type="number" min="0" value={form.sequence} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, sequence: event.target.value }))} /></Field></div><Field label="纳入或排除依据"><textarea value={form.rationale} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, rationale: event.target.value }))} /></Field><Field label="展示意图"><textarea value={form.displayIntent} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, displayIntent: event.target.value }))} /></Field><Field label="养护边界备注"><textarea value={form.conservationNote} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, conservationNote: event.target.value }))} /></Field>{!frozen && <button type="button" disabled={busy} onClick={() => void onSave(selection.id, form)}>SAVE SELECTION</button>}</article>;
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) { return <div className={alert && value > 0 ? "is-alert" : ""}><span>{label}</span><strong>{value}</strong></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span>{label}</span>{children}</label>; }
function projectFormFor(workspace: CuratorialWorkspace) { const project = workspace.project; return { status: project.status as CuratorialProjectStatus, decision: project.decision as CuratorialProjectDecision, title: project.title, curator: project.curator, venueContext: project.venueContext, audience: project.audience, openingAt: toLocalDateTime(project.openingAt), closingAt: toLocalDateTime(project.closingAt), thesis: project.thesis, narrative: project.narrative, spatialNote: project.spatialNote, selectionNote: project.selectionNote, approvalNote: project.approvalNote }; }
function updateForm<K extends keyof ProjectForm>(setter: React.Dispatch<React.SetStateAction<ProjectForm | null>>, key: K, value: ProjectForm[K]) { setter((current) => current ? { ...current, [key]: value } : current); }
function toLocalDateTime(value: string | null | undefined) { if (!value) return ""; const date = new Date(value); if (Number.isNaN(date.getTime())) return ""; const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000); return shifted.toISOString().slice(0, 16); }
function errorMessage(cause: unknown, fallback: string) { return cause instanceof Error ? cause.message : fallback; }
async function requestOverview() { const response = await fetch("/api/studio/archive-curation", { cache: "no-store" }); const payload = (await response.json()) as ApiPayload; if (!response.ok || !payload.overview) throw new Error(payload.error || "无法读取档案策展室。"); return payload.overview; }
async function api(url: string, method: "POST" | "PATCH", body: unknown) { const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const payload = (await response.json()) as ApiPayload; if (!response.ok) throw new Error(payload.error || "操作失败。"); return payload; }
