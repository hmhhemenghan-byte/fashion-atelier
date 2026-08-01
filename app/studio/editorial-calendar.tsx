"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  EditorialCalendarItem,
  EditorialCalendarSnapshot,
  EditorialChannel,
  EditorialEventStatus,
  EditorialEventType,
  EditorialPriority,
} from "@/lib/editorial-calendar";

type ApiPayload = {
  snapshot?: EditorialCalendarSnapshot;
  event?: EditorialCalendarItem;
  deleted?: boolean;
  error?: string;
};

type EventForm = {
  title: string;
  eventType: EditorialEventType;
  channel: EditorialChannel;
  status: EditorialEventStatus;
  priority: EditorialPriority;
  startsAt: string;
  endsAt: string;
  timezone: string;
  allDay: boolean;
  location: string;
  notes: string;
  collectionId: string;
  workId: string;
  publicationId: string;
};

type FilterValue<T extends string> = "all" | T;

const weekDays = ["一", "二", "三", "四", "五", "六", "日"];

const typeLabels: Record<EditorialEventType, string> = {
  design_review: "设计审阅",
  fitting: "试衣",
  shoot: "拍摄",
  lookbook: "Lookbook",
  press: "媒体",
  launch: "发布",
  internal: "内部节点",
};

const channelLabels: Record<EditorialChannel, string> = {
  atelier: "Atelier",
  site: "官网",
  press: "媒体",
  showroom: "Showroom",
  social: "社交渠道",
};

const statusLabels: Record<EditorialEventStatus, string> = {
  planned: "已计划",
  in_progress: "进行中",
  ready: "已就绪",
  completed: "已完成",
  cancelled: "已取消",
};

const priorityLabels: Record<EditorialPriority, string> = {
  standard: "常规",
  high: "重点",
  critical: "关键",
};

