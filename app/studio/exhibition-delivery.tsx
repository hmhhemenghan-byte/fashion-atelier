"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ExhibitionDeliveryChannel, ExhibitionDeliveryDecision, ExhibitionDeliveryOverview, ExhibitionDeliveryProofStatus, ExhibitionDeliveryStatus, ExhibitionDeliveryWorkspace } from "@/lib/exhibition-delivery";

type ApiPayload = { overview?: ExhibitionDeliveryOverview; package?: { id: string }; item?: { id: string }; error?: string };
type Filter = "open" | "attention" | "approved" | "all";
type PackageForm = ReturnType<typeof packageFormFor>;

const statusLabels: Record<ExhibitionDeliveryStatus, string> = { draft: "草稿 / DRAFT", in_review: "评审中 / IN REVIEW", approved: "已放行 / APPROVED", closed: "已关闭 / CLOSED", void: "已作废 / VOID" };
const transitions: Record<ExhibitionDeliveryStatus, ExhibitionDeliveryStatus[]> = { draft: ["draft", "in_review", "void"], in_review: ["in_review", "draft", "approved", "void"], approved: ["approved", "closed"], closed: ["closed"], void: ["void"] };
const decisions: Array<{ value: ExhibitionDeliveryDecision; label: string }> = [
  { value: "pending", label: "待判断 / PENDING" }, { value: "release", label: "交付放行 / RELEASE" }, { value: "revise", label: "修改后复审 / REVISE" }, { value: "hold", label: "暂缓 / HOLD" },
];
const channels: Array<{ value: ExhibitionDeliveryChannel; label: string }> = [
  { value: "wall_text", label: "墙面文字 / WALL TEXT" }, { value: "object_label", label: "作品标签 / OBJECT LABEL" }, { value: "digital_guide", label: "数字导览 / DIGITAL GUIDE" }, { value: "print_guide", label: "印刷导览 / PRINT GUIDE" }, { value: "press_reference", label: "媒体参考 / PRESS" }, { value: "internal_master", label: "内部主档 / MASTER" },
];
const proofStatuses: Array<{ value: ExhibitionDeliveryProofStatus; label: string }> = [
  { value: "draft", label: "待校样 / DRAFT" }, { value: "ready", label: "已就绪 / READY" }, { value: "hold", label: "暂缓 / HOLD" }, { value: "omitted", label: "不交付 / OMITTED" },
];
const sourceLabels: Record<string, string> = { entrance: "入口导语", section: "叙事章节", object_label: "作品标签", credits: "策展署名", accessibility: "无障碍说明", rights: "权利说明" };

