"use client";

import { useEffect, useRef, useState } from "react";

type GalleryImage = {
  id: string;
  workId: string;
  imageKey: string;
  imageType: string;
  imageSize: number;
  label: string;
  altText: string;
  sortOrder: number;
  createdAt: string;
};

type GalleryPayload = {
  image?: GalleryImage;
  images?: GalleryImage[];
  error?: string;
};

type ImageDraft = { label: string; altText: string; sortOrder: string };

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_GALLERY_IMAGES = 12;
const MAX_UPLOAD_BATCH = 8;

export default function GalleryManager({ workId }: { workId: string }) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ImageDraft>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(
          `/api/studio/works/${encodeURIComponent(workId)}/gallery`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as GalleryPayload;
        if (!response.ok) throw new Error(payload.error || "读取细节图失败。");
        if (!cancelled) applyImages(payload.images ?? []);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "读取细节图失败。");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [workId]);

  function applyImages(nextImages: GalleryImage[], preserveDrafts = false) {
    const sorted = sortImages(nextImages);
    setImages(sorted);
    setDrafts((current) =>
      Object.fromEntries(
        sorted.map((image) => [
          image.id,
          preserveDrafts && current[image.id]
            ? current[image.id]
            : {
                label: image.label,
                altText: image.altText,
                sortOrder: String(image.sortOrder),
              },
        ]),
      ),
    );
  }

  function selectFiles(nextFiles: File[]) {
    setError("");
    setMessage("");
    const remaining = Math.max(0, MAX_GALLERY_IMAGES - images.length);
    const accepted: File[] = [];
    const rejected: string[] = [];

    nextFiles.slice(0, Math.min(MAX_UPLOAD_BATCH, remaining)).forEach((file) => {
      const validationError = validateImage(file);
      if (validationError) rejected.push(`${file.name}：${validationError}`);
      else accepted.push(file);
    });

    if (remaining === 0) rejected.push(`每件作品最多添加 ${MAX_GALLERY_IMAGES} 张细节图。`);
    else if (nextFiles.length > MAX_UPLOAD_BATCH) {
      rejected.push(`一次最多选择 ${MAX_UPLOAD_BATCH} 张细节图。`);
    } else if (nextFiles.length > remaining) {
      rejected.push(`当前还可添加 ${remaining} 张细节图。`);
    }

    setFiles(accepted);
    if (rejected.length > 0) setError(rejected.slice(0, 3).join(" "));
  }

  async function upload() {
    if (files.length === 0) return setError("请先选择细节图。");
    setError("");
    setMessage("");
    setUploading(true);
    setProgress(0);

    const uploaded: GalleryImage[] = [];
    const failed: File[] = [];
    let firstFailure = "";

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const order = images.length + index;
      const body = new FormData();
      body.append("image", file);
      body.append("label", `DETAIL ${String(order + 1).padStart(2, "0")}`);
      body.append("altText", fileTitle(file.name));
      body.append("sortOrder", String(order));

      try {
        const payload = await uploadWithProgress(
          body,
          (fileProgress) => {
            setProgress(Math.round(((index + fileProgress / 100) / files.length) * 100));
          },
          `/api/studio/works/${encodeURIComponent(workId)}/gallery`,
        );
        if (!payload.image) throw new Error(payload.error || "上传失败。");
        uploaded.push(payload.image);
      } catch (cause) {
        failed.push(file);
        if (!firstFailure) {
          firstFailure = cause instanceof Error ? cause.message : "上传失败。";
        }
      }
    }

    if (uploaded.length > 0) applyImages([...images, ...uploaded], true);
    setFiles(failed);
    if (inputRef.current) inputRef.current.value = "";
    if (failed.length > 0) {
      setError(`${uploaded.length ? `已添加 ${uploaded.length} 张；` : ""}${failed.length} 张失败：${firstFailure}`);
    } else {
      setMessage(`已添加 ${uploaded.length} 张细节图，可继续编辑标签与顺序。`);
    }
    setUploading(false);
    setProgress(0);
  }

  async function saveImage(image: GalleryImage) {
    const draft = drafts[image.id];
    if (!draft?.altText.trim()) return setError("细节图描述不能为空。");
    setError("");
    setMessage("");
    setSavingId(image.id);
    try {
      const response = await fetch(
        `/api/studio/works/${encodeURIComponent(workId)}/gallery/${encodeURIComponent(image.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            label: draft.label,
            altText: draft.altText,
            sortOrder: Number.parseInt(draft.sortOrder, 10) || 0,
          }),
        },
      );
      const payload = (await response.json()) as GalleryPayload;
      if (!response.ok || !payload.image) {
        throw new Error(payload.error || "保存失败。");
      }
      applyImages(
        images.map((item) => (item.id === image.id ? payload.image as GalleryImage : item)),
        true,
      );
      setMessage("细节图标签、描述与展示顺序已更新。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败，请重试。");
    } finally {
      setSavingId(null);
    }
  }

  async function removeImage(image: GalleryImage) {
    if (deleteConfirmId !== image.id) {
      setDeleteConfirmId(image.id);
      return;
    }
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/studio/works/${encodeURIComponent(workId)}/gallery/${encodeURIComponent(image.id)}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "删除失败。");
      applyImages(images.filter((item) => item.id !== image.id), true);
      setDeleteConfirmId(null);
      setMessage("细节图已删除，不影响作品主图与资料。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除失败，请重试。");
    }
  }

  function updateDraft(imageId: string, patch: Partial<ImageDraft>) {
    setDrafts((current) => ({
      ...current,
      [imageId]: { ...current[imageId], ...patch },
    }));
  }

  return (
    <section className="studio-gallery-manager" aria-labelledby={`gallery-title-${workId}`}>
      <div className="studio-gallery-head">
        <div>
          <span>SECONDARY VIEWS / 细节图组</span>
          <strong id={`gallery-title-${workId}`}>建立完整作品档案</strong>
          <small>添加背面、侧面、局部工艺与面料特写；最多 12 张</small>
        </div>
        <b>{String(images.length).padStart(2, "0")} / 12</b>
      </div>

      <div className="studio-gallery-upload">
        <label>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading || images.length >= MAX_GALLERY_IMAGES}
            onChange={(event) => selectFiles(Array.from(event.target.files ?? []))}
          />
          <span>＋ 选择细节图</span>
          <small>JPEG / PNG / WEBP · EACH MAX 15MB</small>
        </label>
        <button type="button" disabled={uploading || files.length === 0} onClick={() => void upload()}>
          {uploading ? `上传中 ${progress}%` : files.length ? `添加 ${files.length} 张` : "等待选择"}
        </button>
      </div>

      {files.length > 0 && (
        <p className="studio-gallery-queue">
          {files.map((file) => file.name).join(" / ")}
        </p>
      )}

      <div className="studio-gallery-notice" aria-live="polite">
        {loading && <p>正在读取细节图…</p>}
        {error && <p className="is-error">{error}</p>}
        {message && <p>{message}</p>}
      </div>

      {images.length > 0 && (
        <div className="studio-gallery-grid">
          {images.map((image, index) => {
            const draft = drafts[image.id] ?? {
              label: image.label,
              altText: image.altText,
              sortOrder: String(image.sortOrder),
            };
            return (
              <article className="studio-gallery-item" key={image.id}>
                <div className="studio-gallery-thumb">
                  <img src={mediaUrl(image.imageKey)} alt={image.altText} />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className="studio-gallery-fields">
                  <label>
                    <span>标签</span>
                    <input maxLength={40} value={draft.label} onChange={(event) => updateDraft(image.id, { label: event.target.value })} />
                  </label>
                  <label>
                    <span>顺序</span>
                    <input type="number" min="-9999" max="9999" value={draft.sortOrder} onChange={(event) => updateDraft(image.id, { sortOrder: event.target.value })} />
                  </label>
                  <label className="is-wide">
                    <span>图片描述 *</span>
                    <input required maxLength={240} value={draft.altText} onChange={(event) => updateDraft(image.id, { altText: event.target.value })} />
                  </label>
                </div>
                <div className="studio-gallery-actions">
                  <button type="button" disabled={savingId === image.id} onClick={() => void saveImage(image)}>
                    {savingId === image.id ? "保存中…" : "保存"}
                  </button>
                  <button
                    type="button"
                    className={deleteConfirmId === image.id ? "is-confirm" : ""}
                    onClick={() => void removeImage(image)}
                    onBlur={() => setDeleteConfirmId(null)}
                  >
                    {deleteConfirmId === image.id ? "确认删除" : "删除"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function sortImages(images: GalleryImage[]) {
  return [...images].sort((a, b) => {
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
      .slice(0, 240) || "作品细节图"
  );
}

function mediaUrl(imageKey: string) {
  return `/api/media/${imageKey.split("/").map(encodeURIComponent).join("/")}`;
}

function uploadWithProgress(
  body: FormData,
  onProgress: (progress: number) => void,
  endpoint: string,
): Promise<GalleryPayload> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", endpoint);
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      const payload = (request.response ?? {}) as GalleryPayload;
      if (request.status >= 200 && request.status < 300) resolve(payload);
      else reject(new Error(payload.error || "上传失败，请重试。"));
    };
    request.onerror = () => reject(new Error("网络连接中断，请重试。"));
    request.send(body);
  });
}
