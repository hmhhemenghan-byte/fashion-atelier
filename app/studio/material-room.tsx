"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  MaterialCategory,
  MaterialOverview,
  MaterialRole,
  MaterialStatus,
  MaterialUnit,
  MaterialWorkspace,
  WorkMaterialStatus,
} from "@/lib/materials";

type ApiPayload = {
  overview?: MaterialOverview;
  material?: { id: string };
  assignment?: { id: string };
  error?: string;
};

type MaterialFilter = "active" | "all" | "approved" | "attention";

const categories: Array<{
  value: MaterialCategory;
  label: string;
  english: string;
}> = [
  { value: "fabric", label: "梭织面料", english: "FABRIC" },
  { value: "knit", label: "针织材料", english: "KNIT" },
  { value: "leather", label: "皮革", english: "LEATHER" },
  { value: "lining", label: "里料", english: "LINING" },
  { value: "trim", label: "辅料", english: "TRIM" },
  { value: "hardware", label: "五金", english: "HARDWARE" },
  { value: "embellishment", label: "装饰材料", english: "EMBELLISHMENT" },
  { value: "other", label: "其他", english: "OTHER" },
];

const materialStatuses: Array<{
  value: MaterialStatus;
  label: string;
  english: string;
}> = [
  { value: "research", label: "研究中", english: "RESEARCH" },
  { value: "sampling", label: "打样中", english: "SAMPLING" },
  { value: "approved", label: "已批准", english: "APPROVED" },
  { value: "hold", label: "暂缓", english: "HOLD" },
  { value: "archived", label: "已归档", english: "ARCHIVED" },
];

const materialRoles: Array<{
  value: MaterialRole;
  label: string;
}> = [
  { value: "shell", label: "主料 / 面料" },
  { value: "lining", label: "里料" },
  { value: "interlining", label: "衬料" },
  { value: "trim", label: "辅料" },
  { value: "hardware", label: "五金" },
  { value: "embellishment", label: "装饰" },
  { value: "label", label: "标牌" },
  { value: "other", label: "其他" },
];

const units: Array<{ value: MaterialUnit; label: string }> = [
  { value: "m", label: "米 / M" },
  { value: "yd", label: "码 / YD" },
  { value: "pcs", label: "件 / PCS" },
  { value: "g", label: "克 / G" },
  { value: "set", label: "套 / SET" },
  { value: "other", label: "其他" },
];

const emptyCreateForm = {
  name: "",
  category: "fabric" as MaterialCategory,
  status: "research" as MaterialStatus,
  composition: "",
  construction: "",
  colorName: "",
  colorCode: "",
  supplierName: "",
  supplierReference: "",
  origin: "",
  weight: "",
  width: "",
  handFeel: "",
  finish: "",
  certifications: "",
  swatchAltText: "",
  notes: "",
};

const emptyAssignmentForm = {
  workId: "",
  role: "shell" as MaterialRole,
  status: "proposed" as WorkMaterialStatus,
  placement: "",
  colorway: "",
  consumption: "",
  unit: "m" as MaterialUnit,
  notes: "",
  sortOrder: "0",
};

type MaterialEditForm = ReturnType<typeof materialEditForm>;

