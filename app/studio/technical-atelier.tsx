"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  ConstructionCategory,
  ConstructionPriority,
  ConstructionStatus,
  MeasurementStatus,
  SampleStage,
  TechnicalPackOverview,
  TechnicalPackWorkspace,
  TechPackStatus,
  TechPackUnit,
} from "@/lib/technical-packs";
import type {
  TechPackConstructionNote,
  TechPackMeasurement,
} from "@/db/schema";

type ApiPayload = {
  overview?: TechnicalPackOverview;
  pack?: { id: string };
  measurement?: { id: string };
  note?: { id: string };
  error?: string;
};

type PackFilter = "active" | "all" | "review" | "approved" | "attention";

const packStatuses: Array<{
  value: TechPackStatus;
  label: string;
  english: string;
}> = [
  { value: "draft", label: "草拟", english: "DRAFT" },
  { value: "review", label: "评审中", english: "REVIEW" },
  { value: "approved", label: "已批准", english: "APPROVED" },
  { value: "locked", label: "已锁定", english: "LOCKED" },
];

const sampleStages: Array<{
  value: SampleStage;
  label: string;
  english: string;
}> = [
  { value: "concept", label: "概念", english: "CONCEPT" },
  { value: "toile", label: "白坯", english: "TOILE" },
  { value: "prototype", label: "初样", english: "PROTOTYPE" },
  { value: "fit", label: "试身样", english: "FIT" },
  { value: "preproduction", label: "产前样", english: "PRE-PRODUCTION" },
  { value: "final", label: "最终样", english: "FINAL" },
];

const constructionCategories: Array<{
  value: ConstructionCategory;
  label: string;
}> = [
  { value: "seam", label: "缝型 / SEAM" },
  { value: "stitch", label: "针迹 / STITCH" },
  { value: "finish", label: "收边 / FINISH" },
  { value: "trim", label: "辅料 / TRIM" },
  { value: "label", label: "标牌 / LABEL" },
  { value: "artwork", label: "图案 / ARTWORK" },
  { value: "packing", label: "包装 / PACKING" },
  { value: "other", label: "其他 / OTHER" },
];

const priorities: Array<{
  value: ConstructionPriority;
  label: string;
}> = [
  { value: "standard", label: "标准" },
  { value: "important", label: "重要" },
  { value: "critical", label: "关键" },
];

const emptyCreateForm = {
  workId: "",
  sampleStage: "concept" as SampleStage,
  baseSize: "",
  unit: "cm" as TechPackUnit,
  fitIntent: "",
  patternReference: "",
  constructionSummary: "",
  sketchAltText: "",
  notes: "",
};

const emptyMeasurementForm = {
  pointCode: "",
  label: "",
  value: "",
  tolerancePlus: "",
  toleranceMinus: "",
  method: "",
  sortOrder: "0",
};

const emptyConstructionForm = {
  category: "seam" as ConstructionCategory,
  title: "",
  instruction: "",
  priority: "standard" as ConstructionPriority,
  sortOrder: "0",
};

type PackEditForm = ReturnType<typeof packEditForm>;

