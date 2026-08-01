"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ShowroomSampleStatus,
  ShowroomStatus,
  ShowroomWorkspace,
} from "@/lib/showrooms";

type StudioWork = {
  id: string;
  title: string;
  collection: string;
  lookNumber: string;
  description: string;
  altText: string;
  imageKey: string;
  status: "draft" | "published";
  sortOrder: number;
  createdAt: string;
};

type ApiPayload = {
  rooms?: ShowroomWorkspace[];
  room?: ShowroomWorkspace;
  showroom?: ShowroomWorkspace["showroom"];
  shareToken?: string;
  error?: string;
};

type LineupDraft = {
  workId: string;
  note: string;
  sampleStatus: ShowroomSampleStatus;
  featured: boolean;
};

const emptyCreateForm = {
  title: "",
  slug: "",
  subtitle: "",
  audienceLabel: "PRIVATE APPOINTMENT",
  introduction: "",
  expiresAt: "",
  contactName: "",
  contactEmail: "",
  allowDownloads: true,
};

const sampleStatuses: Array<{
  value: ShowroomSampleStatus;
  label: string;
}> = [
  { value: "available", label: "样衣可借" },
  { value: "on_request", label: "需确认" },
  { value: "unavailable", label: "仅供预览" },
];

export default function ShowroomManager(props: { works: StudioWork[] }) {
  const [rooms, setRooms] = useState<ShowroomWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [shareLinks, setShareLinks] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const nextRooms = await requestRooms();
        if (!cancelled) setRooms(nextRooms);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "无法读取私享展厅。",
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

  const metrics = useMemo(
    () => ({
      active: rooms.filter((room) => room.accessState === "active").length,
      draft: rooms.filter((room) => room.accessState === "draft").length,
      closed: rooms.filter(
        (room) =>
          room.accessState === "closed" ||
          room.accessState === "expired",
      ).length,
      looks: rooms.reduce((total, room) => total + room.items.length, 0),
    }),
    [rooms],
  );

  async function createRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!createForm.title.trim() || !createForm.slug.trim()) {
      setError("展厅名称与英文网址标识为必填项。");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/studio/showrooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          expiresAt: createForm.expiresAt
            ? new Date(createForm.expiresAt).toISOString()
            : null,
        }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.room || !payload.shareToken) {
        throw new Error(payload.error || "创建私享展厅失败。");
      }
      const shareLink = createShareLink(
        payload.room.showroom.slug,
        payload.shareToken,
      );
      setRooms((current) => [payload.room as ShowroomWorkspace, ...current]);
      setShareLinks((current) => ({
        ...current,
        [payload.room?.showroom.id as string]: shareLink,
      }));
      setCreateForm(emptyCreateForm);
      setMessage(
        "展厅草稿已建立。请完成选品并启用分享；初始访问链接只在当前页面保留。",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "创建私享展厅失败。",
      );
    } finally {
      setCreating(false);
    }
  }

  function updateRoom(room: ShowroomWorkspace) {
    setRooms((current) =>
      current.map((item) =>
        item.showroom.id === room.showroom.id ? room : item,
      ),
    );
  }

  function registerShareLink(roomId: string, slug: string, token: string) {
    setShareLinks((current) => ({
      ...current,
      [roomId]: createShareLink(slug, token),
    }));
    setMessage(
      "新的分享凭证已生成，旧链接已立即失效。请现在复制新链接。",
    );
  }

  if (loading) {
    return (
      <section className="studio-showrooms is-loading">
        <p>正在准备 Private Showroom…</p>
      </section>
    );
  }

  return (
    <section
      className="studio-showrooms"
      id="private-showrooms"
      aria-labelledby="private-showrooms-title"
    >
      <header className="studio-showrooms-hero">
        <div className="studio-showrooms-number" aria-hidden="true">
          08
        </div>
        <div>
          <span>08 / PRIVATE SHOWROOM</span>
          <h2 id="private-showrooms-title">
            选择。邀请。<i>会面。</i>
          </h2>
          <p>
            从现有作品库策划面向买手、造型师与媒体的私享选辑。每个页面拥有独立访问凭证、
            到期时间和打印 Line Sheet，不引入购物车与公开价格。
          </p>
        </div>
        <aside>
          <span>SHOWROOM PULSE</span>
          <strong>{String(metrics.active).padStart(2, "0")}</strong>
          <small>ACTIVE APPOINTMENTS</small>
          <div>
            <span>{metrics.draft} DRAFT</span>
            <span>{metrics.closed} CLOSED</span>
            <span>{metrics.looks} LOOKS</span>
          </div>
        </aside>
      </header>

      <div className="studio-showrooms-protocol">
        <span>SECURE SHARING / 安全分享</span>
        <p>
          访问密钥只显示一次，系统仅保存其 SHA-256 哈希。轮换凭证会立即使旧链接失效；
          当前站点仍为设计师私有，正式对外前还需确认站点访问范围。
        </p>
      </div>

      {(error || message) && (
        <div
          className={`studio-showrooms-notice${error ? " is-error" : ""}`}
          role="status"
        >
          {error || message}
        </div>
      )}

      <div className="studio-showrooms-body">
        <form
          className="studio-showroom-create"
          onSubmit={createRoom}
        >
          <header>
            <span>NEW APPOINTMENT</span>
            <h3>建立私享展厅</h3>
            <p>先建立草稿，再挑选 Look、补充会面说明并启用分享。</p>
          </header>
          <div className="studio-showroom-create-grid">
            <label>
              <span>展厅名称 *</span>
              <input
                value={createForm.title}
                maxLength={160}
                placeholder="SECOND SKIN / BUYER EDIT"
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                disabled={creating}
              />
            </label>
            <label>
              <span>英文网址标识 *</span>
              <input
                value={createForm.slug}
                maxLength={80}
                placeholder="second-skin-buyer-edit"
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    slug: slugify(event.target.value),
                  }))
                }
                disabled={creating}
              />
            </label>
            <label>
              <span>邀请对象</span>
              <input
                value={createForm.audienceLabel}
                maxLength={160}
                placeholder="PARIS BUYER APPOINTMENT"
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    audienceLabel: event.target.value,
                  }))
                }
                disabled={creating}
              />
            </label>
            <label>
              <span>到期时间（可选）</span>
              <input
                type="datetime-local"
                value={createForm.expiresAt}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    expiresAt: event.target.value,
                  }))
                }
                disabled={creating}
              />
            </label>
            <label className="is-wide">
              <span>展厅副标题</span>
              <input
                value={createForm.subtitle}
                maxLength={240}
                placeholder="A private edit of silhouette, structure and movement."
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    subtitle: event.target.value,
                  }))
                }
                disabled={creating}
              />
            </label>
            <label className="is-wide">
              <span>会面说明</span>
              <textarea
                value={createForm.introduction}
                maxLength={3000}
                rows={4}
                placeholder="说明本次选辑的叙事、适用场景与关注重点。"
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    introduction: event.target.value,
                  }))
                }
                disabled={creating}
              />
            </label>
            <label>
              <span>联系人</span>
              <input
                value={createForm.contactName}
                maxLength={160}
                placeholder="ATELIER PRESS OFFICE"
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    contactName: event.target.value,
                  }))
                }
                disabled={creating}
              />
            </label>
            <label>
              <span>联系邮箱</span>
              <input
                type="email"
                value={createForm.contactEmail}
                maxLength={200}
                placeholder="studio@example.com"
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    contactEmail: event.target.value,
                  }))
                }
                disabled={creating}
              />
            </label>
            <label className="studio-showroom-check is-wide">
              <input
                type="checkbox"
                checked={createForm.allowDownloads}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    allowDownloads: event.target.checked,
                  }))
                }
                disabled={creating}
              />
              <span>允许受邀者下载单张 Look 视觉</span>
            </label>
          </div>
          <button type="submit" disabled={creating}>
            {creating ? "正在建立安全展厅…" : "建立展厅草稿 →"}
          </button>
        </form>

        <section
          className="studio-showroom-register"
          aria-labelledby="showroom-register-title"
        >
          <header>
            <div>
              <span>APPOINTMENT REGISTER</span>
              <h3 id="showroom-register-title">展厅登记簿</h3>
            </div>
            <strong>{String(rooms.length).padStart(2, "0")} ROOMS</strong>
          </header>
          {rooms.length === 0 ? (
            <div className="studio-showroom-empty">
              <span>Ø</span>
              <strong>尚未建立私享展厅</strong>
              <p>从左侧建立第一个会面草稿，再选择作品。</p>
            </div>
          ) : (
            <div className="studio-showroom-list">
              {rooms.map((room, index) => (
                <RoomEditor
                  key={room.showroom.id}
                  index={index}
                  room={room}
                  works={props.works}
                  shareLink={shareLinks[room.showroom.id] || ""}
                  onUpdated={updateRoom}
                  onShareLink={registerShareLink}
                  onError={setError}
                  onMessage={setMessage}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function RoomEditor(props: {
  index: number;
  room: ShowroomWorkspace;
  works: StudioWork[];
  shareLink: string;
  onUpdated: (room: ShowroomWorkspace) => void;
  onShareLink: (roomId: string, slug: string, token: string) => void;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  const [open, setOpen] = useState(props.index === 0);
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [workQuery, setWorkQuery] = useState("");
  const [form, setForm] = useState(() => roomForm(props.room));
  const [lineup, setLineup] = useState<LineupDraft[]>(() =>
    roomLineup(props.room),
  );

  const workById = useMemo(
    () => new Map(props.works.map((work) => [work.id, work])),
    [props.works],
  );
  const selectedIds = useMemo(
    () => new Set(lineup.map((item) => item.workId)),
    [lineup],
  );
  const visibleWorks = useMemo(() => {
    const needle = workQuery.trim().toLocaleLowerCase();
    return props.works.filter(
      (work) =>
        !needle ||
        [work.title, work.collection, work.lookNumber]
          .join(" ")
          .toLocaleLowerCase()
          .includes(needle),
    );
  }, [props.works, workQuery]);

  async function saveMetadata(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    props.onError("");
    props.onMessage("");
    setSaving(true);
    try {
      const payload = await patchRoom(props.room.showroom.id, {
        ...form,
        expiresAt: form.expiresAt
          ? new Date(form.expiresAt).toISOString()
          : null,
      });
      props.onUpdated(payload);
      setForm(roomForm(payload));
      props.onMessage("展厅资料与访问规则已保存。");
    } catch (cause) {
      props.onError(
        cause instanceof Error ? cause.message : "保存展厅资料失败。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: ShowroomStatus) {
    props.onError("");
    props.onMessage("");
    setSaving(true);
    try {
      const payload = await patchRoom(props.room.showroom.id, { status });
      props.onUpdated(payload);
      props.onMessage(
        status === "active"
          ? "私享展厅已启用，最新访问链接现在可以打开。"
          : status === "closed"
            ? "私享展厅已关闭，现有访问链接无法继续进入。"
            : "私享展厅已转回草稿。",
      );
    } catch (cause) {
      props.onError(
        cause instanceof Error ? cause.message : "更新展厅状态失败。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveLineup() {
    props.onError("");
    props.onMessage("");
    setSaving(true);
    try {
      const response = await fetch(
        `/api/studio/showrooms/${encodeURIComponent(props.room.showroom.id)}/works`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: lineup }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.room) {
        throw new Error(payload.error || "保存展厅选品失败。");
      }
      props.onUpdated(payload.room);
      setLineup(roomLineup(payload.room));
      props.onMessage(`已保存 ${lineup.length} 件 Look 的展厅顺序与说明。`);
    } catch (cause) {
      props.onError(
        cause instanceof Error ? cause.message : "保存展厅选品失败。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function rotateToken() {
    props.onError("");
    props.onMessage("");
    setRotating(true);
    try {
      const response = await fetch(
        `/api/studio/showrooms/${encodeURIComponent(props.room.showroom.id)}/rotate-token`,
        { method: "POST" },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.showroom || !payload.shareToken) {
        throw new Error(payload.error || "更新分享凭证失败。");
      }
      props.onUpdated({
        ...props.room,
        showroom: payload.showroom,
      });
      props.onShareLink(
        payload.showroom.id,
        payload.showroom.slug,
        payload.shareToken,
      );
    } catch (cause) {
      props.onError(
        cause instanceof Error ? cause.message : "更新分享凭证失败。",
      );
    } finally {
      setRotating(false);
    }
  }

  async function copyShareLink() {
    if (!props.shareLink) return;
    try {
      await navigator.clipboard.writeText(props.shareLink);
      props.onMessage("私享展厅链接已复制。");
    } catch {
      props.onError("无法复制链接，请手动选择链接复制。");
    }
  }

  function toggleWork(work: StudioWork) {
    setLineup((current) => {
      if (current.some((item) => item.workId === work.id)) {
        const next = current.filter((item) => item.workId !== work.id);
        if (next.length > 0 && !next.some((item) => item.featured)) {
          next[0] = { ...next[0], featured: true };
        }
        return next;
      }
      return [
        ...current,
        {
          workId: work.id,
          note: "",
          sampleStatus: "on_request",
          featured: current.length === 0,
        },
      ];
    });
  }

  function updateLineupItem(
    workId: string,
    patch: Partial<LineupDraft>,
  ) {
    setLineup((current) =>
      current.map((item) => {
        if (patch.featured) {
          if (item.workId === workId) return { ...item, ...patch };
          return { ...item, featured: false };
        }
        return item.workId === workId ? { ...item, ...patch } : item;
      }),
    );
  }

  function moveItem(index: number, direction: -1 | 1) {
    setLineup((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const statusLabel =
    props.room.accessState === "active"
      ? "LIVE"
      : props.room.accessState === "expired"
        ? "EXPIRED"
        : props.room.accessState.toUpperCase();

  return (
    <article
      className={`studio-showroom-room is-${props.room.accessState}${open ? " is-open" : ""}`}
    >
      <button
        className="studio-showroom-room-head"
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span>{String(props.index + 1).padStart(2, "0")}</span>
        <div>
          <small>{props.room.showroom.audienceLabel}</small>
          <strong>{props.room.showroom.title}</strong>
        </div>
        <div>
          <span>{statusLabel}</span>
          <small>{props.room.items.length} LOOKS</small>
        </div>
        <b>{open ? "−" : "+"}</b>
      </button>

      {open && (
        <div className="studio-showroom-room-body">
          <div className="studio-showroom-actions">
            <a
              href={`/showroom/${encodeURIComponent(props.room.showroom.slug)}`}
              target="_blank"
              rel="noreferrer"
            >
              设计师预览 ↗
            </a>
            {props.shareLink ? (
              <button type="button" onClick={() => void copyShareLink()}>
                复制最新分享链接
              </button>
            ) : (
              <span>
                当前凭证末尾 · {props.room.showroom.accessTokenHint}
              </span>
            )}
            <button
              type="button"
              onClick={() => void rotateToken()}
              disabled={rotating}
            >
              {rotating ? "正在轮换…" : "生成新分享链接"}
            </button>
            {props.room.showroom.status !== "active" ? (
              <button
                type="button"
                onClick={() => void changeStatus("active")}
                disabled={saving}
              >
                启用分享
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void changeStatus("closed")}
                disabled={saving}
              >
                关闭访问
              </button>
            )}
          </div>

          {props.shareLink && (
            <div className="studio-showroom-secret">
              <span>ONE-TIME SHARE URL</span>
              <code>{props.shareLink}</code>
              <small>刷新页面后不会再次显示；需要时可轮换凭证。</small>
            </div>
          )}

          <form
            className="studio-showroom-meta"
            onSubmit={saveMetadata}
          >
            <header>
              <span>01 / APPOINTMENT DETAILS</span>
              <strong>会面资料</strong>
            </header>
            <div>
              <label>
                <span>展厅名称</span>
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>网址标识</span>
                <input
                  value={form.slug}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      slug: slugify(event.target.value),
                    }))
                  }
                />
              </label>
              <label>
                <span>邀请对象</span>
                <input
                  value={form.audienceLabel}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      audienceLabel: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>到期时间</span>
                <input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      expiresAt: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="is-wide">
                <span>副标题</span>
                <input
                  value={form.subtitle}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      subtitle: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="is-wide">
                <span>会面说明</span>
                <textarea
                  rows={4}
                  value={form.introduction}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      introduction: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>联系人</span>
                <input
                  value={form.contactName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      contactName: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>联系邮箱</span>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      contactEmail: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="studio-showroom-check is-wide">
                <input
                  type="checkbox"
                  checked={form.allowDownloads}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      allowDownloads: event.target.checked,
                    }))
                  }
                />
                <span>允许下载单张 Look 视觉</span>
              </label>
            </div>
            <button type="submit" disabled={saving}>
              {saving ? "正在保存…" : "保存会面资料"}
            </button>
          </form>

          <section className="studio-showroom-curation">
            <header>
              <div>
                <span>02 / CURATED LINEUP</span>
                <strong>选品与顺序</strong>
              </div>
              <label>
                <span>搜索作品</span>
                <input
                  value={workQuery}
                  placeholder="名称、系列或 Look 编号"
                  onChange={(event) => setWorkQuery(event.target.value)}
                />
              </label>
            </header>

            <div className="studio-showroom-work-picker">
              {visibleWorks.map((work) => (
                <button
                  className={selectedIds.has(work.id) ? "is-selected" : ""}
                  type="button"
                  key={work.id}
                  onClick={() => toggleWork(work)}
                >
                  <img src={workImageUrl(work.imageKey)} alt={work.altText} />
                  <span>{selectedIds.has(work.id) ? "SELECTED" : "ADD"}</span>
                  <strong>{work.title}</strong>
                  <small>
                    {work.lookNumber || work.collection} · {work.status}
                  </small>
                </button>
              ))}
            </div>

            {lineup.length > 0 && (
              <div className="studio-showroom-lineup-edit">
                {lineup.map((item, index) => {
                  const work = workById.get(item.workId);
                  if (!work) return null;
                  return (
                    <article key={item.workId}>
                      <div className="studio-showroom-lineup-index">
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <div>
                          <button
                            type="button"
                            onClick={() => moveItem(index, -1)}
                            disabled={index === 0}
                            aria-label={`上移 ${work.title}`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(index, 1)}
                            disabled={index === lineup.length - 1}
                            aria-label={`下移 ${work.title}`}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                      <img
                        src={workImageUrl(work.imageKey)}
                        alt={work.altText}
                      />
                      <div>
                        <strong>{work.title}</strong>
                        <small>
                          {work.lookNumber || work.collection}
                        </small>
                        <textarea
                          rows={2}
                          maxLength={800}
                          value={item.note}
                          placeholder="此会面专属说明"
                          onChange={(event) =>
                            updateLineupItem(item.workId, {
                              note: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <select
                          value={item.sampleStatus}
                          onChange={(event) =>
                            updateLineupItem(item.workId, {
                              sampleStatus: event.target
                                .value as ShowroomSampleStatus,
                            })
                          }
                        >
                          {sampleStatuses.map((status) => (
                            <option
                              key={status.value}
                              value={status.value}
                            >
                              {status.label}
                            </option>
                          ))}
                        </select>
                        <label>
                          <input
                            type="checkbox"
                            checked={item.featured}
                            onChange={(event) =>
                              updateLineupItem(item.workId, {
                                featured: event.target.checked,
                              })
                            }
                          />
                          <span>精选封面</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => toggleWork(work)}
                        >
                          移除
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <button
              className="studio-showroom-save-lineup"
              type="button"
              onClick={() => void saveLineup()}
              disabled={saving}
            >
              {saving
                ? "正在保存选品…"
                : `保存 ${lineup.length} 件 Look 的顺序与说明 →`}
            </button>
          </section>
        </div>
      )}
    </article>
  );
}

async function requestRooms() {
  const response = await fetch("/api/studio/showrooms", {
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok || !payload.rooms) {
    throw new Error(payload.error || "无法读取私享展厅。");
  }
  return payload.rooms;
}

async function patchRoom(
  id: string,
  patch: Record<string, unknown>,
) {
  const response = await fetch(
    `/api/studio/showrooms/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok || !payload.room) {
    throw new Error(payload.error || "保存私享展厅失败。");
  }
  return payload.room;
}

function roomForm(room: ShowroomWorkspace) {
  return {
    title: room.showroom.title,
    slug: room.showroom.slug,
    subtitle: room.showroom.subtitle,
    audienceLabel: room.showroom.audienceLabel,
    introduction: room.showroom.introduction,
    expiresAt: toInputDate(room.showroom.expiresAt),
    contactName: room.showroom.contactName,
    contactEmail: room.showroom.contactEmail,
    allowDownloads: room.showroom.allowDownloads,
  };
}

function roomLineup(room: ShowroomWorkspace): LineupDraft[] {
  return room.items.map(({ assignment }) => ({
    workId: assignment.workId,
    note: assignment.note,
    sampleStatus: assignment.sampleStatus as ShowroomSampleStatus,
    featured: assignment.featured,
  }));
}

function createShareLink(slug: string, token: string) {
  return new URL(
    `/showroom/${encodeURIComponent(slug)}?key=${encodeURIComponent(token)}`,
    window.location.origin,
  ).toString();
}

function toInputDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

function workImageUrl(imageKey: string) {
  return `/api/media/${imageKey
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}
