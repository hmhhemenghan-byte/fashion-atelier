"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  OutreachCampaignStatus,
  OutreachCampaignWorkspace,
  OutreachLanguage,
  OutreachObjective,
  OutreachOverview,
  OutreachRecipientWorkspace,
} from "@/lib/outreach";

type ApiPayload = {
  overview?: OutreachOverview;
  error?: string;
};

type CampaignForm = {
  title: string;
  objective: OutreachObjective;
  status: OutreachCampaignStatus;
  language: OutreachLanguage;
  collectionId: string;
  publicationId: string;
  showroomId: string;
  market: string;
  audienceNote: string;
  subjectLine: string;
  coreMessage: string;
  callToAction: string;
  embargoAt: string;
  windowStartAt: string;
  windowEndAt: string;
  notes: string;
};

type RecipientEdit = {
  opportunityId: string;
  angle: string;
  draftSubject: string;
  draftBody: string;
  approvalNote: string;
};

const objectives: Array<{ value: OutreachObjective; label: string }> = [
  { value: "collection_launch", label: "系列发布" },
  { value: "press_preview", label: "媒体预览" },
  { value: "showroom_invitation", label: "私享展厅邀请" },
  { value: "editorial_pitch", label: "编辑选题沟通" },
  { value: "buyer_follow_up", label: "买手跟进" },
  { value: "event_follow_up", label: "活动后续" },
  { value: "partnership", label: "合作提案" },
  { value: "other", label: "其他" },
];

const campaignStatuses: Array<{
  value: OutreachCampaignStatus;
  label: string;
}> = [
  { value: "draft", label: "草稿" },
  { value: "review", label: "审核中" },
  { value: "ready", label: "已准备" },
  { value: "active", label: "进行中" },
  { value: "paused", label: "已暂停" },
  { value: "completed", label: "已完成" },
  { value: "archived", label: "已归档" },
];

const languages: Array<{ value: OutreachLanguage; label: string }> = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
  { value: "bilingual", label: "中英双语" },
];

const recipientStatusLabels: Record<string, string> = {
  proposed: "待人工批准",
  blocked: "联系受限",
  approved: "已批准",
  drafted: "草稿已就绪",
  recorded_sent: "已登记发送",
  replied: "已收到回复",
  skipped: "本轮跳过",
};

function emptyCampaignForm(): CampaignForm {
  return {
    title: "",
    objective: "collection_launch",
    status: "draft",
    language: "bilingual",
    collectionId: "",
    publicationId: "",
    showroomId: "",
    market: "",
    audienceNote: "",
    subjectLine: "",
    coreMessage: "",
    callToAction: "",
    embargoAt: "",
    windowStartAt: "",
    windowEndAt: "",
    notes: "",
  };
}

function campaignToForm(
  workspace: OutreachCampaignWorkspace,
): CampaignForm {
  const { campaign } = workspace;
  return {
    title: campaign.title,
    objective: campaign.objective,
    status: campaign.status,
    language: campaign.language,
    collectionId: campaign.collectionId ?? "",
    publicationId: campaign.publicationId ?? "",
    showroomId: campaign.showroomId ?? "",
    market: campaign.market,
    audienceNote: campaign.audienceNote,
    subjectLine: campaign.subjectLine,
    coreMessage: campaign.coreMessage,
    callToAction: campaign.callToAction,
    embargoAt: toLocalDateTime(campaign.embargoAt),
    windowStartAt: toLocalDateTime(campaign.windowStartAt),
    windowEndAt: toLocalDateTime(campaign.windowEndAt),
    notes: campaign.notes,
  };
}

function recipientToEdit(
  workspace: OutreachRecipientWorkspace,
): RecipientEdit {
  return {
    opportunityId: workspace.recipient.opportunityId ?? "",
    angle: workspace.recipient.angle,
    draftSubject: workspace.recipient.draftSubject,
    draftBody: workspace.recipient.draftBody,
    approvalNote: workspace.recipient.approvalNote,
  };
}