export default function MaterialRoom() {
  const [overview, setOverview] = useState<MaterialOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<MaterialFilter>("active");
  const [query, setQuery] = useState("");
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [createImage, setCreateImage] = useState<File | null>(null);
  const [assignmentForm, setAssignmentForm] =
    useState(emptyAssignmentForm);
  const [editForm, setEditForm] = useState<MaterialEditForm | null>(null);
  const [replacementImage, setReplacementImage] = useState<File | null>(
    null,
  );
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [savingAssignmentId, setSavingAssignmentId] = useState<
    string | null
  >(null);
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
        const first = next.materials[0] ?? null;
        setSelectedId(first?.material.id ?? null);
        setEditForm(first ? materialEditForm(first) : null);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "无法读取材料室。",
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

  const visibleMaterials = useMemo(() => {
    if (!overview) return [];
    const needle = query.trim().toLocaleLowerCase();
    return overview.materials.filter((workspace) => {
      const material = workspace.material;
      if (filter === "active" && material.status === "archived") return false;
      if (filter === "approved" && material.status !== "approved") {
        return false;
      }
      if (
        filter === "attention" &&
        workspace.summary.missingFields.length === 0 &&
        !workspace.assignments.some(
          ({ assignment }) =>
            ["selected", "approved"].includes(assignment.status) &&
            material.status !== "approved",
        )
      ) {
        return false;
      }
      if (!needle) return true;
      return [
        material.materialCode,
        material.name,
        material.composition,
        material.colorName,
        material.colorCode,
        material.supplierName,
        material.supplierReference,
        material.notes,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [filter, overview, query]);

  const selected = useMemo(
    () =>
      overview?.materials.find(
        (workspace) => workspace.material.id === selectedId,
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
        next.materials.find(
          (workspace) => workspace.material.id === preferredId,
        ) ??
        next.materials[0] ??
        null;
      setSelectedId(nextSelected?.material.id ?? null);
      setEditForm(nextSelected ? materialEditForm(nextSelected) : null);
      window.dispatchEvent(new CustomEvent("nera:material-updated"));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "无法刷新材料室。",
      );
    }
  }

  function selectMaterial(workspace: MaterialWorkspace) {
    setSelectedId(workspace.material.id);
    setEditForm(materialEditForm(workspace));
    setAssignmentForm(emptyAssignmentForm);
    setReplacementImage(null);
    if (replacementImageRef.current) {
      replacementImageRef.current.value = "";
    }
    setError("");
    setMessage("");
  }

  async function createMaterial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!createForm.name.trim()) {
      setError("请填写材料名称。");
      return;
    }
    if (createImage) {
      const imageError = validateImage(createImage);
      if (imageError) {
        setError(imageError);
        return;
      }
    }
    setCreating(true);
    try {
      const body = new FormData();
      Object.entries(createForm).forEach(([key, value]) =>
        body.set(key, value),
      );
      if (createImage) body.set("swatchImage", createImage);
      const response = await fetch("/api/studio/materials", {
        method: "POST",
        body,
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.material) {
        throw new Error(payload.error || "建立材料档案失败。");
      }
      setCreateForm(emptyCreateForm);
      setCreateImage(null);
      if (createImageRef.current) createImageRef.current.value = "";
      await refresh(
        "材料档案已建立；是否采用仍由设计师人工决定。",
        payload.material.id,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "建立材料档案失败。",
      );
    } finally {
      setCreating(false);
    }
  }

  async function saveMaterial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !editForm) return;
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const response = await fetch(
        `/api/studio/materials/${encodeURIComponent(selected.material.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(editForm),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.material) {
        throw new Error(payload.error || "保存材料档案失败。");
      }
      await refresh("材料规格与状态已保存。", selected.material.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "保存材料档案失败。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function replaceSwatch() {
    if (!selected || !replacementImage) return;
    setError("");
    setMessage("");
    const imageError = validateImage(replacementImage);
    if (imageError) {
      setError(imageError);
      return;
    }
    setReplacing(true);
    try {
      const body = new FormData();
      body.set("image", replacementImage);
      body.set(
        "altText",
        editForm?.swatchAltText || `${selected.material.name} 材料色卡`,
      );
      const response = await fetch(
        `/api/studio/materials/${encodeURIComponent(selected.material.id)}/image`,
        { method: "POST", body },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.material) {
        throw new Error(payload.error || "替换材料色卡失败。");
      }
      setReplacementImage(null);
      if (replacementImageRef.current) {
        replacementImageRef.current.value = "";
      }
      await refresh("材料色卡已更新并写入图片存储。", selected.material.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "替换材料色卡失败。",
      );
    } finally {
      setReplacing(false);
    }
  }

  async function createAssignment(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!selected) return;
    setError("");
    setMessage("");
    if (!assignmentForm.workId) {
      setError("请选择需要使用该材料的 Look。");
      return;
    }
    setSavingAssignmentId("new");
    try {
      const response = await fetch("/api/studio/materials/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...assignmentForm,
          materialId: selected.material.id,
        }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.assignment) {
        throw new Error(payload.error || "加入 Look 用料失败。");
      }
      setAssignmentForm(emptyAssignmentForm);
      await refresh("材料已加入 Look 用料表。", selected.material.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "加入 Look 用料失败。",
      );
    } finally {
      setSavingAssignmentId(null);
    }
  }

  async function changeAssignmentStatus(
    assignmentId: string,
    status: WorkMaterialStatus,
  ) {
    if (!selected) return;
    setError("");
    setMessage("");
    setSavingAssignmentId(assignmentId);
    try {
      const response = await fetch(
        `/api/studio/materials/assignments/${encodeURIComponent(assignmentId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.assignment) {
        throw new Error(payload.error || "更新 Look 用料失败。");
      }
      await refresh("Look 用料状态已更新。", selected.material.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "更新 Look 用料失败。",
      );
    } finally {
      setSavingAssignmentId(null);
    }
  }

  if (loading) {
    return (
      <section className="studio-material-room is-loading">
        <span>20</span>
        <p>正在打开 Material Room…</p>
      </section>
    );
  }

  if (!overview) {
    return (
      <section className="studio-material-room is-loading is-error">
        <span>20</span>
        <p>{error || "材料室暂时不可用。"}</p>
        <button type="button" onClick={() => void refresh()}>
          重新读取
        </button>
      </section>
    );
  }

  return (
    <section
      className="studio-material-room"
      id="material-room"
      aria-labelledby="material-room-title"
    >
      <header className="studio-material-hero">
        <span aria-hidden="true">20</span>
        <div>
          <small>PHASE 20 / MATERIAL ROOM</small>
          <h2 id="material-room-title">
            TOUCH.
            <i>TEST.</i>
            COMPOSE.
          </h2>
          <p>
            将触感、成分、颜色与来源从灵感碎片变成可复用的材料档案，
            再把每一块面料与辅料准确编入 Look。
          </p>
        </div>
        <aside>
          <span>LIVE MATERIAL LIBRARY</span>
          <strong>
            {overview.metrics.approvedCount.toString().padStart(2, "0")}
          </strong>
          <p>
            项材料已经人工批准
            <small>
              {overview.metrics.samplingCount} SAMPLING /{" "}
              {overview.metrics.selectedPendingApprovalCount} CONFLICT
            </small>
          </p>
          <nav aria-label="导出材料数据">
            <a href="/api/studio/materials?format=materials" download>
              MATERIALS CSV
            </a>
            <a href="/api/studio/materials?format=bom" download>
              LOOK BOM CSV
            </a>
            <a href="/api/studio/materials?format=json" download>
              FULL JSON
            </a>
          </nav>
        </aside>
      </header>

      <div className="studio-material-principles">
        <span>MATERIAL PROTOCOL</span>
        <p>先记录物性，再讨论用途</p>
        <b>01</b>
        <p>材料批准与 Look 采用分开</p>
        <b>02</b>
        <p>色卡与来源保持可迁移</p>
        <b>03</b>
        <small>NO AUTO-SELECTION · DESIGNER OWNS THE MATERIAL DECISION</small>
      </div>

      {(error || message) && (
        <div
          className={`studio-material-notice${error ? " is-error" : ""}`}
          role="status"
        >
          {error || message}
        </div>
      )}

      <div className="studio-material-metrics">
        <MaterialMetric
          index="01"
          value={overview.metrics.materialCount}
          label="材料档案"
          detail={`${overview.metrics.approvedCount} 项已批准`}
        />
        <MaterialMetric
          index="02"
          value={overview.metrics.activeBomCount}
          label="Look 用料"
          detail="提议、选定与批准中的关系"
        />
        <MaterialMetric
          index="03"
          value={overview.metrics.missingSwatchCount}
          label="缺少色卡"
          detail="尚未上传材料视觉证据"
          attention={overview.metrics.missingSwatchCount > 0}
        />
        <MaterialMetric
          index="04"
          value={overview.metrics.selectedPendingApprovalCount}
          label="批准冲突"
          detail="Look 已选定、材料尚未批准"
          attention={overview.metrics.selectedPendingApprovalCount > 0}
        />
      </div>

      <section className="studio-material-create">
        <header>
          <small>01 / REGISTER A MATERIAL</small>
          <h3>先建立一块材料的身份。</h3>
          <p>
            色卡可以稍后补充；成分、颜色与供应方会被纳入完整度检查，
            但不会触发自动批准。
          </p>
        </header>
        <form onSubmit={createMaterial}>
          <div className="studio-material-create-fields">
            <label className="is-wide">
              <span>材料名称 *</span>
              <input
                required
                maxLength={240}
                value={createForm.name}
                placeholder="例如：双面羊毛斜纹"
                onChange={(event) =>
                  setCreateForm({ ...createForm, name: event.target.value })
                }
              />
            </label>
            <label>
              <span>类别</span>
              <select
                value={createForm.category}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    category: event.target.value as MaterialCategory,
                  })
                }
              >
                {categories.map((item) => (
                  <option value={item.value} key={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>状态</span>
              <select
                value={createForm.status}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    status: event.target.value as MaterialStatus,
                  })
                }
              >
                {materialStatuses.map((item) => (
                  <option value={item.value} key={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>成分</span>
              <input
                maxLength={500}
                value={createForm.composition}
                placeholder="羊毛 92% / 锦纶 8%"
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    composition: event.target.value,
                  })
                }
              />
            </label>
            <label>
              <span>组织 / 结构</span>
              <input
                maxLength={500}
                value={createForm.construction}
                placeholder="双面斜纹 / 2×2"
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    construction: event.target.value,
                  })
                }
              />
            </label>
            <label>
              <span>颜色名称</span>
              <input
                maxLength={160}
                value={createForm.colorName}
                placeholder="氧化黑"
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    colorName: event.target.value,
                  })
                }
              />
            </label>
            <label>
              <span>色号 / 标准</span>
              <input
                maxLength={120}
                value={createForm.colorCode}
                placeholder="#171717 / PANTONE"
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    colorCode: event.target.value,
                  })
                }
              />
            </label>
            <label>
              <span>供应方</span>
              <input
                maxLength={240}
                value={createForm.supplierName}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    supplierName: event.target.value,
                  })
                }
              />
            </label>
            <label>
              <span>供应方编号</span>
              <input
                maxLength={180}
                value={createForm.supplierReference}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    supplierReference: event.target.value,
                  })
                }
              />
            </label>
            <label>
              <span>产地</span>
              <input
                maxLength={180}
                value={createForm.origin}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    origin: event.target.value,
                  })
                }
              />
            </label>
            <label>
              <span>克重</span>
              <input
                maxLength={120}
                value={createForm.weight}
                placeholder="420 GSM"
                onChange={(event) =>
                  setCreateForm({ ...createForm, weight: event.target.value })
                }
              />
            </label>
            <label>
              <span>幅宽</span>
              <input
                maxLength={120}
                value={createForm.width}
                placeholder="150 CM"
                onChange={(event) =>
                  setCreateForm({ ...createForm, width: event.target.value })
                }
              />
            </label>
            <label className="is-wide">
              <span>手感 / 垂坠</span>
              <input
                maxLength={500}
                value={createForm.handFeel}
                placeholder="表面干燥，横向有支撑，垂坠缓慢"
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    handFeel: event.target.value,
                  })
                }
              />
            </label>
            <label className="is-wide">
              <span>材料备注</span>
              <textarea
                rows={3}
                maxLength={4000}
                value={createForm.notes}
                placeholder="记录适用廓形、测试限制、不可替代的视觉或触感特征。"
                onChange={(event) =>
                  setCreateForm({ ...createForm, notes: event.target.value })
                }
              />
            </label>
          </div>

          <label
            className={`studio-material-upload${createPreview ? " has-image" : ""}`}
          >
            <input
              ref={createImageRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) =>
                setCreateImage(event.target.files?.[0] ?? null)
              }
            />
            {createPreview ? (
              <span
                role="img"
                aria-label="待上传材料色卡预览"
                style={{ backgroundImage: `url("${createPreview}")` }}
              />
            ) : (
              <span aria-hidden="true">+</span>
            )}
            <strong>{createImage ? createImage.name : "上传材料色卡"}</strong>
            <small>JPEG / PNG / WEBP · MAX 15MB</small>
          </label>

          <button type="submit" disabled={creating}>
            {creating ? "正在建立材料档案…" : "建立材料档案 →"}
          </button>
        </form>
      </section>

      <div className="studio-material-workbench">
        <aside className="studio-material-index">
          <header>
            <div>
              <small>02 / MATERIAL INDEX</small>
              <h3>材料索引</h3>
            </div>
            <strong>{visibleMaterials.length.toString().padStart(2, "0")}</strong>
          </header>
          <div className="studio-material-filters">
            {(["active", "all", "approved", "attention"] as MaterialFilter[]).map(
              (value) => (
                <button
                  type="button"
                  className={filter === value ? "is-active" : ""}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  key={value}
                >
                  {filterLabel(value)}
                </button>
              ),
            )}
            <input
              type="search"
              value={query}
              placeholder="材料 / 成分 / 色号 / 供应方"
              aria-label="搜索材料"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="studio-material-list">
            {visibleMaterials.length === 0 ? (
              <p>当前筛选下没有材料。</p>
            ) : (
              visibleMaterials.map((workspace) => (
                <button
                  type="button"
                  className={
                    workspace.material.id === selectedId ? "is-active" : ""
                  }
                  onClick={() => selectMaterial(workspace)}
                  key={workspace.material.id}
                >
                  <MaterialSwatch workspace={workspace} />
                  <div>
                    <span>{workspace.material.materialCode}</span>
                    <b className={`is-${workspace.material.status}`}>
                      {materialStatusLabel(workspace.material.status)}
                    </b>
                    <strong>{workspace.material.name}</strong>
                    <small>
                      {[
                        workspace.material.colorName,
                        workspace.material.composition,
                      ]
                        .filter(Boolean)
                        .join(" · ") || categoryLabel(workspace.material.category)}
                    </small>
                    <i>
                      {workspace.summary.activeUsageCount} LOOK USE /{" "}
                      {workspace.summary.completeness}%
                    </i>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="studio-material-dossier">
          {!selected || !editForm ? (
            <div className="studio-material-empty">
              <span>□</span>
              <h3>建立第一块材料档案。</h3>
              <p>上传色卡，记录物性，再编入 Look。</p>
            </div>
          ) : (
            <>
              <header>
                <MaterialSwatch workspace={selected} large />
                <div>
                  <small>
                    {selected.material.materialCode} /{" "}
                    {categoryEnglish(selected.material.category)}
                  </small>
                  <h3>{selected.material.name}</h3>
                  <p>
                    {[
                      selected.material.colorName,
                      selected.material.colorCode,
                      selected.material.composition,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "等待补充材料规格"}
                  </p>
                </div>
                <aside>
                  <span>{selected.summary.completeness}%</span>
                  <small>SPEC COMPLETENESS</small>
                  {selected.summary.missingFields.length > 0 && (
                    <p>{selected.summary.missingFields.join(" / ")}</p>
                  )}
                </aside>
              </header>

              <form className="studio-material-editor" onSubmit={saveMaterial}>
                <div className="studio-material-editor-grid">
                  <label className="is-wide">
                    <span>材料名称 *</span>
                    <input
                      required
                      maxLength={240}
                      value={editForm.name}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          name: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>类别</span>
                    <select
                      value={editForm.category}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          category: event.target.value as MaterialCategory,
                        })
                      }
                    >
                      {categories.map((item) => (
                        <option value={item.value} key={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>材料状态</span>
                    <select
                      value={editForm.status}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          status: event.target.value as MaterialStatus,
                        })
                      }
                    >
                      {materialStatuses.map((item) => (
                        <option value={item.value} key={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>成分</span>
                    <input
                      maxLength={500}
                      value={editForm.composition}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          composition: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>组织 / 结构</span>
                    <input
                      maxLength={500}
                      value={editForm.construction}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          construction: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>颜色名称</span>
                    <input
                      maxLength={160}
                      value={editForm.colorName}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          colorName: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>色号 / 标准</span>
                    <input
                      maxLength={120}
                      value={editForm.colorCode}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          colorCode: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>供应方</span>
                    <input
                      maxLength={240}
                      value={editForm.supplierName}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          supplierName: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>供应方编号</span>
                    <input
                      maxLength={180}
                      value={editForm.supplierReference}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          supplierReference: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>产地</span>
                    <input
                      maxLength={180}
                      value={editForm.origin}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          origin: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>克重</span>
                    <input
                      maxLength={120}
                      value={editForm.weight}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          weight: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>幅宽</span>
                    <input
                      maxLength={120}
                      value={editForm.width}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          width: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="is-wide">
                    <span>手感 / 垂坠</span>
                    <input
                      maxLength={500}
                      value={editForm.handFeel}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          handFeel: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="is-wide">
                    <span>后整理</span>
                    <input
                      maxLength={500}
                      value={editForm.finish}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          finish: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="is-wide">
                    <span>认证 / 依据</span>
                    <input
                      maxLength={800}
                      value={editForm.certifications}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          certifications: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="is-wide">
                    <span>色卡图片描述</span>
                    <input
                      maxLength={240}
                      value={editForm.swatchAltText}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          swatchAltText: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="is-wide">
                    <span>材料备注</span>
                    <textarea
                      rows={4}
                      maxLength={4000}
                      value={editForm.notes}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          notes: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                <div className="studio-material-image-replace">
                  <div
                    role="img"
                    aria-label={
                      replacementImage
                        ? "待替换色卡预览"
                        : selected.material.swatchAltText ||
                          `${selected.material.name} 材料色卡`
                    }
                    style={
                      replacementPreview
                        ? { backgroundImage: `url("${replacementPreview}")` }
                        : selected.imageUrl
                          ? {
                              backgroundImage: `url("${selected.imageUrl}")`,
                            }
                          : colorStyle(selected.material.colorCode)
                    }
                  />
                  <label>
                    <span>替换色卡图片</span>
                    <input
                      ref={replacementImageRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) =>
                        setReplacementImage(event.target.files?.[0] ?? null)
                      }
                    />
                    <small>
                      {replacementImage
                        ? replacementImage.name
                        : "选择 JPEG / PNG / WEBP"}
                    </small>
                  </label>
                  <button
                    type="button"
                    disabled={!replacementImage || replacing}
                    onClick={() => void replaceSwatch()}
                  >
                    {replacing ? "正在写入图片…" : "确认替换"}
                  </button>
                </div>

                <button
                  className="studio-material-save"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "正在保存材料…" : "保存材料档案 →"}
                </button>
              </form>

              <section className="studio-material-bom">
                <header>
                  <div>
                    <small>03 / LOOK MATERIAL MAP</small>
                    <h4>Look 用料表</h4>
                  </div>
                  <span>
                    {selected.summary.activeUsageCount} ACTIVE /{" "}
                    {selected.summary.approvedUsageCount} APPROVED
                  </span>
                </header>
                <form onSubmit={createAssignment}>
                  <label className="is-wide">
                    <span>关联 Look *</span>
                    <select
                      required
                      value={assignmentForm.workId}
                      onChange={(event) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          workId: event.target.value,
                        })
                      }
                    >
                      <option value="">选择作品</option>
                      {overview.references.works.map((work) => (
                        <option value={work.id} key={work.id}>
                          {work.lookNumber || "—"} / {work.title} /{" "}
                          {work.collection}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>用途</span>
                    <select
                      value={assignmentForm.role}
                      onChange={(event) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          role: event.target.value as MaterialRole,
                        })
                      }
                    >
                      {materialRoles.map((item) => (
                        <option value={item.value} key={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>初始状态</span>
                    <select
                      value={assignmentForm.status}
                      onChange={(event) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          status: event.target.value as WorkMaterialStatus,
                        })
                      }
                    >
                      <option value="proposed">提议</option>
                      <option value="selected">选定</option>
                    </select>
                  </label>
                  <label>
                    <span>使用部位</span>
                    <input
                      maxLength={240}
                      value={assignmentForm.placement}
                      placeholder="前身 / 衣领 / 袖口"
                      onChange={(event) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          placement: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Look 色彩</span>
                    <input
                      maxLength={180}
                      value={assignmentForm.colorway}
                      onChange={(event) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          colorway: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>单件用量</span>
                    <input
                      maxLength={120}
                      value={assignmentForm.consumption}
                      placeholder="1.80"
                      onChange={(event) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          consumption: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>单位</span>
                    <select
                      value={assignmentForm.unit}
                      onChange={(event) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          unit: event.target.value as MaterialUnit,
                        })
                      }
                    >
                      {units.map((item) => (
                        <option value={item.value} key={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="is-wide">
                    <span>用料说明</span>
                    <textarea
                      rows={2}
                      maxLength={2000}
                      value={assignmentForm.notes}
                      onChange={(event) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          notes: event.target.value,
                        })
                      }
                    />
                  </label>
                  <button type="submit" disabled={savingAssignmentId === "new"}>
                    {savingAssignmentId === "new"
                      ? "正在加入…"
                      : "加入 Look 用料 +"}
                  </button>
                </form>

                <div className="studio-material-bom-list">
                  {selected.assignments.length === 0 ? (
                    <p>这块材料尚未编入任何 Look。</p>
                  ) : (
                    selected.assignments.map(({ assignment, work }, index) => (
                      <article
                        className={`is-${assignment.status}`}
                        key={assignment.id}
                      >
                        <span>{(index + 1).toString().padStart(2, "0")}</span>
                        <div
                          className="studio-material-work-thumb"
                          role="img"
                          aria-label={work?.title || "关联 Look"}
                          style={
                            work?.imageUrl
                              ? {
                                  backgroundImage: `url("${work.imageUrl}")`,
                                }
                              : undefined
                          }
                        />
                        <div>
                          <small>
                            {roleLabel(assignment.role)} /{" "}
                            {assignmentStatusLabel(assignment.status)}
                          </small>
                          <strong>{work?.title || "已移除的 Look"}</strong>
                          <p>
                            {[
                              work?.lookNumber,
                              assignment.placement,
                              assignment.colorway,
                              assignment.consumption
                                ? `${assignment.consumption} ${assignment.unit}`
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" · ") || "等待补充用料说明"}
                          </p>
                        </div>
                        <nav aria-label={`更新用料：${work?.title || "Look"}`}>
                          <button
                            type="button"
                            className={
                              assignment.status === "selected"
                                ? "is-active"
                                : ""
                            }
                            disabled={
                              savingAssignmentId === assignment.id ||
                              assignment.status === "dropped"
                            }
                            onClick={() =>
                              void changeAssignmentStatus(
                                assignment.id,
                                "selected",
                              )
                            }
                          >
                            选定
                          </button>
                          <button
                            type="button"
                            className={
                              assignment.status === "approved"
                                ? "is-active"
                                : ""
                            }
                            disabled={
                              savingAssignmentId === assignment.id ||
                              assignment.status === "dropped" ||
                              selected.material.status !== "approved"
                            }
                            onClick={() =>
                              void changeAssignmentStatus(
                                assignment.id,
                                "approved",
                              )
                            }
                          >
                            批准
                          </button>
                          <button
                            type="button"
                            className="is-drop"
                            disabled={
                              savingAssignmentId === assignment.id ||
                              assignment.status === "dropped"
                            }
                            onClick={() =>
                              void changeAssignmentStatus(
                                assignment.id,
                                "dropped",
                              )
                            }
                          >
                            移出
                          </button>
                        </nav>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </section>
      </div>
    </section>
  );
}

function MaterialMetric(props: {
  index: string;
  value: number | string;
  label: string;
  detail: string;
  attention?: boolean;
}) {
  return (
    <article className={props.attention ? "is-attention" : ""}>
      <span>{props.index}</span>
      <strong>{props.value}</strong>
      <h3>{props.label}</h3>
      <p>{props.detail}</p>
    </article>
  );
}

function MaterialSwatch(props: {
  workspace: MaterialWorkspace;
  large?: boolean;
}) {
  return (
    <span
      className={`studio-material-swatch${props.large ? " is-large" : ""}`}
      role="img"
      aria-label={
        props.workspace.material.swatchAltText ||
        `${props.workspace.material.name} 材料色卡`
      }
      style={
        props.workspace.imageUrl
          ? {
              backgroundImage: `url("${props.workspace.imageUrl}")`,
            }
          : colorStyle(props.workspace.material.colorCode)
      }
    >
      {!props.workspace.imageUrl && (
        <small>{props.workspace.material.colorCode || "NO SWATCH"}</small>
      )}
    </span>
  );
}

function materialEditForm(workspace: MaterialWorkspace) {
  return {
    name: workspace.material.name,
    category: workspace.material.category as MaterialCategory,
    status: workspace.material.status as MaterialStatus,
    composition: workspace.material.composition,
    construction: workspace.material.construction,
    colorName: workspace.material.colorName,
    colorCode: workspace.material.colorCode,
    supplierName: workspace.material.supplierName,
    supplierReference: workspace.material.supplierReference,
    origin: workspace.material.origin,
    weight: workspace.material.weight,
    width: workspace.material.width,
    handFeel: workspace.material.handFeel,
    finish: workspace.material.finish,
    certifications: workspace.material.certifications,
    swatchAltText: workspace.material.swatchAltText,
    notes: workspace.material.notes,
  };
}

async function requestOverview(): Promise<MaterialOverview> {
  const response = await fetch("/api/studio/materials", {
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok || !payload.overview) {
    throw new Error(payload.error || "无法读取材料室。");
  }
  return payload.overview;
}

function validateImage(file: File): string | null {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    return "请选择 JPEG、PNG 或 WebP 图片。";
  }
  if (file.size <= 0 || file.size > 15 * 1024 * 1024) {
    return "图片大小必须在 15MB 以内。";
  }
  return null;
}

function colorStyle(value: string): React.CSSProperties | undefined {
  return /^#[0-9a-f]{3,8}$/i.test(value.trim())
    ? { backgroundColor: value.trim() }
    : undefined;
}

function filterLabel(value: MaterialFilter): string {
  return value === "active"
    ? "使用中"
    : value === "approved"
      ? "已批准"
      : value === "attention"
        ? "需补充"
        : "全部";
}

function categoryLabel(value: string): string {
  return categories.find((item) => item.value === value)?.label ?? value;
}

function categoryEnglish(value: string): string {
  return categories.find((item) => item.value === value)?.english ?? value;
}

function materialStatusLabel(value: string): string {
  return (
    materialStatuses.find((item) => item.value === value)?.label ?? value
  );
}

function roleLabel(value: string): string {
  return materialRoles.find((item) => item.value === value)?.label ?? value;
}

function assignmentStatusLabel(value: string): string {
  return value === "proposed"
    ? "提议"
    : value === "selected"
      ? "选定"
      : value === "approved"
        ? "批准"
        : "移出";
}
