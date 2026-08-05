"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type {
  ProductionAcceptanceCheckResult,
  ProductionAcceptanceDecision,
  ProductionAcceptanceImageAngle,
  ProductionAcceptanceOverview,
  ProductionAcceptanceStatus,
  ProductionAcceptanceWorkspace,
} from "@/lib/production-acceptances";

type ApiPayload = {
  overview?: ProductionAcceptanceOverview;
  acceptance?: { id: string };
  check?: { id: string };
  image?: { id: string };
  error?: string;
};

const decisions: Array<{
  value: ProductionAcceptanceDecision;
  label: string;
}> = [
  { value: "pending", label: "待决定 / PENDING" },
  { value: "accept", label: "通过 / ACCEPT" },
  { value: "rework", label: "返工后复验 / REWORK" },
  { value: "hold", label: "暂缓 / HOLD" },
  { value: "reject", label: "拒收 / REJECT" },
];

const statusLabels: Record<ProductionAcceptanceStatus, string> = {
  draft: "草稿 / DRAFT",
  in_review: "验收中 / IN REVIEW",
  accepted: "已通过 / ACCEPTED",
  rejected: "未通过 / NOT ACCEPTED",
  void: "已作废 / VOID",
};

const transitions: Record<
  ProductionAcceptanceStatus,
  ProductionAcceptanceStatus[]
> = {
  draft: ["draft", "in_review", "void"],
  in_review: ["in_review", "accepted", "rejected", "void"],
  accepted: ["accepted"],
  rejected: ["rejected"],
  void: ["void"],
};

const angles: Array<{ value: ProductionAcceptanceImageAngle; label: string }> = [
  { value: "front", label: "正面 / FRONT" },
  { value: "back", label: "背面 / BACK" },
  { value: "detail", label: "工艺细节 / DETAIL" },
  { value: "label", label: "标识 / LABEL" },
  { value: "packaging", label: "包装 / PACKAGING" },
  { value: "group", label: "整组 / GROUP" },
  { value: "other", label: "其他 / OTHER" },
];

const emptyCreate = {
  productionReleaseId: "",
  editionReference: "",
  colorway: "",
  sizeRange: "",
  receivedQuantity: "",
  inspectedQuantity: "",
  receivedAt: "",
  physicalLocation: "",
  notes: "",
};

const emptyImage = {
  file: null as File | null,
  angle: "front" as ProductionAcceptanceImageAngle,
  caption: "",
  altText: "",
};

type EditForm = ReturnType<typeof editFormFor>;
type Filter = "active" | "attention" | "accepted" | "all";

