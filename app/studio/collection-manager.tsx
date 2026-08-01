"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Work = {
  id: string;
  title: string;
  lookNumber: string;
  status: "draft" | "published";
  sortOrder: number;
};

type Collection = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  season: string;
  year: number;
  statement: string;
  heroImageKey: string | null;
  heroAltText: string;
  status: "draft" | "published";
  featured: boolean;
  sortOrder: number;
  createdAt: string;
};

type Assignment = {
  collectionId: string;
  workId: string;
  lookNumber: string;
  sortOrder: number;
  featured: boolean;
};

type AssignmentDraft = {
  selected: boolean;
  lookNumber: string;
  sortOrder: string;
  featured: boolean;
};

type ApiPayload = {
  collection?: Collection;
  collections?: Collection[];
  assignments?: Assignment[];
  error?: string;
};

type CollectionManagerProps = {
  works: Work[];
};

const emptyForm = {
  title: "",
  slug: "",
  subtitle: "",
  season: "AUTUMN—WINTER",
  year: "2027",
  statement: "",
  heroAltText: "",
  sortOrder: "0",
};

export default function CollectionManager({ works }: CollectionManagerProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [assignmentDrafts, setAssignmentDrafts] = useState<
    Record<string, AssignmentDraft>
  >({});
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const heroInputRef = useRef<HTMLInputElement>(null);
  const replacementInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCollections() {
      try {
        const response = await fetch("/api/studio/collections", {
          cache: "no-store",
        });
        const payload = (await response.json()) as ApiPayload;
        if (!response.ok) {
          throw new Error(payload.error || "无法读取系列列表。");
        }
        if (!cancelled) {
          setCollections(sortCollections(payload.collections ?? []));
          setAssignments(payload.assignments ?? []);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "无法读取系列列表。",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadCollections();
    return () => {
      cancelled = true;
    };
  }, []);

  const previewUrl = useMemo(
    () => (heroFile ? URL.createObjectURL(heroFile) : ""),
    [heroFile],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function createCollection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!form.title.trim()) return setError("请输入系列名称。");
    if (heroFile) {
      const imageError = validateImage(heroFile);
      if (imageError) return setError(imageError);
    }

    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    if (heroFile) body.append("heroImage", heroFile);

    setCreating(true);
    try {
      const response = await fetch("/api/studio/collections", {
        method: "POST",
        body,
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.collection) {
        throw new Error(payload.error || "创建系列失败。");
      }
      setCollections((current) =>
        sortCollections([payload.collection as Collection, ...current]),
      );
      setForm(emptyForm);
      setHeroFile(null);
      if (heroInputRef.current) heroInputRef.current.value = "";
      setMessage("系列已创建为草稿，可以继续编排 Look。");
      beginEdit(payload.collection as Collection, []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建系列失败。");
    } finally {
      setCreating(false);
    }
  }

  function beginEdit(
    collection: Collection,
    sourceAssignments = assignments,
  ) {
    if (editingId === collection.id) {
      setEditingId(null);
      return;
    }
    setError("");
    setMessage("");
    setDeleteConfirmId(null);
    setReplacementFile(null);
    if (replacementInputRef.current) replacementInputRef.current.value = "";
    setEditingId(collection.id);
    setEditForm({
      title: collection.title,
      slug: collection.slug,
      subtitle: collection.subtitle,
      season: collection.season,
      year: String(collection.year),
      statement: collection.statement,
      heroAltText: collection.heroAltText,
      sortOrder: String(collection.sortOrder),
    });
    const currentAssignments = sourceAssignments.filter(
      (item) => item.collectionId === collection.id,
    );
    const nextDrafts: Record<string, AssignmentDraft> = {};
    works.forEach((work, index) => {
      const current = currentAssignments.find(
        (item) => item.workId === work.id,
      );
      nextDrafts[work.id] = {
        selected: Boolean(current),
        lookNumber: current?.lookNumber || work.lookNumber || "",
        sortOrder: String(current?.sortOrder ?? work.sortOrder ?? index),
        featured: current?.featured ?? false,
      };
    });
    setAssignmentDrafts(nextDrafts);
  }

  async function saveCollection(
    event: React.FormEvent<HTMLFormElement>,
    collection: Collection,
  ) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!editForm.title.trim()) return setError("系列名称不能为空。");

    const selectedWorks = works
      .filter((work) => assignmentDrafts[work.id]?.selected)
      .map((work, index) => {
        const draft = assignmentDrafts[work.id];
        return {
          workId: work.id,
          lookNumber: draft.lookNumber,
          sortOrder: Number.parseInt(draft.sortOrder, 10) || index,
          featured: draft.featured,
        };
      });

    setBusyId(collection.id);
    try {
      const metadataResponse = await fetch(
        `/api/studio/collections/${encodeURIComponent(collection.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...editForm,
            year: Number.parseInt(editForm.year, 10),
            sortOrder: Number.parseInt(editForm.sortOrder, 10) || 0,
          }),
        },
      );
      const metadataPayload =
        (await metadataResponse.json()) as ApiPayload;
      if (!metadataResponse.ok || !metadataPayload.collection) {
        throw new Error(
          metadataPayload.error || "系列资料保存失败。",
        );
      }

      const lineupResponse = await fetch(
        `/api/studio/collections/${encodeURIComponent(collection.id)}/works`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: selectedWorks }),
        },
      );
      const lineupPayload = (await lineupResponse.json()) as ApiPayload;
      if (!lineupResponse.ok) {
        throw new Error(lineupPayload.error || "Look 编排保存失败。");
      }

      setCollections((current) =>
        sortCollections(
          current.map((item) =>
            item.id === collection.id
              ? (metadataPayload.collection as Collection)
              : item,
          ),
        ),
      );
      setAssignments((current) => [
        ...current.filter((item) => item.collectionId !== collection.id),
        ...(lineupPayload.assignments ?? []),
      ]);
      setMessage(
        `系列资料与 ${selectedWorks.length} 件 Look 编排已保存。`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "系列保存失败，请重试。",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStatus(collection: Collection) {
    setError("");
    setMessage("");
    setBusyId(collection.id);
    const status = collection.status === "published" ? "draft" : "published";
    try {
      const updated = await patchCollection(collection.id, { status });
      setCollections((current) =>
        sortCollections(
          current.map((item) => (item.id === collection.id ? updated : item)),
        ),
      );
      setMessage(
        status === "published"
          ? "系列已发布到 Collections 档案。"
          : "系列已撤回为草稿。",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "状态更新失败。");
    } finally {
      setBusyId(null);
    }
  }

  async function makeFeatured(collection: Collection) {
    setError("");
    setMessage("");
    if (collection.status !== "published") {
      return setError("请先发布系列，再设为首页主推。");
    }
    setBusyId(collection.id);
    try {
      const updated = await patchCollection(collection.id, { featured: true });
      setCollections((current) =>
        sortCollections(
          current.map((item) => ({
            ...item,
            featured: item.id === updated.id,
          })),
        ),
      );
      setMessage("首页主推系列已更新。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "主推设置失败。");
    } finally {
      setBusyId(null);
    }
  }

  async function replaceHero(collection: Collection) {
    setError("");
    setMessage("");
    if (!replacementFile) return setError("请先选择新的系列封面。");
    const imageError = validateImage(replacementFile);
    if (imageError) return setError(imageError);

    const body = new FormData();
    body.append("image", replacementFile);
    body.append("altText", editForm.heroAltText || collection.title);
    setBusyId(collection.id);
    try {
      const response = await fetch(
        `/api/studio/collections/${encodeURIComponent(collection.id)}/image`,
        { method: "POST", body },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.collection) {
        throw new Error(payload.error || "封面替换失败。");
      }
      setCollections((current) =>
        sortCollections(
          current.map((item) =>
            item.id === collection.id
              ? (payload.collection as Collection)
              : item,
          ),
        ),
      );
      setReplacementFile(null);
      if (replacementInputRef.current) replacementInputRef.current.value = "";
      setMessage("系列封面已替换。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "封面替换失败。");
    } finally {
      setBusyId(null);
    }
  }

  async function removeCollection(collection: Collection) {
    if (deleteConfirmId !== collection.id) {
      setDeleteConfirmId(collection.id);
      return;
    }
    setError("");
    setBusyId(collection.id);
    try {
      const response = await fetch(
        `/api/studio/collections/${encodeURIComponent(collection.id)}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok) throw new Error(payload.error || "删除系列失败。");
      setCollections((current) =>
        current.filter((item) => item.id !== collection.id),
      );
      setAssignments((current) =>
        current.filter((item) => item.collectionId !== collection.id),
      );
      setEditingId(null);
      setDeleteConfirmId(null);
      setMessage("系列与封面已删除，原有作品仍保留在作品库中。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除系列失败。");
    } finally {
      setBusyId(null);
    }
  }

  function updateAssignment(
    workId: string,
    patch: Partial<AssignmentDraft>,
  ) {
    setAssignmentDrafts((current) => ({
      ...current,
      [workId]: {
        ...(current[workId] ?? {
          selected: false,
          lookNumber: "",
          sortOrder: "0",
          featured: false,
        }),
        ...patch,
      },
    }));
  }

  return (
    <section
      className="studio-collections"
      id="collection-system"
      aria-labelledby="studio-collections-title"
    >
      <header className="studio-collections-head">
        <div>
          <span>01 / COLLECTION SYSTEM</span>
          <h2 id="studio-collections-title">系列。编排。<i>策展。</i></h2>
        </div>
        <p>
          将作品组织成完整系列，设置 Look 顺序、系列宣言和首页主推。
          发布前可持续使用草稿预览。
        </p>
      </header>

      <div className="studio-collections-grid">
        <form className="studio-collection-create" onSubmit={createCollection}>
          <div className="studio-collection-section-title">
            <span>NEW</span>
            <div><strong>创建系列</strong><small>CREATE COLLECTION</small></div>
          </div>

          <label className={`studio-collection-cover${previewUrl ? " has-image" : ""}`}>
            <input
              ref={heroInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={creating}
              onChange={(event) =>
                setHeroFile(event.target.files?.[0] ?? null)
              }
            />
            {previewUrl ? (
              <img src={previewUrl} alt="待上传系列封面预览" />
            ) : (
              <div><span>＋</span><strong>选择系列封面</strong><small>可稍后添加 · MAX 15MB</small></div>
            )}
          </label>

          <div className="studio-collection-form-grid">
            <Field label="系列名称 *" wide>
              <input
                required
                maxLength={120}
                value={form.title}
                onChange={(event) => {
                  const title = event.target.value;
                  setForm((current) => ({
                    ...current,
                    title,
                    slug: current.slug || slugify(title),
                  }));
                }}
                placeholder="SECOND SKIN"
              />
            </Field>
            <Field label="网址标识">
              <input
                maxLength={80}
                value={form.slug}
                onChange={(event) =>
                  setForm({ ...form, slug: slugify(event.target.value) })
                }
                placeholder="second-skin-aw27"
              />
            </Field>
            <Field label="季节">
              <input
                maxLength={80}
                value={form.season}
                onChange={(event) =>
                  setForm({ ...form, season: event.target.value })
                }
              />
            </Field>
            <Field label="年份">
              <input
                type="number"
                min="1900"
                max="2100"
                value={form.year}
                onChange={(event) =>
                  setForm({ ...form, year: event.target.value })
                }
              />
            </Field>
            <Field label="展示顺序">
              <input
                type="number"
                min="-9999"
                max="9999"
                value={form.sortOrder}
                onChange={(event) =>
                  setForm({ ...form, sortOrder: event.target.value })
                }
              />
            </Field>
            <Field label="副标题" wide>
              <input
                maxLength={160}
                value={form.subtitle}
                onChange={(event) =>
                  setForm({ ...form, subtitle: event.target.value })
                }
                placeholder="Structure in motion"
              />
            </Field>
            <Field label="系列宣言" wide>
              <textarea
                rows={4}
                maxLength={1600}
                value={form.statement}
                onChange={(event) =>
                  setForm({ ...form, statement: event.target.value })
                }
                placeholder="用一段简洁文字说明系列的核心命题。"
              />
            </Field>
            <Field label="封面图片描述" wide>
              <input
                maxLength={240}
                value={form.heroAltText}
                onChange={(event) =>
                  setForm({ ...form, heroAltText: event.target.value })
                }
                placeholder="准确描述封面中的服装与构图"
              />
            </Field>
          </div>
          <button className="studio-collection-primary" type="submit" disabled={creating}>
            {creating ? "正在创建…" : "创建系列草稿"} <span>→</span>
          </button>
        </form>

        <div className="studio-collection-library">
          <div className="studio-collection-library-head">
            <div className="studio-collection-section-title">
              <span>LIVE</span>
              <div><strong>系列库</strong><small>COLLECTION LIBRARY</small></div>
            </div>
            <strong>{String(collections.length).padStart(2, "0")} SERIES</strong>
          </div>

          <div className="studio-collection-notice" aria-live="polite">
            {error && <p className="is-error">{error}</p>}
            {message && <p>{message}</p>}
          </div>

          {loading ? (
            <p className="studio-collection-empty">正在读取系列…</p>
          ) : collections.length === 0 ? (
            <p className="studio-collection-empty">还没有系列，从左侧创建第一套 Collection Dossier。</p>
          ) : (
            <div className="studio-collection-list">
              {collections.map((collection) => {
                const collectionAssignments = assignments.filter(
                  (item) => item.collectionId === collection.id,
                );
                return (
                  <article
                    className="studio-collection-card"
                    id={`collection-${collection.id}`}
                    key={collection.id}
                  >
                    <div className="studio-collection-card-summary">
                      {collection.heroImageKey ? (
                        <img src={mediaUrl(collection.heroImageKey)} alt={collection.heroAltText || collection.title} />
                      ) : (
                        <div className="studio-collection-placeholder">NÉRA</div>
                      )}
                      <div>
                        <div className="studio-collection-badges">
                          <span className={`is-${collection.status}`}>
                            {collection.status === "published" ? "已发布" : "草稿"}
                          </span>
                          {collection.featured && <strong>首页主推</strong>}
                        </div>
                        <small>{collection.season || "COLLECTION"} / {collection.year}</small>
                        <h3>{collection.title}</h3>
                        <p>{String(collectionAssignments.length).padStart(2, "0")} LOOKS · /collections/{collection.slug}</p>
                      </div>
                    </div>
                    <div className="studio-collection-actions">
                      <a
                        href={`/collections/${encodeURIComponent(collection.slug)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        前台预览
                      </a>
                      {collectionAssignments.length > 0 && (
                        <a
                          href={`/collections/${encodeURIComponent(collection.slug)}/lookbook`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Lookbook
                        </a>
                      )}
                      <button type="button" onClick={() => beginEdit(collection)}>
                        {editingId === collection.id ? "收起编辑" : "编辑与编排"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === collection.id}
                        onClick={() => void toggleStatus(collection)}
                      >
                        {collection.status === "published" ? "撤回" : "发布"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === collection.id || collection.featured}
                        onClick={() => void makeFeatured(collection)}
                      >
                        {collection.featured ? "当前主推" : "设为主推"}
                      </button>
                      <button
                        type="button"
                        className={deleteConfirmId === collection.id ? "is-confirm" : ""}
                        disabled={busyId === collection.id}
                        onClick={() => void removeCollection(collection)}
                        onBlur={() => setDeleteConfirmId(null)}
                      >
                        {deleteConfirmId === collection.id ? "确认删除" : "删除系列"}
                      </button>
                    </div>

                    {editingId === collection.id && (
                      <form
                        className="studio-collection-editor"
                        onSubmit={(event) => void saveCollection(event, collection)}
                      >
                        <div className="studio-collection-editor-head">
                          <div><span>EDIT DOSSIER</span><strong>资料与 Look 编排</strong></div>
                          <small>勾选作品并设置系列内编号与顺序</small>
                        </div>

                        <div className="studio-collection-replace">
                          <label>
                            <input
                              ref={replacementInputRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              disabled={busyId === collection.id}
                              onChange={(event) =>
                                setReplacementFile(event.target.files?.[0] ?? null)
                              }
                            />
                            <span>{replacementFile ? replacementFile.name : "选择新封面"}</span>
                          </label>
                          <button
                            type="button"
                            disabled={!replacementFile || busyId === collection.id}
                            onClick={() => void replaceHero(collection)}
                          >
                            替换封面
                          </button>
                        </div>

                        <div className="studio-collection-edit-grid">
                          <Field label="系列名称 *" wide>
                            <input required maxLength={120} value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} />
                          </Field>
                          <Field label="网址标识">
                            <input maxLength={80} value={editForm.slug} onChange={(event) => setEditForm({ ...editForm, slug: slugify(event.target.value) })} />
                          </Field>
                          <Field label="季节">
                            <input maxLength={80} value={editForm.season} onChange={(event) => setEditForm({ ...editForm, season: event.target.value })} />
                          </Field>
                          <Field label="年份">
                            <input type="number" min="1900" max="2100" value={editForm.year} onChange={(event) => setEditForm({ ...editForm, year: event.target.value })} />
                          </Field>
                          <Field label="展示顺序">
                            <input type="number" min="-9999" max="9999" value={editForm.sortOrder} onChange={(event) => setEditForm({ ...editForm, sortOrder: event.target.value })} />
                          </Field>
                          <Field label="副标题" wide>
                            <input maxLength={160} value={editForm.subtitle} onChange={(event) => setEditForm({ ...editForm, subtitle: event.target.value })} />
                          </Field>
                          <Field label="系列宣言" wide>
                            <textarea rows={4} maxLength={1600} value={editForm.statement} onChange={(event) => setEditForm({ ...editForm, statement: event.target.value })} />
                          </Field>
                          <Field label="封面图片描述" wide>
                            <input maxLength={240} value={editForm.heroAltText} onChange={(event) => setEditForm({ ...editForm, heroAltText: event.target.value })} />
                          </Field>
                        </div>

                        <div className="studio-lineup">
                          <header>
                            <div><span>LINEUP</span><strong>系列作品编排</strong></div>
                            <small>{works.length} 件作品可选</small>
                          </header>
                          {works.length === 0 ? (
                            <p>作品库为空，请先在下方上传作品。</p>
                          ) : (
                            <div className="studio-lineup-list">
                              {works.map((work) => {
                                const draft = assignmentDrafts[work.id] ?? {
                                  selected: false,
                                  lookNumber: work.lookNumber,
                                  sortOrder: String(work.sortOrder),
                                  featured: false,
                                };
                                return (
                                  <div className={`studio-lineup-row${draft.selected ? " is-selected" : ""}`} key={work.id}>
                                    <label className="studio-lineup-select">
                                      <input
                                        type="checkbox"
                                        checked={draft.selected}
                                        onChange={(event) =>
                                          updateAssignment(work.id, { selected: event.target.checked })
                                        }
                                      />
                                      <span />
                                      <div><strong>{work.title}</strong><small>{work.status === "published" ? "已发布" : "草稿"}</small></div>
                                    </label>
                                    <label>
                                      <span>LOOK</span>
                                      <input
                                        disabled={!draft.selected}
                                        maxLength={40}
                                        value={draft.lookNumber}
                                        onChange={(event) =>
                                          updateAssignment(work.id, { lookNumber: event.target.value })
                                        }
                                        placeholder="LOOK 01"
                                      />
                                    </label>
                                    <label>
                                      <span>ORDER</span>
                                      <input
                                        disabled={!draft.selected}
                                        type="number"
                                        min="-9999"
                                        max="9999"
                                        value={draft.sortOrder}
                                        onChange={(event) =>
                                          updateAssignment(work.id, { sortOrder: event.target.value })
                                        }
                                      />
                                    </label>
                                    <label className="studio-lineup-featured">
                                      <input
                                        disabled={!draft.selected}
                                        type="checkbox"
                                        checked={draft.featured}
                                        onChange={(event) =>
                                          updateAssignment(work.id, { featured: event.target.checked })
                                        }
                                      />
                                      <span>精选</span>
                                    </label>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="studio-collection-editor-actions">
                          <button type="submit" disabled={busyId === collection.id}>
                            {busyId === collection.id ? "正在保存…" : "保存资料与编排"}
                          </button>
                          <button type="button" onClick={() => setEditingId(null)}>取消</button>
                        </div>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`studio-collection-field${wide ? " is-wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

async function patchCollection(id: string, patch: Record<string, unknown>) {
  const response = await fetch(
    `/api/studio/collections/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok || !payload.collection) {
    throw new Error(payload.error || "系列更新失败。");
  }
  return payload.collection;
}

function mediaUrl(imageKey: string) {
  return `/api/media/${imageKey.split("/").map(encodeURIComponent).join("/")}`;
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

function sortCollections(items: Collection[]) {
  return [...items].sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    if (a.year !== b.year) return b.year - a.year;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function validateImage(file: File) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    return "请选择 JPEG、PNG 或 WebP 图片。";
  }
  if (file.size <= 0 || file.size > 15 * 1024 * 1024) {
    return "图片大小必须在 15MB 以内。";
  }
  return null;
}
