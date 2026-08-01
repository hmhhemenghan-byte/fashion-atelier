"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppointmentInbox from "./appointment-inbox";
import CollectionManager from "./collection-manager";
import CoverageBook from "./coverage-book";
import DesignReviewBoard from "./design-review-board";
import ArchiveHandoff from "./archive-handoff";
import EditorialCalendar from "./editorial-calendar";
import EditorialOperations from "./editorial-operations";
import GalleryManager from "./gallery-manager";
import MaterialRoom from "./material-room";
import TechnicalAtelier from "./technical-atelier";
import FittingRoom from "./fitting-room";
import FinalSampleGate from "./final-sample-gate";
import ProductionReleaseDesk from "./production-release-desk";
import ProductionChangeControl from "./production-change-control";
import OutreachDesk from "./outreach-desk";
import ProcessDossierManager from "./process-dossier-manager";
import PublicationManager from "./publication-manager";
import RelationshipIntelligence from "./relationship-intelligence";
import SampleCorrespondence from "./sample-correspondence";
import SampleFulfilment from "./sample-fulfilment";
import SampleInventoryAudit from "./sample-inventory-audit";
import SampleImpact from "./sample-impact";
import SamplePerformance from "./sample-performance";
import SeasonCommand from "./season-command";
import ShowroomManager from "./showroom-manager";

type Work = {
  id: string;
  title: string;
  collection: string;
  lookNumber: string;
  description: string;
  altText: string;
  imageKey: string;
  imageType: string;
  imageSize: number;
  status: "draft" | "published";
  sortOrder: number;
  createdAt: string;
  publishedAt: string | null;
};

type ApiPayload = { work?: Work; works?: Work[]; error?: string };
type StatusFilter = "all" | Work["status"];

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_BATCH_FILES = 20;

const emptyForm = {
  title: "",
  collection: "SECOND SKIN / AW 2027",
  lookNumber: "",
  description: "",
  altText: "",
  sortOrder: "0",
};

const filters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "draft", label: "草稿" },
  { value: "published", label: "已发布" },
];

