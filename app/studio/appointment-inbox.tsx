"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ShowroomRequestStatus,
  ShowroomRequestWorkspace,
} from "@/lib/showroom-requests";

type ApiPayload = {
  requests?: ShowroomRequestWorkspace[];
  request?: ShowroomRequestWorkspace | null;
  error?: string;
};

type StatusFilter = "all" | ShowroomRequestStatus;

const statuses: Array<{
  value: ShowroomRequestStatus;
  label: string;
}> = [
  { value: "submitted", label: "新提交" },
  { value: "reviewing", label: "审核中" },
  { value: "approved", label: "已确认" },
  { value: "declined", label: "未通过" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

export default function AppointmentInbox() {
  const [requests, setRequests] = useState<ShowroomRequestWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/studio/showroom-requests", {
          cache: "no-store",
        });
        const payload = (await response.json()) as ApiPayload;
        if (!response.ok || !payload.requests) {
          throw new Error(payload.error || "无法读取会面回应。");
        }
        if (!cancelled) setRequests(payload.requests);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "无法读取会面回应。",
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

  useEffect(() => {
    function completeRequest(event: Event) {
      const requestId = (
        event as CustomEvent<{ requestId?: string }>
      ).detail?.requestId;
      if (!requestId) return;
      setRequests((current) =>
        current.map((workspace) =>
          workspace.request.id === requestId
            ? {
                ...workspace,
                request: {
                  ...workspace.request,
                  status: "completed",
                  updatedAt: new Date().toISOString(),
                },
              }
            : workspace,
        ),
      );
    }
    window.addEventListener("nera:loan-closed", completeRequest);
    return () =>
      window.removeEventListener("nera:loan-closed", completeRequest);
  }, []);

  const metrics = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      new: requests.filter((item) => item.request.status === "submitted")
        .length,
      reviewing: requests.filter(
        (item) => item.request.status === "reviewing",
      ).length,
      approved: requests.filter(
        (item) => item.request.status === "approved",
      ).length,
      upcoming: requests.filter(
        (item) =>
          item.request.status === "approved" &&
          Boolean(item.request.neededFrom) &&
          (item.request.neededFrom as string) >= today,
      ).length,
    };
  }, [requests]);

  const visibleRequests = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return requests.filter((workspace) => {
      if (
        filter !== "all" &&
        workspace.request.status !== filter
      ) {
        return false;
      }
      if (!needle) return true;
      return [
        workspace.request.referenceCode,
        workspace.request.requesterName,
        workspace.request.requesterEmail,
        workspace.request.organization,
        workspace.request.projectTitle,
        workspace.showroom.title,
        ...workspace.items.map((item) => item.workTitle),
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [filter, query, requests]);

  function updateRequest(next: ShowroomRequestWorkspace) {
    setRequests((current) =>
      current.map((item) =>
        item.request.id === next.request.id ? next : item,
      ),
    );
    window.dispatchEvent(
      new CustomEvent("nera:request-updated", { detail: next }),
    );
  }

  if (loading) {
    return (
      <section className="studio-appointments is-loading">
        <p>正在准备 Appointment Response…</p>
      </section>
    );
  }

  return (
    <section
      className="studio-appointments"
      id="appointment-response"
      aria-labelledby="appointment-response-title"
    >
      <header className="studio-appointments-hero">
        <span className="studio-appointments-number" aria-hidden="true">
          09
        </span>
        <div>
          <span>09 / APPOINTMENT RESPONSE</span>
          <h2 id="appointment-response-title">
            接收。审核。<i>回应。</i>
          </h2>
          <p>
            将私享展厅从单向展示延伸为专业样衣请求入口：受邀者建立 Pull List，
            工作室审核项目、日期与可用性，再决定是否确认。
          </p>
        </div>
        <aside>
          <span>RESPONSE PULSE</span>
          <strong>{String(metrics.new).padStart(2, "0")}</strong>
          <small>NEW REQUESTS</small>
          <dl>
            <div>
              <dt>REVIEWING</dt>
              <dd>{metrics.reviewing}</dd>
            </div>
            <div>
              <dt>APPROVED</dt>
              <dd>{metrics.approved}</dd>
            </div>
            <div>
              <dt>UPCOMING</dt>
              <dd>{metrics.upcoming}</dd>
            </div>
          </dl>
        </aside>
      </header>

      <div className="studio-appointments-protocol">
        <span>PROFESSIONAL INTAKE / 专业需求登记</span>
        <p>
          请求只代表项目意向，不自动锁定样衣。访问凭证不会写入登记簿；
          联系资料、选品快照与审核记录会进入可导出的交接数据。
        </p>
      </div>

      {(error || message) && (
        <div
          className={`studio-appointments-notice${error ? " is-error" : ""}`}
          role="status"
        >
          {error || message}
        </div>
      )}

      <div className="studio-appointments-tools">
        <div className="studio-appointments-filters">
          <button
            type="button"
            className={filter === "all" ? "is-active" : ""}
            onClick={() => setFilter("all")}
          >
            全部 <span>{requests.length}</span>
          </button>
          {statuses.map((status) => {
            const count = requests.filter(
              (item) => item.request.status === status.value,
            ).length;
            return (
              <button
                type="button"
                key={status.value}
                className={filter === status.value ? "is-active" : ""}
                onClick={() => setFilter(status.value)}
              >
                {status.label} <span>{count}</span>
              </button>
            );
          })}
        </div>
        <label className="studio-appointments-search">
          <span>搜索请求</span>
          <input
            type="search"
            value={query}
            placeholder="编号、联系人、项目或 Look"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {/* This endpoint returns a file attachment, not an application page. */}
        <a
          href="/api/studio/showroom-requests?format=csv"
          download
        >
          导出请求台账 CSV ↘
        </a>
      </div>

      {requests.length === 0 ? (
        <div className="studio-appointments-empty">
          <span>INBOX / 00</span>
          <h3>等待第一条专业回应。</h3>
          <p>
            当受邀者通过有效 Private Showroom 链接提交 Pull List，
            请求会在这里进入“新提交”队列。
          </p>
        </div>
      ) : visibleRequests.length === 0 ? (
        <div className="studio-appointments-empty">
          <span>NO MATCH</span>
          <h3>当前筛选没有请求。</h3>
          <p>调整状态或搜索关键词即可返回完整台账。</p>
        </div>
      ) : (
        <div className="studio-appointments-list">
          {visibleRequests.map((workspace, index) => (
            <RequestCard
              key={workspace.request.id}
              index={index}
              workspace={workspace}
              onUpdated={updateRequest}
              onError={setError}
              onMessage={setMessage}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RequestCard(props: {
  index: number;
  workspace: ShowroomRequestWorkspace;
  onUpdated: (request: ShowroomRequestWorkspace) => void;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  const [open, setOpen] = useState(
    props.workspace.request.status === "submitted" && props.index < 3,
  );
  const [saving, setSaving] = useState(false);
  const [internalNotes, setInternalNotes] = useState(
    props.workspace.request.internalNotes,
  );
  const { request, showroom, items } = props.workspace;

  async function patchRequest(
    patch: Partial<{
      status: ShowroomRequestStatus;
      internalNotes: string;
    }>,
  ) {
    props.onError("");
    props.onMessage("");
    setSaving(true);
    try {
      const response = await fetch(
        `/api/studio/showroom-requests/${encodeURIComponent(request.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.request) {
        throw new Error(payload.error || "保存请求失败。");
      }
      props.onUpdated(payload.request);
      setInternalNotes(payload.request.request.internalNotes);
      props.onMessage(
        patch.status
          ? `请求 ${request.referenceCode} 已更新为「${statusLabel(patch.status)}」。`
          : `请求 ${request.referenceCode} 的内部备注已保存。`,
      );
    } catch (cause) {
      props.onError(
        cause instanceof Error ? cause.message : "保存请求失败。",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <article
      className={`studio-appointment is-${request.status}${open ? " is-open" : ""}`}
    >
      <button
        className="studio-appointment-head"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{request.referenceCode}</span>
        <div>
          <small>{showroom.title}</small>
          <strong>{request.projectTitle}</strong>
        </div>
        <div>
          <strong>{request.requesterName}</strong>
          <small>
            {request.organization || roleLabel(request.requesterRole)}
          </small>
        </div>
        <time dateTime={request.createdAt}>
          {formatDateTime(request.createdAt)}
        </time>
        <b>{statusLabel(request.status)}</b>
        <i>{open ? "−" : "+"}</i>
      </button>

      {open && (
        <div className="studio-appointment-body">
          <section className="studio-appointment-brief">
            <header>
              <div>
                <span>REQUEST BRIEF</span>
                <h3>{request.projectTitle}</h3>
              </div>
              <a
                href={`/showroom/${encodeURIComponent(showroom.slug)}`}
                target="_blank"
                rel="noreferrer"
              >
                预览对应展厅 ↗
              </a>
            </header>
            <dl>
              <div>
                <dt>REQUESTER</dt>
                <dd>{request.requesterName}</dd>
              </div>
              <div>
                <dt>CONTACT</dt>
                <dd>
                  <a href={`mailto:${request.requesterEmail}`}>
                    {request.requesterEmail}
                  </a>
                </dd>
              </div>
              <div>
                <dt>ROLE</dt>
                <dd>{roleLabel(request.requesterRole)}</dd>
              </div>
              <div>
                <dt>PURPOSE</dt>
                <dd>{purposeLabel(request.purpose)}</dd>
              </div>
              <div>
                <dt>WINDOW</dt>
                <dd>{dateWindow(request.neededFrom, request.neededUntil)}</dd>
              </div>
              <div>
                <dt>CITY</dt>
                <dd>{request.deliveryCity || "TO CONFIRM"}</dd>
              </div>
            </dl>
            {request.notes && (
              <blockquote>
                <span>PROJECT NOTES</span>
                <p>{request.notes}</p>
              </blockquote>
            )}
          </section>

          <section className="studio-appointment-pull">
            <header>
              <span>PULL LIST</span>
              <strong>{String(items.length).padStart(2, "0")} LOOKS</strong>
            </header>
            <div>
              {items.map((item, index) => (
                <article key={item.id}>
                  {item.imageKey ? (
                    <img
                      src={mediaUrl(item.imageKey)}
                      alt={item.workTitle}
                    />
                  ) : (
                    <span className="is-missing">NO IMAGE</span>
                  )}
                  <div>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{item.workTitle}</strong>
                    <small>
                      {item.lookNumber || "NO LOOK NUMBER"} ·{" "}
                      {item.sampleStatus === "available"
                        ? "AVAILABLE"
                        : "ON REQUEST"}
                    </small>
                    {item.itemNote && <p>{item.itemNote}</p>}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="studio-appointment-review">
            <header>
              <span>ATELIER REVIEW</span>
              <strong>{statusLabel(request.status)}</strong>
            </header>
            <div className="studio-appointment-statuses">
              {statuses.map((status) => (
                <button
                  type="button"
                  key={status.value}
                  className={
                    request.status === status.value ? "is-active" : ""
                  }
                  disabled={saving || request.status === status.value}
                  onClick={() =>
                    void patchRequest({ status: status.value })
                  }
                >
                  {status.label}
                </button>
              ))}
            </div>
            {request.status === "approved" && (
              <a
                className="studio-appointment-fulfilment-link"
                href="#sample-fulfilment"
              >
                前往样衣履约工作台 ↓
              </a>
            )}
            <label>
              <span>内部备注（访客不可见）</span>
              <textarea
                rows={7}
                maxLength={3000}
                value={internalNotes}
                placeholder="记录尺码、借调、快递、押金或回收安排。"
                onChange={(event) => setInternalNotes(event.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={
                saving || internalNotes === request.internalNotes
              }
              onClick={() => void patchRequest({ internalNotes })}
            >
              {saving ? "正在保存…" : "保存内部备注"}
            </button>
            <small>
              {request.reviewedAt
                ? `LAST REVIEW · ${formatDateTime(request.reviewedAt)}`
                : "AWAITING FIRST REVIEW"}
            </small>
          </aside>
        </div>
      )}
    </article>
  );
}

function mediaUrl(imageKey: string) {
  return `/api/media/${imageKey
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function statusLabel(status: ShowroomRequestStatus) {
  return (
    statuses.find((item) => item.value === status)?.label ??
    status.toUpperCase()
  );
}

function roleLabel(value: string) {
  const labels: Record<string, string> = {
    buyer: "BUYER / 买手",
    stylist: "STYLIST / 造型师",
    editorial: "EDITORIAL / 编辑媒体",
    talent: "TALENT / 艺人团队",
    other: "OTHER / 其他",
  };
  return labels[value] || value.toUpperCase();
}

function purposeLabel(value: string) {
  const labels: Record<string, string> = {
    editorial_shoot: "EDITORIAL SHOOT / 编辑拍摄",
    red_carpet: "RED CARPET / 红毯",
    fitting: "FITTING / 试衣",
    buyer_review: "BUYER REVIEW / 买手审款",
    event: "EVENT / 活动",
    other: "OTHER / 其他",
  };
  return labels[value] || value.toUpperCase();
}

function dateWindow(from: string | null, until: string | null) {
  if (!from && !until) return "TO CONFIRM";
  if (from && until) return `${formatDate(from)} — ${formatDate(until)}`;
  return formatDate(from || until || "");
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(date)
    .toUpperCase();
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .toUpperCase();
}
