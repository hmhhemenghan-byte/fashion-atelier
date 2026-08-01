"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  RelationshipActivityChannel,
  RelationshipActivityDirection,
  RelationshipActivityKind,
  RelationshipActivityStatus,
  RelationshipCandidate,
  RelationshipContactStatus,
  RelationshipContactType,
  RelationshipContactWorkspace,
  RelationshipContactability,
  RelationshipOpportunityKind,
  RelationshipOpportunityStage,
  RelationshipOverview,
  RelationshipPriority,
  RelationshipTier,
} from "@/lib/relationships";

type ApiPayload = {
  overview?: RelationshipOverview;
  error?: string;
};

type ContactForm = {
  name: string;
  organization: string;
  roleTitle: string;
  contactType: RelationshipContactType;
  email: string;
  phone: string;
  market: string;
  city: string;
  preferredChannel: "email" | "phone" | "messaging" | "in_person" | "none";
  tier: RelationshipTier;
  contactability: RelationshipContactability;
  tags: string;
  notes: string;
  nextFollowUpAt: string;
};

type OpportunityForm = {
  contactId: string;
  title: string;
  kind: RelationshipOpportunityKind;
  stage: RelationshipOpportunityStage;
  priority: RelationshipPriority;
  collection: string;
  market: string;
  summary: string;
  nextAction: string;
  nextActionAt: string;
};

type ActivityForm = {
  contactId: string;
  opportunityId: string;
  kind: RelationshipActivityKind;
  channel: RelationshipActivityChannel;
  direction: RelationshipActivityDirection;
  status: RelationshipActivityStatus;
  subject: string;
  notes: string;
  dueAt: string;
  occurredAt: string;
};

const contactTypes: Array<{
  value: RelationshipContactType;
  label: string;
}> = [
  { value: "editor", label: "编辑 / 媒体人" },
  { value: "stylist", label: "造型师" },
  { value: "buyer", label: "买手" },
  { value: "talent_team", label: "艺人 / 团队" },
  { value: "influencer", label: "创作者" },
  { value: "media", label: "媒体机构" },
  { value: "partner", label: "合作伙伴" },
  { value: "production", label: "制作团队" },
  { value: "other", label: "其他" },
];

const tiers: Array<{ value: RelationshipTier; label: string }> = [
  { value: "priority", label: "重点关系" },
  { value: "core", label: "核心关系" },
  { value: "developing", label: "培育中" },
  { value: "dormant", label: "低活跃" },
];

const contactStatuses: Array<{
  value: RelationshipContactStatus;
  label: string;
}> = [
  { value: "active", label: "活跃" },
  { value: "paused", label: "暂停" },
  { value: "archived", label: "归档" },
];

const contactabilityOptions: Array<{
  value: RelationshipContactability;
  label: string;
}> = [
  { value: "unknown", label: "联系边界待确认" },
  { value: "business_context", label: "已有业务往来" },
  { value: "opted_in", label: "已明确同意联系" },
  { value: "do_not_contact", label: "请勿主动联系" },
];

const opportunityKinds: Array<{
  value: RelationshipOpportunityKind;
  label: string;
}> = [
  { value: "editorial", label: "编辑刊登" },
  { value: "dressing", label: "艺人穿着" },
  { value: "buyer", label: "买手 / 商务" },
  { value: "press", label: "媒体采访" },
  { value: "partnership", label: "品牌合作" },
  { value: "event", label: "活动" },
  { value: "content", label: "内容共创" },
  { value: "other", label: "其他" },
];

const stageOptions: Array<{
  value: RelationshipOpportunityStage;
  label: string;
  short: string;
}> = [
  { value: "signal", label: "信号", short: "SIGNAL" },
  { value: "qualified", label: "已确认", short: "QUALIFIED" },
  { value: "ready", label: "可沟通", short: "READY" },
  { value: "conversation", label: "沟通中", short: "CONVERSATION" },
  { value: "sample", label: "样衣阶段", short: "SAMPLE" },
  { value: "active", label: "执行中", short: "ACTIVE" },
  { value: "won", label: "已达成", short: "WON" },
  { value: "lost", label: "未达成", short: "LOST" },
  { value: "on_hold", label: "暂缓", short: "ON HOLD" },
];

const priorityOptions: Array<{
  value: RelationshipPriority;
  label: string;
}> = [
  { value: "low", label: "低" },
  { value: "normal", label: "常规" },
  { value: "high", label: "高" },
  { value: "urgent", label: "紧急" },
];

const activityKinds: Array<{
  value: RelationshipActivityKind;
  label: string;
}> = [
  { value: "note", label: "内部备注" },
  { value: "email", label: "邮件记录" },
  { value: "call", label: "电话" },
  { value: "meeting", label: "会面" },
  { value: "introduction", label: "引荐" },
  { value: "sample", label: "样衣动作" },
  { value: "coverage", label: "成果 / 刊登" },
  { value: "follow_up", label: "跟进待办" },
  { value: "other", label: "其他" },
];

