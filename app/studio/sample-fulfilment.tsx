"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  SampleCondition,
  SampleLoanItemStatus,
  SampleLoanStatus,
  SampleLoanWorkspace,
} from "@/lib/sample-loans";
import type { ShowroomRequestWorkspace } from "@/lib/showroom-requests";

type ApiPayload = {
  loans?: SampleLoanWorkspace[];
  loan?: SampleLoanWorkspace | null;
  eligibleRequests?: ShowroomRequestWorkspace[];
  error?: string;
};

type BoardFilter =
  | "all"
  | "preparing"
  | "outbound"
  | "active"
  | "returns"
  | "closed"
  | "exceptions";

const loanStatuses: Array<{
  value: SampleLoanStatus;
  label: string;
  short: string;
}> = [
  { value: "preparing", label: "准备中", short: "PREP" },
  { value: "ready", label: "待寄出", short: "READY" },
  { value: "dispatched", label: "已寄出", short: "OUT" },
  { value: "delivered", label: "已送达", short: "DELIVERED" },
  { value: "in_use", label: "使用中", short: "IN USE" },
  { value: "return_due", label: "待归还", short: "DUE" },
  { value: "return_in_transit", label: "归还途中", short: "RETURNING" },
  { value: "returned", label: "已收回", short: "RETURNED" },
  { value: "closed", label: "已关闭", short: "CLOSED" },
  { value: "cancelled", label: "已取消", short: "CANCELLED" },
];

const itemStatuses: Array<{
  value: SampleLoanItemStatus;
  label: string;
}> = [
  { value: "reserved", label: "已预留" },
  { value: "packing", label: "打包中" },
  { value: "dispatched", label: "已寄出" },
  { value: "with_recipient", label: "借出中" },
  { value: "returning", label: "归还途中" },
  { value: "returned", label: "已归还" },
  { value: "unavailable", label: "无法提供" },
  { value: "damaged", label: "损坏" },
  { value: "lost", label: "遗失" },
];

const conditions: Array<{ value: SampleCondition; label: string }> = [
  { value: "not_checked", label: "未检查" },
  { value: "excellent", label: "极佳" },
  { value: "good", label: "良好" },
  { value: "worn", label: "有使用痕迹" },
  { value: "damaged", label: "损坏" },
];

const boardFilters: Array<{ value: BoardFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "preparing", label: "准备" },
  { value: "outbound", label: "寄送" },
  { value: "active", label: "借出" },
  { value: "returns", label: "归还" },
  { value: "closed", label: "完成" },
  { value: "exceptions", label: "异常" },
];

