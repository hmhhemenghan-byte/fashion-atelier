"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { FittingImage, FittingIssue } from "@/db/schema";
import type {
  FittingDecision,
  FittingImageAngle,
  FittingImageStatus,
  FittingIssueCategory,
  FittingIssueSeverity,
  FittingIssueStatus,
  FittingOverview,
  FittingSide,
  FittingStatus,
  FittingWorkspace,
} from "@/lib/fittings";

type ApiPayload = {
  overview?: FittingOverview;
  session?: { id: string };
  issue?: { id: string };
  image?: { id: string };
  error?: string;
};

type FittingFilter = "active" | "all" | "review" | "approved" | "attention";

const fittingStatuses: Array<{
  value: FittingStatus;
  label: string;
  english: string;
}> = [
  { value: "planned", label: "已计划", english: "PLANNED" },
  { value: "in_review", label: "审版中", english: "IN REVIEW" },
  { value: "approved", label: "已批准", english: "APPROVED" },
  { value: "closed", label: "已封存", english: "CLOSED" },
  { value: "cancelled", label: "已取消", english: "CANCELLED" },
];

const decisions: Array<{
  value: FittingDecision;
  label: string;
}> = [
  { value: "pending", label: "待判断 / PENDING" },
  { value: "approve", label: "通过 / APPROVE" },
  { value: "revise", label: "修改 / REVISE" },
  { value: "hold", label: "暂缓 / HOLD" },
];

const issueCategories: Array<{
  value: FittingIssueCategory;
  label: string;
}> = [
  { value: "balance", label: "平衡 / BALANCE" },
  { value: "proportion", label: "比例 / PROPORTION" },
  { value: "ease", label: "松量 / EASE" },
  { value: "length", label: "长度 / LENGTH" },
  { value: "shape", label: "轮廓 / SHAPE" },
  { value: "mobility", label: "活动 / MOBILITY" },
  { value: "construction", label: "工艺 / CONSTRUCTION" },
  { value: "styling", label: "造型 / STYLING" },
  { value: "other", label: "其他 / OTHER" },
];

const issueSides: Array<{ value: FittingSide; label: string }> = [
  { value: "all", label: "全身 / ALL" },
  { value: "front", label: "正面 / FRONT" },
  { value: "back", label: "背面 / BACK" },
  { value: "left", label: "左侧 / LEFT" },
  { value: "right", label: "右侧 / RIGHT" },
  { value: "inside", label: "内部 / INSIDE" },
];

const issueSeverities: Array<{
  value: FittingIssueSeverity;
  label: string;
}> = [
  { value: "note", label: "记录 / NOTE" },
  { value: "important", label: "重要 / IMPORTANT" },
  { value: "critical", label: "关键 / CRITICAL" },
];

const imageAngles: Array<{ value: FittingImageAngle; label: string }> = [
  { value: "front", label: "正面 / FRONT" },
  { value: "side", label: "侧面 / SIDE" },
  { value: "back", label: "背面 / BACK" },
  { value: "detail", label: "细节 / DETAIL" },
  { value: "movement", label: "动态 / MOVEMENT" },
  { value: "other", label: "其他 / OTHER" },
];

const emptyCreate = {
  technicalPackId: "",
  sampleSize: "",
  fittingAt: "",
  location: "",
  fitModelReference: "",
  objective: "",
  notes: "",
};

const emptyIssue = {
  category: "balance" as FittingIssueCategory,
  area: "",
  side: "all" as FittingSide,
  observation: "",
  alteration: "",
  pointCode: "",
  severity: "important" as FittingIssueSeverity,
  ownerName: "",
  dueAt: "",
  sortOrder: "0",
};

const emptyImage = {
  angle: "front" as FittingImageAngle,
  caption: "",
  altText: "",
  sortOrder: "0",
};

type SessionEdit = ReturnType<typeof sessionEditForm>;

