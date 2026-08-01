"use client";

import { useEffect, useRef, useState } from "react";
import {
  PROCESS_STAGES,
  type ProcessStage,
} from "@/lib/process-stages";

type ProcessEntry = {
  id: string;
  workId: string;
  stage: ProcessStage;
  title: string;
  notes: string;
  dateLabel: string;
  imageKey: string | null;
  imageType: string | null;
  imageSize: number | null;
  altText: string;
  status: "draft" | "published";
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
};

type ProcessPayload = {
  entry?: ProcessEntry;
  entries?: ProcessEntry[];
  error?: string;
};

type ProcessDraft = {
  stage: ProcessStage;
  title: string;
  notes: string;
  dateLabel: string;
  altText: string;
  status: ProcessEntry["status"];
  sortOrder: string;
};

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_PROCESS_ENTRIES = 24;
const emptyDraft: ProcessDraft = {
  stage: "research",
  title: "",
  notes: "",
  dateLabel: "",
  altText: "",
  status: "draft",
  sortOrder: "0",
};

export default function ProcessDossierManager({ workId }: { workId: string }) {
  const [entries, setEntries] = useState<ProcessEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ProcessDraft>>({});
  const [createDraft, setCreateDraft] = useState<ProcessDraft>(emptyDraft);
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [replacementFiles, setReplacementFiles] = useState<
    Record<string, File | null>
  >({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const createInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadEntries() {
      try {
        const response = await fetch(
          `/api/studio/works/${encodeURIComponent(workId)}/process`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as ProcessPayload;
        if (!response.ok) {
          throw new Error(payload.error || "读取过程档案失败。");
        }
        if (!cancelled) applyEntries(payload.entries ?? []);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "读取过程档案失败。",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadEntries();
    return () => {
      cancelled = true;
    };
  }, [workId]);

  function applyEntries(
    nextEntries: ProcessEntry[],
    preserveDrafts = false,
  ) {
    const sorted = sortEntries(nextEntries);
    setEntries(sorted);
    setDrafts((current) =>
      Object.fromEntries(
        sorted.map((entry) => [
          entry.id,
          preserveDrafts && current[entry.id]
            ? current[entry.id]
            : entryToDraft(entry),
        ]),
      ),
    );
  }

  function chooseCreateFile(file: File | null) {
    setError("");
    setMessage("");
    if (!file) return setCreateFile(null);
    const validationError = validateImage(file);
    if (validationError) {
      setCreateFile(null);
      return setError(validationError);
    }
    setCreateFile(file);
    if (!createDraft.altText) {
      setCreateDraft((current) => ({
        ...current,
        altText: fileTitle(file.name),
      }));
    }
  }

  async function createEntry() {
    setError("");
    setMessage("");
    if (!createDraft.title.trim()) {
      return setError("请填写阶段标题。");
    }
    if (entries.length >= MAX_PROCESS_ENTRIES) {
      return setError(`每件作品最多添加 ${MAX_PROCESS_ENTRIES} 条过程记录。`);
    }
    if (createFile && !createDraft.altText.trim()) {
      return setError("上传过程图片时必须填写图片描述。");
    }

    const body = new FormData();
    appendDraft(body, createDraft);
    if (createFile) body.append("image", createFile);
    setUploading(true);
    setUploadProgress(0);
    try {
      const payload = await uploadWithProgress(
        body,
        setUploadProgress,
        `/api/studio/works/${encodeURIComponent(workId)}/process`,
      );
      if (!payload.entry) {
        throw new Error(payload.error || "添加过程记录失败。");
      }
      applyEntries([...entries, payload.entry]);
      setCreateDraft({
        ...emptyDraft,
        sortOrder: String(entries.length + 1),
      });
      setCreateFile(null);
      if (createInputRef.current) createInputRef.current.value = "";
      setMessage(
        payload.entry.status === "published"
          ? "过程记录已添加并公开。"
          : "过程记录已保存为草稿。",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "添加过程记录失败，请重试。",
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function saveEntry(entry: ProcessEntry) {
    const draft = drafts[entry.id];
    if (!draft?.title.trim()) return setError("阶段标题不能为空。");
    if (entry.imageKey && !draft.altText.trim()) {
      return setError("带图片的过程记录必须填写图片描述。");
    }
    setError("");
    setMessage("");
    setSavingId(entry.id);
    try {
      const response = await fetch(
        `/api/studio/works/${encodeURIComponent(workId)}/process/${encodeURIComponent(entry.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...draft,
            sortOrder: Number.parseInt(draft.sortOrder, 10) || 0,
          }),
        },
      );
      const payload = (await response.json()) as ProcessPayload;
      if (!response.ok || !payload.entry) {
        throw new Error(payload.error || "保存过程记录失败。");
      }
      applyEntries(
        entries.map((item) =>
          item.id === entry.id ? (payload.entry as ProcessEntry) : item,
        ),
      );
      setMessage("阶段、说明、顺序和公开状态已更新。");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "保存过程记录失败，请重试。",
      );
    } finally {
      setSavingId(null);
    }
  }

  function chooseReplacement(entryId: string, file: File | null) {
    setError("");
    setMessage("");
    if (file) {
      const validationError = validateImage(file);
      if (validationError) return setError(validationError);
    }
    setReplacementFiles((current) => ({ ...current, [entryId]: file }));
  }

  async function replaceImage(entry: ProcessEntry) {
    const file = replacementFiles[entry.id];
    if (!file) return setError("请先选择新的过程图片。");
    const draft = drafts[entry.id] ?? entryToDraft(entry);
    if (!draft.altText.trim()) {
      return setError("请先填写图片描述，再替换图片。");
    }

    setError("");
    setMessage("");
    setReplacingId(entry.id);
    const body = new FormData();
    body.append("image", file);
    body.append("altText", draft.altText);
    try {
      const payload = await uploadWithProgress(
        body,
        () => undefined,
        `/api/studio/works/${encodeURIComponent(workId)}/process/${encodeURIComponent(entry.id)}/image`,
      );
      if (!payload.entry) {
        throw new Error(payload.error || "替换过程图片失败。");
      }
      applyEntries(
        entries.map((item) =>
          item.id === entry.id ? (payload.entry as ProcessEntry) : item,
        ),
      );
      setReplacementFiles((current) => ({ ...current, [entry.id]: null }));
      setMessage("过程图片已替换，阶段资料与公开状态保持不变。");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "替换过程图片失败，请重试。",
      );
    } finally {
      setReplacingId(null);
    }
  }

  async function removeEntry(entry: ProcessEntry) {
    if (deleteConfirmId !== entry.id) {
      setDeleteConfirmId(entry.id);
      return;
    }
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/studio/works/${encodeURIComponent(workId)}/process/${encodeURIComponent(entry.id)}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "删除过程记录失败。");
      }
      applyEntries(entries.filter((item) => item.id !== entry.id), true);
      setDeleteConfirmId(null);
      setMessage("过程记录及其图片已删除，不影响作品成品图。");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "删除过程记录失败，请重试。",
      );
    }
  }

  function updateDraft(entryId: string, patch: Partial<ProcessDraft>) {
    setDrafts((current) => ({
      ...current,
      [entryId]: { ...current[entryId], ...patch },
    }));
  }

  return (
    <section
      className="studio-process-manager"
      aria-labelledby={`process-title-${workId}`}
    >
      <div className="studio-process-head">
        <div>
          <span>PROCESS DOSSIER / 过程档案</span>
          <strong id={`process-title-${workId}`}>记录从概念到成衣</strong>
          <small>草图、材料、立裁、打版、试衣和制作过程；最多 24 条</small>
        </div>
        <div>
          <b>{String(entries.length).padStart(2, "0")} / 24</b>
          {entries.length > 0 && (
            <a
              href={`/works/${encodeURIComponent(workId)}/process?preview=1`}
              target="_blank"
              rel="noreferrer"
            >
              档案预览 ↗
            </a>
          )}
        </div>
      </div>

      <div className="studio-process-create">
        <div className="studio-process-create-grid">
          <label>
            <span>阶段</span>
            <select
              value={createDraft.stage}
              onChange={(event) =>
                setCreateDraft({
                  ...createDraft,
                  stage: event.target.value as ProcessStage,
                })
              }
            >
              {PROCESS_STAGES.map((stage) => (
                <option value={stage.value} key={stage.value}>
                  {stage.english} / {stage.label}
                </option>
              ))}
            </select>
          </label>
          <label className="is-wide">
            <span>阶段标题 *</span>
            <input
              maxLength={120}
              value={createDraft.title}
              onChange={(event) =>
                setCreateDraft({ ...createDraft, title: event.target.value })
              }
              placeholder="例如：第一次立裁实验"
            />
          </label>
          <label>
            <span>日期或版本</span>
            <input
              maxLength={80}
              value={createDraft.dateLabel}
              onChange={(event) =>
                setCreateDraft({
                  ...createDraft,
                  dateLabel: event.target.value,
                })
              }
              placeholder="2027.03 / V1"
            />
          </label>
          <label>
            <span>顺序</span>
            <input
              type="number"
              min="-9999"
              max="9999"
              value={createDraft.sortOrder}
              onChange={(event) =>
                setCreateDraft({
                  ...createDraft,
                  sortOrder: event.target.value,
                })
              }
            />
          </label>
          <label>
            <span>状态</span>
            <select
              value={createDraft.status}
              onChange={(event) =>
                setCreateDraft({
                  ...createDraft,
                  status: event.target.value as ProcessEntry["status"],
                })
              }
            >
              <option value="draft">草稿</option>
              <option value="published">公开</option>
            </select>
          </label>
          <label className="is-wide">
            <span>过程说明</span>
            <textarea
              rows={4}
              maxLength={3000}
              value={createDraft.notes}
              onChange={(event) =>
                setCreateDraft({ ...createDraft, notes: event.target.value })
              }
              placeholder="记录设计判断、问题、调整和下一步。"
            />
          </label>
          <label className="is-wide">
            <span>图片描述</span>
            <input
              maxLength={240}
              value={createDraft.altText}
              onChange={(event) =>
                setCreateDraft({ ...createDraft, altText: event.target.value })
              }
              placeholder="上传图片时填写，准确描述草图、面料或制作场景"
            />
          </label>
        </div>

        <div className="studio-process-upload">
          <label>
            <input
              ref={createInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(event) =>
                chooseCreateFile(event.target.files?.[0] ?? null)
              }
            />
            <span>{createFile ? createFile.name : "＋ 添加阶段图片（可选）"}</span>
            <small>JPEG / PNG / WEBP · MAX 15MB</small>
          </label>
          <button
            type="button"
            disabled={uploading || !createDraft.title.trim()}
            onClick={() => void createEntry()}
          >
            {uploading
              ? `保存中 ${uploadProgress}%`
              : createDraft.status === "published"
                ? "添加并公开"
                : "保存为草稿"}
          </button>
        </div>
      </div>

      <div className="studio-process-notice" aria-live="polite">
        {loading && <p>正在读取过程档案…</p>}
        {error && <p className="is-error">{error}</p>}
        {message && <p>{message}</p>}
      </div>

      {entries.length > 0 && (
        <div className="studio-process-list">
          {entries.map((entry, index) => {
            const draft = drafts[entry.id] ?? entryToDraft(entry);
            const replacement = replacementFiles[entry.id];
            return (
              <article className="studio-process-entry" key={entry.id}>
                <div className="studio-process-thumb">
                  {entry.imageKey ? (
                    <img src={mediaUrl(entry.imageKey)} alt={entry.altText} />
                  ) : (
                    <div>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>TEXT NOTE</strong>
                    </div>
                  )}
                  <b>{String(index + 1).padStart(2, "0")}</b>
                </div>

                <div className="studio-process-entry-body">
                  <div className="studio-process-entry-meta">
                    <span className={`is-${entry.status}`}>
                      {entry.status === "published" ? "已公开" : "草稿"}
                    </span>
                    <small>{draft.dateLabel || "NO DATE"}</small>
                  </div>
                  <div className="studio-process-edit-grid">
                    <label>
                      <span>阶段</span>
                      <select
                        value={draft.stage}
                        onChange={(event) =>
                          updateDraft(entry.id, {
                            stage: event.target.value as ProcessStage,
                          })
                        }
                      >
                        {PROCESS_STAGES.map((stage) => (
                          <option value={stage.value} key={stage.value}>
                            {stage.english} / {stage.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="is-wide">
                      <span>标题 *</span>
                      <input
                        maxLength={120}
                        value={draft.title}
                        onChange={(event) =>
                          updateDraft(entry.id, { title: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>日期或版本</span>
                      <input
                        maxLength={80}
                        value={draft.dateLabel}
                        onChange={(event) =>
                          updateDraft(entry.id, {
                            dateLabel: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>顺序</span>
                      <input
                        type="number"
                        min="-9999"
                        max="9999"
                        value={draft.sortOrder}
                        onChange={(event) =>
                          updateDraft(entry.id, {
                            sortOrder: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>状态</span>
                      <select
                        value={draft.status}
                        onChange={(event) =>
                          updateDraft(entry.id, {
                            status: event.target.value as ProcessEntry["status"],
                          })
                        }
                      >
                        <option value="draft">草稿</option>
                        <option value="published">公开</option>
                      </select>
                    </label>
                    <label className="is-wide">
                      <span>过程说明</span>
                      <textarea
                        rows={4}
                        maxLength={3000}
                        value={draft.notes}
                        onChange={(event) =>
                          updateDraft(entry.id, { notes: event.target.value })
                        }
                      />
                    </label>
                    <label className="is-wide">
                      <span>图片描述{entry.imageKey ? " *" : ""}</span>
                      <input
                        maxLength={240}
                        value={draft.altText}
                        onChange={(event) =>
                          updateDraft(entry.id, {
                            altText: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>

                  <div className="studio-process-replace">
                    <label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={replacingId === entry.id}
                        onChange={(event) =>
                          chooseReplacement(
                            entry.id,
                            event.target.files?.[0] ?? null,
                          )
                        }
                      />
                      <span>
                        {replacement
                          ? replacement.name
                          : entry.imageKey
                            ? "选择替换图片"
                            : "为此记录添加图片"}
                      </span>
                    </label>
                    <button
                      type="button"
                      disabled={!replacement || replacingId === entry.id}
                      onClick={() => void replaceImage(entry)}
                    >
                      {replacingId === entry.id ? "上传中…" : "更新图片"}
                    </button>
                  </div>

                  <div className="studio-process-actions">
                    <button
                      type="button"
                      disabled={
                        savingId === entry.id || replacingId === entry.id
                      }
                      onClick={() => void saveEntry(entry)}
                    >
                      {savingId === entry.id ? "保存中…" : "保存记录"}
                    </button>
                    <button
                      type="button"
                      className={
                        deleteConfirmId === entry.id ? "is-confirm" : ""
                      }
                      onClick={() => void removeEntry(entry)}
                      onBlur={() => setDeleteConfirmId(null)}
                    >
                      {deleteConfirmId === entry.id ? "确认删除" : "删除"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function appendDraft(body: FormData, draft: ProcessDraft) {
  body.append("stage", draft.stage);
  body.append("title", draft.title);
  body.append("notes", draft.notes);
  body.append("dateLabel", draft.dateLabel);
  body.append("altText", draft.altText);
  body.append("status", draft.status);
  body.append("sortOrder", String(Number.parseInt(draft.sortOrder, 10) || 0));
}

function entryToDraft(entry: ProcessEntry): ProcessDraft {
  return {
    stage: entry.stage,
    title: entry.title,
    notes: entry.notes,
    dateLabel: entry.dateLabel,
    altText: entry.altText,
    status: entry.status,
    sortOrder: String(entry.sortOrder),
  };
}

function sortEntries(entries: ProcessEntry[]) {
  return [...entries].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function validateImage(file: File) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    return "请选择 JPEG、PNG 或 WebP 图片。";
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return "图片大小必须在 15MB 以内。";
  }
  return null;
}

function fileTitle(name: string) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240) || "过程记录图片"
  );
}

function mediaUrl(imageKey: string) {
  return `/api/media/${imageKey.split("/").map(encodeURIComponent).join("/")}`;
}

function uploadWithProgress(
  body: FormData,
  onProgress: (progress: number) => void,
  endpoint: string,
): Promise<ProcessPayload> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", endpoint);
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () => {
      const payload = (request.response ?? {}) as ProcessPayload;
      if (request.status >= 200 && request.status < 300) resolve(payload);
      else reject(new Error(payload.error || "上传失败，请重试。"));
    };
    request.onerror = () => reject(new Error("网络连接中断，请重试。"));
    request.send(body);
  });
}
