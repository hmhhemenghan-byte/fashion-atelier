"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  SampleCommunication,
  SampleCommunicationChannel,
  SampleCommunicationDirection,
  SampleCommunicationKind,
  SampleCommunicationStatus,
} from "@/lib/sample-correspondence";
import type { SampleLoanWorkspace } from "@/lib/sample-loans";

type ApiPayload = {
  loans?: SampleLoanWorkspace[];
  communications?: SampleCommunication[];
  communication?: SampleCommunication;
  error?: string;
};

type LedgerFilter = "all" | "action" | "draft" | "logged" | "resolved";

type ComposerForm = {
  loanId: string;
  kind: SampleCommunicationKind;
  channel: SampleCommunicationChannel;
  direction: SampleCommunicationDirection;
  recipientName: string;
  recipientAddress: string;
  subject: string;
  body: string;
  followUpAt: string;
};

const communicationKinds: Array<{
  value: SampleCommunicationKind;
  label: string;
  short: string;
}> = [
  { value: "confirmation", label: "借调确认", short: "CONFIRM" },
  { value: "dispatch", label: "寄送通知", short: "DISPATCH" },
  { value: "delivery", label: "签收确认", short: "DELIVERY" },
  { value: "return_reminder", label: "归还提醒", short: "RETURN" },
  { value: "overdue", label: "逾期跟进", short: "OVERDUE" },
  { value: "return_received", label: "归还确认", short: "RECEIVED" },
  { value: "exception", label: "异常沟通", short: "EXCEPTION" },
  { value: "custom", label: "自定义记录", short: "CUSTOM" },
];

const channels: Array<{
  value: SampleCommunicationChannel;
  label: string;
}> = [
  { value: "email", label: "Email" },
  { value: "phone", label: "电话" },
  { value: "messaging", label: "消息应用" },
  { value: "in_person", label: "当面沟通" },
  { value: "internal", label: "内部备注" },
];

const directions: Array<{
  value: SampleCommunicationDirection;
  label: string;
}> = [
  { value: "outbound", label: "对外发出" },
  { value: "inbound", label: "对方回复" },
  { value: "internal", label: "内部记录" },
];

const ledgerFilters: Array<{ value: LedgerFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "action", label: "待跟进" },
  { value: "draft", label: "草稿" },
  { value: "logged", label: "已留痕" },
  { value: "resolved", label: "已解决" },
];