export default function TechnicalAtelier() {
  const [overview, setOverview] = useState<TechnicalPackOverview | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<PackFilter>("active");
  const [query, setQuery] = useState("");
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [createImage, setCreateImage] = useState<File | null>(null);
  const [editForm, setEditForm] = useState<PackEditForm | null>(null);
  const [replacementImage, setReplacementImage] = useState<File | null>(
    null,
  );
  const [measurementForm, setMeasurementForm] = useState(
    emptyMeasurementForm,
  );
  const [constructionForm, setConstructionForm] = useState(
    emptyConstructionForm,
  );
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [addingMeasurement, setAddingMeasurement] = useState(false);
  const [addingConstruction, setAddingConstruction] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const createImageRef = useRef<HTMLInputElement>(null);
  const replacementImageRef = useRef<HTMLInputElement>(null);

  const createPreview = useMemo(
    () => (createImage ? URL.createObjectURL(createImage) : ""),
    [createImage],
  );
  const replacementPreview = useMemo(
    () => (replacementImage ? URL.createObjectURL(replacementImage) : ""),
    [replacementImage],
  );

  useEffect(() => {
    return () => {
      if (createPreview) URL.revokeObjectURL(createPreview);
      if (replacementPreview) URL.revokeObjectURL(replacementPreview);
    };
  }, [createPreview, replacementPreview]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await requestOverview();
        if (cancelled) return;
        setOverview(next);
        const first = next.packs[0] ?? null;
        setSelectedId(first?.pack.id ?? null);
        setEditForm(first ? packEditForm(first) : null);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "无法读取技术工艺室。",
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

  const visiblePacks = useMemo(() => {
    if (!overview) return [];
    const needle = query.trim().toLocaleLowerCase();
    return overview.packs.filter((workspace) => {
      const { pack, work, summary } = workspace;
      if (filter === "active" && pack.status === "locked") return false;
      if (filter === "review" && pack.status !== "review") return false;
      if (
        filter === "approved" &&
        !["approved", "locked"].includes(pack.status)
      ) {
        return false;
      }
      if (
        filter === "attention" &&
        summary.missingFields.length === 0 &&
        summary.criticalOpenNotes === 0
      ) {
        return false;
      }
      if (!needle) return true;
      return [
        pack.techPackCode,
        work?.title,
        work?.lookNumber,
        work?.collection,
        pack.patternReference,
        pack.fitIntent,
        pack.notes,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [filter, overview, query]);

  const selected = useMemo(
    () =>
      overview?.packs.find(
        (workspace) => workspace.pack.id === selectedId,
      ) ?? null,
    [overview, selectedId],
  );

  async function refresh(
    successMessage = "",
    preferredId = selectedId,
  ) {
    setError("");
    if (successMessage) setMessage(successMessage);
    try {
      const next = await requestOverview();
      setOverview(next);
      const nextSelected =
        next.packs.find((workspace) => workspace.pack.id === preferredId) ??
        next.packs[0] ??
        null;
      setSelectedId(nextSelected?.pack.id ?? null);
      setEditForm(nextSelected ? packEditForm(nextSelected) : null);
      window.dispatchEvent(new CustomEvent("nera:tech-pack-updated"));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "无法刷新技术工艺室。",
      );
    }
  }

  function selectPack(workspace: TechnicalPackWorkspace) {
    setSelectedId(workspace.pack.id);
    setEditForm(packEditForm(workspace));
    setMeasurementForm(emptyMeasurementForm);
    setConstructionForm(emptyConstructionForm);
    setReplacementImage(null);
    if (replacementImageRef.current) {
      replacementImageRef.current.value = "";
    }
    setError("");
    setMessage("");
  }

  async function createPack(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!createForm.workId) {
      setError("请选择需要建立技术包的 Look。");
      return;
    }
    setCreating(true);
    try {
      const body = new FormData();
      Object.entries(createForm).forEach(([key, value]) =>
        body.set(key, value),
      );
      if (createImage) body.set("sketchImage", createImage);
      const payload = await requestJson("/api/studio/technical-packs", {
        method: "POST",
        body,
      });
      setCreateForm(emptyCreateForm);
      setCreateImage(null);
      if (createImageRef.current) createImageRef.current.value = "";
      await refresh("新的技术包修订已建立。", payload.pack?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "建立技术包失败。");
    } finally {
      setCreating(false);
    }
  }

  async function savePack(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !editForm) return;
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const payload =
        selected.pack.status === "approved" &&
        ["approved", "locked"].includes(editForm.status)
          ? {
              status: editForm.status,
              approvalNote: editForm.approvalNote,
            }
          : selected.pack.status === "locked" &&
              editForm.status === "review"
            ? {
                status: "review" as const,
                approvalNote: editForm.approvalNote,
              }
            : editForm;
      await requestJson(
        `/api/studio/technical-packs/${encodeURIComponent(selected.pack.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      await refresh("技术包事实已保存。", selected.pack.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存技术包失败。");
    } finally {
      setSaving(false);
    }
  }

  async function replaceSketch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !replacementImage) {
      setError("请选择新的技术图。");
      return;
    }
    setError("");
    setMessage("");
    setReplacing(true);
    try {
      const body = new FormData();
      body.set("image", replacementImage);
      body.set("altText", editForm?.sketchAltText ?? "");
      await requestJson(
        `/api/studio/technical-packs/${encodeURIComponent(selected.pack.id)}/image`,
        { method: "POST", body },
      );
      setReplacementImage(null);
      if (replacementImageRef.current) {
        replacementImageRef.current.value = "";
      }
      await refresh("技术图已替换并保留在交接清单中。", selected.pack.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "替换技术图失败。");
    } finally {
      setReplacing(false);
    }
  }

  async function addMeasurement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError("");
    setMessage("");
    setAddingMeasurement(true);
    try {
      await requestJson("/api/studio/technical-packs/measurements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          techPackId: selected.pack.id,
          ...measurementForm,
        }),
      });
      setMeasurementForm(emptyMeasurementForm);
      await refresh("尺寸点已加入规格表。", selected.pack.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "新增尺寸点失败。");
    } finally {
      setAddingMeasurement(false);
    }
  }

  async function addConstruction(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!selected) return;
    setError("");
    setMessage("");
    setAddingConstruction(true);
    try {
      await requestJson("/api/studio/technical-packs/construction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          techPackId: selected.pack.id,
          ...constructionForm,
        }),
      });
      setConstructionForm(emptyConstructionForm);
      await refresh("工艺说明已加入技术包。", selected.pack.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "新增工艺说明失败。");
    } finally {
      setAddingConstruction(false);
    }
  }

  async function updateMeasurement(
    id: string,
    payload: Record<string, unknown>,
  ) {
    if (!selected) return;
    setSavingItemId(id);
    setError("");
    try {
      await requestJson(
        `/api/studio/technical-packs/measurements/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      await refresh("尺寸规格已更新。", selected.pack.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "更新尺寸点失败。");
    } finally {
      setSavingItemId(null);
    }
  }

  async function updateConstruction(
    id: string,
    payload: Record<string, unknown>,
  ) {
    if (!selected) return;
    setSavingItemId(id);
    setError("");
    try {
      await requestJson(
        `/api/studio/technical-packs/construction/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      await refresh("工艺状态已更新。", selected.pack.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "更新工艺说明失败。");
    } finally {
      setSavingItemId(null);
    }
  }

  if (loading) {
    return (
      <section className="technical-atelier is-loading" id="technical-atelier">
        <p>TECHNICAL ATELIER / 正在整理技术事实…</p>
      </section>
    );
  }

  return (
    <section className="technical-atelier" id="technical-atelier">
      <header className="technical-hero">
        <div className="technical-hero-copy">
          <p className="technical-kicker">
            PHASE 21 · TECHNICAL ATELIER / 技术工艺室
          </p>
          <h2>
            MAKE IT
            <br />
            <i>BUILDABLE.</i>
          </h2>
          <p className="technical-lede">
            把轮廓、材料与制作意图整理成可执行的技术事实。修订、批准与锁定始终由设计师掌握。
          </p>
        </div>
        <div className="technical-hero-rule" aria-hidden="true">
          <span>01 / DEFINE</span>
          <span>02 / MEASURE</span>
          <span>03 / INSTRUCT</span>
          <span>04 / APPROVE</span>
        </div>
        <div className="technical-hero-mark" aria-hidden="true">
          TP
          <small>21</small>
        </div>
      </header>

      <div className="technical-metrics">
        <Metric
          value={overview?.metrics.packCount ?? 0}
          label="TECH PACKS"
          detail="独立修订"
        />
        <Metric
          value={overview?.metrics.reviewCount ?? 0}
          label="IN REVIEW"
          detail="等待设计判断"
          accent
        />
        <Metric
          value={
            (overview?.metrics.approvedCount ?? 0) +
            (overview?.metrics.lockedCount ?? 0)
          }
          label="APPROVED"
          detail={`${overview?.metrics.lockedCount ?? 0} 已锁定`}
        />
        <Metric
          value={overview?.metrics.incompleteCount ?? 0}
          label="INCOMPLETE"
          detail={`${overview?.metrics.criticalOpenCount ?? 0} 条关键风险`}
          attention={(overview?.metrics.incompleteCount ?? 0) > 0}
        />
        <Metric
          value={overview?.metrics.worksWithoutPackCount ?? 0}
          label="UNMAPPED LOOKS"
          detail="尚未建立技术包"
        />
      </div>

      <div className="technical-principles">
        <span>REVISION IS A FACT</span>
        <p>新版本另建修订，不覆盖历史。</p>
        <span>APPROVAL IS HUMAN</span>
        <p>缺少技术图、尺寸点或工艺说明时不能批准。</p>
        <span>REMOVAL IS TRACEABLE</span>
        <p>尺寸与说明以移除状态留痕，不直接删除。</p>
      </div>

      {(error || message) && (
        <div
          className={`technical-notice ${error ? "is-error" : "is-success"}`}
          role={error ? "alert" : "status"}
        >
          {error || message}
        </div>
      )}

      <div className="technical-create-grid">
        <div className="technical-section-title">
          <span>01</span>
          <div>
            <p>NEW REVISION</p>
            <h3>建立技术包修订</h3>
          </div>
        </div>
        <form className="technical-create-form" onSubmit={createPack}>
          <Field label="对应 Look">
            <select
              value={createForm.workId}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  workId: event.target.value,
                }))
              }
              required
            >
              <option value="">选择作品 / Look</option>
              {overview?.references.works.map((work) => (
                <option key={work.id} value={work.id}>
                  {work.lookNumber ? `${work.lookNumber} · ` : ""}
                  {work.title} · 下一个 R{work.latestRevision + 1}
                </option>
              ))}
            </select>
          </Field>
          <Field label="样衣阶段">
            <select
              value={createForm.sampleStage}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  sampleStage: event.target.value as SampleStage,
                }))
              }
            >
              {sampleStages.map((stage) => (
                <option key={stage.value} value={stage.value}>
                  {stage.label} / {stage.english}
                </option>
              ))}
            </select>
          </Field>
          <Field label="基码">
            <input
              value={createForm.baseSize}
              placeholder="例如 EU 38 / M"
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  baseSize: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="尺寸单位">
            <select
              value={createForm.unit}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  unit: event.target.value as TechPackUnit,
                }))
              }
            >
              <option value="cm">厘米 / CM</option>
              <option value="in">英寸 / IN</option>
            </select>
          </Field>
          <Field label="版型意图" wide>
            <textarea
              value={createForm.fitIntent}
              placeholder="描述贴合度、体量、长度、落点与穿着感。"
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  fitIntent: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="纸样编号">
            <input
              value={createForm.patternReference}
              placeholder="PATTERN / BLOCK REF"
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  patternReference: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="技术图" wide>
            <label
              className={`technical-upload ${createPreview ? "has-image" : ""}`}
              style={
                createPreview
                  ? { backgroundImage: `url("${createPreview}")` }
                  : undefined
              }
            >
              <input
                ref={createImageRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  setCreateImage(event.target.files?.[0] ?? null)
                }
              />
              <span>{createImage ? createImage.name : "上传正背面技术平面图"}</span>
              <small>JPEG / PNG / WEBP · 建议浅色背景</small>
            </label>
          </Field>
          <Field label="图片说明">
            <input
              value={createForm.sketchAltText}
              placeholder="无障碍描述"
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  sketchAltText: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="制作总述" wide>
            <textarea
              value={createForm.constructionSummary}
              placeholder="概括结构、层次与关键制作顺序。"
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  constructionSummary: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="修订备注" wide>
            <textarea
              value={createForm.notes}
              placeholder="记录本次修订原因与需要验证的问题。"
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
            />
          </Field>
          <button className="technical-primary" type="submit" disabled={creating}>
            {creating ? "建立中…" : "建立新修订"}
          </button>
        </form>
      </div>

      <div className="technical-library">
        <div className="technical-index">
          <div className="technical-section-title is-compact">
            <span>02</span>
            <div>
              <p>REVISION INDEX</p>
              <h3>技术包索引</h3>
            </div>
          </div>
          <input
            className="technical-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索 Look、编号、系列或纸样…"
            aria-label="搜索技术包"
          />
          <div className="technical-filters" aria-label="技术包筛选">
            {(
              [
                ["active", "进行中"],
                ["all", "全部"],
                ["review", "评审"],
                ["approved", "已批准"],
                ["attention", "需补齐"],
              ] as Array<[PackFilter, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filter === value ? "is-active" : ""}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="technical-index-list">
            {visiblePacks.length === 0 ? (
              <p className="technical-empty">当前筛选下没有技术包。</p>
            ) : (
              visiblePacks.map((workspace) => (
                <button
                  key={workspace.pack.id}
                  type="button"
                  className={
                    selectedId === workspace.pack.id ? "is-active" : ""
                  }
                  onClick={() => selectPack(workspace)}
                >
                  <span className="technical-index-revision">
                    R{String(workspace.pack.revision).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{workspace.work?.title ?? "未匹配 Look"}</strong>
                    <small>
                      {workspace.pack.techPackCode} ·{" "}
                      {statusLabel(workspace.pack.status)}
                    </small>
                  </span>
                  <em>{workspace.summary.completeness}%</em>
                </button>
              ))
            )}
          </div>
          <div className="technical-exports">
            <p>CONTROLLED EXPORTS</p>
            <Link
              href="/api/studio/technical-packs?format=packs"
              prefetch={false}
            >
              技术包 CSV
            </Link>
            <Link
              href="/api/studio/technical-packs?format=measurements"
              prefetch={false}
            >
              尺寸规格 CSV
            </Link>
            <Link
              href="/api/studio/technical-packs?format=construction"
              prefetch={false}
            >
              工艺说明 CSV
            </Link>
            <Link
              href="/api/studio/technical-packs?format=json"
              prefetch={false}
            >
              完整 JSON
            </Link>
          </div>
        </div>

        <div className="technical-dossier">
          {!selected || !editForm ? (
            <div className="technical-dossier-empty">
              <span>TP / 21</span>
              <h3>选择一个技术包修订</h3>
              <p>在这里完善制作事实、尺寸规格和工艺确认。</p>
            </div>
          ) : (
            <>
              <header className="technical-dossier-head">
                <div>
                  <p>{selected.pack.techPackCode}</p>
                  <h3>{selected.work?.title ?? "未匹配 Look"}</h3>
                  <span>
                    {selected.work?.lookNumber || "LOOK —"} ·{" "}
                    {selected.work?.collection || "UNASSIGNED"}
                  </span>
                </div>
                <div className="technical-completeness">
                  <strong>{selected.summary.completeness}%</strong>
                  <span>TECHNICAL FACTS</span>
                </div>
              </header>

              <div className="technical-visual-pair">
                <div
                  role="img"
                  aria-label={`${selected.work?.title ?? "Look"} 作品图`}
                  className="technical-look-image"
                  style={
                    selected.work?.imageUrl
                      ? {
                          backgroundImage: `url("${selected.work.imageUrl}")`,
                        }
                      : undefined
                  }
                >
                  <span>LOOK</span>
                </div>
                <div
                  role="img"
                  aria-label={
                    selected.pack.sketchAltText ||
                    `${selected.pack.techPackCode} 技术图`
                  }
                  className="technical-sketch-image"
                  style={
                    replacementPreview || selected.sketchUrl
                      ? {
                          backgroundImage: `url("${
                            replacementPreview || selected.sketchUrl
                          }")`,
                        }
                      : undefined
                  }
                >
                  <span>TECHNICAL FLAT</span>
                  {!replacementPreview && !selected.sketchUrl && (
                    <b>NO FLAT YET</b>
                  )}
                </div>
              </div>

              <div className="technical-readiness">
                {selected.summary.approvalReady ? (
                  <p className="is-ready">
                    <span>READY FOR APPROVAL</span>
                    技术事实完整，设计师可以决定是否批准。
                  </p>
                ) : (
                  <p>
                    <span>APPROVAL HOLD</span>
                    {selected.summary.missingFields.length
                      ? `待补：${selected.summary.missingFields.join("、")}`
                      : `${selected.summary.criticalOpenNotes} 条关键工艺仍未确认`}
                  </p>
                )}
              </div>

              <form className="technical-edit-form" onSubmit={savePack}>
                <Field label="修订状态">
                  <select
                    value={editForm.status}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? {
                              ...current,
                              status: event.target.value as TechPackStatus,
                            }
                          : current,
                      )
                    }
                  >
                    {packStatuses.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label} / {status.english}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="样衣阶段">
                  <select
                    value={editForm.sampleStage}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? {
                              ...current,
                              sampleStage: event.target.value as SampleStage,
                            }
                          : current,
                      )
                    }
                  >
                    {sampleStages.map((stage) => (
                      <option key={stage.value} value={stage.value}>
                        {stage.label} / {stage.english}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="基码">
                  <input
                    value={editForm.baseSize}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? { ...current, baseSize: event.target.value }
                          : current,
                      )
                    }
                  />
                </Field>
                <Field label="单位">
                  <select
                    value={editForm.unit}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? {
                              ...current,
                              unit: event.target.value as TechPackUnit,
                            }
                          : current,
                      )
                    }
                  >
                    <option value="cm">CM</option>
                    <option value="in">IN</option>
                  </select>
                </Field>
                <Field label="纸样编号">
                  <input
                    value={editForm.patternReference}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? {
                              ...current,
                              patternReference: event.target.value,
                            }
                          : current,
                      )
                    }
                  />
                </Field>
                <Field label="技术图说明">
                  <input
                    value={editForm.sketchAltText}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? {
                              ...current,
                              sketchAltText: event.target.value,
                            }
                          : current,
                      )
                    }
                  />
                </Field>
                {(
                  [
                    ["fitIntent", "版型意图"],
                    ["constructionSummary", "制作总述"],
                    ["gradingNotes", "放码说明"],
                    ["finishingNotes", "整理与收边"],
                    ["labelNotes", "标牌说明"],
                    ["packagingNotes", "包装说明"],
                    ["approvalNote", "批准备注"],
                    ["notes", "修订记录"],
                  ] as Array<[keyof PackEditForm, string]>
                ).map(([key, label]) => (
                  <Field key={key} label={label} wide>
                    <textarea
                      value={String(editForm[key])}
                      onChange={(event) =>
                        setEditForm((current) =>
                          current
                            ? { ...current, [key]: event.target.value }
                            : current,
                        )
                      }
                    />
                  </Field>
                ))}
                <button
                  className="technical-primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "保存中…" : "保存技术事实"}
                </button>
              </form>

              <form className="technical-replace" onSubmit={replaceSketch}>
                <label>
                  <span>替换技术图</span>
                  <input
                    ref={replacementImageRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) =>
                      setReplacementImage(event.target.files?.[0] ?? null)
                    }
                  />
                </label>
                <button
                  type="submit"
                  disabled={!replacementImage || replacing}
                >
                  {replacing ? "上传中…" : "确认替换"}
                </button>
              </form>

              <div className="technical-spec-section">
                <div className="technical-section-title is-compact">
                  <span>03</span>
                  <div>
                    <p>POINTS OF MEASURE</p>
                    <h3>尺寸规格</h3>
                  </div>
                </div>
                <form className="technical-inline-form" onSubmit={addMeasurement}>
                  <input
                    value={measurementForm.pointCode}
                    placeholder="POM 编号"
                    onChange={(event) =>
                      setMeasurementForm((current) => ({
                        ...current,
                        pointCode: event.target.value,
                      }))
                    }
                  />
                  <input
                    value={measurementForm.label}
                    placeholder="尺寸点名称 *"
                    required
                    onChange={(event) =>
                      setMeasurementForm((current) => ({
                        ...current,
                        label: event.target.value,
                      }))
                    }
                  />
                  <input
                    value={measurementForm.value}
                    placeholder={`数值 / ${selected.pack.unit.toUpperCase()}`}
                    onChange={(event) =>
                      setMeasurementForm((current) => ({
                        ...current,
                        value: event.target.value,
                      }))
                    }
                  />
                  <input
                    value={measurementForm.tolerancePlus}
                    placeholder="+ 公差"
                    onChange={(event) =>
                      setMeasurementForm((current) => ({
                        ...current,
                        tolerancePlus: event.target.value,
                      }))
                    }
                  />
                  <input
                    value={measurementForm.toleranceMinus}
                    placeholder="− 公差"
                    onChange={(event) =>
                      setMeasurementForm((current) => ({
                        ...current,
                        toleranceMinus: event.target.value,
                      }))
                    }
                  />
                  <input
                    value={measurementForm.method}
                    placeholder="测量方法"
                    onChange={(event) =>
                      setMeasurementForm((current) => ({
                        ...current,
                        method: event.target.value,
                      }))
                    }
                  />
                  <button type="submit" disabled={addingMeasurement}>
                    {addingMeasurement ? "加入中…" : "加入尺寸点"}
                  </button>
                </form>
                <div className="technical-measure-table">
                  <div className="technical-measure-head">
                    <span>POM</span>
                    <span>尺寸点</span>
                    <span>数值</span>
                    <span>公差 + / −</span>
                    <span>方法</span>
                    <span>状态</span>
                  </div>
                  {selected.measurements.length === 0 ? (
                    <p className="technical-empty">还没有尺寸点。</p>
                  ) : (
                    selected.measurements.map((measurement) => (
                      <MeasurementEditor
                        key={`${measurement.id}-${measurement.updatedAt}`}
                        measurement={measurement}
                        unit={selected.pack.unit}
                        busy={savingItemId === measurement.id}
                        onSave={(payload) =>
                          updateMeasurement(measurement.id, payload)
                        }
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="technical-spec-section">
                <div className="technical-section-title is-compact">
                  <span>04</span>
                  <div>
                    <p>CONSTRUCTION PROTOCOL</p>
                    <h3>工艺说明</h3>
                  </div>
                </div>
                <form
                  className="technical-construction-form"
                  onSubmit={addConstruction}
                >
                  <select
                    value={constructionForm.category}
                    onChange={(event) =>
                      setConstructionForm((current) => ({
                        ...current,
                        category: event.target.value as ConstructionCategory,
                      }))
                    }
                  >
                    {constructionCategories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={constructionForm.title}
                    placeholder="工艺标题 *"
                    required
                    onChange={(event) =>
                      setConstructionForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                  <select
                    value={constructionForm.priority}
                    onChange={(event) =>
                      setConstructionForm((current) => ({
                        ...current,
                        priority: event.target.value as ConstructionPriority,
                      }))
                    }
                  >
                    {priorities.map((priority) => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={constructionForm.instruction}
                    placeholder="描述针迹、缝份、压线、加固、顺序或验收标准。"
                    onChange={(event) =>
                      setConstructionForm((current) => ({
                        ...current,
                        instruction: event.target.value,
                      }))
                    }
                  />
                  <button type="submit" disabled={addingConstruction}>
                    {addingConstruction ? "加入中…" : "加入工艺说明"}
                  </button>
                </form>
                <div className="technical-construction-list">
                  {selected.constructionNotes.length === 0 ? (
                    <p className="technical-empty">还没有工艺说明。</p>
                  ) : (
                    selected.constructionNotes.map((note) => (
                      <ConstructionEditor
                        key={`${note.id}-${note.updatedAt}`}
                        note={note}
                        busy={savingItemId === note.id}
                        onSave={(payload) =>
                          updateConstruction(note.id, payload)
                        }
                      />
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Metric({
  value,
  label,
  detail,
  accent = false,
  attention = false,
}: {
  value: number;
  label: string;
  detail: string;
  accent?: boolean;
  attention?: boolean;
}) {
  return (
    <article
      className={`technical-metric${accent ? " is-accent" : ""}${
        attention ? " is-attention" : ""
      }`}
    >
      <strong>{String(value).padStart(2, "0")}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </article>
  );
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "is-wide" : ""}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function MeasurementEditor({
  measurement,
  unit,
  busy,
  onSave,
}: {
  measurement: TechPackMeasurement;
  unit: TechPackUnit;
  busy: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState(measurementForm(measurement));
  return (
    <div
      className={`technical-measure-row${
        measurement.status === "removed" ? " is-removed" : ""
      }`}
    >
      <input
        aria-label="POM 编号"
        value={form.pointCode}
        onChange={(event) =>
          setForm((current) => ({
            ...current,
            pointCode: event.target.value,
          }))
        }
      />
      <input
        aria-label="尺寸点名称"
        value={form.label}
        onChange={(event) =>
          setForm((current) => ({ ...current, label: event.target.value }))
        }
      />
      <label>
        <input
          aria-label="尺寸值"
          value={form.value}
          onChange={(event) =>
            setForm((current) => ({ ...current, value: event.target.value }))
          }
        />
        <span>{unit.toUpperCase()}</span>
      </label>
      <div>
        <input
          aria-label="正公差"
          value={form.tolerancePlus}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              tolerancePlus: event.target.value,
            }))
          }
        />
        <input
          aria-label="负公差"
          value={form.toleranceMinus}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              toleranceMinus: event.target.value,
            }))
          }
        />
      </div>
      <input
        aria-label="测量方法"
        value={form.method}
        onChange={(event) =>
          setForm((current) => ({ ...current, method: event.target.value }))
        }
      />
      <div className="technical-row-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave(form)}
        >
          保存
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onSave({
              status:
                measurement.status === "removed" ? "active" : "removed",
            })
          }
        >
          {measurement.status === "removed" ? "恢复" : "移除"}
        </button>
      </div>
    </div>
  );
}

function ConstructionEditor({
  note,
  busy,
  onSave,
}: {
  note: TechPackConstructionNote;
  busy: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState(constructionEditForm(note));
  return (
    <article
      className={`technical-construction-card is-${note.priority}${
        note.status === "removed" ? " is-removed" : ""
      }`}
    >
      <div className="technical-construction-card-head">
        <select
          aria-label="工艺类别"
          value={form.category}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              category: event.target.value as ConstructionCategory,
            }))
          }
        >
          {constructionCategories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
        <select
          aria-label="工艺优先级"
          value={form.priority}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              priority: event.target.value as ConstructionPriority,
            }))
          }
        >
          {priorities.map((priority) => (
            <option key={priority.value} value={priority.value}>
              {priority.label}
            </option>
          ))}
        </select>
        <select
          aria-label="工艺状态"
          value={form.status}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              status: event.target.value as ConstructionStatus,
            }))
          }
        >
          <option value="open">待确认 / OPEN</option>
          <option value="confirmed">已确认 / CONFIRMED</option>
          <option value="removed">已移除 / REMOVED</option>
        </select>
      </div>
      <input
        className="technical-construction-title"
        aria-label="工艺标题"
        value={form.title}
        onChange={(event) =>
          setForm((current) => ({ ...current, title: event.target.value }))
        }
      />
      <textarea
        aria-label="工艺说明"
        value={form.instruction}
        onChange={(event) =>
          setForm((current) => ({
            ...current,
            instruction: event.target.value,
          }))
        }
      />
      <button type="button" disabled={busy} onClick={() => onSave(form)}>
        {busy ? "保存中…" : "保存工艺状态"}
      </button>
    </article>
  );
}