export default function StudioClient() {
  const [works, setWorks] = useState<Work[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [replacementProgress, setReplacementProgress] = useState(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const replacementInputRef = useRef<HTMLInputElement>(null);

  const previewUrl = useMemo(
    () => (files[0] ? URL.createObjectURL(files[0]) : ""),
    [files],
  );
  const isBatch = files.length > 1;
  const visibleWorks = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return works.filter((work) => {
      if (filter !== "all" && work.status !== filter) return false;
      if (!needle) return true;
      return [work.title, work.collection, work.lookNumber, work.description]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [filter, query, works]);

  const statusCounts = useMemo(
    () => ({
      all: works.length,
      draft: works.filter((work) => work.status === "draft").length,
      published: works.filter((work) => work.status === "published").length,
    }),
    [works],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    let cancelled = false;
    async function loadWorks() {
      try {
        const response = await fetch("/api/studio/works", { cache: "no-store" });
        const payload = (await response.json()) as ApiPayload;
        if (!response.ok) throw new Error(payload.error || "无法读取作品列表。");
        if (!cancelled) setWorks(sortWorks(payload.works ?? []));
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "无法读取作品列表。");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadWorks();
    return () => {
      cancelled = true;
    };
  }, []);

  function selectFiles(nextFiles: File[]) {
    setError("");
    setMessage("");
    if (nextFiles.length === 0) {
      setFiles([]);
      return;
    }

    const accepted: File[] = [];
    const rejected: string[] = [];
    nextFiles.slice(0, MAX_BATCH_FILES).forEach((nextFile) => {
      const validationError = validateClientImage(nextFile);
      if (validationError) rejected.push(`${nextFile.name}：${validationError}`);
      else accepted.push(nextFile);
    });

    if (nextFiles.length > MAX_BATCH_FILES) {
      rejected.push(`一次最多上传 ${MAX_BATCH_FILES} 张图片。`);
    }
    setFiles(accepted);
    if (rejected.length > 0) setError(rejected.slice(0, 3).join(" "));

    if (accepted.length === 1 && !form.altText) {
      setForm((current) => ({ ...current, altText: fileTitle(accepted[0].name) }));
    }
  }

  function removeQueuedFile(index: number) {
    setFiles((current) => {
      const next = current.filter((_, currentIndex) => currentIndex !== index);
      if (next.length === 0 && inputRef.current) inputRef.current.value = "";
      return next;
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (files.length === 0) return setError("请先选择至少一张作品图片。");
    if (!isBatch && (!form.title.trim() || !form.altText.trim())) {
      return setError("作品名称和图片描述为必填项。");
    }

    setUploading(true);
    setProgress(0);
    const uploaded: Work[] = [];
    const failed: { file: File; originalIndex: number }[] = [];
    const failureMessages: string[] = [];
    const baseSortOrder = Number.parseInt(form.sortOrder, 10) || 0;

    for (let index = 0; index < files.length; index += 1) {
      const currentFile = files[index];
      const body = new FormData();
      const title = isBatch ? fileTitle(currentFile.name) : form.title;
      body.append("title", title);
      body.append("collection", form.collection);
      body.append("lookNumber", isBatch ? "" : form.lookNumber);
      body.append("description", isBatch ? "" : form.description);
      body.append("altText", isBatch ? title : form.altText);
      body.append("sortOrder", String(isBatch ? baseSortOrder + index : baseSortOrder));
      body.append("image", currentFile);

      try {
        const payload = await uploadWithProgress(body, (fileProgress) => {
          setProgress(Math.round(((index + fileProgress / 100) / files.length) * 100));
        });
        if (!payload.work) throw new Error(payload.error || "上传失败。");
        uploaded.push(payload.work);
      } catch (cause) {
        failed.push({ file: currentFile, originalIndex: index });
        failureMessages.push(
          `${currentFile.name}：${cause instanceof Error ? cause.message : "上传失败"}`,
        );
      }
    }

    if (uploaded.length > 0) {
      setWorks((current) => sortWorks([...uploaded, ...current]));
    }

    if (failed.length === 0) {
      setForm(emptyForm);
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
      setMessage(
        uploaded.length > 1
          ? `已上传 ${uploaded.length} 件草稿，可逐件补充资料后发布。`
          : "作品已保存为草稿，可在右侧预览后发布。",
      );
    } else {
      setFiles(failed.map((item) => item.file));
      if (failed.length === 1) {
        const retryTitle = fileTitle(failed[0].file.name);
        setForm((current) => ({
          ...current,
          title: retryTitle,
          altText: retryTitle,
          sortOrder: String(baseSortOrder + failed[0].originalIndex),
        }));
      }
      setProgress(0);
      setError(
        `${uploaded.length > 0 ? `已上传 ${uploaded.length} 件；` : ""}${failed.length} 件失败。${failureMessages[0]}`,
      );
    }
    setUploading(false);
  }

  async function changeStatus(work: Work) {
    setError("");
    setMessage("");
    const nextStatus = work.status === "published" ? "draft" : "published";
    try {
      const response = await fetch(`/api/studio/works/${encodeURIComponent(work.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.work) {
        throw new Error(payload.error || "状态更新失败。");
      }
      setWorks((current) =>
        sortWorks(current.map((item) => (item.id === work.id ? (payload.work as Work) : item))),
      );
      setMessage(nextStatus === "published" ? "作品已发布到前台。" : "作品已转为草稿。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "状态更新失败。");
    }
  }

  function beginEdit(work: Work) {
    if (editingId === work.id) {
      setEditingId(null);
      setReplacementFile(null);
      return;
    }
    setError("");
    setMessage("");
    setDeleteConfirmId(null);
    setReplacementFile(null);
    setReplacementProgress(0);
    if (replacementInputRef.current) replacementInputRef.current.value = "";
    setEditingId(work.id);
    setEditForm({
      title: work.title,
      collection: work.collection,
      lookNumber: work.lookNumber,
      description: work.description,
      altText: work.altText,
      sortOrder: String(work.sortOrder),
    });
  }

  function selectReplacementFile(nextFile: File | null) {
    setError("");
    setMessage("");
    if (!nextFile) {
      setReplacementFile(null);
      return;
    }
    const validationError = validateClientImage(nextFile);
    if (validationError) {
      setReplacementFile(null);
      setError(`${nextFile.name}：${validationError}`);
      return;
    }
    setReplacementFile(nextFile);
  }

  async function replaceImage(work: Work) {
    setError("");
    setMessage("");
    if (!replacementFile) return setError("请先选择新的作品图片。");

    const body = new FormData();
    body.append("image", replacementFile);
    setReplacingId(work.id);
    setReplacementProgress(0);
    try {
      const payload = await uploadWithProgress(
        body,
        setReplacementProgress,
        `/api/studio/works/${encodeURIComponent(work.id)}/image`,
      );
      if (!payload.work) throw new Error(payload.error || "替换图片失败。");
      setWorks((current) =>
        sortWorks(current.map((item) => (item.id === work.id ? payload.work as Work : item))),
      );
      setReplacementFile(null);
      if (replacementInputRef.current) replacementInputRef.current.value = "";
      setMessage("主图已替换；作品链接、资料与发布状态保持不变。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "替换图片失败，请重试。");
    } finally {
      setReplacingId(null);
      setReplacementProgress(0);
    }
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>, work: Work) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!editForm.title.trim() || !editForm.altText.trim()) {
      return setError("作品名称和图片描述为必填项。");
    }

    setSavingId(work.id);
    try {
      const response = await fetch(`/api/studio/works/${encodeURIComponent(work.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          sortOrder: Number.parseInt(editForm.sortOrder, 10) || 0,
        }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.work) {
        throw new Error(payload.error || "作品资料保存失败。");
      }
      setWorks((current) =>
        sortWorks(current.map((item) => (item.id === work.id ? (payload.work as Work) : item))),
      );
      setEditingId(null);
      setMessage("作品资料与展示顺序已更新。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "作品资料保存失败。");
    } finally {
      setSavingId(null);
    }
  }

  async function removeWork(work: Work) {
    if (deleteConfirmId !== work.id) {
      setDeleteConfirmId(work.id);
      return;
    }
    setError("");
    try {
      const response = await fetch(`/api/studio/works/${encodeURIComponent(work.id)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "删除失败。");
      setWorks((current) => current.filter((item) => item.id !== work.id));
      setDeleteConfirmId(null);
      setMessage("作品及其图片已删除。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除失败。");
    }
  }

  return (
    <div className="studio-workspace">
      <section className="studio-intro">
        <p className="studio-kicker">CONTENT STUDIO / 作品后台</p>
        <h1>系列。作品。<i>发布。</i></h1>
        <p>先将作品组织为完整系列，再编排 Look 顺序、预览并发布到前台。</p>
      </section>

      <SeasonCommand />
      <DesignReviewBoard />
      <MaterialRoom />
      <TechnicalAtelier />
      <FittingRoom />
      <FinalSampleGate />
      <ProductionReleaseDesk />
      <ProductionChangeControl />
      <EditorialOperations />
      <EditorialCalendar />
      <ArchiveHandoff />
      <ShowroomManager works={works} />
      <AppointmentInbox />
      <SampleFulfilment />
      <SampleCorrespondence />
      <SampleInventoryAudit />
      <SamplePerformance />
      <SampleImpact />
      <CoverageBook />
      <RelationshipIntelligence />
      <OutreachDesk />
      <CollectionManager works={works} />
      <PublicationManager />

      <div className="studio-columns">
        <form className="studio-form" id="work-upload" onSubmit={submit}>
          <div className="studio-form-title">
            <span>01</span>
            <div><strong>新增作品</strong><small>NEW WORK</small></div>
          </div>

          <label
            className={`studio-drop${dragging ? " is-dragging" : ""}${previewUrl ? " has-image" : ""}`}
            aria-disabled={uploading}
            onDragOver={(event) => {
              event.preventDefault();
              if (!uploading) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (!uploading) selectFiles(Array.from(event.dataTransfer.files));
            }}
          >
            <input
              ref={inputRef}
              type="file"
              name="image"
              multiple
              disabled={uploading}
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => selectFiles(Array.from(event.target.files ?? []))}
            />
            {previewUrl ? (
              <>
                <img src={previewUrl} alt="待上传队列中的第一张作品预览" />
                <span className="studio-drop-count">
                  {files.length === 1 ? "1 IMAGE READY" : `${files.length} IMAGES IN QUEUE`}
                </span>
              </>
            ) : (
              <div>
                <span>＋</span>
                <strong>拖入多张图片或点击选择</strong>
                <small>JPEG / PNG / WEBP · EACH MAX 15MB · UP TO 20</small>
              </div>
            )}
          </label>

          {files.length > 0 && (
            <div className="studio-upload-queue" aria-label="待上传图片队列">
              <div className="studio-queue-head">
                <strong>{files.length.toString().padStart(2, "0")} FILES</strong>
                <span>{isBatch ? "批量模式：文件名将作为作品名" : "单件模式"}</span>
              </div>
              <ol>
                {files.map((queuedFile, index) => (
                  <li key={`${queuedFile.name}-${queuedFile.size}-${queuedFile.lastModified}`}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div><strong>{queuedFile.name}</strong><small>{formatBytes(queuedFile.size)}</small></div>
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => removeQueuedFile(index)}
                      aria-label={`移除 ${queuedFile.name}`}
                    >
                      移除
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {isBatch && (
            <p className="studio-batch-note">
              <strong>BATCH MODE</strong>
              每张图片会成为独立草稿；系列沿用下方设置，排序从当前数字依次递增。上传后可逐件补充说明与造型编号。
            </p>
          )}

          <div className="studio-field-grid">
            <label className={`studio-field studio-field--wide${isBatch ? " is-disabled" : ""}`}>
              <span>作品名称 *</span>
              <input disabled={isBatch} required={!isBatch} maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={isBatch ? "批量模式自动使用文件名" : "例如：Axis / 轴线"} />
            </label>
            <label className="studio-field">
              <span>系列</span>
              <input maxLength={120} value={form.collection} onChange={(e) => setForm({ ...form, collection: e.target.value })} />
            </label>
            <label className={`studio-field${isBatch ? " is-disabled" : ""}`}>
              <span>造型编号</span>
              <input disabled={isBatch} maxLength={40} value={form.lookNumber} onChange={(e) => setForm({ ...form, lookNumber: e.target.value })} placeholder="LOOK 13" />
            </label>
            <label className={`studio-field studio-field--wide${isBatch ? " is-disabled" : ""}`}>
              <span>作品说明</span>
              <textarea disabled={isBatch} maxLength={1000} rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="设计概念、面料与廓形说明" />
            </label>
            <label className={`studio-field studio-field--wide${isBatch ? " is-disabled" : ""}`}>
              <span>图片描述（无障碍）*</span>
              <input disabled={isBatch} required={!isBatch} maxLength={240} value={form.altText} onChange={(e) => setForm({ ...form, altText: e.target.value })} placeholder={isBatch ? "批量模式先使用文件名，之后可逐件完善" : "准确描述图片中的服装与构图"} />
            </label>
            <label className="studio-field">
              <span>排序</span>
              <input type="number" min="-9999" max="9999" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
            </label>
          </div>

          {uploading && (
            <div className="studio-progress" aria-label={`上传进度 ${progress}%`}>
              <span style={{ width: `${progress}%` }} />
              <strong>{progress}%</strong>
            </div>
          )}
          <button className="studio-primary" type="submit" disabled={uploading}>
            {uploading
              ? `正在上传 ${files.length} 件…`
              : files.length > 1
                ? `批量保存 ${files.length} 件草稿`
                : "保存为草稿"}<span>→</span>
          </button>
        </form>

        <section
          className="studio-library"
          id="work-library"
          aria-labelledby="library-title"
        >
          <div className="studio-library-head">
            <div className="studio-library-title"><span>02</span><h2 id="library-title">作品库</h2></div>
            <div className="studio-library-summary">
              <strong>{works.length.toString().padStart(2, "0")} ITEMS</strong>
              <nav className="studio-export" aria-label="导出作品数据">
                <a href="/api/studio/export?format=json">导出 JSON</a>
                <a href="/api/studio/export?format=csv">导出 CSV</a>
              </nav>
            </div>
          </div>

          <div className="studio-notice" aria-live="polite">
            {error && <p className="is-error">{error}</p>}
            {message && <p>{message}</p>}
          </div>

          <div className="studio-library-tools">
            <div className="studio-filters" aria-label="作品状态筛选">
              {filters.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={filter === item.value ? "is-active" : ""}
                  aria-pressed={filter === item.value}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}<span>{statusCounts[item.value]}</span>
                </button>
              ))}
            </div>
            <label className="studio-search">
              <span>搜索作品</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="名称 / 系列 / 编号"
              />
            </label>
          </div>

          {loading ? (
            <p className="studio-empty">正在读取作品…</p>
          ) : works.length === 0 ? (
            <div className="studio-empty"><span>◇</span><p>还没有上传作品。<br />从左侧添加第一件作品。</p></div>
          ) : visibleWorks.length === 0 ? (
            <div className="studio-empty"><span>○</span><p>没有符合条件的作品。<br />试试其他关键词或状态。</p></div>
          ) : (
            <div className="studio-list">
              {visibleWorks.map((work) => (
                <article
                  className="studio-work"
                  id={`work-${work.id}`}
                  key={work.id}
                >
                  <img src={workImageUrl(work.imageKey)} alt={work.altText} />
                  <div className="studio-work-copy">
                    <div>
                      <span className={`studio-status is-${work.status}`}>
                        {work.status === "published" ? "已发布" : "草稿"}
                      </span>
                      <small>{work.lookNumber || "NO LOOK NUMBER"} · ORDER {work.sortOrder}</small>
                    </div>
                    <h3>{work.title}</h3>
                    <p>{work.collection}</p>
                    <div className="studio-work-actions">
                      <a
                        href={`/works/${encodeURIComponent(work.id)}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`预览作品：${work.title}`}
                      >
                        前台预览
                      </a>
                      <button
                        className="is-edit"
                        type="button"
                        onClick={() => beginEdit(work)}
                      >
                        {editingId === work.id ? "收起编辑" : "编辑资料"}
                      </button>
                      <button type="button" onClick={() => void changeStatus(work)}>
                        {work.status === "published" ? "撤回" : "发布"}
                      </button>
                      <button
                        className={deleteConfirmId === work.id ? "is-confirm" : ""}
                        type="button"
                        onClick={() => void removeWork(work)}
                        onBlur={() => setDeleteConfirmId(null)}
                      >
                        {deleteConfirmId === work.id ? "确认删除" : "删除"}
                      </button>
                    </div>
                  </div>
                  {editingId === work.id && (
                    <form className="studio-work-editor" onSubmit={(event) => void saveEdit(event, work)}>
                      <div className="studio-editor-head">
                        <div><span>EDIT</span><strong>编辑作品资料</strong></div>
                        <small>排序数字越小，前台显示越靠前</small>
                      </div>
                      <div className="studio-replace">
                        <div>
                          <span>REPLACE IMAGE</span>
                          <strong>替换主图，不更改作品链接</strong>
                          <small>标题、说明、排序与发布状态都会保留</small>
                        </div>
                        <label>
                          <input
                            ref={replacementInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={replacingId === work.id}
                            onChange={(event) => selectReplacementFile(event.target.files?.[0] ?? null)}
                          />
                          <span>{replacementFile ? replacementFile.name : "选择新主图"}</span>
                          {replacementFile && <small>{formatBytes(replacementFile.size)}</small>}
                        </label>
                        <button
                          type="button"
                          disabled={!replacementFile || replacingId === work.id}
                          onClick={() => void replaceImage(work)}
                        >
                          {replacingId === work.id ? `替换中 ${replacementProgress}%` : "确认替换"}
                        </button>
                        {replacingId === work.id && (
                          <div className="studio-replace-progress" aria-label={`替换图片进度 ${replacementProgress}%`}>
                            <span style={{ width: `${replacementProgress}%` }} />
                          </div>
                        )}
                      </div>
                      <ProcessDossierManager workId={work.id} />
                      <GalleryManager workId={work.id} />
                      <div className="studio-edit-grid">
                        <label className="studio-edit-field studio-edit-field--wide">
                          <span>作品名称 *</span>
                          <input required maxLength={120} value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                        </label>
                        <label className="studio-edit-field">
                          <span>系列</span>
                          <input maxLength={120} value={editForm.collection} onChange={(e) => setEditForm({ ...editForm, collection: e.target.value })} />
                        </label>
                        <label className="studio-edit-field">
                          <span>造型编号</span>
                          <input maxLength={40} value={editForm.lookNumber} onChange={(e) => setEditForm({ ...editForm, lookNumber: e.target.value })} />
                        </label>
                        <label className="studio-edit-field studio-edit-field--wide">
                          <span>作品说明</span>
                          <textarea maxLength={1000} rows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                        </label>
                        <label className="studio-edit-field studio-edit-field--wide">
                          <span>图片描述（无障碍）*</span>
                          <input required maxLength={240} value={editForm.altText} onChange={(e) => setEditForm({ ...editForm, altText: e.target.value })} />
                        </label>
                        <label className="studio-edit-field">
                          <span>展示顺序</span>
                          <input type="number" min="-9999" max="9999" value={editForm.sortOrder} onChange={(e) => setEditForm({ ...editForm, sortOrder: e.target.value })} />
                        </label>
                      </div>
                      <div className="studio-editor-actions">
                        <button type="submit" disabled={savingId === work.id || replacingId === work.id}>
                          {savingId === work.id ? "正在保存…" : "保存修改"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setReplacementFile(null);
                          }}
                        >
                          取消
                        </button>
                      </div>
                    </form>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function workImageUrl(imageKey: string) {
  return `/api/media/${imageKey.split("/").map(encodeURIComponent).join("/")}`;
}

function sortWorks(items: Work[]) {
  return [...items].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function fileTitle(name: string) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "Untitled Work"
  );
}

function validateClientImage(file: File): string | null {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    return "请选择 JPEG、PNG 或 WebP 图片。";
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return "图片大小必须在 15MB 以内。";
  }
  return null;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadWithProgress(
  body: FormData,
  onProgress: (progress: number) => void,
  endpoint = "/api/studio/works",
): Promise<ApiPayload> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", endpoint);
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      const payload = (request.response ?? {}) as ApiPayload;
      if (request.status >= 200 && request.status < 300) resolve(payload);
      else reject(new Error(payload.error || "上传失败，请重试。"));
    };
    request.onerror = () => reject(new Error("网络连接中断，请重试。"));
    request.send(body);
  });
}