export default function SampleCorrespondence() {
  const [loans, setLoans] = useState<SampleLoanWorkspace[]>([]);
  const [communications, setCommunications] = useState<SampleCommunication[]>(
    [],
  );
  const [form, setForm] = useState<ComposerForm>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<LedgerFilter>("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const payload = await requestBoard();
        if (!cancelled) {
          setLoans(payload.loans);
          setCommunications(payload.communications);
          const firstLoan =
            payload.loans.find((item) => isActiveLoan(item)) ??
            payload.loans[0];
          if (firstLoan) {
            setForm(composerForLoan(firstLoan));
          }
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "无法读取样衣沟通工作台。",
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
    let cancelled = false;
    async function syncLoanBoard() {
      try {
        const payload = await requestBoard();
        if (!cancelled) {
          setLoans(payload.loans);
          setCommunications(payload.communications);
        }
      } catch {
        // Keep the current correspondence desk available if a background
        // refresh is interrupted; the next explicit action will retry.
      }
    }
    window.addEventListener("nera:loan-updated", syncLoanBoard);
    return () => {
      cancelled = true;
      window.removeEventListener("nera:loan-updated", syncLoanBoard);
    };
  }, []);

  const loanById = useMemo(
    () => new Map(loans.map((workspace) => [workspace.loan.id, workspace])),
    [loans],
  );

  const metrics = useMemo(() => {
    const today = isoToday();
    return {
      activeLoans: loans.filter(isActiveLoan).length,
      dueFollowUps: communications.filter(
        (entry) =>
          Boolean(entry.followUpAt) &&
          (entry.followUpAt as string) <= today &&
          entry.status !== "resolved",
      ).length,
      drafts: communications.filter((entry) => entry.status === "draft")
        .length,
      unresolved: communications.filter(
        (entry) =>
          entry.status !== "draft" && entry.status !== "resolved",
      ).length,
      overdueLoans: loans.filter(isLoanOverdue).length,
    };
  }, [communications, loans]);

  const actionQueue = useMemo(
    () =>
      loans
        .filter(isActiveLoan)
        .map((workspace) => ({
          workspace,
          kind: recommendedKind(workspace),
          priority: actionPriority(workspace),
          lastEntry: communications.find(
            (entry) => entry.loanId === workspace.loan.id,
          ),
        }))
        .sort(
          (left, right) =>
            left.priority - right.priority ||
            right.workspace.loan.updatedAt.localeCompare(
              left.workspace.loan.updatedAt,
            ),
        )
        .slice(0, 8),
    [communications, loans],
  );

  const visibleCommunications = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const today = isoToday();
    return communications.filter((entry) => {
      if (
        filter === "action" &&
        !(
          entry.status !== "resolved" &&
          Boolean(entry.followUpAt) &&
          (entry.followUpAt as string) <= today
        )
      ) {
        return false;
      }
      if (filter === "draft" && entry.status !== "draft") return false;
      if (
        filter === "logged" &&
        !["logged", "acknowledged"].includes(entry.status)
      ) {
        return false;
      }
      if (filter === "resolved" && entry.status !== "resolved") return false;
      if (!needle) return true;
      const workspace = loanById.get(entry.loanId);
      return [
        entry.subject,
        entry.body,
        entry.recipientName,
        entry.recipientAddress,
        workspace?.loan.loanCode,
        workspace?.request.referenceCode,
        workspace?.request.projectTitle,
        workspace?.request.requesterName,
        workspace?.request.organization,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [communications, filter, loanById, query]);

  function selectLoan(loanId: string, kind?: SampleCommunicationKind) {
    const workspace = loanById.get(loanId);
    if (!workspace) return;
    setForm(composerForLoan(workspace, kind));
  }

  function changeKind(kind: SampleCommunicationKind) {
    const workspace = loanById.get(form.loanId);
    if (!workspace) {
      setForm((current) => ({ ...current, kind }));
      return;
    }
    const template = templateFor(workspace, kind);
    setForm((current) => ({
      ...current,
      kind,
      subject: template.subject,
      body: template.body,
      followUpAt: template.followUpAt,
    }));
  }

  async function saveCommunication(status: SampleCommunicationStatus) {
    setError("");
    setMessage("");
    if (!form.loanId) return setError("请先选择一条样衣借调单。");
    if (!form.subject.trim() || !form.body.trim()) {
      return setError("请填写沟通主题和正文。");
    }

    setSaving(true);
    try {
      const response = await fetch("/api/studio/sample-correspondence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, status }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.communication) {
        throw new Error(payload.error || "保存沟通记录失败。");
      }
      setCommunications((current) => [
        payload.communication as SampleCommunication,
        ...current,
      ]);
      setMessage(
        status === "draft"
          ? "沟通草稿已保存，可稍后复制并在外部发送。"
          : "已记录为在外部完成发送；系统没有代你发送任何消息。",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "保存沟通记录失败。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyComposer() {
    setError("");
    try {
      await navigator.clipboard.writeText(
        `${form.subject.trim()}\n\n${form.body.trim()}`,
      );
      setMessage("主题与正文已复制，可以粘贴到你的沟通工具中。");
    } catch {
      setError("无法自动复制，请手动选择文案。");
    }
  }

  async function updateStatus(
    entry: SampleCommunication,
    status: SampleCommunicationStatus,
  ) {
    setError("");
    setMessage("");
    setUpdatingId(entry.id);
    try {
      const response = await fetch(
        `/api/studio/sample-correspondence/${encodeURIComponent(entry.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.communication) {
        throw new Error(payload.error || "更新沟通状态失败。");
      }
      setCommunications((current) =>
        current.map((item) =>
          item.id === entry.id
            ? (payload.communication as SampleCommunication)
            : item,
        ),
      );
      setMessage(
        status === "resolved"
          ? "这条沟通已标记为解决。"
          : "沟通状态已更新。",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "更新沟通状态失败。",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function copyEntry(entry: SampleCommunication) {
    setError("");
    try {
      await navigator.clipboard.writeText(
        `${entry.subject.trim()}\n\n${entry.body.trim()}`,
      );
      setMessage("这条沟通文案已复制。");
    } catch {
      setError("无法自动复制，请手动选择文案。");
    }
  }

  if (loading) {
    return (
      <section className="studio-correspondence is-loading">
        <p>正在准备 Sample Correspondence…</p>
      </section>
    );
  }

  return (
    <section
      className="studio-correspondence"
      id="sample-correspondence"
      aria-labelledby="sample-correspondence-title"
    >
      <header className="studio-correspondence-hero">
        <span className="studio-correspondence-number" aria-hidden="true">
          11
        </span>
        <div>
          <span>11 / SAMPLE CORRESPONDENCE</span>
          <h2 id="sample-correspondence-title">
            确认。提醒。<i>留痕。</i>
          </h2>
          <p>
            让每一次借调确认、物流通知、归还提醒与异常沟通，都回到同一条样衣责任链。
          </p>
        </div>
        <aside>
          <span>FOLLOW-UP DESK</span>
          <strong>{String(metrics.dueFollowUps).padStart(2, "0")}</strong>
          <small>DUE ACTIONS</small>
          <dl>
            <div>
              <dt>ACTIVE LOANS</dt>
              <dd>{metrics.activeLoans}</dd>
            </div>
            <div>
              <dt>DRAFTS</dt>
              <dd>{metrics.drafts}</dd>
            </div>
            <div className={metrics.unresolved ? "is-alert" : ""}>
              <dt>OPEN THREADS</dt>
              <dd>{metrics.unresolved}</dd>
            </div>
            <div className={metrics.overdueLoans ? "is-alert" : ""}>
              <dt>OVERDUE LOANS</dt>
              <dd>{metrics.overdueLoans}</dd>
            </div>
          </dl>
        </aside>
      </header>

      <div className="studio-correspondence-protocol">
        <span>MANUAL SEND / 人工发送边界</span>
        <p>
          本工作台只生成、复制并记录沟通，不会自动发送 Email、电话或消息；
          “已留痕”表示你已在外部渠道完成沟通并在此登记。
        </p>
      </div>

      {(error || message) && (
        <div
          className={`studio-correspondence-notice${error ? " is-error" : ""}`}
          role="status"
        >
          {error || message}
        </div>
      )}

      <section className="studio-correspondence-queue">
        <header>
          <div>
            <span>NEXT BEST ACTION</span>
            <h3>当前跟进队列</h3>
          </div>
          <strong>{String(actionQueue.length).padStart(2, "0")} ACTIVE</strong>
        </header>
        {actionQueue.length === 0 ? (
          <p>暂无进行中的样衣借调；新的借调单建立后会自动进入这里。</p>
        ) : (
          <div>
            {actionQueue.map(({ workspace, kind, lastEntry }) => (
              <article
                key={workspace.loan.id}
                className={
                  isLoanOverdue(workspace) ? "is-overdue" : undefined
                }
              >
                <div>
                  <span>{workspace.loan.loanCode}</span>
                  <small>{workspace.request.referenceCode}</small>
                </div>
                <div>
                  <h4>{workspace.request.projectTitle}</h4>
                  <p>
                    {workspace.request.requesterName}
                    {workspace.request.organization
                      ? ` · ${workspace.request.organization}`
                      : ""}
                  </p>
                </div>
                <dl>
                  <div>
                    <dt>LOAN STATUS</dt>
                    <dd>{loanStatusLabel(workspace.loan.status)}</dd>
                  </div>
                  <div>
                    <dt>NEXT</dt>
                    <dd>{kindLabel(kind)}</dd>
                  </div>
                  <div>
                    <dt>LAST CONTACT</dt>
                    <dd>
                      {lastEntry
                        ? formatDate(lastEntry.occurredAt ?? lastEntry.createdAt)
                        : "NO RECORD"}
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => {
                    selectLoan(workspace.loan.id, kind);
                    document
                      .getElementById("sample-correspondence-composer")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  准备{kindLabel(kind)} →
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        className="studio-correspondence-composer"
        id="sample-correspondence-composer"
      >
        <header>
          <div>
            <span>COMPOSE / LOG</span>
            <h3>准备沟通文案</h3>
          </div>
          <small>系统不自动外发</small>
        </header>

        {loans.length === 0 ? (
          <div className="studio-correspondence-empty">
            <strong>需要先建立样衣借调单。</strong>
            <a href="#sample-fulfilment">返回第 10 阶段 ↖</a>
          </div>
        ) : (
          <div className="studio-correspondence-compose-grid">
            <aside>
              <label>
                <span>关联借调单</span>
                <select
                  value={form.loanId}
                  onChange={(event) => selectLoan(event.target.value)}
                >
                  {loans.map((workspace) => (
                    <option
                      key={workspace.loan.id}
                      value={workspace.loan.id}
                    >
                      {workspace.loan.loanCode} ·{" "}
                      {workspace.request.projectTitle}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>沟通类型</span>
                <select
                  value={form.kind}
                  onChange={(event) =>
                    changeKind(
                      event.target.value as SampleCommunicationKind,
                    )
                  }
                >
                  {communicationKinds.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="studio-correspondence-pair">
                <label>
                  <span>渠道</span>
                  <select
                    value={form.channel}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        channel: event.target
                          .value as SampleCommunicationChannel,
                      }))
                    }
                  >
                    {channels.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>方向</span>
                  <select
                    value={form.direction}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        direction: event.target
                          .value as SampleCommunicationDirection,
                      }))
                    }
                  >
                    {directions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                <span>联系人</span>
                <input
                  maxLength={180}
                  value={form.recipientName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      recipientName: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>联系地址 / 账号</span>
                <input
                  maxLength={320}
                  value={form.recipientAddress}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      recipientAddress: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>下一次跟进</span>
                <input
                  type="date"
                  value={form.followUpAt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      followUpAt: event.target.value,
                    }))
                  }
                />
              </label>
            </aside>

            <div className="studio-correspondence-editor">
              <label>
                <span>主题 *</span>
                <input
                  required
                  maxLength={240}
                  value={form.subject}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      subject: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>正文 *</span>
                <textarea
                  required
                  maxLength={6000}
                  rows={15}
                  value={form.body}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      body: event.target.value,
                    }))
                  }
                />
              </label>
              <footer>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void copyComposer()}
                >
                  复制文案
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveCommunication("draft")}
                >
                  {saving ? "正在保存…" : "保存草稿"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveCommunication("logged")}
                >
                  已在外部发送，记录留痕 →
                </button>
              </footer>
            </div>
          </div>
        )}
      </section>

      <section className="studio-correspondence-ledger">
        <header>
          <div>
            <span>COMMUNICATION LEDGER</span>
            <h3>沟通时间线</h3>
          </div>
          <a href="/api/studio/sample-correspondence?format=csv" download>
            导出沟通台账 CSV ↘
          </a>
        </header>

        <div className="studio-correspondence-tools">
          <div>
            {ledgerFilters.map((item) => (
              <button
                type="button"
                key={item.value}
                className={filter === item.value ? "is-active" : ""}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
                <span>
                  {
                    communications.filter((entry) =>
                      matchesLedgerFilter(entry, item.value),
                    ).length
                  }
                </span>
              </button>
            ))}
          </div>
          <label>
            <span>搜索记录</span>
            <input
              type="search"
              value={query}
              placeholder="借调编号、项目、联系人、主题"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        {communications.length === 0 ? (
          <div className="studio-correspondence-ledger-empty">
            <span>LEDGER / 00</span>
            <h4>尚无沟通记录。</h4>
            <p>从上方准备第一封通知，保存草稿或登记外部沟通。</p>
          </div>
        ) : visibleCommunications.length === 0 ? (
          <div className="studio-correspondence-ledger-empty">
            <span>NO MATCH</span>
            <h4>当前筛选没有沟通记录。</h4>
          </div>
        ) : (
          <div className="studio-correspondence-ledger-list">
            {visibleCommunications.map((entry) => {
              const workspace = loanById.get(entry.loanId);
              const due = isEntryDue(entry);
              return (
                <article
                  key={entry.id}
                  className={`${entry.status === "draft" ? "is-draft" : ""}${due ? " is-due" : ""}`}
                >
                  <div className="studio-correspondence-ledger-mark">
                    <span>{kindShort(entry.kind)}</span>
                    <strong>{channelLabel(entry.channel)}</strong>
                  </div>
                  <div className="studio-correspondence-ledger-main">
                    <header>
                      <div>
                        <small>
                          {workspace?.loan.loanCode ?? "UNLINKED"} ·{" "}
                          {directionLabel(entry.direction)}
                        </small>
                        <h4>{entry.subject}</h4>
                      </div>
                      <span className={`is-${entry.status}`}>
                        {due ? "需跟进" : communicationStatusLabel(entry.status)}
                      </span>
                    </header>
                    <p>{entry.body}</p>
                    <dl>
                      <div>
                        <dt>CONTACT</dt>
                        <dd>
                          {entry.recipientName || "INTERNAL"}
                          {entry.recipientAddress
                            ? ` · ${entry.recipientAddress}`
                            : ""}
                        </dd>
                      </div>
                      <div>
                        <dt>OCCURRED</dt>
                        <dd>
                          {entry.occurredAt
                            ? formatDateTime(entry.occurredAt)
                            : "DRAFT"}
                        </dd>
                      </div>
                      <div>
                        <dt>FOLLOW-UP</dt>
                        <dd>
                          {entry.followUpAt
                            ? formatDate(entry.followUpAt)
                            : "NOT SET"}
                        </dd>
                      </div>
                    </dl>
                    <footer>
                      <button
                        type="button"
                        onClick={() => void copyEntry(entry)}
                      >
                        复制
                      </button>
                      {entry.status === "draft" && (
                        <button
                          type="button"
                          disabled={updatingId === entry.id}
                          onClick={() => void updateStatus(entry, "logged")}
                        >
                          登记为已发送
                        </button>
                      )}
                      {entry.status === "logged" && (
                        <button
                          type="button"
                          disabled={updatingId === entry.id}
                          onClick={() =>
                            void updateStatus(entry, "acknowledged")
                          }
                        >
                          已获回复
                        </button>
                      )}
                      {entry.status !== "resolved" && (
                        <button
                          type="button"
                          disabled={updatingId === entry.id}
                          onClick={() => void updateStatus(entry, "resolved")}
                        >
                          标记解决
                        </button>
                      )}
                    </footer>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

async function requestBoard() {
  const response = await fetch("/api/studio/sample-correspondence", {
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok || !payload.loans || !payload.communications) {
    throw new Error(payload.error || "无法读取样衣沟通工作台。");
  }
  return {
    loans: payload.loans,
    communications: payload.communications,
  };
}

function emptyForm(): ComposerForm {
  return {
    loanId: "",
    kind: "custom",
    channel: "email",
    direction: "outbound",
    recipientName: "",
    recipientAddress: "",
    subject: "",
    body: "",
    followUpAt: "",
  };
}

function composerForLoan(
  workspace: SampleLoanWorkspace,
  requestedKind?: SampleCommunicationKind,
): ComposerForm {
  const kind = requestedKind ?? recommendedKind(workspace);
  const template = templateFor(workspace, kind);
  return {
    loanId: workspace.loan.id,
    kind,
    channel: "email",
    direction: "outbound",
    recipientName: workspace.request.requesterName,
    recipientAddress: workspace.request.requesterEmail,
    subject: template.subject,
    body: template.body,
    followUpAt: template.followUpAt,
  };
}

function templateFor(
  workspace: SampleLoanWorkspace,
  kind: SampleCommunicationKind,
) {
  const { loan, request, items } = workspace;
  const salutation = request.requesterName
    ? `Dear ${request.requesterName},`
    : "Hello,";
  const signoff = "Best,\nNÉRA ATELIER";
  const lookSummary =
    items
      .slice(0, 6)
      .map((item) =>
        [item.lookNumber, item.workTitle, item.sampleCode]
          .filter(Boolean)
          .join(" / "),
      )
      .join("\n") || "Selected samples";
  const returnDate = loan.expectedReturnAt
    ? formatDate(loan.expectedReturnAt)
    : "to be confirmed";
  const tracking = loan.outboundTracking || "to follow";
  const carrier = loan.outboundCarrier || "carrier to follow";
  const base = {
    subject: "",
    body: "",
    followUpAt: suggestedFollowUp(workspace, kind),
  };

  if (kind === "confirmation") {
    return {
      ...base,
      subject: `Sample loan confirmed — ${request.projectTitle} / ${loan.loanCode}`,
      body: `${salutation}\n\nWe are pleased to confirm the sample loan for ${request.projectTitle}.\n\nLoan reference: ${loan.loanCode}\nRequested window: ${dateWindow(request.neededFrom, request.neededUntil)}\nReturn target: ${returnDate}\n\nSelected pieces:\n${lookSummary}\n\nWe will follow up with dispatch details once the pieces are prepared.\n\n${signoff}`,
    };
  }
  if (kind === "dispatch") {
    return {
      ...base,
      subject: `Samples dispatched — ${loan.loanCode}`,
      body: `${salutation}\n\nYour samples for ${request.projectTitle} have been dispatched.\n\nLoan reference: ${loan.loanCode}\nCarrier: ${carrier}\nTracking: ${tracking}\nReturn target: ${returnDate}\n\nPlease let us know once the shipment has arrived safely.\n\n${signoff}`,
    };
  }
  if (kind === "delivery") {
    return {
      ...base,
      subject: `Delivery check — ${loan.loanCode}`,
      body: `${salutation}\n\nWe are checking that the samples for ${request.projectTitle} arrived safely and in the expected condition.\n\nLoan reference: ${loan.loanCode}\nTracking: ${tracking}\n\nPlease confirm receipt when convenient.\n\n${signoff}`,
    };
  }
  if (kind === "return_reminder") {
    return {
      ...base,
      subject: `Return reminder — ${loan.loanCode}`,
      body: `${salutation}\n\nA gentle reminder that the samples for ${request.projectTitle} are due to be returned by ${returnDate}.\n\nLoan reference: ${loan.loanCode}\nPieces: ${items.length}\n\nPlease share the return carrier and tracking details once arranged. If your schedule has changed, let us know so we can review availability.\n\n${signoff}`,
    };
  }
  if (kind === "overdue") {
    return {
      ...base,
      subject: `Return follow-up required — ${loan.loanCode}`,
      body: `${salutation}\n\nWe are following up on the sample loan for ${request.projectTitle}, which was due back on ${returnDate}.\n\nLoan reference: ${loan.loanCode}\nPieces outstanding: ${items.filter((item) => item.status !== "returned").length}\n\nPlease confirm the current location of the samples and provide a return date or tracking reference today.\n\n${signoff}`,
    };
  }
  if (kind === "return_received") {
    return {
      ...base,
      subject: `Samples received — ${loan.loanCode}`,
      body: `${salutation}\n\nWe confirm that the returned samples for ${request.projectTitle} have been received.\n\nLoan reference: ${loan.loanCode}\nPieces received: ${items.filter((item) => item.status === "returned").length} / ${items.length}\n\nThank you for your care and collaboration.\n\n${signoff}`,
    };
  }
  if (kind === "exception") {
    const exceptions = items
      .filter((item) => ["damaged", "lost", "unavailable"].includes(item.status))
      .map((item) => `${item.lookNumber || "LOOK"} / ${item.workTitle} — ${item.status}`)
      .join("\n");
    return {
      ...base,
      subject: `Sample exception follow-up — ${loan.loanCode}`,
      body: `${salutation}\n\nWe need to follow up on the condition or availability of samples connected to ${request.projectTitle}.\n\nLoan reference: ${loan.loanCode}\n${exceptions || "Please review the sample notes attached to this loan."}\n\nPlease reply with any relevant context so we can close the record accurately.\n\n${signoff}`,
    };
  }
  return {
    ...base,
    subject: `${request.projectTitle} — ${loan.loanCode}`,
    body: `${salutation}\n\nRegarding sample loan ${loan.loanCode} for ${request.projectTitle}:\n\n\n\n${signoff}`,
  };
}

function recommendedKind(
  workspace: SampleLoanWorkspace,
): SampleCommunicationKind {
  if (
    isLoanOverdue(workspace) ||
    workspace.loan.status === "return_due"
  ) {
    return isLoanOverdue(workspace) ? "overdue" : "return_reminder";
  }
  if (
    workspace.items.some((item) =>
      ["damaged", "lost", "unavailable"].includes(item.status),
    )
  ) {
    return "exception";
  }
  if (workspace.loan.status === "dispatched") return "dispatch";
  if (
    workspace.loan.status === "delivered" ||
    workspace.loan.status === "in_use"
  ) {
    return "delivery";
  }
  if (
    workspace.loan.status === "returned" ||
    workspace.loan.status === "closed"
  ) {
    return "return_received";
  }
  return "confirmation";
}

function suggestedFollowUp(
  workspace: SampleLoanWorkspace,
  kind: SampleCommunicationKind,
) {
  if (kind === "return_reminder" && workspace.loan.expectedReturnAt) {
    return workspace.loan.expectedReturnAt;
  }
  if (kind === "confirmation" && workspace.request.neededFrom) {
    return workspace.request.neededFrom;
  }
  if (kind === "dispatch" || kind === "delivery") {
    return shiftDate(isoToday(), 2);
  }
  if (kind === "exception" || kind === "overdue") {
    return shiftDate(isoToday(), 1);
  }
  return "";
}

function actionPriority(workspace: SampleLoanWorkspace) {
  if (isLoanOverdue(workspace)) return 0;
  if (
    workspace.items.some((item) =>
      ["damaged", "lost"].includes(item.status),
    )
  ) {
    return 1;
  }
  if (workspace.loan.status === "return_due") return 2;
  if (workspace.loan.status === "return_in_transit") return 3;
  if (workspace.loan.status === "dispatched") return 4;
  if (workspace.loan.status === "delivered") return 5;
  if (workspace.loan.status === "ready") return 6;
  return 7;
}

function matchesLedgerFilter(
  entry: SampleCommunication,
  filter: LedgerFilter,
) {
  if (filter === "all") return true;
  if (filter === "action") return isEntryDue(entry);
  if (filter === "draft") return entry.status === "draft";
  if (filter === "logged") {
    return ["logged", "acknowledged"].includes(entry.status);
  }
  return entry.status === "resolved";
}

function isEntryDue(entry: SampleCommunication) {
  return (
    entry.status !== "resolved" &&
    Boolean(entry.followUpAt) &&
    (entry.followUpAt as string) <= isoToday()
  );
}

function isActiveLoan(workspace: SampleLoanWorkspace) {
  return !["closed", "cancelled", "returned"].includes(
    workspace.loan.status,
  );
}

function isLoanOverdue(workspace: SampleLoanWorkspace) {
  return (
    Boolean(workspace.loan.expectedReturnAt) &&
    (workspace.loan.expectedReturnAt as string) < isoToday() &&
    !["returned", "closed", "cancelled"].includes(workspace.loan.status)
  );
}

function loanStatusLabel(status: SampleLoanWorkspace["loan"]["status"]) {
  return (
    {
      preparing: "准备中",
      ready: "待寄出",
      dispatched: "已寄出",
      delivered: "已送达",
      in_use: "使用中",
      return_due: "待归还",
      return_in_transit: "归还途中",
      returned: "已收回",
      closed: "已关闭",
      cancelled: "已取消",
    } as const
  )[status];
}

function kindLabel(kind: SampleCommunicationKind) {
  return (
    communicationKinds.find((item) => item.value === kind)?.label ?? kind
  );
}

function kindShort(kind: SampleCommunicationKind) {
  return (
    communicationKinds.find((item) => item.value === kind)?.short ?? kind
  );
}

function channelLabel(channel: SampleCommunicationChannel) {
  return channels.find((item) => item.value === channel)?.label ?? channel;
}

function directionLabel(direction: SampleCommunicationDirection) {
  return (
    directions.find((item) => item.value === direction)?.label ?? direction
  );
}

function communicationStatusLabel(status: SampleCommunicationStatus) {
  return (
    {
      draft: "草稿",
      logged: "已留痕",
      acknowledged: "已获回复",
      resolved: "已解决",
    } as const
  )[status];
}

function dateWindow(from: string | null, until: string | null) {
  if (from && until) return `${formatDate(from)} — ${formatDate(until)}`;
  if (from) return `FROM ${formatDate(from)}`;
  if (until) return `UNTIL ${formatDate(until)}`;
  return "TO BE CONFIRMED";
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
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
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
