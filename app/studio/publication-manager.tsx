"use client";

import { useEffect, useMemo, useState } from "react";

type PublicationStatus = "draft" | "scheduled" | "published";

type Publication = {
  id: string;
  collectionId: string;
  slug: string;
  headline: string;
  deck: string;
  body: string;
  city: string;
  releaseDate: string;
  releaseAt: string | null;
  contactName: string;
  contactEmail: string;
  photography: string;
  styling: string;
  casting: string;
  hair: string;
  makeup: string;
  production: string;
  seoTitle: string;
  seoDescription: string;
  status: PublicationStatus;
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
};

type Collection = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  season: string;
  year: number;
  status: "draft" | "published";
  heroImageKey: string | null;
};

type Preflight = {
  issues: string[];
  readyToPublish: boolean;
  readyToSchedule: boolean;
  scheduledIssue: string | null;
  publishedLooks: number;
  hasHero: boolean;
};

type ApiPayload = {
  publication?: Publication;
  publications?: Publication[];
  collections?: Collection[];
  readiness?: Preflight | Record<string, Preflight>;
  issues?: string[];
  error?: string;
};

type PublicationDraft = Omit<
  Publication,
  "id" | "createdAt" | "publishedAt" | "releaseAt" | "sortOrder"
> & {
  releaseAt: string;
  sortOrder: string;
};

const emptyCreate = {
  collectionId: "",
  headline: "",
  slug: "",
};