function packEditForm(workspace: TechnicalPackWorkspace) {
  const pack = workspace.pack;
  return {
    status: pack.status as TechPackStatus,
    sampleStage: pack.sampleStage as SampleStage,
    baseSize: pack.baseSize,
    unit: pack.unit as TechPackUnit,
    fitIntent: pack.fitIntent,
    patternReference: pack.patternReference,
    constructionSummary: pack.constructionSummary,
    gradingNotes: pack.gradingNotes,
    finishingNotes: pack.finishingNotes,
    labelNotes: pack.labelNotes,
    packagingNotes: pack.packagingNotes,
    sketchAltText: pack.sketchAltText,
    approvalNote: pack.approvalNote,
    notes: pack.notes,
  };
}

function measurementForm(measurement: TechPackMeasurement) {
  return {
    pointCode: measurement.pointCode,
    label: measurement.label,
    value: measurement.value,
    tolerancePlus: measurement.tolerancePlus,
    toleranceMinus: measurement.toleranceMinus,
    method: measurement.method,
    status: measurement.status as MeasurementStatus,
    sortOrder: measurement.sortOrder,
  };
}

function constructionEditForm(note: TechPackConstructionNote) {
  return {
    category: note.category as ConstructionCategory,
    title: note.title,
    instruction: note.instruction,
    priority: note.priority as ConstructionPriority,
    status: note.status as ConstructionStatus,
    sortOrder: note.sortOrder,
  };
}

function statusLabel(status: TechPackStatus) {
  return packStatuses.find((item) => item.value === status)?.label ?? status;
}

async function requestOverview() {
  const response = await fetch("/api/studio/technical-packs", {
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok || !payload.overview) {
    throw new Error(payload.error || "无法读取技术工艺室。");
  }
  return payload.overview;
}

async function requestJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok) {
    throw new Error(payload.error || "操作失败，请稍后重试。");
  }
  return payload;
}