export default function ExhibitionDelivery() {
  const [overview, setOverview] = useState<ExhibitionDeliveryOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PackageForm | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createForm, setCreateForm] = useState({ interpretationPackageId: "", ownerName: "", destination: "", deliveryAt: "" });

  useEffect(() => {
    let cancelled = false;
    requestOverview().then((next) => {
      if (cancelled) return;
      const first = next.packages[0] ?? null; setOverview(next); setSelectedId(first?.package.id ?? null); setEditForm(first ? packageFormFor(first) : null);
    }).catch((cause) => { if (!cancelled) setError(errorMessage(cause, "无法读取展览交付台。")); }).finally(() => { if (!cancelled) setLoading(false); });
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
      return !needle || [item.package.deliveryCode, item.package.masterTitle, item.package.ownerName, item.package.destination, item.interpretation?.packageCode ?? ""].some((value) => value.toLowerCase().includes(needle));
    });
  }, [overview, filter, query]);

  async function reload(note: string, preferredId?: string | null) {
    setLoading(true); setError("");
    try {
      const next = await requestOverview();
      const id = preferredId && next.packages.some((item) => item.package.id === preferredId) ? preferredId : selectedId && next.packages.some((item) => item.package.id === selectedId) ? selectedId : next.packages[0]?.package.id ?? null;
      const workspace = next.packages.find((item) => item.package.id === id) ?? null;
      setOverview(next); setSelectedId(id); setEditForm(workspace ? packageFormFor(workspace) : null); setMessage(note); window.dispatchEvent(new Event("nera:exhibition-delivery-updated"));
    } catch (cause) { setError(errorMessage(cause, "无法刷新展览交付台。")); }
    finally { setLoading(false); }
  }

  async function createPackage(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const payload = await api("/api/studio/exhibition-delivery", "POST", createForm);
      if (!payload.package) throw new Error("建立展览交付包失败。");
      setCreateForm((current) => ({ ...current, interpretationPackageId: "", destination: "", deliveryAt: "" })); await reload("交付修订已建立，并按冻结释读来源生成全部校样项。", payload.package.id);
    } catch (cause) { setError(errorMessage(cause, "建立展览交付包失败。")); }
    finally { setBusy(false); }
  }

  async function savePackage(event: React.FormEvent) {
    event.preventDefault(); if (!selected || !editForm) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/api/studio/exhibition-delivery/${selected.package.id}`, "PATCH", selected.package.status === "approved" ? { status: editForm.status } : editForm);
      await reload(["approved", "closed", "void"].includes(editForm.status) ? "展览交付定义已签核并冻结。" : "交付标准与人工判断已保存。", selected.package.id);
    } catch (cause) { setError(errorMessage(cause, "保存展览交付包失败。")); }
    finally { setBusy(false); }
  }

  async function saveItem(id: string, body: unknown) {
    if (!selected) return; setBusy(true); setError("");
    try { await api(`/api/studio/exhibition-delivery/items/${id}`, "PATCH", body); await reload("交付项校样与交接事实已保存。", selected.package.id); }
    catch (cause) { setError(errorMessage(cause, "保存展览交付项失败。")); }
    finally { setBusy(false); }
  }

  const frozen = selected ? ["approved", "closed", "void"].includes(selected.package.status) : false;
  return <section className="production-change-control production-acceptance conservation-atelier exhibition-readiness archive-curation exhibition-interpretation exhibition-delivery" id="exhibition-delivery" aria-labelledby="exhibition-delivery-title">
    <div className="production-change-intro"><span>PHASE 34 / EXHIBITION DELIVERY</span><h2 id="exhibition-delivery-title">PROOF THE SYSTEM.<br /><i>RELEASE THE MASTER.</i></h2><p>把已批准释读拆成可核对的入口文字、章节、标签、署名、权利与无障碍交付项。这里只冻结交付定义，不自动排版、印刷、上传、发布或发送。</p></div>
    <div className="production-change-metrics"><Metric label="PACKAGES" value={overview?.metrics.total ?? 0} /><Metric label="IN REVIEW" value={overview?.metrics.inReview ?? 0} /><Metric label="APPROVED" value={overview?.metrics.approved ?? 0} /><Metric label="DELIVERY ITEMS" value={overview?.metrics.items ?? 0} /><Metric label="ATTENTION" value={overview?.metrics.attention ?? 0} alert /></div>
    {(error || message) && <p className={error ? "production-change-alert is-error" : "production-change-alert"} role="status">{error || message}</p>}
    <div className="production-change-layout">
      <aside className="production-change-sidebar">
        <form onSubmit={createPackage}><span>NEW DELIVERY REVISION / 新建交付</span><Field label="冻结释读修订"><select required value={createForm.interpretationPackageId} onChange={(event) => setCreateForm((current) => ({ ...current, interpretationPackageId: event.target.value }))}><option value="">选择已批准释读</option>{overview?.references.interpretations.map((item) => <option value={item.id} key={item.id}>{item.packageCode} · {item.title} · {item.itemCount} ITEMS</option>)}</select></Field><Field label="交付负责人"><input required value={createForm.ownerName} onChange={(event) => setCreateForm((current) => ({ ...current, ownerName: event.target.value }))} /></Field><Field label="交付对象或场景"><input value={createForm.destination} onChange={(event) => setCreateForm((current) => ({ ...current, destination: event.target.value }))} /></Field><Field label="计划交付时间"><input type="datetime-local" value={createForm.deliveryAt} onChange={(event) => setCreateForm((current) => ({ ...current, deliveryAt: event.target.value }))} /></Field><button type="submit" disabled={busy}>OPEN DELIVERY REVISION →</button></form>
        <div className="production-change-export"><Link href="/api/studio/exhibition-delivery?format=packages">PACKAGES CSV</Link><Link href="/api/studio/exhibition-delivery?format=items">ITEMS CSV</Link><Link href="/api/studio/exhibition-delivery?format=json">FULL JSON</Link></div>
      </aside>
      <div className="production-change-workbench">
        <div className="production-change-toolbar"><div>{(["open", "attention", "approved", "all"] as Filter[]).map((item) => <button type="button" className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)} key={item}>{item.toUpperCase()}</button>)}</div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索交付编号、标题、负责人或对象" /></div>
        {loading ? <p className="production-change-empty">正在读取展览交付包…</p> : visible.length === 0 ? <p className="production-change-empty">当前筛选下没有展览交付包。</p> : <div className="production-change-list">{visible.map((workspace) => <button type="button" className={workspace.package.id === selectedId ? "is-active" : ""} onClick={() => { setSelectedId(workspace.package.id); setEditForm(packageFormFor(workspace)); setError(""); setMessage(""); }} key={workspace.package.id}><span>{workspace.package.deliveryCode}</span><strong>{workspace.package.masterTitle || workspace.interpretation?.title || "未命名交付"}</strong><small>{workspace.package.ownerName} · {statusLabels[workspace.package.status as ExhibitionDeliveryStatus]}</small><i>{workspace.summary.missingFields.length ? `${workspace.summary.missingFields.length} OPEN` : `${workspace.summary.readyCount} READY`}</i></button>)}</div>}
        {selected && editForm && <div className="production-change-detail"><header><div><span>{selected.package.deliveryCode} · REVISION {selected.package.revision}</span><h3>{selected.package.masterTitle || selected.interpretation?.title}</h3><p>{selected.interpretation?.packageCode} · {selected.package.destination || "DESTINATION PENDING"}</p></div><div><b>{selected.summary.approvalReady ? "READY FOR RELEASE" : statusLabels[selected.package.status as ExhibitionDeliveryStatus]}</b><a href="#exhibition-interpretation">OPEN FROZEN TEXT ↑</a></div></header>
          <form className="production-change-form" onSubmit={savePackage}>
            <div className="production-change-grid"><Field label="交付状态"><select value={editForm.status} disabled={["closed", "void"].includes(selected.package.status)} onChange={(event) => updateForm(setEditForm, "status", event.target.value as ExhibitionDeliveryStatus)}>{transitions[selected.package.status as ExhibitionDeliveryStatus].map((item) => <option value={item} key={item}>{statusLabels[item]}</option>)}</select></Field><Field label="人工决定"><select value={editForm.decision} disabled={frozen} onChange={(event) => updateForm(setEditForm, "decision", event.target.value as ExhibitionDeliveryDecision)}>{decisions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field><Field label="交付负责人"><input value={editForm.ownerName} disabled={frozen} onChange={(event) => updateForm(setEditForm, "ownerName", event.target.value)} /></Field><Field label="计划交付时间"><input type="datetime-local" value={editForm.deliveryAt} disabled={frozen} onChange={(event) => updateForm(setEditForm, "deliveryAt", event.target.value)} /></Field></div>
            <Field label="交付主档标题"><input value={editForm.masterTitle} disabled={frozen} onChange={(event) => updateForm(setEditForm, "masterTitle", event.target.value)} /></Field><Field label="交付对象或场景"><textarea value={editForm.destination} disabled={frozen} onChange={(event) => updateForm(setEditForm, "destination", event.target.value)} /></Field><div className="production-change-grid"><Field label="格式标准"><textarea value={editForm.formatStandard} disabled={frozen} onChange={(event) => updateForm(setEditForm, "formatStandard", event.target.value)} /></Field><Field label="位置与层级标准"><textarea value={editForm.placementStandard} disabled={frozen} onChange={(event) => updateForm(setEditForm, "placementStandard", event.target.value)} /></Field><Field label="无障碍交付标准"><textarea value={editForm.accessibilityStandard} disabled={frozen} onChange={(event) => updateForm(setEditForm, "accessibilityStandard", event.target.value)} /></Field><Field label="权利交付标准"><textarea value={editForm.rightsStandard} disabled={frozen} onChange={(event) => updateForm(setEditForm, "rightsStandard", event.target.value)} /></Field><Field label="交接说明"><textarea value={editForm.handoffNote} disabled={frozen} onChange={(event) => updateForm(setEditForm, "handoffNote", event.target.value)} /></Field><Field label="人工批准依据"><textarea value={editForm.approvalNote} disabled={frozen} onChange={(event) => updateForm(setEditForm, "approvalNote", event.target.value)} /></Field></div>
            {!(["closed", "void"].includes(selected.package.status)) && <><p className="production-change-note">批准前仍需补齐：{selected.summary.missingFields.join("、") || "无"}。当前 {selected.summary.readyCount}/{selected.summary.expectedCount} 项来源已完成校样并就绪。</p><button type="submit" disabled={busy}>{editForm.status === "approved" ? "APPROVE & FREEZE DELIVERY MASTER →" : editForm.status === "closed" ? "CLOSE DELIVERY PACKAGE →" : "SAVE DELIVERY DECISION →"}</button></>}
          </form>
          <div className="production-change-form"><header><div><span>DELIVERY PROOFS / 交付校样</span><h3>逐项确认文字来源、载体、位置、格式和交接说明。</h3></div></header><div className="production-change-checklist">{selected.items.map((item) => <DeliveryItemEditor key={`${item.id}-${item.updatedAt}`} item={item} frozen={frozen} busy={busy} onSave={saveItem} />)}</div></div>
        </div>}
      </div>
    </div>
  </section>;
}

function DeliveryItemEditor({ item, frozen, busy, onSave }: { item: ExhibitionDeliveryWorkspace["items"][number]; frozen: boolean; busy: boolean; onSave: (id: string, body: unknown) => Promise<void> }) {
  const [form, setForm] = useState({ channel: item.channel as ExhibitionDeliveryChannel, sequence: String(item.sequence), title: item.title, placement: item.placement, formatSpec: item.formatSpec, proofStatus: item.proofStatus as ExhibitionDeliveryProofStatus, proofNote: item.proofNote, handoffNote: item.handoffNote });
  return <article className="production-change-check-row"><div>{item.asset?.imageUrl && <Image src={item.asset.imageUrl} width={160} height={200} sizes="120px" alt={`${item.asset.workTitle} 交付标签对应作品`} />}<span>{sourceLabels[item.sourceType] || item.sourceType} · {item.language}</span><strong>{item.sourceTitle || item.title}</strong><p>{item.sourceText.slice(0, 240) || "SOURCE TEXT MISSING"}</p></div><div className="production-change-grid"><Field label="顺序"><input type="number" min="0" value={form.sequence} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, sequence: event.target.value }))} /></Field><Field label="交付载体"><select value={form.channel} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value as ExhibitionDeliveryChannel }))}>{channels.map((channel) => <option value={channel.value} key={channel.value}>{channel.label}</option>)}</select></Field><Field label="校样状态"><select value={form.proofStatus} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, proofStatus: event.target.value as ExhibitionDeliveryProofStatus }))}>{proofStatuses.map((status) => <option value={status.value} key={status.value}>{status.label}</option>)}</select></Field></div><Field label="交付标题"><input value={form.title} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></Field><div className="production-change-grid"><Field label="位置或使用场景"><textarea value={form.placement} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, placement: event.target.value }))} /></Field><Field label="版式与尺寸要求"><textarea value={form.formatSpec} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, formatSpec: event.target.value }))} /></Field><Field label="校样依据"><textarea value={form.proofNote} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, proofNote: event.target.value }))} /></Field><Field label="交接备注"><textarea value={form.handoffNote} disabled={frozen} onChange={(event) => setForm((current) => ({ ...current, handoffNote: event.target.value }))} /></Field></div>{!frozen && <button type="button" disabled={busy} onClick={() => void onSave(item.id, form)}>SAVE DELIVERY PROOF</button>}</article>;
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) { return <div className={alert && value > 0 ? "is-alert" : ""}><span>{label}</span><strong>{value}</strong></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span>{label}</span>{children}</label>; }
function packageFormFor(workspace: ExhibitionDeliveryWorkspace) { const item = workspace.package; return { status: item.status as ExhibitionDeliveryStatus, decision: item.decision as ExhibitionDeliveryDecision, ownerName: item.ownerName, destination: item.destination, deliveryAt: toLocalDateTime(item.deliveryAt), masterTitle: item.masterTitle, formatStandard: item.formatStandard, placementStandard: item.placementStandard, accessibilityStandard: item.accessibilityStandard, rightsStandard: item.rightsStandard, handoffNote: item.handoffNote, approvalNote: item.approvalNote }; }
function updateForm<K extends keyof PackageForm>(setter: React.Dispatch<React.SetStateAction<PackageForm | null>>, key: K, value: PackageForm[K]) { setter((current) => current ? { ...current, [key]: value } : current); }
function toLocalDateTime(value: string | null | undefined) { if (!value) return ""; const date = new Date(value); if (Number.isNaN(date.getTime())) return ""; const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000); return shifted.toISOString().slice(0, 16); }
function errorMessage(cause: unknown, fallback: string) { return cause instanceof Error ? cause.message : fallback; }
async function requestOverview() { const response = await fetch("/api/studio/exhibition-delivery", { cache: "no-store" }); const payload = (await response.json()) as ApiPayload; if (!response.ok || !payload.overview) throw new Error(payload.error || "无法读取展览交付台。"); return payload.overview; }
async function api(url: string, method: "POST" | "PATCH", body: unknown) { const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const payload = (await response.json()) as ApiPayload; if (!response.ok) throw new Error(payload.error || "操作失败。"); return payload; }
