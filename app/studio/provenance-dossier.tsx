"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  ProvenanceDossierCheckResult,
  ProvenanceDossierDecision,
  ProvenanceDossierOverview,
  ProvenanceDossierStatus,
  ProvenanceDossierWorkspace,
} from "@/lib/provenance-dossiers";

type ApiPayload = {
  overview?: ProvenanceDossierOverview;
  dossier?: { id: string };
  check?: { id: string };
  error?: string;
};

const decisions: Array<{ value: ProvenanceDossierDecision; label: string }> = [
  { value: "pending", label: "待决定 / PENDING" },
  { value: "publish", label: "发布 / PUBLISH" },
  { value: "revise", label: "修改后复核 / REVISE" },
  { value: "hold", label: "暂缓 / HOLD" },
];

const statusLabels: Record<ProvenanceDossierStatus, string> = {
  draft: "草稿 / DRAFT",
  in_review: "复核中 / IN REVIEW",
  published: "已发布 / PUBLISHED",
  retired: "已退役 / RETIRED",
  void: "已作废 / VOID",
};

const transitions: Record<ProvenanceDossierStatus, ProvenanceDossierStatus[]> = {
  draft: ["draft", "in_review", "void"],
  in_review: ["in_review", "draft", "published", "void"],
  published: ["published", "retired"],
  retired: ["retired"],
  void: ["void"],
};

const emptyCreate = {
  productionAcceptanceId: "",
  title: "",
  subtitle: "",
};

type EditForm = ReturnType<typeof editFormFor>;
type Filter = "active" | "attention" | "published" | "all";

