"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { InterpretationDecision, InterpretationOverview, InterpretationRightsStatus, InterpretationStatus, InterpretationWorkspace } from "@/lib/exhibition-interpretation";

type ApiPayload = { overview?: InterpretationOverview; package?: { id: string }; section?: { id: string }; label?: { id: string }; error?: string };
type Filter = "open" | "attention" | "approved" | "all";
type PackageForm = ReturnType<typeof packageFormFor>;

const statusLabels: Record<InterpretationStatus, string> = { draft: "草稿 / DRAFT", in_review: "评审中 / IN REVIEW", approved: "已批准 / APPROVED", closed: "已关闭 / CLOSED", void: "已作废 / VOID" };
const transitions: Record<InterpretationStatus, InterpretationStatus[]> = { draft: ["draft", "in_review", "void"], in_review: ["in_review", "draft", "approved", "void"], approved: ["approved", "closed"], closed: ["closed"], void: ["void"] };
const decisions: Array<{ value: InterpretationDecision; label: string }> = [
  { value: "pending", label: "待判断 / PENDING" }, { value: "approve", label: "批准文字 / APPROVE" }, { value: "revise", label: "修改后复审 / REVISE" }, { value: "hold", label: "暂缓 / HOLD" },
];
const rightsStatuses: Array<{ value: InterpretationRightsStatus; label: string }> = [
  { value: "unchecked", label: "未核对 / UNCHECKED" }, { value: "cleared", label: "已确认 / CLEARED" }, { value: "restricted", label: "受限 / RESTRICTED" }, { value: "not_required", label: "无需许可 / NOT REQUIRED" },
];