export default function ProductionAcceptance() {
  const [overview, setOverview] =
    useState<ProductionAcceptanceOverview | null>(null);
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
        const first = next.acceptances[0] ?? null;
        setOverview(next);
        setSelectedId(first?.acceptance.id ?? null);
        setEditForm(first ? editFormFor(first) : null);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "无法读取成衣验收台。");
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

  const visible = useMemo(() => {
    if (!overview) return [];
    const needle = query.trim().toLocaleLowerCase();
    return overview.acceptances.filter((workspace) => {
      const { acceptance, release, work, summary } = workspace;
      if (filter === "active" && ["accepted", "rejected", "void"].includes(acceptance.status)) return false;
      if (filter === "attention" && summary.approvalReady) return false;
      if (filter === "accepted" && acceptance.status !== "accepted") return false;
      if (!needle) return true;
      return [
        acceptance.acceptanceCode,
        acceptance.acceptanceSeal,
        acceptance.editionReference,
        acceptance.colorway,
        release?.releaseCode,
        release?.authorizationCode,
        work?.lookNumber,
        work?.title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [filter, overview, query]);

  const selected =
    overview?.acceptances.find(
      (workspace) => workspace.acceptance.id === selectedId,
    ) ?? null;
  const selectedSource = overview?.references.releasedSources.find(
    (source) => source.productionReleaseId === createForm.productionReleaseId,
  );

  async function refresh(
    successMessage = "",
    preferredId: string | null = selectedId,
  ) {
    setError("");
    if (successMessage) setMessage(successMessage);
    const next = await requestOverview();
    const nextSelected =
      next.acceptances.find(
        (workspace) => workspace.acceptance.id === preferredId,
      ) ??
      next.acceptances[0] ??
      null;
    setOverview(next);
    setSelectedId(nextSelected?.acceptance.id ?? null);
    setEditForm(nextSelected ? editFormFor(nextSelected) : null);
    window.dispatchEvent(new Event("nera:production-acceptance-updated"));
  }

  function selectAcceptance(workspace: ProductionAcceptanceWorkspace) {
    setSelectedId(workspace.acceptance.id);
    setEditForm(editFormFor(workspace));
    setImageForm(emptyImage);
    setError("");
    setMessage("");
  }

  async function createAcceptance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSource) return setError("请选择有效的 NERA-GO 生产放行。");
    setCreating(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/studio/production-acceptances", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.acceptance) {
        throw new Error(payload.error || "建立成衣验收失败。");
      }
      setCreateForm(emptyCreate);
      await refresh(
        "验收记录已经建立；原生产放行与偏差事实均未被改写。",
        payload.acceptance.id,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "建立成衣验收失败。");
    } finally {
      setCreating(false);
    }
  }

  async function saveAcceptance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !editForm) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/studio/production-acceptances/${encodeURIComponent(selected.acceptance.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(editForm),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.acceptance) {
        throw new Error(payload.error || "保存成衣验收失败。");
      }
      await refresh(
        editForm.status === "accepted"
          ? "人工验收已经签署并冻结。"
          : editForm.status === "rejected"
            ? "未通过结论已经记录并冻结。"
            : "成衣验收事实已经保存。",
        selected.acceptance.id,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存成衣验收失败。");
    } finally {
      setSaving(false);
    }
  }

  async function updateCheck(
    id: string,
    result: ProductionAcceptanceCheckResult,
    observation: string,
  ) {
    setSavingCheckId(id);
    setError("");
    try {
      const response = await fetch(
        `/api/studio/production-acceptances/checks/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ result, observation }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.check) {
        throw new Error(payload.error || "保存核对项失败。");
      }
      await refresh("核对事实已经保存。", selectedId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存核对项失败。");
    } finally {
      setSavingCheckId(null);
    }
  }

  async function uploadEvidence(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !imageForm.file) return setError("请选择证据图片。");
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("image", imageForm.file);
      body.append("angle", imageForm.angle);
      body.append("caption", imageForm.caption);
      body.append("altText", imageForm.altText);
      const response = await fetch(
        `/api/studio/production-acceptances/${encodeURIComponent(selected.acceptance.id)}/images`,
        { method: "POST", body },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.image) {
        throw new Error(payload.error || "上传验收证据失败。");
      }
      setImageForm(emptyImage);
      await refresh("私密实物证据已经上传。", selected.acceptance.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "上传验收证据失败。");
    } finally {
      setUploading(false);
    }
  }

  async function removeEvidence(id: string) {
    setError("");
    try {
      const response = await fetch(
        `/api/studio/production-acceptances/images/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "removed" }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.image) {
        throw new Error(payload.error || "移除证据失败。");
      }
      await refresh("证据已从有效验收记录中移除。", selectedId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "移除证据失败。");
    }
  }

  return (
    <section
      className="production-change-control production-acceptance"
      id="production-acceptance"
      aria-labelledby="production-acceptance-title"
    >
      <header className="production-change-hero">
        <div>
          <span>26 / EDITION ACCEPTANCE</span>
          <h2 id="production-acceptance-title">
            RECEIVE THE REAL.<br />
            <i>SIGN THE STANDARD.</i>
          </h2>
          <p>
            生产放行不是最终事实。对实际到达的成衣进行抽检、核对与人工签署，
            让每次通过或拒收都能回到唯一的 NERA-GO 与设计意图。
          </p>
        </div>
        <div className="production-change-mark" aria-hidden="true">
          <b>✓</b>
          <span>PHYSICAL TRUTH</span>
        </div>
      </header>

      <div className="production-change-metrics">
        <Metric label="TOTAL" value={overview?.metrics.total ?? 0} />
        <Metric label="IN REVIEW" value={overview?.metrics.inReview ?? 0} />
        <Metric label="ACCEPTED" value={overview?.metrics.accepted ?? 0} />
        <Metric label="NOT ACCEPTED" value={overview?.metrics.rejected ?? 0} />
        <Metric label="ATTENTION" value={overview?.metrics.attention ?? 0} alert />
      </div>

      <div className="production-change-principles">
        <p><span>01</span>验收只绑定已授权 NERA-GO，不静默改写产品定义。</p>
        <p><span>02</span>八项实物核对与至少一张私密证据共同构成事实。</p>
        <p><span>03</span>未关闭高风险偏差时，系统拒绝生成人工验收标识。</p>
      </div>

      {(error || message) && (
        <div
          className={`production-change-notice${error ? " is-error" : ""}`}
          role="status"
        >
          {error || message}
        </div>
      )}

      <div className="production-change-layout">
        <aside className="production-change-create">
          <header>
            <span>NEW RECEIPT / 新验收</span>
            <h3>从已放行的实物开始。</h3>
          </header>
          <form onSubmit={createAcceptance}>
            <Field label="NERA-GO / 生产放行">
              <select
                value={createForm.productionReleaseId}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    productionReleaseId: event.target.value,
                  }))
                }
                required
              >
                <option value="">选择已授权放行</option>
                {overview?.references.releasedSources.map((source) => (
                  <option value={source.productionReleaseId} key={source.productionReleaseId}>
                    {source.lookNumber} · {source.releaseCode} · {source.blockingExceptions} BLOCK
                  </option>
                ))}
              </select>
            </Field>
            {selectedSource && (
              <div className="production-change-source">
                <div
                  className="production-change-source-image"
                  style={{
                    backgroundImage: `url("${selectedSource.imageUrl.replaceAll('"', "%22")}")`,
                  }}
                  aria-hidden="true"
                />
                <div>
                  <b>{selectedSource.workTitle}</b>
                  <span>{selectedSource.authorizationCode}</span>
                  <small>
                    {selectedSource.blockingExceptions > 0
                      ? `${selectedSource.blockingExceptions} 条高风险偏差未关闭`
                      : "高风险偏差已清除"}
                  </small>
                </div>
              </div>
            )}
            <Field label="成衣版号 / 批次参考">
              <input
                value={createForm.editionReference}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, editionReference: event.target.value }))
                }
                placeholder="工作室内部版号或到达参考"
              />
            </Field>
            <div className="production-change-form-grid">
              <Field label="颜色">
                <input
                  value={createForm.colorway}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, colorway: event.target.value }))
                  }
                  placeholder={selectedSource?.colorways || "颜色范围"}
                />
              </Field>
              <Field label="尺码范围">
                <input
                  value={createForm.sizeRange}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, sizeRange: event.target.value }))
                  }
                  placeholder={selectedSource?.sizeRange || "尺码范围"}
                />
              </Field>
              <Field label="到达数量">
                <input
                  type="number"
                  min="0"
                  value={createForm.receivedQuantity}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, receivedQuantity: event.target.value }))
                  }
                />
              </Field>
              <Field label="抽检数量">
                <input
                  type="number"
                  min="0"
                  value={createForm.inspectedQuantity}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, inspectedQuantity: event.target.value }))
                  }
                />
              </Field>
              <Field label="到达时间">
                <input
                  type="datetime-local"
                  value={createForm.receivedAt}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, receivedAt: event.target.value }))
                  }
                />
              </Field>
              <Field label="实物位置">
                <input
                  value={createForm.physicalLocation}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, physicalLocation: event.target.value }))
                  }
                />
              </Field>
            </div>
            <Field label="内部说明">
              <textarea
                value={createForm.notes}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </Field>
            <button type="submit" disabled={creating}>
              {creating ? "CREATING…" : "OPEN ACCEPTANCE →"}
            </button>
          </form>
        </aside>

        <div className="production-change-register">
          <header>
            <div>
              <span>EDITION REGISTER</span>
              <h3>成衣验收台账</h3>
            </div>
            <nav aria-label="成衣验收筛选">
              {(["active", "attention", "accepted", "all"] as Filter[]).map((item) => (
                <button
                  type="button"
                  className={filter === item ? "is-active" : ""}
                  onClick={() => setFilter(item)}
                  key={item}
                >
                  {item.toUpperCase()}
                </button>
              ))}
            </nav>
          </header>
          <input
            className="production-change-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索编号、Look、版号、颜色…"
            aria-label="搜索成衣验收"
          />
          <div className="production-change-list">
            {loading ? (
              <p className="production-change-empty">正在读取验收台账…</p>
            ) : visible.length > 0 ? (
              visible.map((workspace) => (
                <button
                  type="button"
                  className={`production-change-row severity-${workspace.summary.failedChecks > 0 ? "critical" : workspace.summary.approvalReady ? "low" : "medium"}${selectedId === workspace.acceptance.id ? " is-selected" : ""}`}
                  onClick={() => selectAcceptance(workspace)}
                  key={workspace.acceptance.id}
                >
                  <span>{workspace.acceptance.acceptanceCode}</span>
                  <div>
                    <b>{workspace.acceptance.editionReference || "版号待记录"}</b>
                    <small>
                      {workspace.work?.lookNumber || "LOOK"} · {workspace.release?.releaseCode || "RELEASE"}
                    </small>
                  </div>
                  <em>{statusLabels[workspace.acceptance.status]}</em>
                  <strong>{workspace.summary.passedChecks}/8 PASS</strong>
                  <i>{workspace.summary.blockingExceptions > 0 ? `${workspace.summary.blockingExceptions} BLOCK` : "CLEAR"}</i>
                </button>
              ))
            ) : (
              <p className="production-change-empty">当前筛选下没有验收记录。</p>
            )}
          </div>
          <footer>
            <Link href="/api/studio/production-acceptances?format=acceptances">ACCEPTANCE CSV</Link>
            <Link href="/api/studio/production-acceptances?format=checks">CHECKS CSV</Link>
            <Link href="/api/studio/production-acceptances?format=images">EVIDENCE CSV</Link>
            <Link href="/api/studio/production-acceptances?format=json">FULL JSON</Link>
          </footer>
        </div>
      </div>

      {selected && editForm && (
        <div className="production-change-dossier">
          <header>
            <div>
              <span>{selected.acceptance.acceptanceCode}</span>
              <h3>{selected.acceptance.editionReference || "成衣验收事实"}</h3>
              <p>
                {selected.work?.lookNumber} · {selected.release?.authorizationCode}
              </p>
            </div>
            <div className={`production-change-status severity-${selected.summary.approvalReady ? "low" : "high"}`}>
              <b>{selected.summary.passedChecks}/8 PASS</b>
              <span>{statusLabels[selected.acceptance.status]}</span>
            </div>
          </header>

          <div className="production-change-dossier-grid">
            <form className="production-change-editor" onSubmit={saveAcceptance}>
              <header>
                <span>PHYSICAL AUTHORITY / 实物权限</span>
                <p>通过或未通过后即冻结；后续实物必须建立新的验收轮次。</p>
              </header>
              <div className="production-change-form-grid">
                <Field label="状态">
                  <select
                    value={editForm.status}
                    onChange={(event) =>
                      setEditForm((current) => current ? { ...current, status: event.target.value as ProductionAcceptanceStatus } : current)
                    }
                    disabled={isFrozen(selected)}
                  >
                    {transitions[selected.acceptance.status].map((status) => (
                      <option value={status} key={status}>{statusLabels[status]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="人工决定">
                  <select
                    value={editForm.decision}
                    onChange={(event) =>
                      setEditForm((current) => current ? { ...current, decision: event.target.value as ProductionAcceptanceDecision } : current)
                    }
                    disabled={isFrozen(selected)}
                  >
                    {decisions.map((item) => (
                      <option value={item.value} key={item.value}>{item.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="成衣版号 / 批次参考">
                  <input
                    value={editForm.editionReference}
                    onChange={(event) =>
                      setEditForm((current) => current ? { ...current, editionReference: event.target.value } : current)
                    }
                    disabled={isFrozen(selected)}
                  />
                </Field>
                <Field label="颜色">
                  <input
                    value={editForm.colorway}
                    onChange={(event) =>
                      setEditForm((current) => current ? { ...current, colorway: event.target.value } : current)
                    }
                    disabled={isFrozen(selected)}
                  />
                </Field>
                <Field label="尺码范围">
                  <input
                    value={editForm.sizeRange}
                    onChange={(event) =>
                      setEditForm((current) => current ? { ...current, sizeRange: event.target.value } : current)
                    }
                    disabled={isFrozen(selected)}
                  />
                </Field>
                <Field label="实物位置">
                  <input
                    value={editForm.physicalLocation}
                    onChange={(event) =>
                      setEditForm((current) => current ? { ...current, physicalLocation: event.target.value } : current)
                    }
                    disabled={isFrozen(selected)}
                  />
                </Field>
                <Field label="到达数量">
                  <input
                    type="number"
                    min="0"
                    value={editForm.receivedQuantity}
                    onChange={(event) =>
                      setEditForm((current) => current ? { ...current, receivedQuantity: event.target.value } : current)
                    }
                    disabled={isFrozen(selected)}
                  />
                </Field>
                <Field label="抽检数量">
                  <input
                    type="number"
                    min="0"
                    value={editForm.inspectedQuantity}
                    onChange={(event) =>
                      setEditForm((current) => current ? { ...current, inspectedQuantity: event.target.value } : current)
                    }
                    disabled={isFrozen(selected)}
                  />
                </Field>
                <Field label="到达时间">
                  <input
                    type="datetime-local"
                    value={editForm.receivedAt}
                    onChange={(event) =>
                      setEditForm((current) => current ? { ...current, receivedAt: event.target.value } : current)
                    }
                    disabled={isFrozen(selected)}
                  />
                </Field>
                <Field label="验收时间">
                  <input
                    type="datetime-local"
                    value={editForm.inspectedAt}
                    onChange={(event) =>
                      setEditForm((current) => current ? { ...current, inspectedAt: event.target.value } : current)
                    }
                    disabled={isFrozen(selected)}
                  />
                </Field>
              </div>
              <Field label="验收标准">
                <textarea
                  value={editForm.inspectionStandard}
                  onChange={(event) =>
                    setEditForm((current) => current ? { ...current, inspectionStandard: event.target.value } : current)
                  }
                  disabled={isFrozen(selected)}
                />
              </Field>
              <Field label="总体观察">
                <textarea
                  value={editForm.overallObservation}
                  onChange={(event) =>
                    setEditForm((current) => current ? { ...current, overallObservation: event.target.value } : current)
                  }
                  disabled={isFrozen(selected)}
                />
              </Field>
              <Field label="处置结论">
                <textarea
                  value={editForm.dispositionNote}
                  onChange={(event) =>
                    setEditForm((current) => current ? { ...current, dispositionNote: event.target.value } : current)
                  }
                  disabled={isFrozen(selected)}
                  placeholder="说明通过、返工、暂缓或拒收的人工依据。"
                />
              </Field>
              <Field label="内部说明">
                <textarea
                  value={editForm.notes}
                  onChange={(event) =>
                    setEditForm((current) => current ? { ...current, notes: event.target.value } : current)
                  }
                  disabled={isFrozen(selected)}
                />
              </Field>
              <div className="production-change-readiness">
                <b>{selected.summary.approvalReady ? "READY TO ACCEPT" : "FACTS INCOMPLETE"}</b>
                <span>{selected.summary.blockingExceptions} BLOCKING EXCEPTIONS</span>
                <span>{selected.summary.activeImages} PRIVATE EVIDENCE</span>
                <span>{selected.summary.missingFields.join(" · ") || "关键事实完整"}</span>
              </div>
              {!isFrozen(selected) && (
                <button type="submit" disabled={saving}>
                  {saving ? "SAVING…" : "SAVE & APPLY DECISION →"}
                </button>
              )}
              {selected.acceptance.acceptanceSeal && (
                <div className="production-change-seal">
                  <span>ACCEPTANCE SEAL</span>
                  <strong>{selected.acceptance.acceptanceSeal}</strong>
                  <small>{selected.acceptance.acceptedBy} · {formatDate(selected.acceptance.acceptedAt)}</small>
                </div>
              )}
            </form>

            <div className="production-change-timeline">
              <header>
                <span>EIGHT-POINT CHECK / 八项核对</span>
                <p>每项结果均由设计师或受托验收人明确记录。</p>
              </header>
              <div className="production-acceptance-checks">
                {selected.checks.map((check, index) => (
                  <CheckEditor
                    key={`${check.id}:${check.updatedAt}`}
                    index={index + 1}
                    check={check}
                    frozen={isFrozen(selected)}
                    saving={savingCheckId === check.id}
                    onSave={updateCheck}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="production-acceptance-evidence">
            <header>
              <div>
                <span>PRIVATE EVIDENCE / 私密实物证据</span>
                <h3>只用于验收，不自动公开。</h3>
              </div>
              <b>{selected.summary.activeImages}/12</b>
            </header>
            <div className="production-acceptance-images">
              {selected.images
                .filter((image) => image.status === "active")
                .map((image) => (
                  <figure key={image.id}>
                    <Image
                      src={image.imageUrl}
                      alt={image.altText}
                      width={900}
                      height={1100}
                      unoptimized
                    />
                    <figcaption>
                      <b>{image.angle.toUpperCase()}</b>
                      <span>{image.caption || image.altText}</span>
                      {!isFrozen(selected) && (
                        <button type="button" onClick={() => void removeEvidence(image.id)}>
                          移除
                        </button>
                      )}
                    </figcaption>
                  </figure>
                ))}
            </div>
            {!isFrozen(selected) && (
              <form className="production-acceptance-upload" onSubmit={uploadEvidence}>
                <Field label="证据图片">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) =>
                      setImageForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))
                    }
                    required
                  />
                </Field>
                <Field label="角度 / 类型">
                  <select
                    value={imageForm.angle}
                    onChange={(event) =>
                      setImageForm((current) => ({ ...current, angle: event.target.value as ProductionAcceptanceImageAngle }))
                    }
                  >
                    {angles.map((item) => (
                      <option value={item.value} key={item.value}>{item.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="说明">
                  <input
                    value={imageForm.caption}
                    onChange={(event) =>
                      setImageForm((current) => ({ ...current, caption: event.target.value }))
                    }
                  />
                </Field>
                <Field label="无障碍描述">
                  <input
                    value={imageForm.altText}
                    onChange={(event) =>
                      setImageForm((current) => ({ ...current, altText: event.target.value }))
                    }
                  />
                </Field>
                <button type="submit" disabled={uploading}>
                  {uploading ? "UPLOADING…" : "UPLOAD PRIVATE EVIDENCE →"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
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
  check: ProductionAcceptanceWorkspace["checks"][number];
  frozen: boolean;
  saving: boolean;
  onSave: (
    id: string,
    result: ProductionAcceptanceCheckResult,
    observation: string,
  ) => Promise<void>;
}) {
  const [result, setResult] = useState<ProductionAcceptanceCheckResult>(check.result);
  const [observation, setObservation] = useState(check.observation);
  return (
    <article className={`production-change-action is-${result}`}>
      <span>{String(index).padStart(2, "0")} / {check.category.replaceAll("_", " ").toUpperCase()}</span>
      <h4>{check.title}</h4>
      <p>{check.requirement}</p>
      <select
        value={result}
        onChange={(event) => setResult(event.target.value as ProductionAcceptanceCheckResult)}
        disabled={frozen}
      >
        <option value="pending">待核对 / PENDING</option>
        <option value="pass">通过 / PASS</option>
        <option value="fail">失败 / FAIL</option>
        <option value="na">不适用 / N/A</option>
      </select>
      <textarea
        value={observation}
        onChange={(event) => setObservation(event.target.value)}
        placeholder="记录实际观察与测量事实。"
        disabled={frozen}
      />
      {!frozen && (
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave(check.id, result, observation)}
        >
          {saving ? "SAVING…" : "SAVE CHECK"}
        </button>
      )}
    </article>
  );
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className={alert && value > 0 ? "is-alert" : ""}>
      <span>{label}</span>
      <strong>{String(value).padStart(2, "0")}</strong>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span>{label}</span>
      {children}
    </label>
  );
}

function editFormFor(workspace: ProductionAcceptanceWorkspace) {
  const { acceptance } = workspace;
  return {
    status: acceptance.status,
    decision: acceptance.decision,
    editionReference: acceptance.editionReference,
    colorway: acceptance.colorway,
    sizeRange: acceptance.sizeRange,
    receivedQuantity: String(acceptance.receivedQuantity || ""),
    inspectedQuantity: String(acceptance.inspectedQuantity || ""),
    receivedAt: toLocalDateTime(acceptance.receivedAt),
    inspectedAt: toLocalDateTime(acceptance.inspectedAt),
    physicalLocation: acceptance.physicalLocation,
    inspectionStandard: acceptance.inspectionStandard,
    overallObservation: acceptance.overallObservation,
    dispositionNote: acceptance.dispositionNote,
    notes: acceptance.notes,
  };
}

function isFrozen(workspace: ProductionAcceptanceWorkspace) {
  return ["accepted", "rejected", "void"].includes(workspace.acceptance.status);
}

async function requestOverview() {
  const response = await fetch("/api/studio/production-acceptances", {
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok || !payload.overview) {
    throw new Error(payload.error || "无法读取成衣验收台。");
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

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
}