export default function ProvenanceDossier() {
  const [overview, setOverview] = useState<ProvenanceDossierOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [query, setQuery] = useState("");
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingCheckId, setSavingCheckId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await requestOverview();
        if (cancelled) return;
        const first = next.dossiers[0] ?? null;
        setOverview(next);
        setSelectedId(first?.dossier.id ?? null);
        setEditForm(first ? editFormFor(first) : null);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "无法读取成衣溯源档案。");
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
    return overview.dossiers.filter((workspace) => {
      const { dossier, acceptance, work, summary } = workspace;
      if (filter === "active" && ["published", "retired", "void"].includes(dossier.status)) return false;
      if (filter === "attention" && summary.publishReady) return false;
      if (filter === "published" && dossier.status !== "published") return false;
      if (!needle) return true;
      return [
        dossier.dossierCode,
        dossier.title,
        dossier.slug,
        acceptance?.acceptanceSeal,
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
    overview?.dossiers.find((workspace) => workspace.dossier.id === selectedId) ?? null;
  const selectedSource = overview?.references.acceptedSources.find(
    (source) => source.productionAcceptanceId === createForm.productionAcceptanceId,
  );

  async function refresh(successMessage = "", preferredId: string | null = selectedId) {
    setError("");
    if (successMessage) setMessage(successMessage);
    const next = await requestOverview();
    const nextSelected =
      next.dossiers.find((workspace) => workspace.dossier.id === preferredId) ??
      next.dossiers[0] ??
      null;
    setOverview(next);
    setSelectedId(nextSelected?.dossier.id ?? null);
    setEditForm(nextSelected ? editFormFor(nextSelected) : null);
    window.dispatchEvent(new Event("nera:provenance-updated"));
  }

  function selectDossier(workspace: ProvenanceDossierWorkspace) {
    setSelectedId(workspace.dossier.id);
    setEditForm(editFormFor(workspace));
    setError("");
    setMessage("");
  }

  async function createDossier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSource) return setError("请选择有效的 NERA-ACCEPT 实物版本。");
    setCreating(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/studio/provenance-dossiers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.dossier) {
        throw new Error(payload.error || "建立溯源档案失败。");
      }
      setCreateForm(emptyCreate);
      await refresh("新档案修订已经建立；原验收事实保持冻结。", payload.dossier.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "建立溯源档案失败。");
    } finally {
      setCreating(false);
    }
  }

  async function saveDossier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !editForm) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/studio/provenance-dossiers/${encodeURIComponent(selected.dossier.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            selected.dossier.status === "published" && editForm.status === "retired"
              ? { status: "retired" }
              : editForm,
          ),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.dossier) {
        throw new Error(payload.error || "保存溯源档案失败。");
      }
      await refresh(
        editForm.status === "published"
          ? "溯源档案已经人工发布并冻结。"
          : editForm.status === "retired"
            ? "公开档案已退役；历史版本仍然保留。"
            : "溯源档案已经保存。",
        selected.dossier.id,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存溯源档案失败。");
    } finally {
      setSaving(false);
    }
  }

  async function updateCheck(
    id: string,
    result: ProvenanceDossierCheckResult,
    observation: string,
  ) {
    setSavingCheckId(id);
    setError("");
    try {
      const response = await fetch(
        `/api/studio/provenance-dossiers/checks/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ result, observation }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.check) {
        throw new Error(payload.error || "保存公开核对项失败。");
      }
      await refresh("公开核对事实已经保存。", selectedId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存公开核对项失败。");
    } finally {
      setSavingCheckId(null);
    }
  }

  return (
    <section
      className="production-change-control provenance-dossier"
      id="provenance-dossier"
      aria-labelledby="provenance-dossier-title"
    >
      <header className="production-change-hero">
        <div>
          <span>27 / PROVENANCE DOSSIER</span>
          <h2 id="provenance-dossier-title">
            TRACE THE REAL.<br />
            <i>PUBLISH THE MEMORY.</i>
          </h2>
          <p>
            从已通过 NERA-ACCEPT 的真实成衣出发，整理设计故事、材料、制作、
            护理与修复事实；只有人工核对通过后，才形成可长期阅读的公开档案。
          </p>
        </div>
        <div className="production-change-mark" aria-hidden="true">
          <b>∞</b>
          <span>VERIFIED MEMORY</span>
        </div>
      </header>

      <div className="production-change-metrics">
        <Metric label="TOTAL" value={overview?.metrics.total ?? 0} />
        <Metric label="IN REVIEW" value={overview?.metrics.inReview ?? 0} />
        <Metric label="PUBLISHED" value={overview?.metrics.published ?? 0} />
        <Metric label="RETIRED" value={overview?.metrics.retired ?? 0} />
        <Metric label="ATTENTION" value={overview?.metrics.attention ?? 0} alert />
      </div>

      <div className="production-change-principles">
        <p><span>01</span>只接受已签署 NERA-ACCEPT 的实物来源。</p>
        <p><span>02</span>公开页只使用作品公开图，不带出私密验收证据。</p>
        <p><span>03</span>发布版本不可原地改写；变化必须建立新修订。</p>
      </div>

      {(error || message) && (
        <div className={`production-change-notice${error ? " is-error" : ""}`} role="status">
          {error || message}
        </div>
      )}

      <div className="production-change-layout">
        <aside className="production-change-create">
          <header>
            <span>NEW DOSSIER / 新档案</span>
            <h3>从已验收的作品开始。</h3>
          </header>
          <form onSubmit={createDossier}>
            <Field label="NERA-ACCEPT / 实物验收">
              <select
                value={createForm.productionAcceptanceId}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    productionAcceptanceId: event.target.value,
                  }))
                }
                required
              >
                <option value="">选择已通过验收</option>
                {overview?.references.acceptedSources.map((source) => (
                  <option value={source.productionAcceptanceId} key={source.productionAcceptanceId}>
                    {source.lookNumber} · {source.acceptanceSeal} · R{source.latestRevision + 1}
                  </option>
                ))}
              </select>
            </Field>
            {selectedSource && (
              <div className="production-change-source">
                <div
                  className="production-change-source-image"
                  style={{ backgroundImage: `url("${selectedSource.imageUrl.replaceAll('"', "%22")}")` }}
                  aria-hidden="true"
                />
                <div>
                  <b>{selectedSource.workTitle}</b>
                  <span>{selectedSource.acceptanceSeal}</span>
                  <small>{selectedSource.collection}</small>
                </div>
              </div>
            )}
            <Field label="公开标题">
              <input
                value={createForm.title}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder={selectedSource?.workTitle || "作品标题"}
              />
            </Field>
            <Field label="副标题">
              <input
                value={createForm.subtitle}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, subtitle: event.target.value }))
                }
              />
            </Field>
            <button type="submit" disabled={creating || !selectedSource}>
              {creating ? "CREATING…" : "CREATE DOSSIER →"}
            </button>
          </form>
          <div className="production-change-export">
            <Link href="/api/studio/provenance-dossiers?format=dossiers">DOSSIERS CSV</Link>
            <Link href="/api/studio/provenance-dossiers?format=checks">CHECKS CSV</Link>
            <Link href="/api/studio/provenance-dossiers?format=json">FULL JSON</Link>
          </div>
        </aside>

        <div className="production-change-workbench">
          <div className="production-change-toolbar">
            <div>
              {(["active", "attention", "published", "all"] as Filter[]).map((item) => (
                <button
                  type="button"
                  className={filter === item ? "is-active" : ""}
                  onClick={() => setFilter(item)}
                  key={item}
                >
                  {item.toUpperCase()}
                </button>
              ))}
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索编号、Look 或标题"
            />
          </div>

          {loading ? (
            <p className="production-change-empty">正在读取溯源档案…</p>
          ) : visible.length === 0 ? (
            <p className="production-change-empty">当前筛选下没有档案。</p>
          ) : (
            <div className="production-change-list">
              {visible.map((workspace) => (
                <button
                  type="button"
                  className={workspace.dossier.id === selectedId ? "is-active" : ""}
                  onClick={() => selectDossier(workspace)}
                  key={workspace.dossier.id}
                >
                  <span>{workspace.dossier.dossierCode}</span>
                  <strong>{workspace.dossier.title || workspace.work?.title || "UNTITLED"}</strong>
                  <small>
                    {workspace.work?.lookNumber || "NO LOOK"} · {statusLabels[workspace.dossier.status]}
                  </small>
                  <i>{workspace.summary.passedChecks}/6 CHECKS</i>
                </button>
              ))}
            </div>
          )}

          {selected && editForm && (
            <div className="production-change-detail">
              <header>
                <div>
                  <span>{selected.dossier.dossierCode} / REV {selected.dossier.revision}</span>
                  <h3>{selected.dossier.title || selected.work?.title}</h3>
                  <p>
                    {selected.acceptance?.acceptanceSeal} · {selected.release?.authorizationCode}
                  </p>
                </div>
                <div>
                  <b>{selected.summary.publishReady ? "READY" : "INCOMPLETE"}</b>
                  {selected.dossier.status === "published" && (
                    <Link href={`/provenance/${selected.dossier.slug}`} target="_blank">
                      OPEN PUBLIC DOSSIER ↗
                    </Link>
                  )}
                </div>
              </header>

              <form className="production-change-form" onSubmit={saveDossier}>
                <div className="production-change-grid">
                  <Field label="状态">
                    <select
                      value={editForm.status}
                      onChange={(event) =>
                        setEditForm((current) => current ? { ...current, status: event.target.value as ProvenanceDossierStatus } : current)
                      }
                      disabled={["retired", "void"].includes(selected.dossier.status)}
                    >
                      {transitions[selected.dossier.status].map((status) => (
                        <option value={status} key={status}>{statusLabels[status]}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="人工决定">
                    <select
                      value={editForm.decision}
                      onChange={(event) =>
                        setEditForm((current) => current ? { ...current, decision: event.target.value as ProvenanceDossierDecision } : current)
                      }
                      disabled={isFrozen(selected)}
                    >
                      {decisions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                    </select>
                  </Field>
                  <Field label="公开地址">
                    <input value={editForm.slug} onChange={(event) => updateEdit(setEditForm, "slug", event.target.value)} disabled={isFrozen(selected)} />
                  </Field>
                  <Field label="完成日期">
                    <input type="date" value={editForm.madeAt} onChange={(event) => updateEdit(setEditForm, "madeAt", event.target.value)} disabled={isFrozen(selected)} />
                  </Field>
                  <Field label="公开标题">
                    <input value={editForm.title} onChange={(event) => updateEdit(setEditForm, "title", event.target.value)} disabled={isFrozen(selected)} />
                  </Field>
                  <Field label="副标题">
                    <input value={editForm.subtitle} onChange={(event) => updateEdit(setEditForm, "subtitle", event.target.value)} disabled={isFrozen(selected)} />
                  </Field>
                  <Field label="制作方说明">
                    <input value={editForm.makerDisclosure} onChange={(event) => updateEdit(setEditForm, "makerDisclosure", event.target.value)} disabled={isFrozen(selected)} />
                  </Field>
                  <Field label="制作地点">
                    <input value={editForm.placeOfMaking} onChange={(event) => updateEdit(setEditForm, "placeOfMaking", event.target.value)} disabled={isFrozen(selected)} />
                  </Field>
                </div>
                <Field label="公开摘要">
                  <textarea value={editForm.publicSummary} onChange={(event) => updateEdit(setEditForm, "publicSummary", event.target.value)} disabled={isFrozen(selected)} />
                </Field>
                <Field label="设计故事">
                  <textarea value={editForm.designStory} onChange={(event) => updateEdit(setEditForm, "designStory", event.target.value)} disabled={isFrozen(selected)} />
                </Field>
                <Field label="材料披露">
                  <textarea value={editForm.materialDisclosure} onChange={(event) => updateEdit(setEditForm, "materialDisclosure", event.target.value)} disabled={isFrozen(selected)} />
                </Field>
                <div className="production-change-grid">
                  <Field label="护理建议">
                    <textarea value={editForm.careGuidance} onChange={(event) => updateEdit(setEditForm, "careGuidance", event.target.value)} disabled={isFrozen(selected)} />
                  </Field>
                  <Field label="修复建议">
                    <textarea value={editForm.repairGuidance} onChange={(event) => updateEdit(setEditForm, "repairGuidance", event.target.value)} disabled={isFrozen(selected)} />
                  </Field>
                </div>
                <Field label="溯源说明">
                  <textarea value={editForm.provenanceNote} onChange={(event) => updateEdit(setEditForm, "provenanceNote", event.target.value)} disabled={isFrozen(selected)} />
                </Field>
                {selected.summary.missingFields.length > 0 && (
                  <p className="production-change-blocker">
                    待补齐：{selected.summary.missingFields.join("、")}
                  </p>
                )}
                {!(["retired", "void"].includes(selected.dossier.status)) && (
                  <button type="submit" disabled={saving}>
                    {saving ? "SAVING…" : editForm.status === "published" ? "PUBLISH & FREEZE →" : "SAVE DOSSIER →"}
                  </button>
                )}
              </form>

              <div className="production-change-actions">
                <header>
                  <div>
                    <span>PUBLICATION CHECKS / 公开核对</span>
                    <h3>六项事实，全部人工确认。</h3>
                  </div>
                  <b>{selected.summary.passedChecks}/6</b>
                </header>
                <div className="production-change-action-list">
                  {selected.checks.map((check, index) => (
                    <CheckEditor
                      index={index + 1}
                      check={check}
                      frozen={isFrozen(selected)}
                      saving={savingCheckId === check.id}
                      onSave={updateCheck}
                      key={check.id}
                    />
                  ))}
                </div>
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
  check: ProvenanceDossierWorkspace["checks"][number];
  frozen: boolean;
  saving: boolean;
  onSave: (id: string, result: ProvenanceDossierCheckResult, observation: string) => Promise<void>;
}) {
  const [result, setResult] = useState<ProvenanceDossierCheckResult>(check.result);
  const [observation, setObservation] = useState(check.observation);
  return (
    <article className={`production-change-action is-${result}`}>
      <span>{String(index).padStart(2, "0")} / {check.category.replaceAll("_", " ").toUpperCase()}</span>
      <h4>{check.title}</h4>
      <p>{check.requirement}</p>
      <select value={result} onChange={(event) => setResult(event.target.value as ProvenanceDossierCheckResult)} disabled={frozen}>
        <option value="pending">待核对 / PENDING</option>
        <option value="pass">通过 / PASS</option>
        <option value="fail">失败 / FAIL</option>
        <option value="na">不适用 / N/A</option>
      </select>
      <textarea value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="记录人工核对依据。" disabled={frozen} />
      {!frozen && (
        <button type="button" disabled={saving} onClick={() => void onSave(check.id, result, observation)}>
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

function editFormFor(workspace: ProvenanceDossierWorkspace) {
  const { dossier } = workspace;
  return {
    status: dossier.status,
    decision: dossier.decision,
    slug: dossier.slug,
    title: dossier.title,
    subtitle: dossier.subtitle,
    designStory: dossier.designStory,
    materialDisclosure: dossier.materialDisclosure,
    makerDisclosure: dossier.makerDisclosure,
    placeOfMaking: dossier.placeOfMaking,
    madeAt: dossier.madeAt ?? "",
    careGuidance: dossier.careGuidance,
    repairGuidance: dossier.repairGuidance,
    provenanceNote: dossier.provenanceNote,
    publicSummary: dossier.publicSummary,
  };
}

function updateEdit<K extends keyof EditForm>(
  setter: React.Dispatch<React.SetStateAction<EditForm | null>>,
  key: K,
  value: EditForm[K],
) {
  setter((current) => current ? { ...current, [key]: value } : current);
}

function isFrozen(workspace: ProvenanceDossierWorkspace) {
  return ["published", "retired", "void"].includes(workspace.dossier.status);
}

async function requestOverview() {
  const response = await fetch("/api/studio/provenance-dossiers", { cache: "no-store" });
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok || !payload.overview) {
    throw new Error(payload.error || "无法读取成衣溯源档案。");
  }
  return payload.overview;
}