const channelOptions: Array<{
  value: RelationshipActivityChannel;
  label: string;
}> = [
  { value: "email", label: "邮件" },
  { value: "phone", label: "电话" },
  { value: "messaging", label: "即时消息" },
  { value: "in_person", label: "线下" },
  { value: "internal", label: "内部" },
];

const directionOptions: Array<{
  value: RelationshipActivityDirection;
  label: string;
}> = [
  { value: "inbound", label: "对方发起" },
  { value: "outbound", label: "我方发起" },
  { value: "internal", label: "内部记录" },
];

const activityStatuses: Array<{
  value: RelationshipActivityStatus;
  label: string;
}> = [
  { value: "planned", label: "计划中" },
  { value: "completed", label: "已完成 / 已记录" },
  { value: "cancelled", label: "已取消" },
];

function emptyContactForm(): ContactForm {
  return {
    name: "",
    organization: "",
    roleTitle: "",
    contactType: "other",
    email: "",
    phone: "",
    market: "",
    city: "",
    preferredChannel: "email",
    tier: "developing",
    contactability: "unknown",
    tags: "",
    notes: "",
    nextFollowUpAt: "",
  };
}

function emptyOpportunityForm(contactId = ""): OpportunityForm {
  return {
    contactId,
    title: "",
    kind: "editorial",
    stage: "signal",
    priority: "normal",
    collection: "",
    market: "",
    summary: "",
    nextAction: "",
    nextActionAt: "",
  };
}

function emptyActivityForm(contactId = ""): ActivityForm {
  return {
    contactId,
    opportunityId: "",
    kind: "note",
    channel: "internal",
    direction: "internal",
    status: "planned",
    subject: "",
    notes: "",
    dueAt: "",
    occurredAt: "",
  };
}