export default function PublicationManager() {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [readiness, setReadiness] = useState<Record<string, Preflight>>({});
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PublicationDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData(announce = false) {
    setError("");
    try {
      const payload = await fetchPublicationData();
      setPublications(sortPublications(payload.publications ?? []));
      setCollections(payload.collections ?? []);
      setReadiness(
        isReadinessMap(payload.readiness) ? payload.readiness : {},
      );
      if (announce) setMessage("系列与发布状态已刷新。");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "无法读取专业发布中心。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      try {
        const payload = await fetchPublicationData();
        if (cancelled) return;
        setPublications(sortPublications(payload.publications ?? []));
        setCollections(payload.collections ?? []);
        setReadiness(
          isReadinessMap(payload.readiness) ? payload.readiness : {},
        );
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "无法读取专业发布中心。",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadInitialData();
    return () => {
      cancelled = true;
    };
  }, []);

  const availableCollections = useMemo(
    () =>
      collections.filter(
        (collection) =>
          !publications.some(
            (publication) => publication.collectionId === collection.id,
          ),
      ),
    [collections, publications],
  );

  async function createPublication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!createForm.collectionId || !createForm.headline.trim()) {
      return setError("请选择系列并填写发布标题。");
    }
    setCreating(true);
    try {
      const response = await fetch("/api/studio/publications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.publication) {
        throw new Error(payload.error || "创建发布包失败。");
      }
      const publication = payload.publication;
      setPublications((current) =>
        sortPublications([publication, ...current]),
      );
      if (isPreflight(payload.readiness)) {
        setReadiness((current) => ({
          ...current,
          [publication.id]: payload.readiness as Preflight,
        }));
      }
      setCreateForm(emptyCreate);
      setMessage("发布包已创建为草稿，请完成媒体资料和发布前检查。");
      beginEdit(publication);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建发布包失败。");
    } finally {
      setCreating(false);
    }
  }

  function selectCreateCollection(collectionId: string) {
    const collection = collections.find((item) => item.id === collectionId);
    if (!collection) {
      setCreateForm(emptyCreate);
      return;
    }
    const headline = collection.title;
    setCreateForm({
      collectionId,
      headline,
      slug: slugify(`${collection.title}-${collection.year}`),
    });
  }

  function beginEdit(publication: Publication) {
    if (editingId === publication.id) {
      setEditingId(null);
      setEditForm(null);
      return;
    }
    setError("");
    setMessage("");
    setDeleteConfirmId(null);
    setEditingId(publication.id);
    setEditForm(publicationToDraft(publication));
  }

  async function savePublication(
    event: React.FormEvent<HTMLFormElement>,
    publication: Publication,
  ) {
    event.preventDefault();
    await updatePublication(publication, undefined);
  }

  async function updatePublication(
    publication: Publication,
    status: PublicationStatus | undefined,
  ) {
    if (!editForm) return;
    setError("");
    setMessage("");
    if (!editForm.headline.trim()) {
      return setError("发布标题不能为空。");
    }
    setBusyId(publication.id);
    try {
      const response = await fetch(
        `/api/studio/publications/${encodeURIComponent(publication.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...editForm,
            releaseAt: editForm.releaseAt
              ? new Date(editForm.releaseAt).toISOString()
              : null,
            sortOrder: Number.parseInt(editForm.sortOrder, 10) || 0,
            status,
          }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.publication) {
        const issues = payload.issues?.length
          ? ` ${payload.issues.join("；")}。`
          : "";
        throw new Error(
          `${payload.error || "保存发布包失败。"}${issues}`,
        );
      }
      const updated = payload.publication;
      setPublications((current) =>
        sortPublications(
          current.map((item) =>
            item.id === publication.id ? updated : item,
          ),
        ),
      );
      if (isPreflight(payload.readiness)) {
        setReadiness((current) => ({
          ...current,
          [publication.id]: payload.readiness as Preflight,
        }));
      }
      setEditForm(publicationToDraft(updated));
      setMessage(statusMessage(status));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "保存发布包失败，请重试。",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function removePublication(publication: Publication) {
    if (deleteConfirmId !== publication.id) {
      setDeleteConfirmId(publication.id);
      return;
    }
    setError("");
    setMessage("");
    setBusyId(publication.id);
    try {
      const response = await fetch(
        `/api/studio/publications/${encodeURIComponent(publication.id)}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok) {
        throw new Error(payload.error || "删除发布包失败。");
      }
      setPublications((current) =>
        current.filter((item) => item.id !== publication.id),
      );
      setReadiness((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([id]) => id !== publication.id),
        ),
      );
      setEditingId(null);
      setEditForm(null);
      setDeleteConfirmId(null);
      setMessage("发布包已删除，系列和作品资料保持不变。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除发布包失败。");
    } finally {
      setBusyId(null);
    }
  }

  function patchEdit(patch: Partial<PublicationDraft>) {
    setEditForm((current) => (current ? { ...current, ...patch } : current));
  }

  return (
    <section
      className="studio-publications"
      id="publication-center"
      aria-labelledby="studio-publications-title"
    >
      <header className="studio-publications-head">
        <div>
          <span>04 / PROFESSIONAL PUBLISHING</span>
          <h2 id="studio-publications-title">
            编辑。预检。<i>发布。</i>
          </h2>
        </div>
        <p>
          把完整系列整理为可交付媒体、买手和合作方的官方发布包，
          并统一管理署名、SEO、定时发布与下载资料。
        </p>
      </header>

      <div className="studio-publications-grid">
        <form
          className="studio-publication-create"
          onSubmit={createPublication}
        >
          <div className="studio-publication-section-title">
            <span>NEW</span>
            <div>
              <strong>创建官方发布包</strong>
              <small>CREATE RELEASE</small>
            </div>
          </div>
          <label>
            <span>关联系列 *</span>
            <select
              required
              value={createForm.collectionId}
              onChange={(event) =>
                selectCreateCollection(event.target.value)
              }
            >
              <option value="">选择 Collection</option>
              {availableCollections.map((collection) => (
                <option value={collection.id} key={collection.id}>
                  {collection.title} / {collection.year}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>发布标题 *</span>
            <input
              required
              maxLength={160}
              value={createForm.headline}
              onChange={(event) => {
                const headline = event.target.value;
                setCreateForm((current) => ({
                  ...current,
                  headline,
                  slug: current.slug || slugify(headline),
                }));
              }}
              placeholder="SECOND SKIN — STRUCTURE IN MOTION"
            />
          </label>
          <label>
            <span>网址标识 *</span>
            <input
              required
              maxLength={80}
              value={createForm.slug}
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  slug: slugify(event.target.value),
                })
              }
              placeholder="second-skin-2027"
            />
          </label>
          <button type="submit" disabled={creating || !availableCollections.length}>
            {creating ? "正在创建…" : "创建发布草稿"} <span>→</span>
          </button>
          {!loading && availableCollections.length === 0 && (
            <p>所有系列都已有发布包；如需更新，请从右侧继续编辑。</p>
          )}
        </form>

        <div className="studio-publication-library">
          <div className="studio-publication-library-head">
            <div className="studio-publication-section-title">
              <span>PRESS</span>
              <div>
                <strong>发布队列</strong>
                <small>RELEASE QUEUE</small>
              </div>
            </div>
            <div>
              <strong>
                {String(publications.length).padStart(2, "0")} RELEASES
              </strong>
              <button type="button" onClick={() => void loadData(true)}>
                刷新系列
              </button>
            </div>
          </div>

          <div className="studio-publication-notice" aria-live="polite">
            {error && <p className="is-error">{error}</p>}
            {message && <p>{message}</p>}
          </div>

          {loading ? (
            <p className="studio-publication-empty">正在读取发布队列…</p>
          ) : publications.length === 0 ? (
            <p className="studio-publication-empty">
              还没有官方发布包，从左侧选择一个系列开始。
            </p>
          ) : (
            <div className="studio-publication-list">
              {publications.map((publication) => {
                const collection = collections.find(
                  (item) => item.id === publication.collectionId,
                );
                const preflight = readiness[publication.id];
                const isEditing = editingId === publication.id && editForm;
                return (
                  <article
                    className="studio-publication-card"
                    id={`publication-${publication.id}`}
                    key={publication.id}
                  >
                    <div className="studio-publication-summary">
                      <div>
                        <span className={`is-${publication.status}`}>
                          {statusLabel(publication)}
                        </span>
                        <small>
                          {collection?.title || "MISSING COLLECTION"} ·{" "}
                          {publication.releaseDate || "NO RELEASE DATE"}
                        </small>
                      </div>
                      <h3>{publication.headline}</h3>
                      <p>{publication.deck || "媒体摘要尚未填写。"}</p>
                      <div className="studio-publication-readiness">
                        <strong
                          className={
                            preflight?.readyToPublish ? "is-ready" : ""
                          }
                        >
                          {preflight?.readyToPublish
                            ? "READY TO PUBLISH"
                            : `${preflight?.issues.length ?? 0} CHECKS OPEN`}
                        </strong>
                        <span>
                          {preflight?.publishedLooks ?? 0} PUBLISHED LOOKS
                        </span>
                      </div>
                      {preflight && preflight.issues.length > 0 && (
                        <ul>
                          {preflight.issues.slice(0, 4).map((issue) => (
                            <li key={issue}>{issue}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="studio-publication-actions">
                      <a
                        href={`/press/${encodeURIComponent(publication.slug)}?preview=1`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        发布页预览
                      </a>
                      <button
                        type="button"
                        onClick={() => beginEdit(publication)}
                      >
                        {isEditing ? "收起编辑" : "编辑发布包"}
                      </button>
                      <button
                        type="button"
                        className={
                          deleteConfirmId === publication.id
                            ? "is-confirm"
                            : ""
                        }
                        disabled={busyId === publication.id}
                        onClick={() => void removePublication(publication)}
                        onBlur={() => setDeleteConfirmId(null)}
                      >
                        {deleteConfirmId === publication.id
                          ? "确认删除"
                          : "删除"}
                      </button>
                    </div>

                    {isEditing && (
                      <form
                        className="studio-publication-editor"
                        onSubmit={(event) =>
                          void savePublication(event, publication)
                        }
                      >
                        <div className="studio-publication-editor-head">
                          <div>
                            <span>RELEASE EDITOR</span>
                            <strong>官方发布资料</strong>
                          </div>
                          <small>
                            保存后，发布前检查会按最新资料重新计算
                          </small>
                        </div>

                        <div className="studio-publication-form-grid">
                          <Field label="关联系列 *">
                            <select
                              value={editForm.collectionId}
                              onChange={(event) =>
                                patchEdit({
                                  collectionId: event.target.value,
                                })
                              }
                            >
                              {collections.map((item) => (
                                <option value={item.id} key={item.id}>
                                  {item.title} / {item.year}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="展示顺序">
                            <input
                              type="number"
                              min="-9999"
                              max="9999"
                              value={editForm.sortOrder}
                              onChange={(event) =>
                                patchEdit({ sortOrder: event.target.value })
                              }
                            />
                          </Field>
                          <Field label="发布标题 *" wide>
                            <input
                              required
                              maxLength={160}
                              value={editForm.headline}
                              onChange={(event) =>
                                patchEdit({ headline: event.target.value })
                              }
                            />
                          </Field>
                          <Field label="网址标识 *">
                            <input
                              required
                              maxLength={80}
                              value={editForm.slug}
                              onChange={(event) =>
                                patchEdit({
                                  slug: slugify(event.target.value),
                                })
                              }
                            />
                          </Field>
                          <Field label="发布城市">
                            <input
                              maxLength={120}
                              value={editForm.city}
                              onChange={(event) =>
                                patchEdit({ city: event.target.value })
                              }
                              placeholder="PARIS / SHANGHAI"
                            />
                          </Field>
                          <Field label="对外发布日期">
                            <input
                              maxLength={100}
                              value={editForm.releaseDate}
                              onChange={(event) =>
                                patchEdit({
                                  releaseDate: event.target.value,
                                })
                              }
                              placeholder="APRIL 08, 2027"
                            />
                          </Field>
                          <Field label="定时发布时间">
                            <input
                              type="datetime-local"
                              value={editForm.releaseAt}
                              onChange={(event) =>
                                patchEdit({
                                  releaseAt: event.target.value,
                                })
                              }
                            />
                          </Field>
                          <Field label="媒体摘要" wide>
                            <textarea
                              rows={3}
                              maxLength={320}
                              value={editForm.deck}
                              onChange={(event) =>
                                patchEdit({ deck: event.target.value })
                              }
                            />
                          </Field>
                          <Field label="新闻稿正文" wide>
                            <textarea
                              rows={9}
                              maxLength={8000}
                              value={editForm.body}
                              onChange={(event) =>
                                patchEdit({ body: event.target.value })
                              }
                              placeholder="使用空行分隔段落；建议包含系列命题、材料、廓形与发布背景。"
                            />
                          </Field>
                        </div>

                        <div className="studio-publication-subsection">
                          <header>
                            <span>CREDITS</span>
                            <strong>制作署名</strong>
                          </header>
                          <div className="studio-publication-form-grid">
                            <Field label="Photography">
                              <input
                                maxLength={160}
                                value={editForm.photography}
                                onChange={(event) =>
                                  patchEdit({
                                    photography: event.target.value,
                                  })
                                }
                              />
                            </Field>
                            <Field label="Styling">
                              <input
                                maxLength={160}
                                value={editForm.styling}
                                onChange={(event) =>
                                  patchEdit({ styling: event.target.value })
                                }
                              />
                            </Field>
                            <Field label="Casting">
                              <input
                                maxLength={160}
                                value={editForm.casting}
                                onChange={(event) =>
                                  patchEdit({ casting: event.target.value })
                                }
                              />
                            </Field>
                            <Field label="Hair">
                              <input
                                maxLength={160}
                                value={editForm.hair}
                                onChange={(event) =>
                                  patchEdit({ hair: event.target.value })
                                }
                              />
                            </Field>
                            <Field label="Makeup">
                              <input
                                maxLength={160}
                                value={editForm.makeup}
                                onChange={(event) =>
                                  patchEdit({ makeup: event.target.value })
                                }
                              />
                            </Field>
                            <Field label="Production">
                              <input
                                maxLength={160}
                                value={editForm.production}
                                onChange={(event) =>
                                  patchEdit({
                                    production: event.target.value,
                                  })
                                }
                              />
                            </Field>
                          </div>
                        </div>

                        <div className="studio-publication-subsection">
                          <header>
                            <span>DISTRIBUTION</span>
                            <strong>媒体联系与 SEO</strong>
                          </header>
                          <div className="studio-publication-form-grid">
                            <Field label="联系人">
                              <input
                                maxLength={120}
                                value={editForm.contactName}
                                onChange={(event) =>
                                  patchEdit({
                                    contactName: event.target.value,
                                  })
                                }
                              />
                            </Field>
                            <Field label="媒体邮箱 *">
                              <input
                                type="email"
                                maxLength={200}
                                value={editForm.contactEmail}
                                onChange={(event) =>
                                  patchEdit({
                                    contactEmail: event.target.value,
                                  })
                                }
                              />
                            </Field>
                            <Field label="SEO 标题" wide>
                              <input
                                maxLength={160}
                                value={editForm.seoTitle}
                                onChange={(event) =>
                                  patchEdit({
                                    seoTitle: event.target.value,
                                  })
                                }
                              />
                            </Field>
                            <Field label="SEO / 分享描述" wide>
                              <textarea
                                rows={3}
                                maxLength={320}
                                value={editForm.seoDescription}
                                onChange={(event) =>
                                  patchEdit({
                                    seoDescription: event.target.value,
                                  })
                                }
                              />
                            </Field>
                          </div>
                        </div>

                        <div className="studio-publication-publish">
                          <button
                            type="submit"
                            disabled={busyId === publication.id}
                          >
                            {busyId === publication.id
                              ? "保存中…"
                              : "保存资料"}
                          </button>
                          {publication.status !== "draft" && (
                            <button
                              type="button"
                              disabled={busyId === publication.id}
                              onClick={() =>
                                void updatePublication(
                                  publication,
                                  "draft",
                                )
                              }
                            >
                              撤回为草稿
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busyId === publication.id}
                            onClick={() =>
                              void updatePublication(
                                publication,
                                "scheduled",
                              )
                            }
                          >
                            定时发布
                          </button>
                          <button
                            type="button"
                            disabled={busyId === publication.id}
                            onClick={() =>
                              void updatePublication(
                                publication,
                                "published",
                              )
                            }
                          >
                            立即发布
                          </button>
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
    <label className={wide ? "is-wide" : ""}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function publicationToDraft(publication: Publication): PublicationDraft {
  return {
    collectionId: publication.collectionId,
    slug: publication.slug,
    headline: publication.headline,
    deck: publication.deck,
    body: publication.body,
    city: publication.city,
    releaseDate: publication.releaseDate,
    releaseAt: toLocalDateTime(publication.releaseAt),
    contactName: publication.contactName,
    contactEmail: publication.contactEmail,
    photography: publication.photography,
    styling: publication.styling,
    casting: publication.casting,
    hair: publication.hair,
    makeup: publication.makeup,
    production: publication.production,
    seoTitle: publication.seoTitle,
    seoDescription: publication.seoDescription,
    status: publication.status,
    sortOrder: String(publication.sortOrder),
  };
}

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function slugify(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

function sortPublications(items: Publication[]) {
  return [...items].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function statusLabel(publication: Publication) {
  if (publication.status === "published") return "已公开";
  if (publication.status === "scheduled") {
    const isLive =
      publication.releaseAt &&
      new Date(publication.releaseAt).getTime() <= Date.now();
    return isLive ? "定时已生效" : "等待定时";
  }
  return "草稿";
}

function statusMessage(status: PublicationStatus | undefined) {
  if (status === "published") return "官方发布已上线到 Press Room。";
  if (status === "scheduled") return "发布包已进入定时队列。";
  if (status === "draft") return "发布包已撤回为草稿。";
  return "发布资料已保存，预检状态已更新。";
}

function isPreflight(value: ApiPayload["readiness"]): value is Preflight {
  return Boolean(
    value &&
      !Array.isArray(value) &&
      "issues" in value &&
      Array.isArray(value.issues),
  );
}

function isReadinessMap(
  value: ApiPayload["readiness"],
): value is Record<string, Preflight> {
  return Boolean(value && !isPreflight(value));
}

async function fetchPublicationData() {
  const response = await fetch("/api/studio/publications", {
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok) {
    throw new Error(payload.error || "无法读取专业发布中心。");
  }
  return payload;
}