export default function SampleFulfilment() {
  const [loans, setLoans] = useState<SampleLoanWorkspace[]>([]);
  const [eligible, setEligible] = useState<ShowroomRequestWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<BoardFilter>("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/studio/sample-loans", {
          cache: "no-store",
        });
        const payload = (await response.json()) as ApiPayload;
        if (!response.ok || !payload.loans || !payload.eligibleRequests) {
          throw new Error(payload.error || "无法读取样衣履约工作台。");
        }
        if (!cancelled) {
          setLoans(payload.loans);
          setEligible(payload.eligibleRequests);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "无法读取样衣履约工作台。",
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
    function syncApprovedRequest(event: Event) {
      const workspace = (
        event as CustomEvent<ShowroomRequestWorkspace>
      ).detail;
      if (!workspace?.request) return;
      setEligible((current) => {
        const withoutCurrent = current.filter(
          (item) => item.request.id !== workspace.request.id,
        );
        const alreadyInFulfilment = loans.some(
          (loan) => loan.loan.requestId === workspace.request.id,
        );
        return workspace.request.status === "approved" &&
          !alreadyInFulfilment
          ? [workspace, ...withoutCurrent]
          : withoutCurrent;
      });
    }
    window.addEventListener("nera:request-updated", syncApprovedRequest);
    return () =>
      window.removeEventListener(
        "nera:request-updated",
        syncApprovedRequest,
      );
  }, [loans]);

  useEffect(() => {
    function syncInventoryAssignment(event: Event) {
      const workspace = (event as CustomEvent<SampleLoanWorkspace>).detail;
      if (!workspace?.loan) return;
      setLoans((current) =>
        current.map((item) =>
          item.loan.id === workspace.loan.id ? workspace : item,
        ),
      );
    }
    window.addEventListener(
      "nera:inventory-updated",
      syncInventoryAssignment,
    );
    return () =>
      window.removeEventListener(
        "nera:inventory-updated",
        syncInventoryAssignment,
      );
  }, []);

  const metrics = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      active: loans.filter(
        (item) =>
          !["closed", "cancelled", "returned"].includes(item.loan.status),
      ).length,
      outbound: loans.filter((item) =>
        ["dispatched", "delivered"].includes(item.loan.status),
      ).length,
      due: loans.filter((item) =>
        ["return_due", "return_in_transit"].includes(item.loan.status),
      ).length,
      overdue: loans.filter(
        (item) =>
          Boolean(item.loan.expectedReturnAt) &&
          (item.loan.expectedReturnAt as string) < today &&
          !["returned", "closed", "cancelled"].includes(item.loan.status),
      ).length,
      exceptions: loans.reduce(
        (total, item) =>
          total +
          item.items.filter((sample) =>
            ["damaged", "lost"].includes(sample.status),
          ).length,
        0,
      ),
    };
  }, [loans]);

  const visibleLoans = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return loans.filter((workspace) => {
      if (!matchesFilter(workspace, filter)) return false;
      if (!needle) return true;
      return [
        workspace.loan.loanCode,
        workspace.request.referenceCode,
        workspace.request.projectTitle,
        workspace.request.requesterName,
        workspace.request.requesterEmail,
        workspace.request.organization,
        workspace.showroom.title,
        workspace.loan.outboundTracking,
        workspace.loan.returnTracking,
        ...workspace.items.flatMap((item) => [
          item.workTitle,
          item.lookNumber,
          item.sampleCode,
        ]),
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [filter, loans, query]);

  async function createLoan(requestId: string) {
    setError("");
    setMessage("");
    setCreatingId(requestId);
    try {
      const response = await fetch("/api/studio/sample-loans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.loan) {
        throw new Error(payload.error || "建立样衣借调单失败。");
      }
      setLoans((current) => [payload.loan as SampleLoanWorkspace, ...current]);
      setEligible((current) =>
        current.filter((item) => item.request.id !== requestId),
      );
      window.dispatchEvent(
        new CustomEvent("nera:loan-updated", {
          detail: payload.loan,
        }),
      );
      setMessage(
        `借调单 ${payload.loan.loan.loanCode} 已建立，样衣进入准备队列。`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "建立样衣借调单失败。",
      );
    } finally {
      setCreatingId(null);
    }
  }

  function updateLoan(next: SampleLoanWorkspace) {
    setLoans((current) =>
      current.map((item) =>
        item.loan.id === next.loan.id ? next : item,
      ),
    );
    window.dispatchEvent(
      new CustomEvent("nera:loan-updated", { detail: next }),
    );
  }

  if (loading) {
    return (
      <section className="studio-fulfilment is-loading">
        <p>正在准备 Sample Fulfilment…</p>
      </section>
    );
  }

  return (
    <section
      className="studio-fulfilment"
      id="sample-fulfilment"
      aria-labelledby="sample-fulfilment-title"
    >
      <header className="studio-fulfilment-hero">
        <span className="studio-fulfilment-number" aria-hidden="true">
          10
        </span>
        <div>
          <span>10 / SAMPLE FULFILMENT</span>
          <h2 id="sample-fulfilment-title">
            借出。追踪。<i>归还。</i>
          </h2>
          <p>
            把已批准的 Pull Request 转成可执行的样衣借调单，逐件记录样衣编号、
            状况、寄送、在外使用与归还结果。
          </p>
        </div>
        <aside>
          <span>LOAN CONTROL</span>
          <strong>{String(metrics.active).padStart(2, "0")}</strong>
          <small>ACTIVE LOANS</small>
          <dl>
            <div>
              <dt>OUTBOUND</dt>
              <dd>{metrics.outbound}</dd>
            </div>
            <div>
              <dt>DUE</dt>
              <dd>{metrics.due}</dd>
            </div>
            <div className={metrics.overdue ? "is-alert" : ""}>
              <dt>OVERDUE</dt>
              <dd>{metrics.overdue}</dd>
            </div>
            <div className={metrics.exceptions ? "is-alert" : ""}>
              <dt>EXCEPTIONS</dt>
              <dd>{metrics.exceptions}</dd>
            </div>
          </dl>
        </aside>
      </header>

      <div className="studio-fulfilment-protocol">
        <span>ASSET CUSTODY / 样衣责任链</span>
        <p>
          每件样衣保留独立编号、尺码、出库状况与归还状况；总单状态推进时会同步普通样衣，
          但损坏、遗失与无法提供等异常记录不会被覆盖。
        </p>
      </div>

      {(error || message) && (
        <div
          className={`studio-fulfilment-notice${error ? " is-error" : ""}`}
          role="status"
        >
          {error || message}
        </div>
      )}

      <section className="studio-fulfilment-ready">
        <header>
          <div>
            <span>APPROVED REQUESTS</span>
            <h3>待建立借调单</h3>
          </div>
          <strong>{String(eligible.length).padStart(2, "0")} READY</strong>
        </header>
        {eligible.length === 0 ? (
          <p>
            暂无待转履约的请求。请先在第 09 阶段将合适的 Pull Request
            更新为“已确认”。
          </p>
        ) : (
          <div>
            {eligible.map((workspace) => (
              <article key={workspace.request.id}>
                <div>
                  <span>{workspace.request.referenceCode}</span>
                  <small>{workspace.showroom.title}</small>
                  <h4>{workspace.request.projectTitle}</h4>
                  <p>
                    {workspace.request.requesterName}
                    {workspace.request.organization
                      ? ` · ${workspace.request.organization}`
                      : ""}
                  </p>
                </div>
                <div className="studio-fulfilment-ready-looks">
                  {workspace.items.slice(0, 4).map((item) => (
                    <img
                      key={item.id}
                      src={mediaUrl(item.imageKey)}
                      alt={item.workTitle}
                    />
                  ))}
                  <span>{workspace.items.length} LOOKS</span>
                </div>
                <dl>
                  <div>
                    <dt>NEEDED</dt>
                    <dd>
                      {dateWindow(
                        workspace.request.neededFrom,
                        workspace.request.neededUntil,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>CITY</dt>
                    <dd>{workspace.request.deliveryCity || "TO CONFIRM"}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  disabled={creatingId === workspace.request.id}
                  onClick={() => void createLoan(workspace.request.id)}
                >
                  {creatingId === workspace.request.id
                    ? "正在建立…"
                    : "建立借调单 →"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="studio-fulfilment-tools">
        <div className="studio-fulfilment-filters">
          {boardFilters.map((item) => (
            <button
              type="button"
              key={item.value}
              className={filter === item.value ? "is-active" : ""}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
              <span>
                {
                  loans.filter((loan) => matchesFilter(loan, item.value))
                    .length
                }
              </span>
            </button>
          ))}
        </div>
        <label>
          <span>搜索借调单</span>
          <input
            type="search"
            value={query}
            placeholder="编号、项目、联系人、物流单号"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <a href="/api/studio/sample-loans?format=csv" download>
          导出借调台账 CSV ↘
        </a>
      </div>

      {loans.length === 0 ? (
        <div className="studio-fulfilment-empty">
          <span>LOAN REGISTER / 00</span>
          <h3>尚未建立样衣借调单。</h3>
          <p>从上方已批准请求建立第一条履约记录。</p>
        </div>
      ) : visibleLoans.length === 0 ? (
        <div className="studio-fulfilment-empty">
          <span>NO MATCH</span>
          <h3>当前筛选没有借调单。</h3>
          <p>调整状态或搜索关键词即可返回完整台账。</p>
        </div>
      ) : (
        <div className="studio-fulfilment-list">
          {visibleLoans.map((workspace, index) => (
            <LoanCard
              key={workspace.loan.id}
              index={index}
              workspace={workspace}
              onUpdated={updateLoan}
              onError={setError}
              onMessage={setMessage}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function LoanCard(props: {
  index: number;
  workspace: SampleLoanWorkspace;
  onUpdated: (workspace: SampleLoanWorkspace) => void;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  const [open, setOpen] = useState(
    !["closed", "cancelled"].includes(props.workspace.loan.status) &&
      props.index < 2,
  );
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => loanForm(props.workspace));
  const { loan, request, showroom, items } = props.workspace;
  const overdue = isLoanOverdue(props.workspace);

  async function patchLoan(
    patch: Record<string, unknown>,
    successMessage: string,
  ) {
    props.onError("");
    props.onMessage("");
    setSaving(true);
    try {
      const response = await fetch(
        `/api/studio/sample-loans/${encodeURIComponent(loan.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.loan) {
        throw new Error(payload.error || "保存借调单失败。");
      }
      props.onUpdated(payload.loan);
      setForm(loanForm(payload.loan));
      if (patch.status === "closed") {
        window.dispatchEvent(
          new CustomEvent("nera:loan-closed", {
            detail: { requestId: payload.loan.request.id },
          }),
        );
      }
      props.onMessage(successMessage);
    } catch (cause) {
      props.onError(
        cause instanceof Error ? cause.message : "保存借调单失败。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveLogistics(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await patchLoan(
      {
        ...form,
        outboundSentAt: toIsoDateTime(form.outboundSentAt),
        deliveredAt: toIsoDateTime(form.deliveredAt),
        expectedReturnAt: form.expectedReturnAt || null,
        returnReceivedAt: toIsoDateTime(form.returnReceivedAt),
      },
      `借调单 ${loan.loanCode} 的物流资料已保存。`,
    );
  }

  return (
    <article
      className={`studio-loan is-${loan.status}${open ? " is-open" : ""}${overdue ? " is-overdue" : ""}`}
    >
      <button
        className="studio-loan-head"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{loan.loanCode}</span>
        <div>
          <small>{request.referenceCode} · {showroom.title}</small>
          <strong>{request.projectTitle}</strong>
        </div>
        <div>
          <strong>{request.requesterName}</strong>
          <small>{request.organization || request.requesterEmail}</small>
        </div>
        <div>
          <small>RETURN TARGET</small>
          <strong>
            {loan.expectedReturnAt
              ? formatDate(loan.expectedReturnAt)
              : "TO CONFIRM"}
          </strong>
        </div>
        <b>{overdue ? "OVERDUE" : loanStatusLabel(loan.status)}</b>
        <i>{open ? "−" : "+"}</i>
      </button>

      {open && (
        <div className="studio-loan-body">
          <section className="studio-loan-overview">
            <header>
              <div>
                <span>LOAN BRIEF</span>
                <h3>{request.projectTitle}</h3>
              </div>
              <div className="studio-loan-overview-actions">
                <a href="#sample-correspondence">沟通留痕 ↓</a>
                <a href={`mailto:${request.requesterEmail}`}>
                  联系借用方 ↗
                </a>
              </div>
            </header>
            <dl>
              <div>
                <dt>REQUESTER</dt>
                <dd>{request.requesterName}</dd>
              </div>
              <div>
                <dt>ORGANIZATION</dt>
                <dd>{request.organization || "INDEPENDENT"}</dd>
              </div>
              <div>
                <dt>PURPOSE</dt>
                <dd>{purposeLabel(request.purpose)}</dd>
              </div>
              <div>
                <dt>DESTINATION</dt>
                <dd>{request.deliveryCity || "TO CONFIRM"}</dd>
              </div>
              <div>
                <dt>PROJECT WINDOW</dt>
                <dd>{dateWindow(request.neededFrom, request.neededUntil)}</dd>
              </div>
              <div>
                <dt>ITEMS</dt>
                <dd>{String(items.length).padStart(2, "0")} SAMPLES</dd>
              </div>
            </dl>
            <div className="studio-loan-timeline">
              {loanStatuses
                .filter((item) => item.value !== "cancelled")
                .map((status, index) => {
                  const currentIndex = loanStatuses.findIndex(
                    (item) => item.value === loan.status,
                  );
                  return (
                    <span
                      key={status.value}
                      className={
                        loan.status !== "cancelled" && index <= currentIndex
                          ? "is-reached"
                          : ""
                      }
                    >
                      <b>{String(index + 1).padStart(2, "0")}</b>
                      <small>{status.short}</small>
                    </span>
                  );
                })}
            </div>
          </section>

          <section className="studio-loan-samples">
            <header>
              <div>
                <span>ITEM CUSTODY</span>
                <h3>逐件样衣记录</h3>
              </div>
              <strong>
                {
                  items.filter((item) =>
                    ["damaged", "lost"].includes(item.status),
                  ).length
                }{" "}
                EXCEPTIONS
              </strong>
            </header>
            <div>
              {items.map((item, index) => (
                <SampleItemEditor
                  key={`${item.id}:${item.updatedAt}`}
                  index={index}
                  item={item}
                  loanId={loan.id}
                  onUpdated={props.onUpdated}
                  onError={props.onError}
                  onMessage={props.onMessage}
                />
              ))}
            </div>
          </section>

          <form className="studio-loan-logistics" onSubmit={saveLogistics}>
            <header>
              <span>LOGISTICS DESK</span>
              <strong>寄送与归还</strong>
            </header>
            <div className="studio-loan-statuses">
              {loanStatuses.map((status) => (
                <button
                  type="button"
                  key={status.value}
                  className={loan.status === status.value ? "is-active" : ""}
                  disabled={saving || loan.status === status.value}
                  onClick={() =>
                    void patchLoan(
                      { status: status.value },
                      `借调单 ${loan.loanCode} 已更新为「${status.label}」。`,
                    )
                  }
                >
                  <span>{status.short}</span>
                  <small>{status.label}</small>
                </button>
              ))}
            </div>
            <div className="studio-loan-logistics-grid">
              <label>
                <span>联系电话</span>
                <input
                  value={form.contactPhone}
                  maxLength={80}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      contactPhone: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="is-wide">
                <span>完整寄送地址</span>
                <textarea
                  rows={3}
                  value={form.deliveryAddress}
                  maxLength={1000}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      deliveryAddress: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>寄出承运方</span>
                <input
                  value={form.outboundCarrier}
                  maxLength={120}
                  placeholder="DHL / FedEx / Courier"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      outboundCarrier: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>寄出物流单号</span>
                <input
                  value={form.outboundTracking}
                  maxLength={200}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      outboundTracking: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>实际寄出时间</span>
                <input
                  type="datetime-local"
                  value={form.outboundSentAt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      outboundSentAt: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>确认送达时间</span>
                <input
                  type="datetime-local"
                  value={form.deliveredAt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      deliveredAt: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="is-wide">
                <span>预计归还日期</span>
                <input
                  type="date"
                  value={form.expectedReturnAt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      expectedReturnAt: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>归还承运方</span>
                <input
                  value={form.returnCarrier}
                  maxLength={120}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      returnCarrier: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>归还物流单号</span>
                <input
                  value={form.returnTracking}
                  maxLength={200}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      returnTracking: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="is-wide">
                <span>实际收回时间</span>
                <input
                  type="datetime-local"
                  value={form.returnReceivedAt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      returnReceivedAt: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="is-wide">
                <span>物流与借调备注</span>
                <textarea
                  rows={5}
                  value={form.logisticsNotes}
                  maxLength={3000}
                  placeholder="包装、保险、押金、联系人、快递窗口或特殊处理要求。"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      logisticsNotes: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <button type="submit" disabled={saving}>
              {saving ? "正在保存…" : "保存物流资料"}
            </button>
            <small>UPDATED · {formatDateTime(loan.updatedAt)}</small>
          </form>
        </div>
      )}
    </article>
  );
}

function SampleItemEditor(props: {
  index: number;
  item: SampleLoanWorkspace["items"][number];
  loanId: string;
  onUpdated: (workspace: SampleLoanWorkspace) => void;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => itemForm(props.item));

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    props.onError("");
    props.onMessage("");
    setSaving(true);
    try {
      const response = await fetch(
        `/api/studio/sample-loans/${encodeURIComponent(props.loanId)}/items/${encodeURIComponent(props.item.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.loan) {
        throw new Error(payload.error || "保存样衣状态失败。");
      }
      props.onUpdated(payload.loan);
      props.onMessage(`${props.item.workTitle} 的样衣记录已保存。`);
    } catch (cause) {
      props.onError(
        cause instanceof Error ? cause.message : "保存样衣状态失败。",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className={`studio-loan-sample is-${form.status}`}
      onSubmit={save}
    >
      <figure>
        {props.item.imageKey ? (
          <img src={mediaUrl(props.item.imageKey)} alt={props.item.workTitle} />
        ) : (
          <span>NO IMAGE</span>
        )}
        <b>{String(props.index + 1).padStart(2, "0")}</b>
        <small>{itemStatusLabel(form.status)}</small>
      </figure>
      <header>
        <span>{props.item.lookNumber || "NO LOOK NUMBER"}</span>
        <h4>{props.item.workTitle}</h4>
      </header>
      <div>
        <label>
          <span>样衣编号 / BARCODE</span>
          <input
            value={form.sampleCode}
            maxLength={120}
            placeholder="NR-SAMPLE-001"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                sampleCode: event.target.value,
              }))
            }
          />
        </label>
        <label>
          <span>尺码</span>
          <input
            value={form.sizeLabel}
            maxLength={80}
            placeholder="EU 36 / SAMPLE"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                sizeLabel: event.target.value,
              }))
            }
          />
        </label>
        <label className="is-wide">
          <span>当前状态</span>
          <select
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: event.target.value as SampleLoanItemStatus,
              }))
            }
          >
            {itemStatuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>出库状况</span>
          <select
            value={form.outboundCondition}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                outboundCondition: event.target.value as SampleCondition,
              }))
            }
          >
            {conditions.map((condition) => (
              <option key={condition.value} value={condition.value}>
                {condition.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>归还状况</span>
          <select
            value={form.returnCondition}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                returnCondition: event.target.value as SampleCondition,
              }))
            }
          >
            {conditions.map((condition) => (
              <option key={condition.value} value={condition.value}>
                {condition.label}
              </option>
            ))}
          </select>
        </label>
        <label className="is-wide">
          <span>状况备注</span>
          <textarea
            rows={3}
            value={form.conditionNotes}
            maxLength={1200}
            placeholder="污渍、磨损、缺件、修复或清洁记录。"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                conditionNotes: event.target.value,
              }))
            }
          />
        </label>
      </div>
      <button type="submit" disabled={saving}>
        {saving ? "保存中…" : "保存单件记录"}
      </button>
    </form>
  );
}

function matchesFilter(
  workspace: SampleLoanWorkspace,
  filter: BoardFilter,
) {
  if (filter === "all") return true;
  if (filter === "preparing") {
    return ["preparing", "ready"].includes(workspace.loan.status);
  }
  if (filter === "outbound") {
    return ["dispatched", "delivered"].includes(workspace.loan.status);
  }
  if (filter === "active") {
    return ["in_use", "return_due"].includes(workspace.loan.status);
  }
  if (filter === "returns") {
    return ["return_in_transit", "returned"].includes(workspace.loan.status);
  }
  if (filter === "closed") {
    return ["closed", "cancelled"].includes(workspace.loan.status);
  }
  return (
    isLoanOverdue(workspace) ||
    workspace.items.some((item) =>
      ["damaged", "lost"].includes(item.status),
    )
  );
}

function isLoanOverdue(workspace: SampleLoanWorkspace) {
  const today = new Date().toISOString().slice(0, 10);
  return Boolean(
    workspace.loan.expectedReturnAt &&
      workspace.loan.expectedReturnAt < today &&
      !["returned", "closed", "cancelled"].includes(workspace.loan.status),
  );
}

function loanStatusLabel(value: string) {
  return (
    loanStatuses.find((status) => status.value === value)?.label ??
    value.toUpperCase()
  );
}

function itemStatusLabel(value: string) {
  return (
    itemStatuses.find((status) => status.value === value)?.label ??
    value.toUpperCase()
  );
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

function loanForm(workspace: SampleLoanWorkspace) {
  const { loan } = workspace;
  return {
    contactPhone: loan.contactPhone,
    deliveryAddress: loan.deliveryAddress,
    outboundCarrier: loan.outboundCarrier,
    outboundTracking: loan.outboundTracking,
    outboundSentAt: toInputDateTime(loan.outboundSentAt),
    deliveredAt: toInputDateTime(loan.deliveredAt),
    expectedReturnAt: loan.expectedReturnAt || "",
    returnCarrier: loan.returnCarrier,
    returnTracking: loan.returnTracking,
    returnReceivedAt: toInputDateTime(loan.returnReceivedAt),
    logisticsNotes: loan.logisticsNotes,
  };
}

function itemForm(item: SampleLoanWorkspace["items"][number]) {
  return {
    sampleCode: item.sampleCode,
    sizeLabel: item.sizeLabel,
    status: item.status as SampleLoanItemStatus,
    outboundCondition: item.outboundCondition as SampleCondition,
    returnCondition: item.returnCondition as SampleCondition,
    conditionNotes: item.conditionNotes,
  };
}

function mediaUrl(imageKey: string) {
  return `/api/media/${imageKey
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
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

function toInputDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIsoDateTime(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