export default function ExhibitionInterpretation() {
  const [overview, setOverview] = useState<InterpretationOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PackageForm | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createForm, setCreateForm] = useState({ curatorialProjectId: "", editor: "", primaryLanguage: "zh-CN", secondaryLanguage: "en" });
  const [sectionTitle, setSectionTitle] = useState("");

  useEffect(() => {
    let cancelled = false;
    requestOverview().then((next) => {
      if (cancelled) return;
      const first = next.packages[0] ?? null; setOverview(next); setSelectedId(first?.package.id ?? null); setEditForm(first ? packageFormFor(first) : null);
    }).catch((cause) => { if (!cancelled) setError(errorMessage(cause, "无法读取展览释读室。")); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const selected = overview?.packages.find((item) => item.package.id === selectedId) ?? null;
  const visible = useMemo(() => {
    if (!overview) return [];
    const needle = query.trim().toLowerCase();
    return overview.packages.filter((item) => {
      if (filter === "open" && ["approved", "closed", "void"].includes(item.package.status)) return false;
      if (filter === "attention" && !((item.package.status === "in_review" || item.package.decision === "revise") && !item.summary.approvalReady)) return false;
      if (filter === "approved" && !["approved", "closed"].includes(item.package.status)) return false;
      return !needle || [item.package.packageCode, item.package.title, item.package.editor, item.project?.title ?? ""].some((value) => value.toLowerCase().includes(needle));
    });
  }, [overview, filter, query]);

  async function reload(note: string, preferredId?: string | null) {
    setLoading(true); setError("");
    try {
      const next = await requestOverview();
      const id = preferredId && next.packages.some((item) => item.package.id === preferredId) ? preferredId : selectedId && next.packages.some((item) => item.package.id === selectedId) ? selectedId : next.packages[0]?.package.id ?? null;
      const workspace = next.packages.find((item) => item.package.id === id) ?? null;
      setOverview(next); setSelectedId(id); setEditForm(workspace ? packageFormFor(workspace) : null); setMessage(note);
      window.dispatchEvent(new Event("nera:interpretation-updated"));
    } catch (cause) { setError(errorMessage(cause, "无法刷新展览释读室。")); }
    finally { setLoading(false); }
  }

  async function createPackage(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const payload = await api("/api/studio/exhibition-interpretation", "POST", createForm);
      if (!payload.package) throw new Error("建立展览释读包失败。");
      setCreateForm((current) => ({ ...current, curatorialProjectId: "" })); await reload("释读修订已建立，并按冻结选品生成作品标签。", payload.package.id);
    } catch (cause) { setError(errorMessage(cause, "建立展览释读包失败。")); }
    finally { setBusy(false); }
  }

  async function savePackage(event: React.FormEvent) {
    event.preventDefault(); if (!selected || !editForm) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/api/studio/exhibition-interpretation/${selected.package.id}`, "PATCH", selected.package.status === "approved" ? { status: editForm.status } : editForm);
      await reload(["approved", "closed", "void"].includes(editForm.status) ? "释读修订已签核并冻结。" : "展览导语、署名与人工判断已保存。", selected.package.id);
    } catch (cause) { setError(errorMessage(cause, "保存展览释读包失败。")); }
    finally { setBusy(false); }
  }

  async function addSection(event: React.FormEvent) {
    event.preventDefault(); if (!selected || !sectionTitle.trim()) return;
    setBusy(true); setError("");
    try { await api("/api/studio/exhibition-interpretation/sections", "POST", { interpretationPackageId: selected.package.id, titlePrimary: sectionTitle }); setSectionTitle(""); await reload("叙事章节已加入。", selected.package.id); }
    catch (cause) { setError(errorMessage(cause, "新增叙事章节失败。")); }
    finally { setBusy(false); }
  }

  async function saveChild(kind: "sections" | "labels", id: string, body: unknown, note: string) {
    if (!selected) return; setBusy(true); setError("");
    try { await api(`/api/studio/exhibition-interpretation/${kind}/${id}`, "PATCH", body); await reload(note, selected.package.id); }
    catch (cause) { setError(errorMessage(cause, "保存释读内容失败。")); }
    finally { setBusy(false); }
  }

  const frozen = selected ? ["approved", "closed", "void"].includes(selected.package.status) : false;
  return <section className="production-change-control production-acceptance conservation-atelier exhibition-readiness archive-curation exhibition-interpretation" id="exhibition-interpretation" aria-labelledby="exhibition-interpretation-title">
    <div className="production-change-intro"><span>PHASE 33 / EXHIBITION INTERPRETATION</span><h2 id="exhibition-interpretation-title">WRITE THE ROOM.<br /><i>GUARD THE MEANING.</i></h2><p>把冻结策展转化为入口导语、章节叙事与逐件作品标签。系统核对事实、署名、权利和无障碍文字，但不会自动撰写、翻译或公开。</p></div>
    <div className="production-change-metrics"><Metric label="PACKAGES" value={overview?.metrics.total ?? 0} /><Metric label="IN REVIEW" value={overview?.metrics.inReview ?? 0} /><Metric label="APPROVED" value={overview?.metrics.approved ?? 0} /><Metric label="OBJECT LABELS" value={overview?.metrics.labels ?? 0} /><Metric label="ATTENTION" value={overview?.metrics.attention ?? 0} alert /></div>
    {(error || message) && <p className={error ? "production-change-alert is-error" : "production-change-alert"} role="status">{error || message}</p>}
    <div className="production-change-layout">
      <aside className="production-change-sidebar">
        <form onSubmit={createPackage}><span>NEW INTERPRETATION REVISION / 新建释读</span><Field label="冻结策展项目"><select required value={createForm.curatorialProjectId} onChange={(event) => setCreateForm((current) => ({ ...current, curatorialProjectId: event.target.value }))}><option value="">选择已批准策展</option>{overview?.references.projects.map((project) => <option value={project.id} key={project.id}>{project.projectCode} · {project.title} · R{project.existingRevisions + 1}</option>)}</select></Field><Field label="文字负责人"><input required value={createForm.editor} onChange={(event) => setCreateForm((current) => ({ ...current, editor: event.target.value }))} /></Field><div className="production-change-grid"><Field label="主语言"><input required value={createForm.primaryLanguage} onChange={(event) => setCreateForm((current) => ({ ...current, primaryLanguage: event.target.value }))} /></Field><Field label="第二语言（可空）"><input value={createForm.secondaryLanguage} onChange={(event) => setCreateForm((current) => ({ ...current, secondaryLanguage: event.target.value }))} /></Field></div><button type="submit" disabled={busy}>OPEN INTERPRETATION REVISION →</button></form>
        <div className="production-change-export"><Link href="/api/studio/exhibition-interpretation?format=packages">PACKAGES CSV</Link><Link href="/api/studio/exhibition-interpretation?format=sections">SECTIONS CSV</Link><Link href="/api/studio/exhibition-interpretation?format=labels">LABELS CSV</Link><Link href="/api/studio/exhibition-interpretation?format=json">FULL JSON</Link></div>
      </aside>
      <div className="production-change-workbench">
        <div className="production-change-toolbar"><div>{(["open", "attention", "approved", "all"] as Filter[]).map((item) => <button type="button" className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)} key={item}>{item.toUpperCase()}</button>)}</div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索释读编号、标题或负责人" /></div>
        {loading ? <p className="production-change-empty">正在读取展览释读包…</p> : visible.length === 0 ? <p className="production-change-empty">当前筛选下没有展览释读包。</p> : <div className="production-change-list">{visible.map((workspace) => <button type="button" className={workspace.package.id === selectedId ? "is-active" : ""} onClick={() => { setSelectedId(workspace.package.id); setEditForm(packageFormFor(workspace)); setError(""); setMessage(""); }} key={workspace.package.id}><span>{workspace.package.packageCode}</span><strong>{workspace.package.title || workspace.project?.title || "未命名释读"}</strong><small>{workspace.package.editor} · {statusLabels[workspace.package.status as InterpretationStatus]}</small><i>{workspace.summary.missingFields.length ? `${workspace.summary.missingFields.length} OPEN` : `${workspace.summary.labelCount} LABELS`}</i></button>)}</div>}
        {selected && editForm && <div className="production-change-detail"><header><div><span>{selected.package.packageCode} · REVISION {selected.package.revision}</span><h3>{selected.package.title || selected.project?.title}</h3><p>{selected.project?.projectCode} · {selected.project?.curator}</p></div><div><b>{selected.summary.approvalReady ? "READY FOR APPROVAL" : statusLabels[selected.package.status as InterpretationStatus]}</b><a href="#archive-curation">OPEN FROZEN CURATION ↑</a></div></header>
          <form className="production-change-form" onSubmit={savePackage}>
            <div className="production-change-grid"><Field label="释读状态"><select value={editForm.status} disabled={["closed", "void"].includes(selected.package.status)} onChange={(event) => updateForm(setEditForm, "status", event.target.value as InterpretationStatus)}>{transitions[selected.package.status as InterpretationStatus].map((item) => <option value={item} key={item}>{statusLabels[item]}</option>)}</select></Field><Field label="人工决定"><select value={editForm.decision} disabled={frozen} onChange={(event) => updateForm(setEditForm, "decision", event.target.value as InterpretationDecision)}>{decisions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field><Field label="文字负责人"><input value={editForm.editor} disabled={frozen} onChange={(event) => updateForm(setEditForm, "editor", event.target.value)} /></Field><Field label="主语言"><input value={editForm.primaryLanguage} disabled={frozen} onChange={(event) => updateForm(setEditForm, "primaryLanguage", event.target.value)} /></Field><Field label="第二语言"><input value={editForm.secondaryLanguage} disabled={frozen} onChange={(event) => updateForm(setEditForm, "secondaryLanguage", event.target.value)} /></Field></div>
            <Field label="展览标题"><input value={editForm.title} disabled={frozen} onChange={(event) => updateForm(setEditForm, "title", event.target.value)} /></Field><Field label="副标题"><input value={editForm.subtitle} disabled={frozen} onChange={(event) => updateForm(setEditForm, "subtitle", event.target.value)} /></Field><Field label="入口导语"><textarea value={editForm.entranceText} disabled={frozen} onChange={(event) => updateForm(setEditForm, "entranceText", event.target.value)} /></Field><div className="production-change-grid"><Field label="策展署名"><textarea value={editForm.curatorialCredit} disabled={frozen} onChange={(event) => updateForm(setEditForm, "curatorialCredit", event.target.value)} /></Field><Field label="鸣谢"><textarea value={editForm.acknowledgement} disabled={frozen} onChange={(event) => updateForm(setEditForm, "acknowledgement", event.target.value)} /></Field><Field label="无障碍释读说明"><textarea value={editForm.accessibilityNote} disabled={frozen} onChange={(event) => updateForm(setEditForm, "accessibilityNote", event.target.value)} /></Field><Field label="权利与引用说明"><textarea value={editForm.rightsNote} disabled={frozen} onChange={(event) => updateForm(setEditForm, "rightsNote", event.target.value)} /></Field><Field label="人工批准依据"><textarea value={editForm.approvalNote} disabled={frozen} onChange={(event) => updateForm(setEditForm, "approvalNote", event.target.value)} /></Field></div>
            {!(["closed", "void"].includes(selected.package.status)) && <><p className="production-change-note">批准前仍需补齐：{selected.summary.missingFields.join("、") || "无"}。当前 {selected.summary.clearedLabels}/{selected.summary.expectedLabelCount} 件作品已完成权利核对。</p><button type="submit" disabled={busy}>{editForm.status === "approved" ? "APPROVE & FREEZE INTERPRETATION →" : editForm.status === "closed" ? "CLOSE INTERPRETATION PACKAGE →" : "SAVE INTERPRETATION DECISION →"}</button></>}
          </form>
          <div className="production-change-form"><header><div><span>NARRATIVE SECTIONS / 叙事章节</span><h3>先建立阅读路径，再逐件解释作品。</h3></div></header>{!frozen && <form onSubmit={addSection}><Field label="新章节标题"><input required value={sectionTitle} onChange={(event) => setSectionTitle(event.target.value)} /></Field><button type="submit" disabled={busy}>ADD NARRATIVE SECTION →</button></form>}<div className="production-change-checklist">{selected.sections.map((section) => <SectionEditor key={`${section.id}-${section.updatedAt}`} section={section} frozen={frozen} busy={busy} secondaryLanguage={selected.package.secondaryLanguage} onSave={(id, body) => saveChild("sections", id, body, "叙事章节已保存。")} />)}</div></div>
          <div className="production-change-form"><header><div><span>OBJECT LABELS / 作品标签</span><h3>事实、叙事、署名与无障碍文字逐件核对。</h3></div></header><div className="production-change-checklist">{selected.labels.map((label) => <LabelEditor key={`${label.id}-${label.updatedAt}`} label={label} frozen={frozen} busy={busy} secondaryLanguage={selected.package.secondaryLanguage} onSave={(id, body) => saveChild("labels", id, body, "作品标签与权利事实已保存。")} />)}</div></div>
        </div>}
      </div>
    </div>
  </section>;
}

function SectionEditor({ section, frozen, busy, secondaryLanguage, onSave }: { section: InterpretationWorkspace["sections"][number]; frozen: boolean; busy: boolean; secondaryLanguage: string; onSave: (id: string, body: unknown) => Promise<void> }) {
  const [form, setForm] = useState({ sequence: String(section.sequence), titlePrimary: section.titlePrimary, titleSecondary: section.titleSecondary, bodyPrimary: section.bodyPrimary, bodySecondary: section.bodySecondary });
  return <article className="production-change-check-row"><div><span>SECTION {String(section.sequence).padStart(2, "0")}</span><strong>{section.titlePrimary || "未命名章节"}</strong><p>{secondaryLanguage ? `双语：主语言 + ${secondaryLanguage}` : "单语言释读"}</p></div><div className="production-change-grid"><Field label="顺序"><input type="number" min="0" value={form.sequence} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, sequence: event.target.value }))} /></Field><Field label="主语言标题"><input value={form.titlePrimary} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, titlePrimary: event.target.value }))} /></Field>{secondaryLanguage && <Field label="第二语言标题"><input value={form.titleSecondary} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, titleSecondary: event.target.value }))} /></Field>}</div><Field label="主语言章节正文"><textarea value={form.bodyPrimary} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, bodyPrimary: event.target.value }))} /></Field>{secondaryLanguage && <Field label="第二语言章节正文"><textarea value={form.bodySecondary} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, bodySecondary: event.target.value }))} /></Field>}{!frozen && <button type="button" disabled={busy} onClick={() => void onSave(section.id, form)}>SAVE SECTION</button>}</article>;
}

function LabelEditor({ label, frozen, busy, secondaryLanguage, onSave }: { label: InterpretationWorkspace["labels"][number]; frozen: boolean; busy: boolean; secondaryLanguage: string; onSave: (id: string, body: unknown) => Promise<void> }) {
  const [form, setForm] = useState({ sequence: String(label.sequence), headline: label.headline, bodyPrimary: label.bodyPrimary, bodySecondary: label.bodySecondary, objectFacts: label.objectFacts, creditLine: label.creditLine, accessibilityText: label.accessibilityText, sourceNote: label.sourceNote, rightsStatus: label.rightsStatus as InterpretationRightsStatus });
  return <article className="production-change-check-row"><div>{label.asset?.imageUrl && <Image src={label.asset.imageUrl} width={160} height={200} sizes="120px" alt={`${label.asset.workTitle} 档案作品`} />}<span>{label.asset?.assetCode || "UNKNOWN ASSET"} · {label.curatorialRole.toUpperCase()}</span><strong>{label.asset?.workTitle || label.headline}</strong><p>{label.curatorialRationale || "策展依据未读取"}</p></div><div className="production-change-grid"><Field label="顺序"><input type="number" min="0" value={form.sequence} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, sequence: event.target.value }))} /></Field><Field label="标签标题"><input value={form.headline} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, headline: event.target.value }))} /></Field><Field label="权利状态"><select value={form.rightsStatus} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, rightsStatus: event.target.value as InterpretationRightsStatus }))}>{rightsStatuses.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field></div><Field label="主语言标签正文"><textarea value={form.bodyPrimary} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, bodyPrimary: event.target.value }))} /></Field>{secondaryLanguage && <Field label="第二语言标签正文"><textarea value={form.bodySecondary} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, bodySecondary: event.target.value }))} /></Field>}<div className="production-change-grid"><Field label="作品事实"><textarea value={form.objectFacts} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, objectFacts: event.target.value }))} /></Field><Field label="署名"><textarea value={form.creditLine} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, creditLine: event.target.value }))} /></Field><Field label="无障碍描述"><textarea value={form.accessibilityText} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, accessibilityText: event.target.value }))} /></Field><Field label="来源依据"><textarea value={form.sourceNote} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, sourceNote: event.target.value }))} /></Field></div>{!frozen && <button type="button" disabled={busy} onClick={() => void onSave(label.id, form)}>SAVE OBJECT LABEL</button>}</article>;
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) { return <div className={alert && value > 0 ? "is-alert" : ""}><span>{label}</span><strong>{value}</strong></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span>{label}</span>{children}</label>; }
function packageFormFor(workspace: InterpretationWorkspace) { const item = workspace.package; return { status: item.status as InterpretationStatus, decision: item.decision as InterpretationDecision, editor: item.editor, primaryLanguage: item.primaryLanguage, secondaryLanguage: item.secondaryLanguage, title: item.title, subtitle: item.subtitle, entranceText: item.entranceText, curatorialCredit: item.curatorialCredit, acknowledgement: item.acknowledgement, accessibilityNote: item.accessibilityNote, rightsNote: item.rightsNote, approvalNote: item.approvalNote }; }
function updateForm<K extends keyof PackageForm>(setter: React.Dispatch<React.SetStateAction<PackageForm | null>>, key: K, value: PackageForm[K]) { setter((current) => current ? { ...current, [key]: value } : current); }
function errorMessage(cause: unknown, fallback: string) { return cause instanceof Error ? cause.message : fallback; }
async function requestOverview() { const response = await fetch("/api/studio/exhibition-interpretation", { cache: "no-store" }); const payload = (await response.json()) as ApiPayload; if (!response.ok || !payload.overview) throw new Error(payload.error || "无法读取展览释读室。"); return payload.overview; }
async function api(url: string, method: "POST" | "PATCH", body: unknown) { const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const payload = (await response.json()) as ApiPayload; if (!response.ok) throw new Error(payload.error || "操作失败。"); return payload; }