export default function OutreachDesk() {
  const [overview, setOverview] = useState<OutreachOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [campaignQuery, setCampaignQuery] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("open");
  const [createForm, setCreateForm] = useState<CampaignForm>(
    emptyCampaignForm,
  );
  const [campaignForm, setCampaignForm] = useState<CampaignForm>(
    emptyCampaignForm,
  );
  const [contactId, setContactId] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [recipientAngle, setRecipientAngle] = useState("");
  const [recipientEdits, setRecipientEdits] = useState<
    Record<string, RecipientEdit>
  >({});

  const selected = useMemo(
    () =>
      overview?.campaigns.find(
        ({ campaign }) => campaign.id === selectedCampaignId,
      ) ?? null,
    [overview, selectedCampaignId],
  );

  const visibleCampaigns = useMemo(() => {
    if (!overview) return [];
    const needle = campaignQuery.trim().toLocaleLowerCase();
    return overview.campaigns.filter((workspace) => {
      if (
        campaignFilter === "open" &&
        ["completed", "archived"].includes(workspace.campaign.status)
      ) {
        return false;
      }
      if (
        campaignFilter !== "all" &&
        campaignFilter !== "open" &&
        workspace.campaign.status !== campaignFilter
      ) {
        return false;
      }
      if (!needle) return true;
      return [
        workspace.campaign.campaignCode,
        workspace.campaign.title,
        workspace.campaign.market,
        workspace.collection?.title,
        workspace.publication?.headline,
        workspace.showroom?.label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [campaignFilter, campaignQuery, overview]);

  const availableContacts = useMemo(() => {
    if (!overview || !selected) return [];
    const existing = new Set(
      selected.recipients.map(({ contact }) => contact.id),
    );
    return overview.contacts.filter((contact) => !existing.has(contact.id));
  }, [overview, selected]);

  const selectedContact = overview?.contacts.find(
    (contact) => contact.id === contactId,
  );

  async function loadOverview(
    preferredId = selectedCampaignId,
    preserveNotice = true,
  ) {
    if (!preserveNotice) {
      setMessage("");
      setError("");
    }
    const response = await fetch("/api/studio/outreach", {
      cache: "no-store",
    });
    const payload = (await response.json()) as ApiPayload;
    if (!response.ok || !payload.overview) {
      throw new Error(payload.error || "无法读取外联策划台。");
    }
    setOverview(payload.overview);
    const nextId =
      preferredId &&
      payload.overview.campaigns.some(
        ({ campaign }) => campaign.id === preferredId,
      )
        ? preferredId
        : payload.overview.campaigns[0]?.campaign.id ?? "";
    setSelectedCampaignId(nextId);
    const nextWorkspace = payload.overview.campaigns.find(
      ({ campaign }) => campaign.id === nextId,
    );
    setCampaignForm(
      nextWorkspace ? campaignToForm(nextWorkspace) : emptyCampaignForm(),
    );
    setRecipientEdits({});
    return payload.overview;
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/studio/outreach", {
          cache: "no-store",
        });
        const payload = (await response.json()) as ApiPayload;
        if (!response.ok || !payload.overview) {
          throw new Error(payload.error || "无法读取外联策划台。");
        }
        if (!cancelled) {
          setOverview(payload.overview);
          const first = payload.overview.campaigns[0] ?? null;
          setSelectedCampaignId(first?.campaign.id ?? "");
          setCampaignForm(
            first ? campaignToForm(first) : emptyCampaignForm(),
          );
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "无法读取外联策划台。",
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
    async function syncFromRelationships() {
      try {
        const response = await fetch("/api/studio/outreach", {
          cache: "no-store",
        });
        const payload = (await response.json()) as ApiPayload;
        if (!cancelled && response.ok && payload.overview) {
          setOverview(payload.overview);
        }
      } catch {
        // Keep the current review state if a background refresh is interrupted.
      }
    }
    window.addEventListener(
      "nera:relationship-updated",
      syncFromRelationships,
    );
    return () => {
      cancelled = true;
      window.removeEventListener(
        "nera:relationship-updated",
        syncFromRelationships,
      );
    };
  }, []);

  function selectCampaign(workspace: OutreachCampaignWorkspace) {
    setSelectedCampaignId(workspace.campaign.id);
    setCampaignForm(campaignToForm(workspace));
    setContactId("");
    setOpportunityId("");
    setRecipientAngle("");
    setRecipientEdits({});
    setMessage("");
    setError("");
  }

  async function createCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    setMessage("");
    setError("");
    try {
      const payload = await mutate("/api/studio/outreach", {
        ...createForm,
        embargoAt: fromLocalDateTime(createForm.embargoAt),
        windowStartAt: fromLocalDateTime(createForm.windowStartAt),
        windowEndAt: fromLocalDateTime(createForm.windowEndAt),
      });
      const createdId =
        typeof payload.campaign === "object" &&
        payload.campaign &&
        "id" in payload.campaign
          ? String(payload.campaign.id)
          : "";
      setCreateForm(emptyCampaignForm());
      await loadOverview(createdId);
      setMessage("外联活动已建立，下一步请逐位审核对象。");
      emitUpdate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "活动建立失败。");
    } finally {
      setBusy("");
    }
  }

  async function saveCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy("campaign");
    setMessage("");
    setError("");
    try {
      await mutate(
        `/api/studio/outreach/${encodeURIComponent(selected.campaign.id)}`,
        {
          title: campaignForm.title,
          objective: campaignForm.objective,
          status: campaignForm.status,
          language: campaignForm.language,
          market: campaignForm.market,
          audienceNote: campaignForm.audienceNote,
          subjectLine: campaignForm.subjectLine,
          coreMessage: campaignForm.coreMessage,
          callToAction: campaignForm.callToAction,
          embargoAt: fromLocalDateTime(campaignForm.embargoAt),
          windowStartAt: fromLocalDateTime(campaignForm.windowStartAt),
          windowEndAt: fromLocalDateTime(campaignForm.windowEndAt),
          notes: campaignForm.notes,
        },
        "PATCH",
      );
      await loadOverview(selected.campaign.id);
      setMessage("活动策略与时间窗口已更新。");
      emitUpdate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "活动保存失败。");
    } finally {
      setBusy("");
    }
  }

  async function addRecipient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !contactId) {
      setError("请选择联系人。");
      return;
    }
    setBusy("recipient:add");
    setMessage("");
    setError("");
    try {
      await mutate("/api/studio/outreach/recipients", {
        campaignId: selected.campaign.id,
        contactId,
        opportunityId: opportunityId || null,
        angle: recipientAngle,
      });
      setContactId("");
      setOpportunityId("");
      setRecipientAngle("");
      await loadOverview(selected.campaign.id);
      setMessage("对象已加入活动；具备联系条件的对象仍需人工批准。");
      emitUpdate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "对象添加失败。");
    } finally {
      setBusy("");
    }
  }

  function getRecipientEdit(workspace: OutreachRecipientWorkspace) {
    return (
      recipientEdits[workspace.recipient.id] ?? recipientToEdit(workspace)
    );
  }

  function updateRecipientEdit(
    workspace: OutreachRecipientWorkspace,
    patch: Partial<RecipientEdit>,
  ) {
    setRecipientEdits((current) => ({
      ...current,
      [workspace.recipient.id]: {
        ...(current[workspace.recipient.id] ?? recipientToEdit(workspace)),
        ...patch,
      },
    }));
  }

  async function patchRecipient(
    workspace: OutreachRecipientWorkspace,
    body: Record<string, unknown>,
    success: string,
  ) {
    if (!selected) return;
    const id = workspace.recipient.id;
    setBusy(`recipient:${id}`);
    setMessage("");
    setError("");
    try {
      await mutate(
        `/api/studio/outreach/recipients/${encodeURIComponent(id)}`,
        body,
        "PATCH",
      );
      await loadOverview(selected.campaign.id);
      setMessage(success);
      emitUpdate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "对象更新失败。");
    } finally {
      setBusy("");
    }
  }

  async function copyDraft(workspace: OutreachRecipientWorkspace) {
    if (!workspace.canInitiate) {
      setError("当前联系边界不允许复制主动外联草稿。");
      return;
    }
    const edit = getRecipientEdit(workspace);
    const draft = `${edit.draftSubject}\n\n${edit.draftBody}`.trim();
    if (!draft) {
      setError("当前还没有可复制的草稿。");
      return;
    }
    try {
      await navigator.clipboard.writeText(draft);
      setMessage("草稿已复制；请在确认收件人与私享链接后，前往外部渠道发送。");
      setError("");
    } catch {
      setError("浏览器未允许复制，请手动选择草稿内容。");
    }
  }

  if (loading) {
    return (
      <section className="studio-outreach is-loading">
        CAMPAIGN &amp; OUTREACH DESK / LOADING
      </section>
    );
  }

  if (!overview) {
    return (
      <section className="studio-outreach is-loading is-error">
        {error || "外联策划台暂时不可用。"}
      </section>
    );
  }

  return (
    <section
      className={`studio-outreach${busy ? " is-refreshing" : ""}`}
      id="campaign-outreach"
    >
      <header className="studio-outreach-hero">
        <span>17</span>
        <div>
          <small>PHASE 17 / CAMPAIGN &amp; OUTREACH DESK</small>
          <h2>
            精准策划。
            <i>由人发出。</i>
          </h2>
          <p>
            把系列、发布包、私享展厅与真实关系连接成可审阅的外联计划。
            系统准备事实草稿，设计师保留最后判断与发送权。
          </p>
        </div>
        <aside>
          <small>CONTACTABLE POOL</small>
          <strong>{overview.metrics.contactPoolCount}</strong>
          <span>CONTACTS WITH CONFIRMED BOUNDARIES</span>
          <dl>
            <div>
              <dt>CAMPAIGNS</dt>
              <dd>{overview.metrics.campaignCount}</dd>
            </div>
            <div>
              <dt>DRAFT READY</dt>
              <dd>{overview.metrics.draftReadyCount}</dd>
            </div>
            <div>
              <dt>RESPONSE</dt>
              <dd>{overview.metrics.responseRate}%</dd>
            </div>
          </dl>
        </aside>
      </header>

      <div className="studio-outreach-method">
        <span>HUMAN-LED PROTOCOL</span>
        <p>
          每位对象都独立检查联系边界。标记为“请勿主动联系”的联系人无法加入；
          未确认渠道或授权的对象会被阻断。批准、复制、外部发送与发送登记彼此分开，
          私享展厅链接必须由设计师在发送前手动加入。
        </p>
      </div>

      {(message || error) && (
        <div
          className={`studio-outreach-notice${error ? " is-error" : ""}`}
          role="status"
        >
          {error || message}
        </div>
      )}

      <div className="studio-outreach-metrics">
        <OutreachMetric
          eyebrow="LIVE / READY"
          value={overview.metrics.liveCampaignCount}
          detail="已通过对象审核并进入准备或执行阶段的活动。"
        />
        <OutreachMetric
          eyebrow="PENDING APPROVAL"
          value={overview.metrics.pendingApprovalCount}
          detail="仍等待设计师逐位判断的对象。"
          alert={overview.metrics.pendingApprovalCount > 0}
        />
        <OutreachMetric
          eyebrow="RECORDED SENT"
          value={overview.metrics.recordedSentCount}
          detail="只统计已在外部渠道发送后人工登记的记录。"
        />
        <OutreachMetric
          eyebrow="REPLIES"
          value={overview.metrics.replyCount}
          detail="收到回复后登记，并同步回关系互动时间线。"
        />
        <OutreachMetric
          eyebrow="BOUNDARY BLOCKS"
          value={overview.metrics.blockedRecipientCount}
          detail="当前不具备主动联系条件的活动对象。"
          alert={overview.metrics.blockedRecipientCount > 0}
        />
        <OutreachMetric
          eyebrow="TOTAL RECIPIENTS"
          value={overview.metrics.recipientCount}
          detail="跨所有活动的独立审核席位，不等于邮件发送量。"
        />
      </div>

      <details className="studio-outreach-create">
        <summary>
          <span>01 / NEW CAMPAIGN</span>
          <strong>建立外联活动</strong>
          <i>＋</i>
        </summary>
        <form onSubmit={createCampaign}>
          <OutreachInput
            label="活动名称 *"
            value={createForm.title}
            onChange={(value) => setCreateForm({ ...createForm, title: value })}
          />
          <OutreachSelect
            label="目标"
            value={createForm.objective}
            options={objectives}
            onChange={(value) =>
              setCreateForm({
                ...createForm,
                objective: value as OutreachObjective,
              })
            }
          />
          <OutreachSelect
            label="语言"
            value={createForm.language}
            options={languages}
            onChange={(value) =>
              setCreateForm({
                ...createForm,
                language: value as OutreachLanguage,
              })
            }
          />
          <OutreachInput
            label="市场 / 城市"
            value={createForm.market}
            onChange={(value) =>
              setCreateForm({ ...createForm, market: value })
            }
          />
          <OutreachSelect
            label="关联系列"
            value={createForm.collectionId}
            options={[
              { value: "", label: "暂不关联" },
              ...overview.resources.collections.map((resource) => ({
                value: resource.id,
                label: `${resource.label}${resource.meta ? ` · ${resource.meta}` : ""}`,
              })),
            ]}
            onChange={(value) =>
              setCreateForm({ ...createForm, collectionId: value })
            }
          />
          <OutreachSelect
            label="关联发布包"
            value={createForm.publicationId}
            options={[
              { value: "", label: "暂不关联" },
              ...overview.resources.publications.map((resource) => ({
                value: resource.id,
                label: resource.label,
              })),
            ]}
            onChange={(value) =>
              setCreateForm({ ...createForm, publicationId: value })
            }
          />
          <OutreachSelect
            label="关联私享展厅"
            value={createForm.showroomId}
            options={[
              { value: "", label: "暂不关联" },
              ...overview.resources.showrooms.map((resource) => ({
                value: resource.id,
                label: `${resource.label} · ${resource.status}`,
              })),
            ]}
            onChange={(value) =>
              setCreateForm({ ...createForm, showroomId: value })
            }
          />
          <OutreachInput
            label="统一主题"
            value={createForm.subjectLine}
            onChange={(value) =>
              setCreateForm({ ...createForm, subjectLine: value })
            }
          />
          <label className="is-wide">
            <span>核心信息</span>
            <textarea
              rows={4}
              value={createForm.coreMessage}
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  coreMessage: event.target.value,
                })
              }
            />
          </label>
          <label className="is-wide">
            <span>行动请求</span>
            <textarea
              rows={2}
              value={createForm.callToAction}
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  callToAction: event.target.value,
                })
              }
            />
          </label>
          <OutreachInput
            label="保密截止"
            type="datetime-local"
            value={createForm.embargoAt}
            onChange={(value) =>
              setCreateForm({ ...createForm, embargoAt: value })
            }
          />
          <OutreachInput
            label="外联开始"
            type="datetime-local"
            value={createForm.windowStartAt}
            onChange={(value) =>
              setCreateForm({ ...createForm, windowStartAt: value })
            }
          />
          <OutreachInput
            label="外联结束"
            type="datetime-local"
            value={createForm.windowEndAt}
            onChange={(value) =>
              setCreateForm({ ...createForm, windowEndAt: value })
            }
          />
          <button type="submit" disabled={Boolean(busy)}>
            {busy === "create" ? "正在建立…" : "建立草稿活动 →"}
          </button>
        </form>
      </details>

      <section className="studio-outreach-workbench">
        <aside className="studio-outreach-campaigns">
          <header>
            <span>02 / CAMPAIGN INDEX</span>
            <div>
              <a href="/api/studio/outreach?format=campaigns" download>
                活动 CSV ↘
              </a>
              <a href="/api/studio/outreach?format=recipients" download>
                对象 CSV ↘
              </a>
            </div>
          </header>
          <input
            value={campaignQuery}
            placeholder="搜索活动、市场或系列"
            onChange={(event) => setCampaignQuery(event.target.value)}
          />
          <select
            value={campaignFilter}
            onChange={(event) => setCampaignFilter(event.target.value)}
          >
            <option value="open">当前活动</option>
            <option value="all">全部状态</option>
            {campaignStatuses.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div>
            {visibleCampaigns.map((workspace, index) => (
              <button
                type="button"
                className={
                  workspace.campaign.id === selectedCampaignId
                    ? "is-selected"
                    : ""
                }
                key={workspace.campaign.id}
                onClick={() => selectCampaign(workspace)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <small>
                    {workspace.campaign.campaignCode} /{" "}
                    {campaignStatusLabel(workspace.campaign.status)}
                  </small>
                  <strong>{workspace.campaign.title}</strong>
                  <p>
                    {workspace.metrics.recipientCount} 位对象 ·{" "}
                    {workspace.metrics.draftedCount} 份草稿
                  </p>
                </div>
                <b>{workspace.readiness}%</b>
              </button>
            ))}
            {visibleCampaigns.length === 0 && (
              <p className="studio-outreach-empty">暂无匹配活动。</p>
            )}
          </div>
        </aside>

        <div className="studio-outreach-dossier">
          {selected ? (
            <>
              <header>
                <div>
                  <small>
                    {selected.campaign.campaignCode} /{" "}
                    {objectiveLabel(selected.campaign.objective)}
                  </small>
                  <h3>{selected.campaign.title}</h3>
                  <p>
                    {selected.campaign.market || "未限定市场"} ·{" "}
                    {selected.campaign.language.toUpperCase()} · 更新于{" "}
                    {formatDateTime(selected.campaign.updatedAt)}
                  </p>
                </div>
                <div className="studio-outreach-readiness">
                  <strong>{selected.readiness}%</strong>
                  <span>READINESS</span>
                </div>
              </header>

              <div className="studio-outreach-links">
                {selected.collection && (
                  <span>COLLECTION / {selected.collection.title}</span>
                )}
                {selected.publication && (
                  <span>PRESS / {selected.publication.headline}</span>
                )}
                {selected.showroom && (
                  <span>SHOWROOM / {selected.showroom.label}</span>
                )}
                {!selected.collection &&
                  !selected.publication &&
                  !selected.showroom && <span>尚未关联内容资产</span>}
              </div>

              {selected.blockers.length > 0 && (
                <div className="studio-outreach-blockers">
                  <strong>进入 READY 前仍需处理</strong>
                  <ul>
                    {selected.blockers.map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                </div>
              )}

              <form
                className="studio-outreach-strategy"
                onSubmit={saveCampaign}
              >
                <OutreachInput
                  label="活动名称"
                  value={campaignForm.title}
                  onChange={(value) =>
                    setCampaignForm({ ...campaignForm, title: value })
                  }
                />
                <OutreachSelect
                  label="状态"
                  value={campaignForm.status}
                  options={campaignStatuses}
                  onChange={(value) =>
                    setCampaignForm({
                      ...campaignForm,
                      status: value as OutreachCampaignStatus,
                    })
                  }
                />
                <OutreachSelect
                  label="目标"
                  value={campaignForm.objective}
                  options={objectives}
                  onChange={(value) =>
                    setCampaignForm({
                      ...campaignForm,
                      objective: value as OutreachObjective,
                    })
                  }
                />
                <OutreachSelect
                  label="语言"
                  value={campaignForm.language}
                  options={languages}
                  onChange={(value) =>
                    setCampaignForm({
                      ...campaignForm,
                      language: value as OutreachLanguage,
                    })
                  }
                />
                <OutreachInput
                  label="市场"
                  value={campaignForm.market}
                  onChange={(value) =>
                    setCampaignForm({ ...campaignForm, market: value })
                  }
                />
                <OutreachInput
                  label="统一主题"
                  value={campaignForm.subjectLine}
                  onChange={(value) =>
                    setCampaignForm({
                      ...campaignForm,
                      subjectLine: value,
                    })
                  }
                />
                <label className="is-wide">
                  <span>受众说明</span>
                  <textarea
                    rows={2}
                    value={campaignForm.audienceNote}
                    onChange={(event) =>
                      setCampaignForm({
                        ...campaignForm,
                        audienceNote: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="is-wide">
                  <span>核心信息</span>
                  <textarea
                    rows={4}
                    value={campaignForm.coreMessage}
                    onChange={(event) =>
                      setCampaignForm({
                        ...campaignForm,
                        coreMessage: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="is-wide">
                  <span>行动请求</span>
                  <textarea
                    rows={2}
                    value={campaignForm.callToAction}
                    onChange={(event) =>
                      setCampaignForm({
                        ...campaignForm,
                        callToAction: event.target.value,
                      })
                    }
                  />
                </label>
                <OutreachInput
                  label="保密截止"
                  type="datetime-local"
                  value={campaignForm.embargoAt}
                  onChange={(value) =>
                    setCampaignForm({ ...campaignForm, embargoAt: value })
                  }
                />
                <OutreachInput
                  label="外联开始"
                  type="datetime-local"
                  value={campaignForm.windowStartAt}
                  onChange={(value) =>
                    setCampaignForm({
                      ...campaignForm,
                      windowStartAt: value,
                    })
                  }
                />
                <OutreachInput
                  label="外联结束"
                  type="datetime-local"
                  value={campaignForm.windowEndAt}
                  onChange={(value) =>
                    setCampaignForm({
                      ...campaignForm,
                      windowEndAt: value,
                    })
                  }
                />
                <button type="submit" disabled={Boolean(busy)}>
                  {busy === "campaign" ? "正在保存…" : "保存活动策略 →"}
                </button>
                <small>
                  内容资产在建活动时锁定，避免活动中途误换私享展厅。
                </small>
              </form>

              <section className="studio-outreach-recipient-adder">
                <header>
                  <span>03 / RECIPIENT REVIEW</span>
                  <h3>逐位选择与审核</h3>
                </header>
                <form onSubmit={addRecipient}>
                  <label>
                    <span>联系人 *</span>
                    <select
                      value={contactId}
                      onChange={(event) => {
                        setContactId(event.target.value);
                        setOpportunityId("");
                      }}
                    >
                      <option value="">选择关系库联系人</option>
                      {availableContacts.map((contact) => (
                        <option
                          value={contact.id}
                          key={contact.id}
                          disabled={contact.eligibility === "do_not_contact"}
                        >
                          {contact.name} ·{" "}
                          {contact.organization || contact.contactCode} /{" "}
                          {contact.eligibilityReason}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>关联机会</span>
                    <select
                      value={opportunityId}
                      onChange={(event) =>
                        setOpportunityId(event.target.value)
                      }
                    >
                      <option value="">不关联机会</option>
                      {(selectedContact?.opportunities ?? []).map(
                        (opportunity) => (
                          <option value={opportunity.id} key={opportunity.id}>
                            {opportunity.title} · {opportunity.stage}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="is-wide">
                    <span>针对这位联系人的沟通角度</span>
                    <textarea
                      rows={2}
                      value={recipientAngle}
                      onChange={(event) =>
                        setRecipientAngle(event.target.value)
                      }
                    />
                  </label>
                  <button type="submit" disabled={Boolean(busy) || !contactId}>
                    {busy === "recipient:add" ? "正在加入…" : "加入审核席位 →"}
                  </button>
                </form>
              </section>

              <section className="studio-outreach-recipients">
                <header>
                  <div>
                    <span>APPROVAL QUEUE</span>
                    <h3>{selected.metrics.recipientCount} 位活动对象</h3>
                  </div>
                  <p>草稿只能在人工批准后生成；本台不提供发送按钮。</p>
                </header>
                <div>
                  {selected.recipients.map((workspace, index) => (
                    <RecipientCard
                      key={workspace.recipient.id}
                      index={index}
                      workspace={workspace}
                      edit={getRecipientEdit(workspace)}
                      busy={busy === `recipient:${workspace.recipient.id}`}
                      onEdit={(patch) =>
                        updateRecipientEdit(workspace, patch)
                      }
                      onPatch={(body, success) =>
                        patchRecipient(workspace, body, success)
                      }
                      onCopy={() => copyDraft(workspace)}
                    />
                  ))}
                  {selected.recipients.length === 0 && (
                    <p className="studio-outreach-empty">
                      先从关系库选择对象，再逐位批准。系统不会默认勾选任何联系人。
                    </p>
                  )}
                </div>
              </section>
            </>
          ) : (
            <div className="studio-outreach-zero">
              <span>NO CAMPAIGN SELECTED</span>
              <h3>从建立第一个活动开始。</h3>
              <p>活动会把内容事实、联系人边界与人工发送记录放在同一条链路里。</p>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}

function RecipientCard({
  index,
  workspace,
  edit,
  busy,
  onEdit,
  onPatch,
  onCopy,
}: {
  index: number;
  workspace: OutreachRecipientWorkspace;
  edit: RecipientEdit;
  busy: boolean;
  onEdit: (patch: Partial<RecipientEdit>) => void;
  onPatch: (body: Record<string, unknown>, success: string) => Promise<void>;
  onCopy: () => Promise<void>;
}) {
  const { recipient, contact } = workspace;
  const status = recipient.status;
  const common = {
    opportunityId: edit.opportunityId || null,
    angle: edit.angle,
    approvalNote: edit.approvalNote,
  };
  return (
    <article
      className={`studio-outreach-recipient is-${status}${
        workspace.eligibility !== "eligible" ? " is-blocked" : ""
      }`}
    >
      <header>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <div>
          <small>
            {contact.contactCode} / {contact.contactType.toUpperCase()} /{" "}
            {contact.tier.toUpperCase()}
          </small>
          <h4>{contact.name}</h4>
          <p>
            {contact.organization || "独立联系人"}
            {contact.roleTitle ? ` · ${contact.roleTitle}` : ""}
            {contact.market ? ` · ${contact.market}` : ""}
          </p>
        </div>
        <aside>
          <strong>{recipientStatusLabels[status] ?? status}</strong>
          <small>{workspace.eligibilityReason}</small>
        </aside>
      </header>

      <div className="studio-outreach-contact-route">
        <span>首选渠道 / {contact.preferredChannel}</span>
        <span>联系边界 / {contact.contactability}</span>
        {recipient.approvedAt && (
          <span>批准 / {formatDateTime(recipient.approvedAt)}</span>
        )}
      </div>

      <div className="studio-outreach-recipient-fields">
        <label>
          <span>关联机会</span>
          <select
            value={edit.opportunityId}
            disabled={["recorded_sent", "replied"].includes(status)}
            onChange={(event) =>
              onEdit({ opportunityId: event.target.value })
            }
          >
            <option value="">不关联机会</option>
            {contactOpportunities(workspace).map((opportunity) => (
              <option value={opportunity.id} key={opportunity.id}>
                {opportunity.title} · {opportunity.stage}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>人工审核说明</span>
          <input
            value={edit.approvalNote}
            disabled={["recorded_sent", "replied"].includes(status)}
            onChange={(event) =>
              onEdit({ approvalNote: event.target.value })
            }
          />
        </label>
        <label className="is-wide">
          <span>沟通角度</span>
          <textarea
            rows={2}
            value={edit.angle}
            disabled={["recorded_sent", "replied"].includes(status)}
            onChange={(event) => onEdit({ angle: event.target.value })}
          />
        </label>
      </div>

      {["drafted", "recorded_sent", "replied"].includes(status) && (
        <div className="studio-outreach-draft">
          <label>
            <span>草稿主题</span>
            <input
              value={edit.draftSubject}
              readOnly={status !== "drafted"}
              onChange={(event) =>
                onEdit({ draftSubject: event.target.value })
              }
            />
          </label>
          <label>
            <span>草稿正文</span>
            <textarea
              rows={10}
              value={edit.draftBody}
              readOnly={status !== "drafted"}
              onChange={(event) =>
                onEdit({ draftBody: event.target.value })
              }
            />
          </label>
        </div>
      )}

      <footer>
        {status === "proposed" && workspace.canInitiate && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onPatch(
                { ...common, status: "approved" },
                `${contact.name} 已获人工批准，可生成事实草稿。`,
              )
            }
          >
            人工批准
          </button>
        )}
        {status === "blocked" && workspace.canInitiate && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onPatch(
                { ...common, status: "approved" },
                `${contact.name} 的联系条件已恢复并获人工批准。`,
              )
            }
          >
            重新检查并批准
          </button>
        )}
        {status === "approved" && workspace.canInitiate && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onPatch(
                { ...common, generateDraft: true },
                `${contact.name} 的个性化事实草稿已生成，请人工校订。`,
              )
            }
          >
            生成事实草稿
          </button>
        )}
        {status === "drafted" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onPatch(
                  {
                    ...common,
                    draftSubject: edit.draftSubject,
                    draftBody: edit.draftBody,
                  },
                  `${contact.name} 的草稿已保存。`,
                )
              }
            >
              保存校订
            </button>
            {workspace.canInitiate && (
              <>
                <button type="button" disabled={busy} onClick={onCopy}>
                  复制草稿
                </button>
                <button
                  type="button"
                  className="is-record"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "请确认：内容已经由你在外部渠道实际发送。此操作只登记事实，不会发送任何消息。",
                      )
                    ) {
                      void onPatch(
                        {
                          ...common,
                          draftSubject: edit.draftSubject,
                          draftBody: edit.draftBody,
                          status: "recorded_sent",
                        },
                        `${contact.name} 的外部发送已登记并同步到关系时间线。`,
                      );
                    }
                  }}
                >
                  登记已外部发送
                </button>
              </>
            )}
          </>
        )}
        {status === "recorded_sent" && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onPatch(
                { status: "replied" },
                `${contact.name} 的回复已登记并同步到关系时间线。`,
              )
            }
          >
            登记收到回复
          </button>
        )}
        {status === "skipped" && workspace.canInitiate && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onPatch(
                { ...common, status: "proposed" },
                `${contact.name} 已重新进入人工审核。`,
              )
            }
          >
            重新进入审核
          </button>
        )}
        {["proposed", "approved", "drafted", "blocked"].includes(status) && (
          <button
            type="button"
            className="is-quiet"
            disabled={busy}
            onClick={() =>
              onPatch(
                { ...common, status: "skipped" },
                `${contact.name} 已从本轮计划跳过。`,
              )
            }
          >
            本轮跳过
          </button>
        )}
        {busy && <span>正在保存…</span>}
      </footer>
    </article>
  );
}

function OutreachMetric({
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

function OutreachInput({
  label,
  value,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function OutreachSelect({
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
          <option value={option.value} key={option.value}>
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
  const payload = (await response.json()) as {
    error?: string;
    campaign?: { id?: string };
  };
  if (!response.ok) throw new Error(payload.error || "操作失败。");
  return payload;
}

function emitUpdate() {
  window.dispatchEvent(new CustomEvent("nera:outreach-updated"));
}

function campaignStatusLabel(value: string) {
  return (
    campaignStatuses.find((option) => option.value === value)?.label ?? value
  );
}

function objectiveLabel(value: string) {
  return objectives.find((option) => option.value === value)?.label ?? value;
}

function contactOpportunities(workspace: OutreachRecipientWorkspace) {
  return workspace.opportunities;
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

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