export default function FittingRoom() {
  const [overview, setOverview] = useState<FittingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FittingFilter>("active");
  const [query, setQuery] = useState("");
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [editForm, setEditForm] = useState<SessionEdit | null>(null);
  const [issueForm, setIssueForm] = useState(emptyIssue);
  const [imageForm, setImageForm] = useState(emptyImage);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingIssue, setAddingIssue] = useState(false);
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
        const first = next.sessions[0] ?? null;
        setSelectedId(first?.session.id ?? null);
        setEditForm(first ? sessionEditForm(first) : null);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "无法读取试身审版室。",
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

  const visibleSessions = useMemo(() => {
    if (!overview) return [];
    const needle = query.trim().toLocaleLowerCase();
    return overview.sessions.filter((workspace) => {
      const { session, work, technicalPack, summary } = workspace;
      if (
        filter === "active" &&
        ["closed", "cancelled"].includes(session.status)
      ) {
        return false;
      }
      if (filter === "review" && session.status !== "in_review") return false;
      if (
        filter === "approved" &&
        !["approved", "closed"].includes(session.status)
      ) {
        return false;
      }
      if (
        filter === "attention" &&
        summary.missingFields.length === 0 &&
        summary.criticalOpenIssues === 0 &&
        session.decision !== "revise"
      ) {
        return false;
      }
      if (!needle) return true;
      return [
        session.fittingCode,
        work?.title,
        work?.lookNumber,
        work?.collection,
        technicalPack?.techPackCode,
        session.location,
        session.objective,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [filter, overview, query]);

  const selected = useMemo(
    () =>
      overview?.sessions.find(
        (workspace) => workspace.session.id === selectedId,
      ) ?? null,
    [overview, selectedId],
  );

  async function refresh(preferredId?: string | null) {
    const next = await requestOverview();
    setOverview(next);
    const id =
      preferredId ??
      selectedId ??
      next.sessions[0]?.session.id ??
      null;
    const workspace =
      next.sessions.find((item) => item.session.id === id) ??
      next.sessions[0] ??
      null;
    setSelectedId(workspace?.session.id ?? null);
    setEditForm(workspace ? sessionEditForm(workspace) : null);
    window.dispatchEvent(new Event("nera:fitting-updated"));
  }

  function selectSession(workspace: FittingWorkspace) {
    setSelectedId(workspace.session.id);
    setEditForm(sessionEditForm(workspace));
    setError("");
    setMessage("");
  }

  async function createSession(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/studio/fittings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.session) {
        throw new Error(payload.error || "建立试身场次失败。");
      }
      setCreateForm(emptyCreate);
      await refresh(payload.session.id);
      setMessage("新一轮试身已建立，等待补充审版事实。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "建立试身场次失败。");
    } finally {
      setCreating(false);
    }
  }

  async function saveSession(
    override?: Partial<SessionEdit>,
    success = "试身事实已保存。",
  ) {
    if (!selected || !editForm) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/studio/fittings/${encodeURIComponent(selected.session.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...editForm, ...override }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.session) {
        throw new Error(payload.error || "保存试身事实失败。");
      }
      await refresh(selected.session.id);
      setMessage(success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存试身事实失败。");
    } finally {
      setSaving(false);
    }
  }

  async function closeSession() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/studio/fittings/${encodeURIComponent(selected.session.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "closed" }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok) {
        throw new Error(payload.error || "封存试身场次失败。");
      }
      await refresh(selected.session.id);
      setMessage("已封存批准事实；后续修改请建立下一轮试身。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "封存试身场次失败。");
    } finally {
      setSaving(false);
    }
  }

  async function addIssue(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setAddingIssue(true);
    setError("");
    try {
      const response = await fetch("/api/studio/fittings/issues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...issueForm,
          fittingSessionId: selected.session.id,
        }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.issue) {
        throw new Error(payload.error || "新增版型问题失败。");
      }
      setIssueForm(emptyIssue);
      await refresh(selected.session.id);
      setMessage("版型观察与修改指令已加入本轮审版。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "新增版型问题失败。");
    } finally {
      setAddingIssue(false);
    }
  }

  async function uploadImage(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !imageFile) return;
    setUploadingImage(true);
    setError("");
    try {
      const form = new FormData();
      form.set("image", imageFile);
      Object.entries(imageForm).forEach(([key, value]) => form.set(key, value));
      const response = await fetch(
        `/api/studio/fittings/${encodeURIComponent(selected.session.id)}/images`,
        { method: "POST", body: form },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.image) {
        throw new Error(payload.error || "上传试身影像失败。");
      }
      setImageFile(null);
      setImageForm(emptyImage);
      if (imageInputRef.current) imageInputRef.current.value = "";
      await refresh(selected.session.id);
      setMessage("试身影像已保存为私密审版证据。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "上传试身影像失败。");
    } finally {
      setUploadingImage(false);
    }
  }

  async function updateIssue(id: string, body: object) {
    if (!selected) return;
    setSavingItemId(id);
    setError("");
    try {
      const response = await fetch(
        `/api/studio/fittings/issues/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok) {
        throw new Error(payload.error || "更新版型问题失败。");
      }
      await refresh(selected.session.id);
      setMessage("版型问题状态已更新。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "更新版型问题失败。");
    } finally {
      setSavingItemId(null);
    }
  }

  async function updateImage(id: string, body: object) {
    if (!selected) return;
    setSavingItemId(id);
    setError("");
    try {
      const response = await fetch(
        `/api/studio/fittings/images/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok) {
        throw new Error(payload.error || "更新影像记录失败。");
      }
      await refresh(selected.session.id);
      setMessage("影像角度、说明与状态已更新。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "更新影像记录失败。");
    } finally {
      setSavingItemId(null);
    }
  }

  if (loading) {
    return (
      <section className="fitting-room is-loading" id="fitting-room">
        FITTING ROOM / LOADING
      </section>
    );
  }

  const frozen = selected
    ? ["approved", "closed", "cancelled"].includes(selected.session.status)
    : false;

  return (
    <section className="fitting-room" id="fitting-room">
      <header className="fitting-hero">
        <div className="fitting-hero-copy">
          <p className="fitting-kicker">PHASE 22 / FITTING ROOM</p>
          <h2>
            VERIFY
            <br />
            THE <i>LINE.</i>
          </h2>
          <p className="fitting-lede">
            让每一轮试身留下可以复核的平衡、轮廓、动态与修改事实。影像仅作为私密审版证据，批准仍由设计师完成。
          </p>
        </div>
        <aside className="fitting-hero-mark">
          <span>22</span>
          <small>FIT / FACT / DECISION</small>
        </aside>
        <div className="fitting-hero-rule">
          <span>OBSERVE → ALTER → VERIFY</span>
          <span>NO AUTO APPROVAL</span>
        </div>
      </header>

      {overview && (
        <div className="fitting-metrics">
          <Metric value={overview.metrics.sessionCount} label="SESSIONS" detail="全部试身轮次" />
          <Metric value={overview.metrics.reviewCount} label="IN REVIEW" detail="正在审版" accent />
          <Metric value={overview.metrics.approvedCount} label="APPROVED" detail="批准或封存" />
          <Metric value={overview.metrics.incompleteCount} label="INCOMPLETE" detail="事实尚未补齐" attention />
          <Metric value={overview.metrics.criticalOpenCount} label="CRITICAL" detail="关键问题未解" attention />
        </div>
      )}

      <div className="fitting-principles">
        <span>01</span><p>试身验证的是具体技术包修订，不覆盖历史事实。</p>
        <span>02</span><p>关键问题未解决时，系统拒绝批准。</p>
        <span>03</span><p>批准后不可改写；继续调整必须建立下一轮。</p>
      </div>

      {(error || message) && (
        <p className={`fitting-notice${error ? " is-error" : ""}`}>
          {error || message}
        </p>
      )}

      <section className="fitting-create-grid">
        <SectionTitle number="01" eyebrow="NEW SESSION" title="建立试身轮次" />
        <form className="fitting-create-form" onSubmit={createSession}>
          <label className="is-wide">
            <span>TECH PACK / 对应技术包</span>
            <select
              required
              value={createForm.technicalPackId}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  technicalPackId: event.target.value,
                }))
              }
            >
              <option value="">选择技术包修订</option>
              {overview?.references.technicalPacks.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.techPackCode} · {pack.lookNumber} · {pack.workTitle} · {pack.status.toUpperCase()}
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
            <span>FITTING AT / 试身时间</span>
            <input
              type="datetime-local"
              value={createForm.fittingAt}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  fittingAt: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>LOCATION / 地点</span>
            <input
              value={createForm.location}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  location: event.target.value,
                }))
              }
              placeholder="ATELIER 01"
            />
          </label>
          <label>
            <span>WEARER REF / 试穿参考</span>
            <input
              value={createForm.fitModelReference}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  fitModelReference: event.target.value,
                }))
              }
              placeholder="使用内部代号，避免不必要个人信息"
            />
          </label>
          <label className="is-wide">
            <span>OBJECTIVE / 本轮目标</span>
            <textarea
              required
              value={createForm.objective}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  objective: event.target.value,
                }))
              }
              placeholder="本轮需要验证的平衡、体量、长度、活动度或工艺。"
            />
          </label>
          <label className="is-wide">
            <span>NOTES / 备注</span>
            <textarea
              value={createForm.notes}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="准备条件、参与角色与需要带回技术包的事项。"
            />
          </label>
          <button className="fitting-primary is-wide" disabled={creating}>
            {creating ? "CREATING…" : "CREATE FITTING ROUND ↘"}
          </button>
        </form>
      </section>

      <section className="fitting-library">
        <aside className="fitting-index">
          <SectionTitle number="02" eyebrow="SESSION INDEX" title="试身台账" compact />
          <input
            className="fitting-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索 Look、技术包、地点…"
          />
          <div className="fitting-filters">
            {(
              [
                ["active", "进行中"],
                ["review", "审版中"],
                ["approved", "已批准"],
                ["attention", "需处理"],
                ["all", "全部"],
              ] as Array<[FittingFilter, string]>
            ).map(([value, label]) => (
              <button
                className={filter === value ? "is-active" : ""}
                key={value}
                onClick={() => setFilter(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="fitting-session-list">
            {visibleSessions.map((workspace, index) => (
              <button
                className={
                  workspace.session.id === selectedId ? "is-active" : ""
                }
                key={workspace.session.id}
                onClick={() => selectSession(workspace)}
                type="button"
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <small>{workspace.session.fittingCode}</small>
                <strong>{workspace.work?.title ?? "未找到作品"}</strong>
                <p>
                  {workspace.technicalPack?.techPackCode ?? "NO PACK"} ·{" "}
                  {workspace.session.status.replaceAll("_", " ").toUpperCase()}
                </p>
                <i>{workspace.summary.completeness}% FACTS</i>
              </button>
            ))}
          </div>
          <div className="fitting-exports">
            <p>CONTROLLED EXPORTS</p>
            <Link href="/api/studio/fittings?format=sessions">SESSIONS CSV ↘</Link>
            <Link href="/api/studio/fittings?format=issues">ISSUES CSV ↘</Link>
            <Link href="/api/studio/fittings?format=images">EVIDENCE CSV ↘</Link>
            <Link href="/api/studio/fittings?format=json">FULL JSON ↘</Link>
          </div>
        </aside>

        <div className="fitting-dossier">
          {!selected || !editForm ? (
            <div className="fitting-empty">
              <span>22</span>
              <h3>等待第一轮试身</h3>
              <p>从已建立的技术包创建场次，开始记录真实版型判断。</p>
            </div>
          ) : (
            <>
              <header className="fitting-dossier-header">
                <div
                  className="fitting-work-image"
                  style={
                    selected.work?.imageUrl
                      ? { backgroundImage: `url("${selected.work.imageUrl}")` }
                      : undefined
                  }
                  role="img"
                  aria-label={selected.work?.title ?? "Look image"}
                />
                <div>
                  <small>
                    {selected.session.fittingCode} / ROUND {selected.session.round}
                  </small>
                  <h3>{selected.work?.title ?? "未找到作品"}</h3>
                  <p>
                    {selected.work?.lookNumber} · {selected.work?.collection}
                  </p>
                  <b>
                    {selected.technicalPack?.techPackCode} ·{" "}
                    {selected.technicalPack?.sampleStage.toUpperCase()}
                  </b>
                </div>
                <aside className={selected.summary.approvalReady ? "is-ready" : ""}>
                  <span>{selected.summary.completeness}%</span>
                  <strong>
                    {selected.summary.approvalReady
                      ? "APPROVAL READY"
                      : "FACTS REQUIRED"}
                  </strong>
                  <p>
                    {selected.summary.missingFields.length > 0
                      ? `待补：${selected.summary.missingFields.join("、")}`
                      : selected.summary.criticalOpenIssues > 0
                        ? `${selected.summary.criticalOpenIssues} 个关键问题未解决`
                        : selected.technicalPack?.status === "draft"
                          ? "技术包需先进入评审"
                          : "事实齐全，等待设计师决定"}
                  </p>
                </aside>
              </header>

              <section className="fitting-editor">
                <SectionTitle number="03" eyebrow="FIT ASSESSMENT" title="审版事实" compact />
                <form
                  className="fitting-edit-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveSession();
                  }}
                >
                  <label>
                    <span>STATUS / 状态</span>
                    <select
                      disabled={frozen}
                      value={editForm.status}
                      onChange={(event) =>
                        setEditForm((current) =>
                          current
                            ? {
                                ...current,
                                status: event.target.value as FittingStatus,
                              }
                            : current,
                        )
                      }
                    >
                      {fittingStatuses.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label} / {item.english}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>DECISION / 设计结论</span>
                    <select
                      disabled={frozen}
                      value={editForm.decision}
                      onChange={(event) =>
                        setEditForm((current) =>
                          current
                            ? {
                                ...current,
                                decision: event.target.value as FittingDecision,
                              }
                            : current,
                        )
                      }
                    >
                      {decisions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="SAMPLE SIZE / 样衣尺码"
                    value={editForm.sampleSize}
                    disabled={frozen}
                    onChange={(value) => setEditForm({ ...editForm, sampleSize: value })}
                  />
                  <Field
                    label="LOCATION / 地点"
                    value={editForm.location}
                    disabled={frozen}
                    onChange={(value) => setEditForm({ ...editForm, location: value })}
                  />
                  <Field
                    label="FITTING AT / 试身时间"
                    value={editForm.fittingAt}
                    type="datetime-local"
                    disabled={frozen}
                    onChange={(value) => setEditForm({ ...editForm, fittingAt: value })}
                  />
                  <Field
                    label="NEXT FITTING / 下轮时间"
                    value={editForm.nextFittingAt}
                    type="datetime-local"
                    disabled={frozen}
                    onChange={(value) => setEditForm({ ...editForm, nextFittingAt: value })}
                  />
                  <Field
                    label="WEARER REF / 试穿参考"
                    value={editForm.fitModelReference}
                    disabled={frozen}
                    onChange={(value) => setEditForm({ ...editForm, fitModelReference: value })}
                  />
                  <TextArea
                    label="OBJECTIVE / 本轮目标"
                    value={editForm.objective}
                    disabled={frozen}
                    onChange={(value) => setEditForm({ ...editForm, objective: value })}
                    wide
                  />
                  <TextArea
                    label="BALANCE / 平衡判断"
                    value={editForm.balanceNotes}
                    disabled={frozen}
                    onChange={(value) => setEditForm({ ...editForm, balanceNotes: value })}
                  />
                  <TextArea
                    label="SILHOUETTE / 轮廓判断"
                    value={editForm.silhouetteNotes}
                    disabled={frozen}
                    onChange={(value) => setEditForm({ ...editForm, silhouetteNotes: value })}
                  />
                  <TextArea
                    label="MOVEMENT / 动态判断"
                    value={editForm.movementNotes}
                    disabled={frozen}
                    onChange={(value) => setEditForm({ ...editForm, movementNotes: value })}
                  />
                  <TextArea
                    label="COMFORT / 穿着反馈"
                    value={editForm.comfortNotes}
                    disabled={frozen}
                    onChange={(value) => setEditForm({ ...editForm, comfortNotes: value })}
                  />
                  <TextArea
                    label="CONCLUSION / 审版结论"
                    value={editForm.conclusion}
                    disabled={frozen}
                    onChange={(value) => setEditForm({ ...editForm, conclusion: value })}
                    wide
                  />
                  <TextArea
                    label="APPROVAL NOTE / 批准说明"
                    value={editForm.approvalNote}
                    disabled={frozen}
                    onChange={(value) => setEditForm({ ...editForm, approvalNote: value })}
                  />
                  <TextArea
                    label="NOTES / 内部备注"
                    value={editForm.notes}
                    disabled={frozen}
                    onChange={(value) => setEditForm({ ...editForm, notes: value })}
                  />
                  {!frozen && (
                    <div className="fitting-editor-actions is-wide">
                      <button className="fitting-primary" disabled={saving}>
                        {saving ? "SAVING…" : "SAVE FIT FACTS"}
                      </button>
                      <button
                        className="fitting-approve"
                        disabled={saving}
                        onClick={() =>
                          void saveSession(
                            { status: "approved", decision: "approve" },
                            "本轮试身已由设计师批准并冻结。",
                          )
                        }
                        type="button"
                      >
                        APPROVE THIS ROUND
                      </button>
                    </div>
                  )}
                  {selected.session.status === "approved" && (
                    <button
                      className="fitting-close is-wide"
                      disabled={saving}
                      onClick={() => void closeSession()}
                      type="button"
                    >
                      CLOSE & ARCHIVE THIS ROUND
                    </button>
                  )}
                </form>
              </section>

              <section className="fitting-evidence">
                <header>
                  <SectionTitle number="04" eyebrow="PRIVATE EVIDENCE" title="试身影像" compact />
                  <span>{selected.summary.activeImages} ACTIVE / 12 MAX</span>
                </header>
                {!frozen && (
                  <form className="fitting-image-form" onSubmit={uploadImage}>
                    <label className="fitting-image-file">
                      <span>{imageFile ? imageFile.name : "选择试身影像"}</span>
                      <small>JPEG / PNG / WEBP · MAX 15MB · PRIVATE</small>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) =>
                          setImageFile(event.target.files?.[0] ?? null)
                        }
                      />
                    </label>
                    <label>
                      <span>ANGLE / 角度</span>
                      <select
                        value={imageForm.angle}
                        onChange={(event) =>
                          setImageForm((current) => ({
                            ...current,
                            angle: event.target.value as FittingImageAngle,
                          }))
                        }
                      >
                        {imageAngles.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>CAPTION / 说明</span>
                      <input
                        value={imageForm.caption}
                        onChange={(event) =>
                          setImageForm((current) => ({
                            ...current,
                            caption: event.target.value,
                          }))
                        }
                        placeholder="需要观察的线条或动作"
                      />
                    </label>
                    <label>
                      <span>ALT TEXT / 图片描述</span>
                      <input
                        value={imageForm.altText}
                        onChange={(event) =>
                          setImageForm((current) => ({
                            ...current,
                            altText: event.target.value,
                          }))
                        }
                        placeholder="例如：Look 04 侧面抬臂试身记录"
                      />
                    </label>
                    <button
                      className="fitting-primary"
                      disabled={!imageFile || uploadingImage}
                    >
                      {uploadingImage ? "UPLOADING…" : "ADD EVIDENCE"}
                    </button>
                  </form>
                )}
                <div className="fitting-image-grid">
                  {selected.images.map((image) => (
                    <FittingImageCard
                      frozen={frozen}
                      image={image}
                      key={`${image.id}-${image.updatedAt}`}
                      saving={savingItemId === image.id}
                      onSave={(body) => updateImage(image.id, body)}
                    />
                  ))}
                  {selected.images.length === 0 && (
                    <p className="fitting-evidence-empty">
                      尚无试身影像。记录正面、侧面、背面或动态证据后，才可批准本轮。
                    </p>
                  )}
                </div>
              </section>

              <section className="fitting-issues">
                <header>
                  <SectionTitle number="05" eyebrow="ALTERATION LOG" title="版型问题与修改" compact />
                  <span>
                    {selected.summary.openIssues} OPEN /{" "}
                    {selected.summary.criticalOpenIssues} CRITICAL
                  </span>
                </header>
                {!frozen && (
                  <form className="fitting-issue-form" onSubmit={addIssue}>
                    <label>
                      <span>CATEGORY / 类别</span>
                      <select
                        value={issueForm.category}
                        onChange={(event) =>
                          setIssueForm((current) => ({
                            ...current,
                            category: event.target.value as FittingIssueCategory,
                          }))
                        }
                      >
                        {issueCategories.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>AREA / 部位</span>
                      <input
                        value={issueForm.area}
                        onChange={(event) =>
                          setIssueForm((current) => ({
                            ...current,
                            area: event.target.value,
                          }))
                        }
                        placeholder="肩线、袖窿、腰节、后摆…"
                      />
                    </label>
                    <label>
                      <span>SIDE / 方向</span>
                      <select
                        value={issueForm.side}
                        onChange={(event) =>
                          setIssueForm((current) => ({
                            ...current,
                            side: event.target.value as FittingSide,
                          }))
                        }
                      >
                        {issueSides.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>SEVERITY / 级别</span>
                      <select
                        value={issueForm.severity}
                        onChange={(event) =>
                          setIssueForm((current) => ({
                            ...current,
                            severity: event.target.value as FittingIssueSeverity,
                          }))
                        }
                      >
                        {issueSeverities.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="is-wide">
                      <span>OBSERVATION / 观察事实</span>
                      <textarea
                        required
                        value={issueForm.observation}
                        onChange={(event) =>
                          setIssueForm((current) => ({
                            ...current,
                            observation: event.target.value,
                          }))
                        }
                        placeholder="只记录可见或可复核的版型事实。"
                      />
                    </label>
                    <label className="is-wide">
                      <span>ALTERATION / 修改指令</span>
                      <textarea
                        value={issueForm.alteration}
                        onChange={(event) =>
                          setIssueForm((current) => ({
                            ...current,
                            alteration: event.target.value,
                          }))
                        }
                        placeholder="明确需要收、放、移、转、抬、降或重新验证的内容。"
                      />
                    </label>
                    <label>
                      <span>POM / 尺寸点</span>
                      <input
                        value={issueForm.pointCode}
                        onChange={(event) =>
                          setIssueForm((current) => ({
                            ...current,
                            pointCode: event.target.value,
                          }))
                        }
                        placeholder="例如 POM-12"
                      />
                    </label>
                    <label>
                      <span>OWNER / 负责人</span>
                      <input
                        value={issueForm.ownerName}
                        onChange={(event) =>
                          setIssueForm((current) => ({
                            ...current,
                            ownerName: event.target.value,
                          }))
                        }
                        placeholder="Pattern / Atelier"
                      />
                    </label>
                    <label>
                      <span>DUE / 处理时间</span>
                      <input
                        type="datetime-local"
                        value={issueForm.dueAt}
                        onChange={(event) =>
                          setIssueForm((current) => ({
                            ...current,
                            dueAt: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button className="fitting-primary" disabled={addingIssue}>
                      {addingIssue ? "ADDING…" : "ADD ALTERATION"}
                    </button>
                  </form>
                )}
                <div className="fitting-issue-list">
                  {selected.issues.map((issue, index) => (
                    <FittingIssueCard
                      frozen={frozen}
                      index={index}
                      issue={issue}
                      key={`${issue.id}-${issue.updatedAt}`}
                      saving={savingItemId === issue.id}
                      onSave={(body) => updateIssue(issue.id, body)}
                    />
                  ))}
                  {selected.issues.length === 0 && (
                    <p className="fitting-evidence-empty">
                      尚无版型问题。若本轮没有问题，可直接在审版结论中说明通过依据。
                    </p>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </section>
    </section>
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
    <article
      className={`fitting-metric${props.accent ? " is-accent" : ""}${props.attention ? " is-attention" : ""}`}
    >
      <strong>{String(props.value).padStart(2, "0")}</strong>
      <span>{props.label}</span>
      <small>{props.detail}</small>
    </article>
  );
}

function SectionTitle(props: {
  number: string;
  eyebrow: string;
  title: string;
  compact?: boolean;
}) {
  return (
    <div className={`fitting-section-title${props.compact ? " is-compact" : ""}`}>
      <span>{props.number}</span>
      <div>
        <p>{props.eyebrow}</p>
        <h3>{props.title}</h3>
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label>
      <span>{props.label}</span>
      <input
        disabled={props.disabled}
        type={props.type ?? "text"}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function TextArea(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  wide?: boolean;
}) {
  return (
    <label className={props.wide ? "is-wide" : ""}>
      <span>{props.label}</span>
      <textarea
        disabled={props.disabled}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function FittingIssueCard(props: {
  issue: FittingIssue;
  index: number;
  frozen: boolean;
  saving: boolean;
  onSave: (body: object) => Promise<void>;
}) {
  const [form, setForm] = useState({
    category: props.issue.category as FittingIssueCategory,
    area: props.issue.area,
    side: props.issue.side as FittingSide,
    observation: props.issue.observation,
    alteration: props.issue.alteration,
    pointCode: props.issue.pointCode,
    severity: props.issue.severity as FittingIssueSeverity,
    status: props.issue.status as FittingIssueStatus,
    ownerName: props.issue.ownerName,
    dueAt: toLocalDateTime(props.issue.dueAt),
    sortOrder: String(props.issue.sortOrder),
  });

  return (
    <article className={`fitting-issue-card is-${props.issue.severity}`}>
      <header>
        <span>{String(props.index + 1).padStart(2, "0")}</span>
        <div>
          <small>{props.issue.category.toUpperCase()} / {props.issue.side.toUpperCase()}</small>
          <strong>{props.issue.area || "GENERAL FIT"}</strong>
        </div>
        <b>{props.issue.status.replaceAll("_", " ").toUpperCase()}</b>
      </header>
      <div className="fitting-issue-fields">
        <label>
          <span>CATEGORY</span>
          <select
            disabled={props.frozen}
            value={form.category}
            onChange={(event) =>
              setForm({ ...form, category: event.target.value as FittingIssueCategory })
            }
          >
            {issueCategories.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>AREA</span>
          <input
            disabled={props.frozen}
            value={form.area}
            onChange={(event) => setForm({ ...form, area: event.target.value })}
          />
        </label>
        <label>
          <span>SIDE</span>
          <select
            disabled={props.frozen}
            value={form.side}
            onChange={(event) =>
              setForm({ ...form, side: event.target.value as FittingSide })
            }
          >
            {issueSides.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>SEVERITY</span>
          <select
            disabled={props.frozen}
            value={form.severity}
            onChange={(event) =>
              setForm({ ...form, severity: event.target.value as FittingIssueSeverity })
            }
          >
            {issueSeverities.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="is-wide">
          <span>OBSERVATION</span>
          <textarea
            disabled={props.frozen}
            value={form.observation}
            onChange={(event) => setForm({ ...form, observation: event.target.value })}
          />
        </label>
        <label className="is-wide">
          <span>ALTERATION</span>
          <textarea
            disabled={props.frozen}
            value={form.alteration}
            onChange={(event) => setForm({ ...form, alteration: event.target.value })}
          />
        </label>
        <label>
          <span>POM</span>
          <input
            disabled={props.frozen}
            value={form.pointCode}
            onChange={(event) => setForm({ ...form, pointCode: event.target.value })}
          />
        </label>
        <label>
          <span>OWNER</span>
          <input
            disabled={props.frozen}
            value={form.ownerName}
            onChange={(event) => setForm({ ...form, ownerName: event.target.value })}
          />
        </label>
        <label>
          <span>DUE</span>
          <input
            disabled={props.frozen}
            type="datetime-local"
            value={form.dueAt}
            onChange={(event) => setForm({ ...form, dueAt: event.target.value })}
          />
        </label>
        <label>
          <span>STATUS</span>
          <select
            disabled={props.frozen}
            value={form.status}
            onChange={(event) =>
              setForm({ ...form, status: event.target.value as FittingIssueStatus })
            }
          >
            <option value="open">OPEN / 待处理</option>
            <option value="in_progress">IN PROGRESS / 修改中</option>
            <option value="resolved">RESOLVED / 已解决</option>
            <option value="removed">REMOVED / 移出</option>
          </select>
        </label>
      </div>
      {!props.frozen && (
        <button
          disabled={props.saving}
          onClick={() => void props.onSave(form)}
          type="button"
        >
          {props.saving ? "SAVING…" : "SAVE ALTERATION"}
        </button>
      )}
    </article>
  );
}

function FittingImageCard(props: {
  image: FittingImage & { imageUrl: string };
  frozen: boolean;
  saving: boolean;
  onSave: (body: object) => Promise<void>;
}) {
  const [form, setForm] = useState({
    angle: props.image.angle as FittingImageAngle,
    caption: props.image.caption,
    altText: props.image.altText,
    status: props.image.status as FittingImageStatus,
    sortOrder: String(props.image.sortOrder),
  });

  return (
    <article className={props.image.status === "removed" ? "is-removed" : ""}>
      <div
        className="fitting-evidence-image"
        style={{ backgroundImage: `url("${props.image.imageUrl}")` }}
        role="img"
        aria-label={props.image.altText}
      >
        <span>{props.image.angle.toUpperCase()}</span>
      </div>
      <label>
        <span>ANGLE</span>
        <select
          disabled={props.frozen}
          value={form.angle}
          onChange={(event) =>
            setForm({ ...form, angle: event.target.value as FittingImageAngle })
          }
        >
          {imageAngles.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </label>
      <label>
        <span>CAPTION</span>
        <input
          disabled={props.frozen}
          value={form.caption}
          onChange={(event) => setForm({ ...form, caption: event.target.value })}
        />
      </label>
      <label>
        <span>ALT TEXT</span>
        <input
          disabled={props.frozen}
          value={form.altText}
          onChange={(event) => setForm({ ...form, altText: event.target.value })}
        />
      </label>
      <label>
        <span>STATUS</span>
        <select
          disabled={props.frozen}
          value={form.status}
          onChange={(event) =>
            setForm({ ...form, status: event.target.value as FittingImageStatus })
          }
        >
          <option value="active">ACTIVE / 有效</option>
          <option value="removed">REMOVED / 移出</option>
        </select>
      </label>
      {!props.frozen && (
        <button
          disabled={props.saving}
          onClick={() => void props.onSave(form)}
          type="button"
        >
          {props.saving ? "SAVING…" : "SAVE EVIDENCE"}
        </button>
      )}
    </article>
  );
}

function sessionEditForm(workspace: FittingWorkspace) {
  const session = workspace.session;
  return {
    status: session.status as FittingStatus,
    decision: session.decision as FittingDecision,
    sampleSize: session.sampleSize,
    fittingAt: toLocalDateTime(session.fittingAt),
    location: session.location,
    fitModelReference: session.fitModelReference,
    objective: session.objective,
    balanceNotes: session.balanceNotes,
    silhouetteNotes: session.silhouetteNotes,
    movementNotes: session.movementNotes,
    comfortNotes: session.comfortNotes,
    conclusion: session.conclusion,
    nextFittingAt: toLocalDateTime(session.nextFittingAt),
    approvalNote: session.approvalNote,
    notes: session.notes,
  };
}

async function requestOverview() {
  const response = await fetch("/api/studio/fittings", {
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok || !payload.overview) {
    throw new Error(payload.error || "无法读取试身审版室。");
  }
  return payload.overview;
}

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