export default function EditorialCalendar() {
  const [snapshot, setSnapshot] =
    useState<EditorialCalendarSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 12);
  });
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] =
    useState<FilterValue<EditorialEventType>>("all");
  const [statusFilter, setStatusFilter] =
    useState<FilterValue<EditorialEventStatus>>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [automaticId, setAutomaticId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(() => emptyForm());
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await requestCalendar();
        if (!cancelled) setSnapshot(next);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "无法读取编辑日历。",
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

  const visibleEvents = useMemo(() => {
    if (!snapshot) return [];
    const needle = query.trim().toLocaleLowerCase();
    return snapshot.events.filter((event) => {
      if (typeFilter !== "all" && event.eventType !== typeFilter) {
        return false;
      }
      if (statusFilter !== "all" && event.status !== statusFilter) {
        return false;
      }
      if (!needle) return true;
      return [
        event.title,
        event.location,
        event.notes,
        event.relationLabel,
        typeLabels[event.eventType],
        channelLabels[event.channel],
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [query, snapshot, statusFilter, typeFilter]);

  const calendarDays = useMemo(
    () => buildMonthDays(viewDate),
    [viewDate],
  );
  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, EditorialCalendarItem[]>();
    visibleEvents.forEach((event) => {
      const key = dateKey(new Date(event.startsAt));
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    });
    return grouped;
  }, [visibleEvents]);
  const runwayEvents = useMemo(
    () =>
      [...visibleEvents]
        .filter((event) => event.status !== "cancelled")
        .sort(
          (left, right) =>
            new Date(left.startsAt).getTime() -
            new Date(right.startsAt).getTime(),
        )
        .slice(0, 10),
    [visibleEvents],
  );
  const automaticEvent =
    snapshot?.events.find((event) => event.id === automaticId) ?? null;
  const filteredWorks = useMemo(() => {
    if (!snapshot) return [];
    if (!form.collectionId) return snapshot.references.works;
    const workIds = new Set(
      snapshot.references.assignments
        .filter(
          (assignment) =>
            assignment.collectionId === form.collectionId,
        )
        .map((assignment) => assignment.workId),
    );
    return snapshot.references.works.filter((work) => workIds.has(work.id));
  }, [form.collectionId, snapshot]);

  async function refresh(successMessage = "") {
    setError("");
    if (successMessage) setMessage(successMessage);
    try {
      setSnapshot(await requestCalendar());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "无法刷新编辑日历。",
      );
    }
  }

  function beginCreate(seed?: Date) {
    setEditingId(null);
    setAutomaticId(null);
    setDeleteConfirmId(null);
    setError("");
    setMessage("");
    setForm(emptyForm(seed));
    setEditorOpen(true);
  }

  function beginEdit(event: EditorialCalendarItem) {
    setError("");
    setMessage("");
    setDeleteConfirmId(null);
    if (!event.editable) {
      setEditingId(null);
      setEditorOpen(false);
      setAutomaticId(event.id);
      return;
    }
    setAutomaticId(null);
    setEditingId(event.id);
    setForm({
      title: event.title,
      eventType: event.eventType,
      channel: event.channel,
      status: event.status,
      priority: event.priority,
      startsAt: toInputDate(event.startsAt, event.allDay),
      endsAt: event.endsAt
        ? toInputDate(event.endsAt, event.allDay)
        : "",
      timezone: event.timezone,
      allDay: event.allDay,
      location: event.location,
      notes: event.notes,
      collectionId: event.collectionId ?? "",
      workId: event.workId ?? "",
      publicationId: event.publicationId ?? "",
    });
    setEditorOpen(true);
  }

  async function saveEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!form.title.trim() || !form.startsAt) {
      setError("排期名称与开始时间为必填项。");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        editingId
          ? `/api/studio/calendar/${encodeURIComponent(editingId)}`
          : "/api/studio/calendar",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...form,
            endsAt: form.endsAt || null,
            collectionId: form.collectionId || null,
            workId: form.workId || null,
            publicationId: form.publicationId || null,
          }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok) {
        throw new Error(payload.error || "排期保存失败。");
      }
      setEditorOpen(false);
      setEditingId(null);
      await refresh(editingId ? "排期已更新。" : "新排期已加入日历。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "排期保存失败。");
    } finally {
      setSaving(false);
    }
  }

  async function markCompleted(event: EditorialCalendarItem) {
    if (!event.editable) return;
    setError("");
    try {
      const response = await fetch(
        `/api/studio/calendar/${encodeURIComponent(event.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status:
              event.status === "completed" ? "in_progress" : "completed",
          }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok) {
        throw new Error(payload.error || "状态更新失败。");
      }
      await refresh(
        event.status === "completed"
          ? "排期已重新开启。"
          : "排期已标记完成。",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "状态更新失败。");
    }
  }

  async function removeEvent() {
    if (!editingId) return;
    if (deleteConfirmId !== editingId) {
      setDeleteConfirmId(editingId);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/studio/calendar/${encodeURIComponent(editingId)}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok) {
        throw new Error(payload.error || "删除排期失败。");
      }
      setEditorOpen(false);
      setEditingId(null);
      setDeleteConfirmId(null);
      await refresh("排期已删除。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除排期失败。");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="studio-calendar is-loading">
        <p>正在同步 Editorial Calendar…</p>
      </section>
    );
  }

  if (!snapshot) {
    return (
      <section className="studio-calendar is-loading">
        <p>{error || "编辑日历暂时不可用。"}</p>
        <button type="button" onClick={() => void refresh()}>
          重新读取
        </button>
      </section>
    );
  }

  return (
    <section
      className="studio-calendar"
      id="editorial-calendar"
      aria-labelledby="editorial-calendar-title"
    >
      <header className="studio-calendar-hero">
        <div>
          <span>06 / EDITORIAL CALENDAR</span>
          <h2 id="editorial-calendar-title">
            时间。节点。<i>成片。</i>
          </h2>
          <p>
            把试衣、拍摄、Lookbook、媒体交付和正式发布放进同一条编辑节奏，
            每个日期都能回到它对应的系列、作品或发布包。
          </p>
        </div>
        <div className="studio-calendar-stamp">
          <small>WORKING MONTH</small>
          <strong>{monthNumber(viewDate)}</strong>
          <span>{viewDate.getFullYear()}</span>
        </div>
      </header>

      <div className="studio-calendar-toolbar">
        <div>
          <button
            type="button"
            aria-label="上个月"
            onClick={() => setViewDate(shiftMonth(viewDate, -1))}
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setViewDate(
                new Date(now.getFullYear(), now.getMonth(), 1, 12),
              );
            }}
          >
            今天
          </button>
          <button
            type="button"
            aria-label="下个月"
            onClick={() => setViewDate(shiftMonth(viewDate, 1))}
          >
            →
          </button>
          <strong>{formatMonth(viewDate)}</strong>
        </div>
        <nav aria-label="编辑日历操作">
          <button
            type="button"
            onClick={() =>
              window.location.assign(
                "/api/studio/calendar?format=ics",
              )
            }
          >
            导出 iCal
          </button>
          <button type="button" onClick={() => void refresh("日历已刷新。")}>
            同步 ↻
          </button>
          <button
            className="is-primary"
            type="button"
            onClick={() => beginCreate()}
          >
            ＋ 新增排期
          </button>
        </nav>
      </div>

      <div className="studio-calendar-metrics">
        <CalendarMetric
          label="ACTIVE"
          value={snapshot.summary.upcoming}
          detail="未完成节点"
        />
        <CalendarMetric
          label="NEXT 07 DAYS"
          value={snapshot.summary.nextSevenDays}
          detail="近七日交付"
        />
        <CalendarMetric
          label="OVERDUE"
          value={snapshot.summary.overdue}
          detail="需要重新排期"
          alert={snapshot.summary.overdue > 0}
        />
        <CalendarMetric
          label="AUTO SYNC"
          value={snapshot.summary.automaticMilestones}
          detail="发布中心节点"
        />
      </div>

      <div className="studio-calendar-filters">
        <label>
          <span>TYPE</span>
          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(
                event.target.value as FilterValue<EditorialEventType>,
              )
            }
          >
            <option value="all">全部类型</option>
            {Object.entries(typeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>STATUS</span>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as FilterValue<EditorialEventStatus>,
              )
            }
          >
            <option value="all">全部状态</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="is-wide">
          <span>SEARCH</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="名称 / 场地 / 关联内容"
          />
        </label>
      </div>

      <div className="studio-calendar-notice" aria-live="polite">
        {error && <p className="is-error">{error}</p>}
        {message && <p>{message}</p>}
      </div>

      {(editorOpen || automaticEvent) && (
        <section className="studio-calendar-editor">
          {automaticEvent ? (
            <div className="studio-calendar-automatic">
              <div>
                <span>AUTOMATIC RELEASE MILESTONE</span>
                <h3>{automaticEvent.title}</h3>
              </div>
              <p>
                这个节点由发布中心的定时发布时间自动生成。日期与发布状态应在
                发布包中修改，日历会保持同步。
              </p>
              <div>
                {automaticEvent.relationHref && (
                  <a href={automaticEvent.relationHref}>打开发布包 →</a>
                )}
                <button type="button" onClick={() => setAutomaticId(null)}>
                  关闭
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={(event) => void saveEvent(event)}>
              <header>
                <div>
                  <span>
                    {editingId ? "EDIT SCHEDULE" : "NEW SCHEDULE"}
                  </span>
                  <h3>{editingId ? "调整编辑节点" : "建立新的编辑节点"}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditorOpen(false);
                    setEditingId(null);
                  }}
                >
                  关闭 ×
                </button>
              </header>
              <div className="studio-calendar-form-grid">
                <label className="is-wide">
                  <span>排期名称 *</span>
                  <input
                    required
                    maxLength={160}
                    value={form.title}
                    onChange={(event) =>
                      setForm({ ...form, title: event.target.value })
                    }
                    placeholder="例如：SECOND SKIN / CAMPAIGN SHOOT"
                  />
                </label>
                <label>
                  <span>类型</span>
                  <select
                    value={form.eventType}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        eventType: event.target
                          .value as EditorialEventType,
                      })
                    }
                  >
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>渠道</span>
                  <select
                    value={form.channel}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        channel: event.target.value as EditorialChannel,
                      })
                    }
                  >
                    {Object.entries(channelLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>状态</span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        status: event.target
                          .value as EditorialEventStatus,
                      })
                    }
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>优先级</span>
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        priority: event.target
                          .value as EditorialPriority,
                      })
                    }
                  >
                    {Object.entries(priorityLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>开始 *</span>
                  <input
                    required
                    type={form.allDay ? "date" : "datetime-local"}
                    value={form.startsAt}
                    onChange={(event) =>
                      setForm({ ...form, startsAt: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>结束</span>
                  <input
                    type={form.allDay ? "date" : "datetime-local"}
                    value={form.endsAt}
                    onChange={(event) =>
                      setForm({ ...form, endsAt: event.target.value })
                    }
                  />
                </label>
                <label className="studio-calendar-check">
                  <input
                    type="checkbox"
                    checked={form.allDay}
                    onChange={(event) => {
                      const allDay = event.target.checked;
                      setForm({
                        ...form,
                        allDay,
                        startsAt: allDay
                          ? form.startsAt.slice(0, 10)
                          : `${form.startsAt.slice(0, 10)}T10:00`,
                        endsAt: form.endsAt
                          ? allDay
                            ? form.endsAt.slice(0, 10)
                            : `${form.endsAt.slice(0, 10)}T18:00`
                          : "",
                      });
                    }}
                  />
                  <span>全天节点</span>
                </label>
                <label>
                  <span>时区</span>
                  <input
                    maxLength={80}
                    value={form.timezone}
                    onChange={(event) =>
                      setForm({ ...form, timezone: event.target.value })
                    }
                    placeholder="Europe/Paris"
                  />
                </label>
                <label className="is-wide">
                  <span>场地 / 交付位置</span>
                  <input
                    maxLength={240}
                    value={form.location}
                    onChange={(event) =>
                      setForm({ ...form, location: event.target.value })
                    }
                    placeholder="例如：Paris Showroom / Digital Delivery"
                  />
                </label>
                <label>
                  <span>关联系列</span>
                  <select
                    value={form.collectionId}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        collectionId: event.target.value,
                        workId: "",
                        publicationId: "",
                      })
                    }
                  >
                    <option value="">无</option>
                    {snapshot.references.collections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.title} / {collection.year}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>关联作品</span>
                  <select
                    value={form.workId}
                    onChange={(event) =>
                      setForm({ ...form, workId: event.target.value })
                    }
                  >
                    <option value="">无</option>
                    {filteredWorks.map((work) => (
                      <option key={work.id} value={work.id}>
                        {work.lookNumber || "LOOK"} / {work.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="is-wide">
                  <span>关联发布包</span>
                  <select
                    value={form.publicationId}
                    onChange={(event) => {
                      const publicationId = event.target.value;
                      const publication =
                        snapshot.references.publications.find(
                          (item) => item.id === publicationId,
                        );
                      setForm({
                        ...form,
                        publicationId,
                        collectionId:
                          publication?.collectionId ??
                          form.collectionId,
                      });
                    }}
                  >
                    <option value="">无</option>
                    {snapshot.references.publications.map((publication) => (
                      <option key={publication.id} value={publication.id}>
                        {publication.headline}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="is-wide">
                  <span>节点说明</span>
                  <textarea
                    rows={4}
                    maxLength={4000}
                    value={form.notes}
                    onChange={(event) =>
                      setForm({ ...form, notes: event.target.value })
                    }
                    placeholder="交付物、负责人、确认标准或现场备注"
                  />
                </label>
              </div>
              <footer>
                {editingId ? (
                  <button
                    className="is-danger"
                    type="button"
                    disabled={saving}
                    onClick={() => void removeEvent()}
                  >
                    {deleteConfirmId === editingId
                      ? "再次点击确认删除"
                      : "删除排期"}
                  </button>
                ) : (
                  <span>所有日期将保存到设计师后台。</span>
                )}
                <button
                  className="is-primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "正在保存…" : editingId ? "保存调整" : "加入日历"} →
                </button>
              </footer>
            </form>
          )}
        </section>
      )}

      <div className="studio-calendar-workbench">
        <section className="studio-calendar-month">
          <header>
            <div>
              <span>MONTH VIEW</span>
              <h3>{formatMonth(viewDate)}</h3>
            </div>
            <p>
              {String(visibleEvents.length).padStart(2, "0")} VISIBLE /{" "}
              {String(snapshot.summary.total).padStart(2, "0")} TOTAL
            </p>
          </header>
          <div className="studio-calendar-weekdays" aria-hidden="true">
            {weekDays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="studio-calendar-grid">
            {calendarDays.map((day) => {
              const key = dateKey(day);
              const dayEvents = eventsByDay.get(key) ?? [];
              const inMonth = day.getMonth() === viewDate.getMonth();
              return (
                <article
                  className={`${inMonth ? "" : "is-outside"}${
                    key === dateKey(new Date()) ? " is-today" : ""
                  }`}
                  key={key}
                >
                  <button
                    className="studio-calendar-day-number"
                    type="button"
                    onClick={() => beginCreate(day)}
                    aria-label={`在 ${formatLongDay(day)} 新增排期`}
                  >
                    <span>{day.getDate()}</span>
                    <small>＋</small>
                  </button>
                  <div>
                    {dayEvents.slice(0, 3).map((event) => (
                      <EventButton
                        event={event}
                        key={event.id}
                        onSelect={beginEdit}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="studio-calendar-more">
                        + {dayEvents.length - 3} MORE
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="studio-calendar-mobile-agenda">
            {visibleEvents.length === 0 ? (
              <CalendarEmpty onCreate={() => beginCreate()} />
            ) : (
              visibleEvents.slice(0, 24).map((event) => (
                <button
                  type="button"
                  key={event.id}
                  onClick={() => beginEdit(event)}
                >
                  <time dateTime={event.startsAt}>
                    {formatAgendaDate(event.startsAt)}
                  </time>
                  <div>
                    <span>{typeLabels[event.eventType]}</span>
                    <strong>{event.title}</strong>
                    <p>{event.relationLabel}</p>
                  </div>
                  <b>→</b>
                </button>
              ))
            )}
          </div>
        </section>

        <aside className="studio-calendar-runway">
          <header>
            <span>NEXT RUNWAY</span>
            <h3>编辑时间线</h3>
            <p>优先显示当前筛选结果中最接近的十个节点。</p>
          </header>
          {runwayEvents.length === 0 ? (
            <CalendarEmpty onCreate={() => beginCreate()} />
          ) : (
            <ol>
              {runwayEvents.map((event, index) => (
                <li
                  className={`is-${event.health} is-${event.priority}`}
                  key={event.id}
                >
                  <button type="button" onClick={() => beginEdit(event)}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <time dateTime={event.startsAt}>
                      {formatTimelineDate(event.startsAt)}
                    </time>
                    <div>
                      <small>
                        {typeLabels[event.eventType]} /{" "}
                        {channelLabels[event.channel]}
                      </small>
                      <strong>{event.title}</strong>
                      <p>{event.relationLabel}</p>
                    </div>
                    <b>{event.source === "publication" ? "SYNC" : "→"}</b>
                  </button>
                  {event.editable && (
                    <button
                      className="studio-calendar-done"
                      type="button"
                      onClick={() => void markCompleted(event)}
                    >
                      {event.status === "completed" ? "重新开启" : "标记完成"}
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </section>
  );
}

function EventButton({
  event,
  onSelect,
}: {
  event: EditorialCalendarItem;
  onSelect: (event: EditorialCalendarItem) => void;
}) {
  return (
    <button
      className={`studio-calendar-event is-${event.eventType} is-${event.health}`}
      type="button"
      title={`${event.title} · ${event.relationLabel}`}
      onClick={() => onSelect(event)}
    >
      <span>{formatTime(event)}</span>
      <strong>{event.title}</strong>
      {event.source === "publication" && <small>AUTO</small>}
    </button>
  );
}

function CalendarMetric({
  label,
  value,
  detail,
  alert = false,
}: {
  label: string;
  value: number;
  detail: string;
  alert?: boolean;
}) {
  return (
    <div className={alert ? "is-alert" : ""}>
      <span>{label}</span>
      <strong>{String(value).padStart(2, "0")}</strong>
      <small>{detail}</small>
    </div>
  );
}

function CalendarEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="studio-calendar-empty">
      <span>○</span>
      <strong>当前没有匹配的排期</strong>
      <p>建立第一个试衣、拍摄或发布节点。</p>
      <button type="button" onClick={onCreate}>
        新增排期 →
      </button>
    </div>
  );
}

async function requestCalendar() {
  const response = await fetch("/api/studio/calendar", {
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok || !payload.snapshot) {
    throw new Error(payload.error || "无法读取编辑日历。");
  }
  return payload.snapshot;
}

function emptyForm(seed = new Date()): EventForm {
  const next = new Date(seed);
  if (seed.getTime() === new Date(seed).setHours(12, 0, 0, 0)) {
    next.setHours(10, 0, 0, 0);
  } else {
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
  }
  const end = new Date(next.getTime() + 60 * 60 * 1000);
  return {
    title: "",
    eventType: "internal",
    channel: "atelier",
    status: "planned",
    priority: "standard",
    startsAt: toInputDate(next.toISOString(), false),
    endsAt: toInputDate(end.toISOString(), false),
    timezone:
      Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris",
    allDay: false,
    location: "",
    notes: "",
    collectionId: "",
    workId: "",
    publicationId: "",
  };
}

function buildMonthDays(viewDate: Date) {
  const first = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth(),
    1,
    12,
  );
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function shiftMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthNumber(date: Date) {
  return String(date.getMonth() + 1).padStart(2, "0");
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
  }).format(date);
}

function formatLongDay(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatAgendaDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatTimelineDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "2-digit",
  })
    .format(new Date(value))
    .toUpperCase();
}

function formatTime(event: EditorialCalendarItem) {
  if (event.allDay) return "ALL DAY";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(event.startsAt));
}

function toInputDate(value: string, allDay: boolean) {
  const date = new Date(value);
  if (allDay) return dateKey(date);
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