export default function RelationshipIntelligence() {
  const [overview, setOverview] = useState<RelationshipOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [contactForm, setContactForm] = useState<ContactForm>(emptyContactForm);
  const [opportunityForm, setOpportunityForm] = useState<OpportunityForm>(
    emptyOpportunityForm(),
  );
  const [activityForm, setActivityForm] = useState<ActivityForm>(
    emptyActivityForm(),
  );

  async function reload(preserveMessage = true) {
    if (!preserveMessage) {
      setMessage("");
      setError("");
    }
    const response = await fetch("/api/studio/relationships", {
      cache: "no-store",
    });
    const payload = (await response.json()) as ApiPayload;
    if (!response.ok || !payload.overview) {
      throw new Error(payload.error || "无法读取关系工作台。");
    }
    setOverview(payload.overview);
    const nextSelectedContactId =
      selectedContactId &&
      payload.overview?.contacts.some(
        ({ contact }) => contact.id === selectedContactId,
      )
        ? selectedContactId
        : payload.overview?.contacts[0]?.contact.id ?? "";
    setSelectedContactId(nextSelectedContactId);
    if (nextSelectedContactId !== selectedContactId) {
      setOpportunityForm(emptyOpportunityForm(nextSelectedContactId));
      setActivityForm(emptyActivityForm(nextSelectedContactId));
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/studio/relationships", {
          cache: "no-store",
        });
        const payload = (await response.json()) as ApiPayload;
        if (!response.ok || !payload.overview) {
          throw new Error(payload.error || "无法读取关系工作台。");
        }
        if (!cancelled) {
          setOverview(payload.overview);
          const firstContactId =
            payload.overview.contacts[0]?.contact.id ?? "";
          setSelectedContactId(firstContactId);
          setOpportunityForm(emptyOpportunityForm(firstContactId));
          setActivityForm(emptyActivityForm(firstContactId));
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "无法读取关系工作台。",
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
    async function sync() {
      try {
        const response = await fetch("/api/studio/relationships", {
          cache: "no-store",
        });
        const payload = (await response.json()) as ApiPayload;
        if (!cancelled && response.ok && payload.overview) {
          setOverview(payload.overview);
        }
      } catch {
        // Preserve the current workbench when a background refresh is interrupted.
      }
    }
    window.addEventListener("nera:request-updated", sync);
    window.addEventListener("nera:placement-updated", sync);
    window.addEventListener("nera:outreach-updated", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("nera:request-updated", sync);
      window.removeEventListener("nera:placement-updated", sync);
      window.removeEventListener("nera:outreach-updated", sync);
    };
  }, []);

  function selectContact(contactId: string) {
    setSelectedContactId(contactId);
    setOpportunityForm((current) => ({
      ...current,
      contactId,
    }));
    setActivityForm((current) => ({
      ...current,
      contactId,
      opportunityId: "",
    }));
  }

  const visibleContacts = useMemo(() => {
    if (!overview) return [];
    const needle = query.trim().toLocaleLowerCase();
    return overview.contacts.filter(({ contact, tags }) => {
      if (typeFilter !== "all" && contact.contactType !== typeFilter) {
        return false;
      }
      if (tierFilter !== "all" && contact.tier !== tierFilter) return false;
      if (statusFilter !== "all" && contact.status !== statusFilter) {
        return false;
      }
      if (!needle) return true;
      return [
        contact.contactCode,
        contact.name,
        contact.organization,
        contact.roleTitle,
        contact.email,
        contact.market,
        contact.city,
        ...tags,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [overview, query, statusFilter, tierFilter, typeFilter]);

  const visibleCandidates = useMemo(() => {
    if (!overview) return [];
    const needle = candidateQuery.trim().toLocaleLowerCase();
    return overview.candidates
      .filter((candidate) =>
        needle
          ? [
              candidate.name,
              candidate.organization,
              candidate.email,
              candidate.market,
              candidate.sourceLabel,
            ]
              .join(" ")
              .toLocaleLowerCase()
              .includes(needle)
          : true,
      )
      .slice(0, 12);
  }, [candidateQuery, overview]);

  const selected =
    overview?.contacts.find(
      ({ contact }) => contact.id === selectedContactId,
    ) ?? null;
  const selectedOpportunities =
    overview?.opportunities.filter(
      (opportunity) => opportunity.contactId === activityForm.contactId,
    ) ?? [];

  async function createContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("contact");
    setMessage("");
    setError("");
    try {
      await mutate("/api/studio/relationships", {
        ...contactForm,
        nextFollowUpAt: fromLocalDateTime(contactForm.nextFollowUpAt),
      });
      setContactForm(emptyContactForm());
      await reload();
      setMessage("联系人已加入关系库。");
      emitUpdate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "联系人保存失败。");
    } finally {
      setBusy("");
    }
  }

  async function importCandidate(candidate: RelationshipCandidate) {
    setBusy(`candidate:${candidate.id}`);
    setMessage("");
    setError("");
    try {
      await mutate("/api/studio/relationships", {
        name: candidate.name,
        organization: candidate.organization,
        roleTitle: candidate.roleTitle,
        contactType: candidate.contactType,
        email: candidate.email,
        market: candidate.market,
        preferredChannel: candidate.email ? "email" : "none",
        tier: "developing",
        status: "active",
        contactability: candidate.contactability,
        sourceType: candidate.sourceType,
        sourceId: candidate.sourceId,
        tags: [candidate.sourceType.replaceAll("_", " ")],
        notes: `SOURCE / ${candidate.sourceLabel}`,
      });
      await reload();
      setMessage(`${candidate.name} 已由事实候选加入关系库。`);
      emitUpdate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "候选导入失败。");
    } finally {
      setBusy("");
    }
  }

  async function createOpportunity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("opportunity");
    setMessage("");
    setError("");
    try {
      await mutate("/api/studio/relationships/opportunities", {
        ...opportunityForm,
        nextActionAt: fromLocalDateTime(opportunityForm.nextActionAt),
      });
      setOpportunityForm(
        emptyOpportunityForm(opportunityForm.contactId),
      );
      await reload();
      setMessage("机会已加入人工推进管线。");
      emitUpdate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "机会保存失败。");
    } finally {
      setBusy("");
    }
  }

  async function createActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("activity");
    setMessage("");
    setError("");
    try {
      await mutate("/api/studio/relationships/activities", {
        ...activityForm,
        dueAt: fromLocalDateTime(activityForm.dueAt),
        occurredAt: fromLocalDateTime(activityForm.occurredAt),
      });
      setActivityForm(emptyActivityForm(activityForm.contactId));
      await reload();
      setMessage("互动或待办记录已保存；系统不会自动发送。");
      emitUpdate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "互动记录保存失败。");
    } finally {
      setBusy("");
    }
  }

  async function patchContact(id: string, body: Record<string, unknown>) {
    setBusy(`contact:${id}`);
    setMessage("");
    setError("");
    try {
      await mutate(`/api/studio/relationships/${encodeURIComponent(id)}`, body, "PATCH");
      await reload();
      setMessage("联系人资料已更新。");
      emitUpdate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "联系人更新失败。");
    } finally {
      setBusy("");
    }
  }

  async function patchOpportunity(
    id: string,
    body: Record<string, unknown>,
  ) {
    setBusy(`opportunity:${id}`);
    setMessage("");
    setError("");
    try {
      await mutate(
        `/api/studio/relationships/opportunities/${encodeURIComponent(id)}`,
        body,
        "PATCH",
      );
      await reload();
      setMessage("机会阶段已更新。");
      emitUpdate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "机会更新失败。");
    } finally {
      setBusy("");
    }
  }

  async function completeActivity(id: string) {
    setBusy(`activity:${id}`);
    setMessage("");
    setError("");
    try {
      await mutate(
        `/api/studio/relationships/activities/${encodeURIComponent(id)}`,
        { status: "completed" },
        "PATCH",
      );
      await reload();
      setMessage("待办已标记完成，并写入最近联系时间。");
      emitUpdate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "待办更新失败。");
    } finally {
      setBusy("");
    }
  }

  if (!overview && loading) {
    return (
      <section className="studio-relationships is-loading">
        <p>正在连接 Relationship Intelligence…</p>
      </section>
    );
  }

  if (!overview) {
    return (
      <section className="studio-relationships is-loading is-error">
        <p>{error || "关系与机会工作台暂不可用。"}</p>
      </section>
    );
  }

  const { metrics } = overview;
  return (
    <section
      className={`studio-relationships${loading ? " is-refreshing" : ""}`}
      id="relationship-intelligence"
      aria-labelledby="relationship-intelligence-title"
      aria-busy={loading}
    >
      <header className="studio-relationships-hero">
        <span aria-hidden="true">16</span>
        <div>
          <small>16 / RELATIONSHIP &amp; OPPORTUNITY</small>
          <h2 id="relationship-intelligence-title">
            关系。时机。<i>下一步。</i>
          </h2>
          <p>
            将展厅回应、样衣往来与真实成果沉淀为设计师自己的关系记忆：
            谁在关注、机会走到哪里、下一步由谁人工确认，全部保留来源和时间。
          </p>
        </div>
        <aside>
          <small>RELATIONSHIP SIGNAL</small>
          <strong>{String(metrics.activeContactCount).padStart(2, "0")}</strong>
          <span>ACTIVE RELATIONSHIPS</span>
          <dl>
            <div>
              <dt>OPEN</dt>
              <dd>{metrics.openOpportunityCount}</dd>
            </div>
            <div className={metrics.overdueCount ? "is-alert" : ""}>
              <dt>OVERDUE</dt>
              <dd>{metrics.overdueCount}</dd>
            </div>
            <div>
              <dt>SIGNALS</dt>
              <dd>{metrics.candidateCount}</dd>
            </div>
          </dl>
        </aside>
      </header>

      <div className="studio-relationships-method">
        <span>HUMAN-IN-THE-LOOP / 工作边界</span>
        <p>
          本区只记录关系事实、人工优先级和下一步，不对人物进行隐性价值评分。
          系统不会自动发邮件、消息或邀约；“请勿主动联系”会作为显著边界持续保留。
        </p>
      </div>

      {(error || message) && (
        <div
          className={`studio-relationships-notice${error ? " is-error" : ""}`}
          role="status"
        >
          {error || message}
        </div>
      )}

      <section className="studio-relationships-metrics">
        <RelationshipMetric
          eyebrow="OPEN OPPORTUNITIES"
          value={metrics.openOpportunityCount}
          detail={`${metrics.opportunityWithoutNextActionCount} 项尚未写明下一步和时间`}
          alert={metrics.opportunityWithoutNextActionCount > 0}
        />
        <RelationshipMetric
          eyebrow="NEXT 7 DAYS"
          value={metrics.nextSevenDaysCount}
          detail="未来七天需要人工处理的跟进"
        />
        <RelationshipMetric
          eyebrow="RECENT TOUCHPOINTS"
          value={metrics.recentTouchpointCount}
          detail="最近 30 天完成并留痕的互动"
        />
        <RelationshipMetric
          eyebrow="PROFILE COMPLETENESS"
          value={`${formatNumber(metrics.profileCompleteness)}%`}
          detail="资料、联系边界、标签与节奏的平均完整度"
        />
        <RelationshipMetric
          eyebrow="WON / REALIZED"
          value={metrics.wonOpportunityCount}
          detail="由设计师明确标记为已达成的机会"
        />
        <RelationshipMetric
          eyebrow="FACT CANDIDATES"
          value={metrics.candidateCount}
          detail="来自展厅回应与 Placement、等待人工确认的人物"
        />
      </section>

      <section className="studio-relationships-onboarding">
        <article className="studio-relationship-candidates">
          <header>
            <div>
              <span>FACT-BASED DISCOVERY</span>
              <h3>从已有事实发现关系</h3>
            </div>
            <strong>{overview.candidates.length} CANDIDATES</strong>
          </header>
          <p>
            候选不会自动进入联系人库。只有点击“纳入关系库”后才会建立独立记录；
            来源仍指向原始展厅回应或成果。
          </p>
          <input
            type="search"
            value={candidateQuery}
            placeholder="搜索姓名、机构、市场或来源…"
            onChange={(event) => setCandidateQuery(event.target.value)}
          />
          {visibleCandidates.length > 0 ? (
            <div>
              {visibleCandidates.map((candidate) => (
                <article key={candidate.id}>
                  <span>{candidate.sourceType.replaceAll("_", " ").toUpperCase()}</span>
                  <strong>{candidate.name}</strong>
                  <p>
                    {[candidate.organization, candidate.market]
                      .filter(Boolean)
                      .join(" · ") || "机构与市场待补充"}
                  </p>
                  <small>
                    {candidate.signalCount} SIGNALS / {candidate.sourceLabel}
                  </small>
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void importCandidate(candidate)}
                  >
                    {busy === `candidate:${candidate.id}`
                      ? "正在纳入…"
                      : "纳入关系库 →"}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="studio-relationship-empty-small">
              当前没有新的事实候选。
            </div>
          )}
        </article>

        <form className="studio-relationship-create" onSubmit={createContact}>
          <header>
            <span>NEW RELATIONSHIP</span>
            <h3>手动建立联系人</h3>
          </header>
          <div>
            <RelationshipInput
              label="姓名 *"
              value={contactForm.name}
              onChange={(value) => setContactForm({ ...contactForm, name: value })}
            />
            <RelationshipInput
              label="机构"
              value={contactForm.organization}
              onChange={(value) =>
                setContactForm({ ...contactForm, organization: value })
              }
            />
            <RelationshipInput
              label="职务"
              value={contactForm.roleTitle}
              onChange={(value) =>
                setContactForm({ ...contactForm, roleTitle: value })
              }
            />
            <RelationshipSelect
              label="联系人类型"
              value={contactForm.contactType}
              options={contactTypes}
              onChange={(value) =>
                setContactForm({
                  ...contactForm,
                  contactType: value as RelationshipContactType,
                })
              }
            />
            <RelationshipInput
              label="邮箱"
              type="email"
              value={contactForm.email}
              onChange={(value) => setContactForm({ ...contactForm, email: value })}
            />
            <RelationshipInput
              label="电话"
              value={contactForm.phone}
              onChange={(value) => setContactForm({ ...contactForm, phone: value })}
            />
            <RelationshipInput
              label="市场"
              value={contactForm.market}
              onChange={(value) => setContactForm({ ...contactForm, market: value })}
            />
            <RelationshipInput
              label="城市"
              value={contactForm.city}
              onChange={(value) => setContactForm({ ...contactForm, city: value })}
            />
            <RelationshipSelect
              label="关系层级"
              value={contactForm.tier}
              options={tiers}
              onChange={(value) =>
                setContactForm({
                  ...contactForm,
                  tier: value as RelationshipTier,
                })
              }
            />
            <RelationshipSelect
              label="联系边界"
              value={contactForm.contactability}
              options={contactabilityOptions}
              onChange={(value) =>
                setContactForm({
                  ...contactForm,
                  contactability: value as RelationshipContactability,
                })
              }
            />
            <RelationshipInput
              label="标签"
              value={contactForm.tags}
              placeholder="editorial, Shanghai, AW27"
              onChange={(value) => setContactForm({ ...contactForm, tags: value })}
            />
            <RelationshipInput
              label="下次跟进"
              type="datetime-local"
              value={contactForm.nextFollowUpAt}
              onChange={(value) =>
                setContactForm({ ...contactForm, nextFollowUpAt: value })
              }
            />
            <label className="is-wide">
              <span>内部备注</span>
              <textarea
                rows={3}
                value={contactForm.notes}
                onChange={(event) =>
                  setContactForm({ ...contactForm, notes: event.target.value })
                }
              />
            </label>
          </div>
          <button type="submit" disabled={Boolean(busy)}>
            {busy === "contact" ? "正在保存…" : "建立联系人 →"}
          </button>
        </form>
      </section>

      <section className="studio-relationship-directory">
        <header>
          <div>
            <span>RELATIONSHIP DIRECTORY</span>
            <h3>联系人档案与节奏</h3>
          </div>
          <div>
            <a href="/api/studio/relationships?format=contacts" download>
              联系人 CSV ↘
            </a>
            <a href="/api/studio/relationships?format=json" download>
              完整 JSON ↘
            </a>
          </div>
        </header>
        <div className="studio-relationship-filters">
          <input
            type="search"
            value={query}
            placeholder="搜索姓名、机构、市场、邮箱或标签…"
            onChange={(event) => setQuery(event.target.value)}
          />
          <RelationshipSelect
            label="类型"
            value={typeFilter}
            options={[{ value: "all", label: "全部类型" }, ...contactTypes]}
            onChange={setTypeFilter}
          />
          <RelationshipSelect
            label="层级"
            value={tierFilter}
            options={[{ value: "all", label: "全部层级" }, ...tiers]}
            onChange={setTierFilter}
          />
          <RelationshipSelect
            label="状态"
            value={statusFilter}
            options={[
              { value: "all", label: "全部状态" },
              ...contactStatuses,
            ]}
            onChange={setStatusFilter}
          />
        </div>
        <div className="studio-relationship-directory-grid">
          <div className="studio-relationship-contact-list">
            {visibleContacts.length > 0 ? (
              visibleContacts.map((workspace, index) => (
                <button
                  type="button"
                  className={
                    selectedContactId === workspace.contact.id
                      ? "is-selected"
                      : ""
                  }
                  key={workspace.contact.id}
                  onClick={() => selectContact(workspace.contact.id)}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{workspace.contact.name}</strong>
                    <p>
                      {[
                        workspace.contact.organization,
                        workspace.contact.market,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "资料待补充"}
                    </p>
                  </div>
                  <aside>
                    <small>{tierLabel(workspace.contact.tier)}</small>
                    <b>{workspace.completeness}%</b>
                  </aside>
                </button>
              ))
            ) : (
              <div className="studio-relationship-empty-small">
                当前筛选下没有联系人。
              </div>
            )}
          </div>
          {selected ? (
            <ContactDossier
              key={selected.contact.id}
              workspace={selected}
              busy={busy}
              onSave={(body) =>
                patchContact(selected.contact.id, body)
              }
              onOpportunityStage={(id, stage) =>
                patchOpportunity(id, { stage })
              }
            />
          ) : (
            <div className="studio-relationship-dossier is-empty">
              <span>Ø</span>
              <strong>选择一个联系人</strong>
              <p>资料、机会和互动会在这里形成一条可追溯关系线。</p>
            </div>
          )}
        </div>
      </section>

      <section className="studio-relationship-pipeline">
        <header>
          <div>
            <span>OPPORTUNITY PIPELINE</span>
            <h3>人工推进，不丢失下一步</h3>
          </div>
          <a href="/api/studio/relationships?format=opportunities" download>
            机会 CSV ↘
          </a>
        </header>
        <div>
          {stageOptions.map((stage) => {
            const rows = overview.opportunities.filter(
              (opportunity) => opportunity.stage === stage.value,
            );
            return (
              <article key={stage.value}>
                <header>
                  <span>{stage.short}</span>
                  <strong>{rows.length}</strong>
                </header>
                <div>
                  {rows.map((opportunity) => {
                    const contact = overview.contacts.find(
                      ({ contact: item }) =>
                        item.id === opportunity.contactId,
                    )?.contact;
                    return (
                      <article
                        className={`is-${opportunity.priority}`}
                        key={opportunity.id}
                      >
                        <small>{opportunity.opportunityCode}</small>
                        <strong>{opportunity.title}</strong>
                        <p>
                          {contact?.name ?? "未找到联系人"}
                          {contact?.organization
                            ? ` · ${contact.organization}`
                            : ""}
                        </p>
                        <span>
                          {opportunity.nextActionAt
                            ? `NEXT / ${formatDate(opportunity.nextActionAt)}`
                            : "NEXT ACTION MISSING"}
                        </span>
                        <select
                          value={opportunity.stage}
                          disabled={Boolean(busy)}
                          onChange={(event) =>
                            void patchOpportunity(opportunity.id, {
                              stage: event.target
                                .value as RelationshipOpportunityStage,
                            })
                          }
                        >
                          {stageOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </article>
                    );
                  })}
                  {rows.length === 0 && <p>暂无记录</p>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="studio-relationship-action-workbench">
        <form onSubmit={createOpportunity}>
          <header>
            <span>NEW OPPORTUNITY</span>
            <h3>建立机会</h3>
          </header>
          <RelationshipSelect
            label="联系人 *"
            value={opportunityForm.contactId}
            options={[
              { value: "", label: "选择联系人" },
              ...overview.contacts.map(({ contact }) => ({
                value: contact.id,
                label: `${contact.name} · ${contact.organization || contact.contactCode}`,
              })),
            ]}
            onChange={(value) =>
              setOpportunityForm({ ...opportunityForm, contactId: value })
            }
          />
          <RelationshipInput
            label="机会名称 *"
            value={opportunityForm.title}
            onChange={(value) =>
              setOpportunityForm({ ...opportunityForm, title: value })
            }
          />
          <div className="studio-relationship-form-pair">
            <RelationshipSelect
              label="类型"
              value={opportunityForm.kind}
              options={opportunityKinds}
              onChange={(value) =>
                setOpportunityForm({
                  ...opportunityForm,
                  kind: value as RelationshipOpportunityKind,
                })
              }
            />
            <RelationshipSelect
              label="阶段"
              value={opportunityForm.stage}
              options={stageOptions}
              onChange={(value) =>
                setOpportunityForm({
                  ...opportunityForm,
                  stage: value as RelationshipOpportunityStage,
                })
              }
            />
          </div>
          <div className="studio-relationship-form-pair">
            <RelationshipSelect
              label="优先级"
              value={opportunityForm.priority}
              options={priorityOptions}
              onChange={(value) =>
                setOpportunityForm({
                  ...opportunityForm,
                  priority: value as RelationshipPriority,
                })
              }
            />
            <RelationshipInput
              label="系列"
              value={opportunityForm.collection}
              onChange={(value) =>
                setOpportunityForm({ ...opportunityForm, collection: value })
              }
            />
          </div>
          <RelationshipInput
            label="市场"
            value={opportunityForm.market}
            onChange={(value) =>
              setOpportunityForm({ ...opportunityForm, market: value })
            }
          />
          <label>
            <span>机会摘要</span>
            <textarea
              rows={3}
              value={opportunityForm.summary}
              onChange={(event) =>
                setOpportunityForm({
                  ...opportunityForm,
                  summary: event.target.value,
                })
              }
            />
          </label>
          <RelationshipInput
            label="下一步"
            value={opportunityForm.nextAction}
            onChange={(value) =>
              setOpportunityForm({ ...opportunityForm, nextAction: value })
            }
          />
          <RelationshipInput
            label="下一步时间"
            type="datetime-local"
            value={opportunityForm.nextActionAt}
            onChange={(value) =>
              setOpportunityForm({ ...opportunityForm, nextActionAt: value })
            }
          />
          <button type="submit" disabled={Boolean(busy)}>
            {busy === "opportunity" ? "正在保存…" : "加入机会管线 →"}
          </button>
        </form>

        <form onSubmit={createActivity}>
          <header>
            <span>TOUCHPOINT / TASK</span>
            <h3>记录互动或待办</h3>
          </header>
          <RelationshipSelect
            label="联系人 *"
            value={activityForm.contactId}
            options={[
              { value: "", label: "选择联系人" },
              ...overview.contacts.map(({ contact }) => ({
                value: contact.id,
                label: `${contact.name} · ${contact.organization || contact.contactCode}`,
              })),
            ]}
            onChange={(value) =>
              setActivityForm({
                ...activityForm,
                contactId: value,
                opportunityId: "",
              })
            }
          />
          <RelationshipSelect
            label="关联机会"
            value={activityForm.opportunityId}
            options={[
              { value: "", label: "不关联机会" },
              ...selectedOpportunities.map((opportunity) => ({
                value: opportunity.id,
                label: opportunity.title,
              })),
            ]}
            onChange={(value) =>
              setActivityForm({ ...activityForm, opportunityId: value })
            }
          />
          <div className="studio-relationship-form-pair">
            <RelationshipSelect
              label="类型"
              value={activityForm.kind}
              options={activityKinds}
              onChange={(value) =>
                setActivityForm({
                  ...activityForm,
                  kind: value as RelationshipActivityKind,
                })
              }
            />
            <RelationshipSelect
              label="状态"
              value={activityForm.status}
              options={activityStatuses}
              onChange={(value) =>
                setActivityForm({
                  ...activityForm,
                  status: value as RelationshipActivityStatus,
                })
              }
            />
          </div>
          <div className="studio-relationship-form-pair">
            <RelationshipSelect
              label="渠道"
              value={activityForm.channel}
              options={channelOptions}
              onChange={(value) =>
                setActivityForm({
                  ...activityForm,
                  channel: value as RelationshipActivityChannel,
                })
              }
            />
            <RelationshipSelect
              label="方向"
              value={activityForm.direction}
              options={directionOptions}
              onChange={(value) =>
                setActivityForm({
                  ...activityForm,
                  direction: value as RelationshipActivityDirection,
                })
              }
            />
          </div>
          <RelationshipInput
            label="主题 *"
            value={activityForm.subject}
            onChange={(value) =>
              setActivityForm({ ...activityForm, subject: value })
            }
          />
          <label>
            <span>记录</span>
            <textarea
              rows={3}
              value={activityForm.notes}
              onChange={(event) =>
                setActivityForm({
                  ...activityForm,
                  notes: event.target.value,
                })
              }
            />
          </label>
          <div className="studio-relationship-form-pair">
            <RelationshipInput
              label="待办时间"
              type="datetime-local"
              value={activityForm.dueAt}
              onChange={(value) =>
                setActivityForm({ ...activityForm, dueAt: value })
              }
            />
            <RelationshipInput
              label="实际发生时间"
              type="datetime-local"
              value={activityForm.occurredAt}
              onChange={(value) =>
                setActivityForm({ ...activityForm, occurredAt: value })
              }
            />
          </div>
          <button type="submit" disabled={Boolean(busy)}>
            {busy === "activity" ? "正在保存…" : "保存记录 →"}
          </button>
          <small>
            此操作只记录或规划，不会自动发送邮件、消息或邀请。
          </small>
        </form>
      </section>

      <section className="studio-relationship-agenda">
        <header>
          <div>
            <span>ACTION AGENDA</span>
            <h3>下一步队列</h3>
          </div>
          <a href="/api/studio/relationships?format=activities" download>
            互动与待办 CSV ↘
          </a>
        </header>
        {overview.agenda.length > 0 ? (
          <ol>
            {overview.agenda.map((item, index) => (
              <li className={item.overdue ? "is-overdue" : ""} key={item.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <time>{formatDateTime(item.dueAt)}</time>
                <div>
                  <small>{item.kind.toUpperCase()} / {item.contactName}</small>
                  <strong>{item.title}</strong>
                  {item.detail && <p>{item.detail}</p>}
                </div>
                <b>{item.overdue ? "OVERDUE" : item.priority.toUpperCase()}</b>
                {item.kind === "activity" ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void completeActivity(item.id.replace("activity:", ""))
                    }
                  >
                    标记完成
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => selectContact(item.contactId)}
                  >
                    查看联系人
                  </button>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <div className="studio-relationship-agenda-empty">
            <span>✓</span>
            <strong>当前没有到期待办</strong>
            <p>为联系人、机会或互动设置下一步时间后，会自动进入此队列。</p>
          </div>
        )}
      </section>
    </section>
  );
}

function ContactDossier({
  workspace,
  busy,
  onSave,
  onOpportunityStage,
}: {
  workspace: RelationshipContactWorkspace;
  busy: string;
  onSave: (body: Record<string, unknown>) => Promise<void>;
  onOpportunityStage: (
    id: string,
    stage: RelationshipOpportunityStage,
  ) => Promise<void>;
}) {
  const { contact } = workspace;
  const [tier, setTier] = useState(contact.tier);
  const [status, setStatus] = useState(contact.status);
  const [contactability, setContactability] = useState(contact.contactability);
  const [nextFollowUpAt, setNextFollowUpAt] = useState(
    toLocalDateTime(contact.nextFollowUpAt),
  );
  const [tags, setTags] = useState(workspace.tags.join(", "));
  const [notes, setNotes] = useState(contact.notes);

  return (
    <article
      className={`studio-relationship-dossier${
        contact.contactability === "do_not_contact" ? " is-do-not-contact" : ""
      }`}
    >
      <header>
        <div>
          <span>{contact.contactCode} / {contactTypeLabel(contact.contactType)}</span>
          <h4>{contact.name}</h4>
          <p>
            {[contact.roleTitle, contact.organization, contact.market]
              .filter(Boolean)
              .join(" · ") || "资料待补充"}
          </p>
        </div>
        <aside>
          <strong>{workspace.completeness}%</strong>
          <small>PROFILE COMPLETE</small>
        </aside>
      </header>
      {contact.contactability === "do_not_contact" && (
        <div className="studio-relationship-boundary">
          DO NOT CONTACT / 仅保留历史记录，不应主动外联
        </div>
      )}
      <dl>
        <div>
          <dt>EMAIL</dt>
          <dd>{contact.email || "未填写"}</dd>
        </div>
        <div>
          <dt>PHONE</dt>
          <dd>{contact.phone || "未填写"}</dd>
        </div>
        <div>
          <dt>LAST CONTACT</dt>
          <dd>{contact.lastContactAt ? formatDate(contact.lastContactAt) : "无记录"}</dd>
        </div>
        <div>
          <dt>NEXT ACTION</dt>
          <dd>{workspace.nextActionAt ? formatDate(workspace.nextActionAt) : "未安排"}</dd>
        </div>
        <div>
          <dt>SOURCE</dt>
          <dd>{contact.sourceType.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt>OPEN OPPORTUNITIES</dt>
          <dd>{workspace.openOpportunityCount}</dd>
        </div>
      </dl>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({
            tier,
            status,
            contactability,
            nextFollowUpAt: fromLocalDateTime(nextFollowUpAt),
            tags,
            notes,
          });
        }}
      >
        <RelationshipSelect
          label="关系层级"
          value={tier}
          options={tiers}
          onChange={(value) => setTier(value as RelationshipTier)}
        />
        <RelationshipSelect
          label="状态"
          value={status}
          options={contactStatuses}
          onChange={(value) =>
            setStatus(value as RelationshipContactStatus)
          }
        />
        <RelationshipSelect
          label="联系边界"
          value={contactability}
          options={contactabilityOptions}
          onChange={(value) =>
            setContactability(value as RelationshipContactability)
          }
        />
        <RelationshipInput
          label="下次跟进"
          type="datetime-local"
          value={nextFollowUpAt}
          onChange={setNextFollowUpAt}
        />
        <RelationshipInput
          label="标签"
          value={tags}
          onChange={setTags}
        />
        <label className="is-wide">
          <span>内部备注</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={Boolean(busy)}
          className="is-wide"
        >
          {busy === `contact:${contact.id}` ? "正在保存…" : "保存关系节奏 →"}
        </button>
      </form>
      <section>
        <header>
          <span>OPPORTUNITIES / {workspace.opportunities.length}</span>
        </header>
        {workspace.opportunities.length > 0 ? (
          workspace.opportunities.slice(0, 8).map((opportunity) => (
            <article key={opportunity.id}>
              <div>
                <small>{opportunity.opportunityCode}</small>
                <strong>{opportunity.title}</strong>
                <p>{opportunity.nextAction || "下一步待补充"}</p>
              </div>
              <select
                value={opportunity.stage}
                disabled={Boolean(busy)}
                onChange={(event) =>
                  void onOpportunityStage(
                    opportunity.id,
                    event.target.value as RelationshipOpportunityStage,
                  )
                }
              >
                {stageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </article>
          ))
        ) : (
          <p>尚未建立机会。</p>
        )}
      </section>
      <section>
        <header>
          <span>RECENT ACTIVITY / {workspace.activities.length}</span>
        </header>
        {workspace.activities.length > 0 ? (
          workspace.activities.slice(0, 6).map((activity) => (
            <article key={activity.id}>
              <div>
                <small>{activity.kind.toUpperCase()} / {activity.status.toUpperCase()}</small>
                <strong>{activity.subject}</strong>
                <p>{activity.notes || "无补充记录"}</p>
              </div>
              <time>
                {formatDate(
                  activity.occurredAt ??
                    activity.dueAt ??
                    activity.createdAt,
                )}
              </time>
            </article>
          ))
        ) : (
          <p>尚未记录互动。</p>
        )}
      </section>
    </article>
  );
}

function RelationshipMetric({
  eyebrow,
  value,
  detail,
  alert = false,
}: {
  eyebrow: string;
  value: number | string;
  detail: string;
  alert?: boolean;
}) {
  return (
    <article className={alert ? "is-alert" : ""}>
      <span>{eyebrow}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function RelationshipInput({
  label,
  value,
  type = "text",
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function RelationshipSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

async function mutate(
  url: string,
  body: Record<string, unknown>,
  method: "POST" | "PATCH" = "POST",
) {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error || "操作失败。");
  return payload;
}

function emitUpdate() {
  window.dispatchEvent(new CustomEvent("nera:relationship-updated"));
}

function contactTypeLabel(value: string) {
  return contactTypes.find((option) => option.value === value)?.label ?? value;
}

function tierLabel(value: string) {
  return tiers.find((option) => option.value === value)?.label ?? value;
}

function fromLocalDateTime(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date)
    : value;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
    : value;
}
