"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  SamplePlacementChannel,
  SamplePlacementMetricMode,
  SamplePlacementOverview,
  SamplePlacementStatus,
  SamplePlacementType,
  SamplePlacementVoiceType,
  SamplePlacementWorkspace,
} from "@/lib/sample-placements";

type ApiPayload = {
  overview?: SamplePlacementOverview;
  placement?: SamplePlacementWorkspace | null;
  error?: string;
};

type PlacementForm = {
  loanId: string;
  status: SamplePlacementStatus;
  placementType: SamplePlacementType;
  channel: SamplePlacementChannel;
  title: string;
  outletName: string;
  voiceName: string;
  voiceType: SamplePlacementVoiceType;
  eventName: string;
  market: string;
  country: string;
  placementDate: string;
  sourceUrl: string;
  evidenceAltText: string;
  reportedReach: string;
  reportedEngagements: string;
  reportedImpact: string;
  impactCurrency: string;
  metricMode: SamplePlacementMetricMode;
  metricSource: string;
  notes: string;
  loanItemIds: string[];
};

const statuses: Array<{ value: SamplePlacementStatus; label: string }> = [
  { value: "pending", label: "待确认" },
  { value: "shot", label: "已拍摄" },
  { value: "placed", label: "已落地" },
  { value: "published", label: "已发布" },
  { value: "not_placed", label: "未采用" },
  { value: "archived", label: "已归档" },
];

const placementTypes: Array<{
  value: SamplePlacementType;
  label: string;
}> = [
  { value: "editorial", label: "编辑大片" },
  { value: "red_carpet", label: "红毯" },
  { value: "celebrity", label: "艺人造型" },
  { value: "influencer", label: "创作者内容" },
  { value: "film_tv", label: "影视" },
  { value: "event", label: "活动" },
  { value: "buyer", label: "买手展示" },
  { value: "other", label: "其他" },
];

const channels: Array<{ value: SamplePlacementChannel; label: string }> = [
  { value: "print", label: "纸媒" },
  { value: "online", label: "线上媒体" },
  { value: "social", label: "社交媒体" },
  { value: "broadcast", label: "广播 / 影视" },
  { value: "event", label: "现场活动" },
  { value: "other", label: "其他" },
];

const voiceTypes: Array<{
  value: SamplePlacementVoiceType;
  label: string;
}> = [
  { value: "media", label: "媒体" },
  { value: "celebrity", label: "名人" },
  { value: "influencer", label: "意见领袖" },
  { value: "partner", label: "合作方" },
  { value: "owned_media", label: "自有媒体" },
  { value: "other", label: "其他" },
];

const metricModes: Array<{
  value: SamplePlacementMetricMode;
  label: string;
}> = [
  { value: "not_recorded", label: "未记录" },
  { value: "reported", label: "外部 / 人工填报" },
  { value: "verified", label: "证据已核验" },
];

function emptyForm(): PlacementForm {
  return {
    loanId: "",
    status: "pending",
    placementType: "editorial",
    channel: "print",
    title: "",
    outletName: "",
    voiceName: "",
    voiceType: "media",
    eventName: "",
    market: "",
    country: "",
    placementDate: "",
    sourceUrl: "",
    evidenceAltText: "",
    reportedReach: "",
    reportedEngagements: "",
    reportedImpact: "",
    impactCurrency: "USD",
    metricMode: "not_recorded",
    metricSource: "",
    notes: "",
    loanItemIds: [],
  };
}

export default function SampleImpact() {
  const [overview, setOverview] = useState<SamplePlacementOverview | null>(null);
  const [form, setForm] = useState<PlacementForm>(emptyForm);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SamplePlacementStatus>(
    "all",
  );
  const [channelFilter, setChannelFilter] = useState<
    "all" | SamplePlacementChannel
  >("all");
  const [editing, setEditing] = useState<{
    id: string;
    form: PlacementForm;
    evidenceFile: File | null;
  } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await requestOverview();
        if (!cancelled) setOverview(next);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "无法读取成果工作台。",
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
        const next = await requestOverview();
        if (!cancelled) setOverview(next);
      } catch {
        // Preserve the current ledger if a background refresh is interrupted.
      }
    }
    window.addEventListener("nera:loan-updated", sync);
    window.addEventListener("nera:placement-updated", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("nera:loan-updated", sync);
      window.removeEventListener("nera:placement-updated", sync);
    };
  }, []);

  const selectedLoan = useMemo(
    () =>
      overview?.loans.find((workspace) => workspace.loan.id === form.loanId) ??
      null,
    [form.loanId, overview],
  );
  const visiblePlacements = useMemo(() => {
    if (!overview) return [];
    const needle = query.trim().toLocaleLowerCase();
    return overview.placements.filter(({ placement, loan, items }) => {
      if (statusFilter !== "all" && placement.status !== statusFilter) {
        return false;
      }
      if (channelFilter !== "all" && placement.channel !== channelFilter) {
        return false;
      }
      if (!needle) return true;
      return [
        placement.placementCode,
        placement.title,
        placement.outletName,
        placement.voiceName,
        placement.eventName,
        placement.market,
        placement.country,
        loan?.loanCode,
        loan?.projectTitle,
        ...items.flatMap((item) => [
          item.assetCode,
          item.lookNumber,
          item.workTitle,
        ]),
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [channelFilter, overview, query, statusFilter]);

  async function createPlacement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const body = placementFormData(form, evidenceFile);
      const response = await fetch("/api/studio/sample-placements", {
        method: "POST",
        body,
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.placement) {
        throw new Error(payload.error || "建立成果记录失败。");
      }
      const next = await requestOverview();
      setOverview(next);
      setForm(emptyForm());
      setEvidenceFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage(`已建立 ${payload.placement.placement.placementCode}。`);
      window.dispatchEvent(new CustomEvent("nera:placement-updated"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "建立成果记录失败。");
    } finally {
      setSaving(false);
    }
  }

  function chooseLoan(loanId: string) {
    const loan = overview?.loans.find(
      (workspace) => workspace.loan.id === loanId,
    );
    setForm((current) => ({
      ...current,
      loanId,
      loanItemIds: loan?.items.map((item) => item.id) ?? [],
      title: current.title || loan?.request.projectTitle || "",
      voiceName: current.voiceName || loan?.request.requesterName || "",
    }));
  }

  function toggleCreateItem(itemId: string) {
    setForm((current) => ({
      ...current,
      loanItemIds: current.loanItemIds.includes(itemId)
        ? current.loanItemIds.filter((id) => id !== itemId)
        : [...current.loanItemIds, itemId],
    }));
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setError("");
    setMessage("");
    setUpdatingId(editing.id);
    try {
      const response = await fetch(
        `/api/studio/sample-placements/${encodeURIComponent(editing.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...editing.form,
            loanId: undefined,
          }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.placement) {
        throw new Error(payload.error || "保存成果记录失败。");
      }
      if (editing.evidenceFile) {
        const imageBody = new FormData();
        imageBody.set("evidenceImage", editing.evidenceFile);
        imageBody.set("evidenceAltText", editing.form.evidenceAltText);
        const imageResponse = await fetch(
          `/api/studio/sample-placements/${encodeURIComponent(editing.id)}/image`,
          { method: "POST", body: imageBody },
        );
        const imagePayload = (await imageResponse.json()) as ApiPayload;
        if (!imageResponse.ok) {
          throw new Error(imagePayload.error || "证据图片更新失败。");
        }
      }
      setOverview(await requestOverview());
      setEditing(null);
      setMessage("成果记录、关联 Look 与指标口径已更新。");
      window.dispatchEvent(new CustomEvent("nera:placement-updated"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存成果记录失败。");
    } finally {
      setUpdatingId(null);
    }
  }

  if (!overview && loading) {
    return (
      <section className="studio-impact is-loading">
        <p>正在连接 Placement &amp; Impact…</p>
      </section>
    );
  }

  if (!overview) {
    return (
      <section className="studio-impact is-loading is-error">
        <p>{error || "成果工作台暂不可用。"}</p>
      </section>
    );
  }

  const metrics = overview.metrics;
  return (
    <section
      className="studio-impact"
      id="placement-impact"
      aria-labelledby="placement-impact-title"
    >
      <header className="studio-impact-hero">
        <span aria-hidden="true">14</span>
        <div>
          <small>14 / PLACEMENT &amp; IMPACT</small>
          <h2 id="placement-impact-title">
            借出。出现。<i>证据。</i>
          </h2>
          <p>
            把每次样衣寄送连接到刊登、红毯、艺人造型与现场露出；从“送过什么”继续追踪到“真正发生了什么”。
          </p>
        </div>
        <aside>
          <small>COVERED SEND-OUTS</small>
          <strong>{formatPercent(metrics.coveredSendOutRate)}</strong>
          <span>
            {metrics.coveredLoanCount}/{metrics.sentLoanCount} 借出已产生可确认成果
          </span>
          <dl>
            <div>
              <dt>OUTCOMES / SEND</dt>
              <dd>{formatDecimal(metrics.outcomesPerSendOut)}</dd>
            </div>
            <div>
              <dt>EVIDENCE</dt>
              <dd>{formatPercent(metrics.evidenceCoverageRate)}</dd>
            </div>
          </dl>
        </aside>
      </header>

      <div className="studio-impact-method">
        <span>MEASUREMENT NOTE / 指标说明</span>
        <p>
          “借出覆盖率”＝至少有一条已落地或已发布成果的借出单 ÷
          已送出借出单；“成果/借出”允许一次借出产生多条内容。触达、互动与影响值仅汇总人工或第三方填报数据，并保留来源；不同币种不会合并。
        </p>
      </div>

      {(error || message) && (
        <div
          className={`studio-impact-notice${error ? " is-error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {error || message}
        </div>
      )}

      <div className="studio-impact-metrics">
        <ImpactMetric
          index="01"
          label="OUTCOMES"
          value={metrics.outcomeCount}
          detail={`${metrics.publishedCount} 已发布 / ${metrics.placementCount} 全部记录`}
        />
        <ImpactMetric
          index="02"
          label="VERIFIED"
          value={metrics.verifiedMetricCount}
          detail={`${metrics.evidenceCount} 条成果有链接或截图`}
        />
        <ImpactMetric
          index="03"
          label="REPORTED REACH"
          value={compactNumber(metrics.reportedReach)}
          detail={`${compactNumber(metrics.reportedEngagements)} 填报互动`}
        />
        <ImpactMetric
          index="04"
          label="REPORTED IMPACT"
          value={impactSummary(metrics.impactByCurrency)}
          detail="按币种分列 · 不等同于平台计算 MIV"
        />
      </div>

      <div className="studio-impact-workbench">
        <form className="studio-impact-form" onSubmit={createPlacement}>
          <header>
            <span>NEW EVIDENCE / 新增成果</span>
            <h3>登记一次真实出现</h3>
            <p>先连接借出与 Look，再记录发布方、Voice、证据和指标来源。</p>
          </header>

          <label className="is-wide">
            <span>关联借出单</span>
            <select
              value={form.loanId}
              onChange={(event) => chooseLoan(event.target.value)}
            >
              <option value="">暂不关联 / 后补证据</option>
              {overview.loans.map((workspace) => (
                <option key={workspace.loan.id} value={workspace.loan.id}>
                  {workspace.loan.loanCode} · {workspace.request.projectTitle} ·{" "}
                  {workspace.request.requesterName}
                </option>
              ))}
            </select>
          </label>

          {selectedLoan && (
            <div className="studio-impact-look-picker is-wide">
              <header>
                <span>PLACED LOOKS</span>
                <strong>
                  {form.loanItemIds.length}/{selectedLoan.items.length} SELECTED
                </strong>
              </header>
              <div>
                {selectedLoan.items.map((item) => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      checked={form.loanItemIds.includes(item.id)}
                      onChange={() => toggleCreateItem(item.id)}
                    />
                    {item.imageKey ? (
                      <img src={mediaUrl(item.imageKey)} alt="" />
                    ) : (
                      <span aria-hidden="true">Ø</span>
                    )}
                    <strong>{item.lookNumber || "LOOK"}</strong>
                    <small>{item.workTitle}</small>
                  </label>
                ))}
              </div>
            </div>
          )}

          <TextField
            label="成果标题 *"
            value={form.title}
            onChange={(title) => setForm({ ...form, title })}
            maxLength={240}
            placeholder="Vogue China September Editorial"
            wide
          />
          <SelectField
            label="状态"
            value={form.status}
            options={statuses}
            onChange={(status) =>
              setForm({ ...form, status: status as SamplePlacementStatus })
            }
          />
          <SelectField
            label="成果类型"
            value={form.placementType}
            options={placementTypes}
            onChange={(placementType) =>
              setForm({
                ...form,
                placementType: placementType as SamplePlacementType,
              })
            }
          />
          <SelectField
            label="渠道"
            value={form.channel}
            options={channels}
            onChange={(channel) =>
              setForm({ ...form, channel: channel as SamplePlacementChannel })
            }
          />
          <SelectField
            label="Voice 类型"
            value={form.voiceType}
            options={voiceTypes}
            onChange={(voiceType) =>
              setForm({
                ...form,
                voiceType: voiceType as SamplePlacementVoiceType,
              })
            }
          />
          <TextField
            label="媒体 / 发布方"
            value={form.outletName}
            onChange={(outletName) => setForm({ ...form, outletName })}
            maxLength={240}
            placeholder="Vogue / i-D / Studio"
          />
          <TextField
            label="Voice / 穿着者"
            value={form.voiceName}
            onChange={(voiceName) => setForm({ ...form, voiceName })}
            maxLength={240}
            placeholder="Stylist / Talent / Creator"
          />
          <TextField
            label="活动 / 项目"
            value={form.eventName}
            onChange={(eventName) => setForm({ ...form, eventName })}
            maxLength={240}
            placeholder="Premiere / Campaign"
          />
          <TextField
            label="日期"
            value={form.placementDate}
            onChange={(placementDate) => setForm({ ...form, placementDate })}
            type="date"
          />
          <TextField
            label="市场"
            value={form.market}
            onChange={(market) => setForm({ ...form, market })}
            maxLength={120}
            placeholder="APAC"
          />
          <TextField
            label="国家 / 地区"
            value={form.country}
            onChange={(country) => setForm({ ...form, country })}
            maxLength={120}
            placeholder="China"
          />
          <TextField
            label="证据链接"
            value={form.sourceUrl}
            onChange={(sourceUrl) => setForm({ ...form, sourceUrl })}
            type="url"
            maxLength={1200}
            placeholder="https://…"
            wide
          />
          <label className="studio-impact-file is-wide">
            <span>证据图片 · JPEG / PNG / WebP · 15MB 内</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) =>
                setEvidenceFile(event.target.files?.[0] ?? null)
              }
            />
            <strong>{evidenceFile?.name || "选择刊登截图或现场照片 ↗"}</strong>
          </label>
          <TextField
            label="证据图片描述"
            value={form.evidenceAltText}
            onChange={(evidenceAltText) =>
              setForm({ ...form, evidenceAltText })
            }
            maxLength={240}
            placeholder="用于归档与无障碍阅读"
            wide
          />

          <div className="studio-impact-metric-entry is-wide">
            <header>
              <div>
                <span>REPORTED METRICS</span>
                <strong>只记录有来源的数据</strong>
              </div>
              <SelectField
                label="指标口径"
                value={form.metricMode}
                options={metricModes}
                onChange={(metricMode) =>
                  setForm({
                    ...form,
                    metricMode: metricMode as SamplePlacementMetricMode,
                  })
                }
              />
            </header>
            <div>
              <TextField
                label="填报触达"
                value={form.reportedReach}
                onChange={(reportedReach) =>
                  setForm({ ...form, reportedReach })
                }
                type="number"
                step="1"
                placeholder="0"
              />
              <TextField
                label="填报互动"
                value={form.reportedEngagements}
                onChange={(reportedEngagements) =>
                  setForm({ ...form, reportedEngagements })
                }
                type="number"
                step="1"
                placeholder="0"
              />
              <TextField
                label="填报影响值"
                value={form.reportedImpact}
                onChange={(reportedImpact) =>
                  setForm({ ...form, reportedImpact })
                }
                type="number"
                step="0.01"
                placeholder="0.00"
              />
              <TextField
                label="币种"
                value={form.impactCurrency}
                onChange={(impactCurrency) =>
                  setForm({
                    ...form,
                    impactCurrency: impactCurrency.toUpperCase(),
                  })
                }
                maxLength={3}
                placeholder="USD"
              />
            </div>
            <TextField
              label="指标来源"
              value={form.metricSource}
              onChange={(metricSource) => setForm({ ...form, metricSource })}
              maxLength={500}
              placeholder="媒体后台、代理商报告或内部核验说明"
              wide
            />
          </div>

          <label className="is-wide">
            <span>内部备注</span>
            <textarea
              value={form.notes}
              maxLength={3000}
              rows={4}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
            />
          </label>
          <button type="submit" disabled={saving}>
            {saving ? "正在保存证据…" : "建立成果记录 ↗"}
          </button>
        </form>

        <aside className="studio-impact-intelligence">
          <header>
            <span>PLACEMENT SIGNALS</span>
            <h3>谁让作品真正被看见</h3>
          </header>
          <Breakdown
            title="TOP OUTLETS"
            rows={overview.breakdowns.outlets}
          />
          <Breakdown title="TOP VOICES" rows={overview.breakdowns.voices} />
          <Breakdown
            title="CHANNEL MIX"
            rows={overview.breakdowns.channels.map((row) => ({
              ...row,
              key: optionLabel(channels, row.key),
            }))}
          />
          <footer>
            <strong>{metrics.unlinkedCount}</strong>
            <span>条成果尚未关联借出单，建议在证据确认后补齐来源链路。</span>
          </footer>
        </aside>
      </div>

      <section className="studio-impact-ledger">
        <header>
          <div>
            <span>PLACEMENT LEDGER / 成果账本</span>
            <h3>从线索到已发布</h3>
          </div>
          <a href="/api/studio/sample-placements?format=csv" download>
            导出成果 CSV ↘
          </a>
        </header>
        <div className="studio-impact-filters">
          <label>
            <span>搜索</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="媒体、Voice、Look、借出编号…"
            />
          </label>
          <label>
            <span>状态</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as "all" | SamplePlacementStatus,
                )
              }
            >
              <option value="all">全部状态</option>
              {statuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>渠道</span>
            <select
              value={channelFilter}
              onChange={(event) =>
                setChannelFilter(
                  event.target.value as "all" | SamplePlacementChannel,
                )
              }
            >
              <option value="all">全部渠道</option>
              {channels.map((channel) => (
                <option key={channel.value} value={channel.value}>
                  {channel.label}
                </option>
              ))}
            </select>
          </label>
          <strong>
            {visiblePlacements.length}/{overview.placements.length} RECORDS
          </strong>
        </div>

        {visiblePlacements.length === 0 ? (
          <div className="studio-impact-empty">
            <span>Ø</span>
            <strong>尚无匹配成果</strong>
            <p>登记首条刊登、造型或现场露出后，这里会形成证据账本。</p>
          </div>
        ) : (
          <div className="studio-impact-list">
            {visiblePlacements.map((workspace) => (
              <PlacementCard
                key={workspace.placement.id}
                workspace={workspace}
                overview={overview}
                editing={editing}
                updating={updatingId === workspace.placement.id}
                onEdit={() =>
                  setEditing({
                    id: workspace.placement.id,
                    form: editForm(workspace),
                    evidenceFile: null,
                  })
                }
                onCancel={() => setEditing(null)}
                onChange={(next) => setEditing(next)}
                onSave={saveEdit}
              />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function PlacementCard(props: {
  workspace: SamplePlacementWorkspace;
  overview: SamplePlacementOverview;
  editing: {
    id: string;
    form: PlacementForm;
    evidenceFile: File | null;
  } | null;
  updating: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onChange: (
    value: {
      id: string;
      form: PlacementForm;
      evidenceFile: File | null;
    } | null,
  ) => void;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const { placement, loan, items } = props.workspace;
  const isEditing = props.editing?.id === placement.id;
  const associatedLoan = placement.loanId
    ? props.overview.loans.find(
        (workspace) => workspace.loan.id === placement.loanId,
      )
    : null;
  const edit = isEditing ? props.editing : null;
  return (
    <article
      className={`studio-impact-card is-${placement.status}${isEditing ? " is-editing" : ""}`}
    >
      <div className="studio-impact-card-media">
        {placement.evidenceImageKey ? (
          <img
            src={mediaUrl(placement.evidenceImageKey)}
            alt={placement.evidenceAltText || placement.title}
          />
        ) : items[0]?.imageKey ? (
          <img src={mediaUrl(items[0].imageKey)} alt={items[0].workTitle} />
        ) : (
          <span aria-hidden="true">NO EVIDENCE</span>
        )}
        <b>{optionLabel(statuses, placement.status)}</b>
      </div>
      <div className="studio-impact-card-copy">
        <header>
          <div>
            <small>
              {placement.placementCode} /{" "}
              {optionLabel(channels, placement.channel)}
            </small>
            <h4>{placement.title}</h4>
            <p>
              {[placement.outletName, placement.voiceName, placement.eventName]
                .filter(Boolean)
                .join(" · ") || "发布方与 Voice 待补充"}
            </p>
          </div>
          <time>{formatDate(placement.placementDate)}</time>
        </header>
        <div className="studio-impact-card-tags">
          <span>{optionLabel(placementTypes, placement.placementType)}</span>
          <span>{optionLabel(voiceTypes, placement.voiceType)}</span>
          <span
            className={
              placement.metricMode === "verified" ? "is-verified" : ""
            }
          >
            {optionLabel(metricModes, placement.metricMode)}
          </span>
        </div>
        <div className="studio-impact-card-links">
          {loan ? (
            <span>
              {loan.loanCode} · {loan.projectTitle}
            </span>
          ) : (
            <span className="is-alert">未关联借出单</span>
          )}
          {placement.sourceUrl ? (
            <a href={placement.sourceUrl} target="_blank" rel="noreferrer">
              查看证据 ↗
            </a>
          ) : (
            <span className="is-alert">缺少证据链接</span>
          )}
        </div>
        <div className="studio-impact-card-looks">
          {items.length > 0 ? (
            items.map((item) => (
              <span key={item.id}>
                <b>{item.lookNumber || "LOOK"}</b>
                {item.workTitle}
                {item.assetCode && <small>{item.assetCode}</small>}
              </span>
            ))
          ) : (
            <span className="is-empty">尚未标记采用的 Look</span>
          )}
        </div>
        <dl>
          <div>
            <dt>REPORTED REACH</dt>
            <dd>
              {placement.reportedReach === null
                ? "—"
                : compactNumber(placement.reportedReach)}
            </dd>
          </div>
          <div>
            <dt>ENGAGEMENTS</dt>
            <dd>
              {placement.reportedEngagements === null
                ? "—"
                : compactNumber(placement.reportedEngagements)}
            </dd>
          </div>
          <div>
            <dt>REPORTED IMPACT</dt>
            <dd>
              {placement.reportedImpactCents === null
                ? "—"
                : formatMoney(
                    placement.reportedImpactCents,
                    placement.impactCurrency,
                  )}
            </dd>
          </div>
        </dl>
        {placement.metricSource && (
          <p className="studio-impact-source">
            SOURCE / {placement.metricSource}
          </p>
        )}
        {!isEditing && (
          <button type="button" onClick={props.onEdit}>
            编辑证据与状态 ↗
          </button>
        )}
      </div>

      {edit && (
        <form className="studio-impact-editor" onSubmit={props.onSave}>
          <header>
            <div>
              <span>EDIT PLACEMENT</span>
              <strong>{placement.placementCode}</strong>
            </div>
            <button type="button" onClick={props.onCancel}>
              关闭
            </button>
          </header>
          <TextField
            label="成果标题"
            value={edit.form.title}
            onChange={(title) =>
              props.onChange({ ...edit, form: { ...edit.form, title } })
            }
            maxLength={240}
            wide
          />
          <SelectField
            label="状态"
            value={edit.form.status}
            options={statuses}
            onChange={(status) =>
              props.onChange({
                ...edit,
                form: {
                  ...edit.form,
                  status: status as SamplePlacementStatus,
                },
              })
            }
          />
          <TextField
            label="活动 / 项目"
            value={edit.form.eventName}
            onChange={(eventName) =>
              props.onChange({
                ...edit,
                form: { ...edit.form, eventName },
              })
            }
          />
          <TextField
            label="市场"
            value={edit.form.market}
            onChange={(market) =>
              props.onChange({
                ...edit,
                form: { ...edit.form, market },
              })
            }
          />
          <TextField
            label="国家 / 地区"
            value={edit.form.country}
            onChange={(country) =>
              props.onChange({
                ...edit,
                form: { ...edit.form, country },
              })
            }
          />
          <SelectField
            label="渠道"
            value={edit.form.channel}
            options={channels}
            onChange={(channel) =>
              props.onChange({
                ...edit,
                form: {
                  ...edit.form,
                  channel: channel as SamplePlacementChannel,
                },
              })
            }
          />
          <SelectField
            label="成果类型"
            value={edit.form.placementType}
            options={placementTypes}
            onChange={(placementType) =>
              props.onChange({
                ...edit,
                form: {
                  ...edit.form,
                  placementType: placementType as SamplePlacementType,
                },
              })
            }
          />
          <SelectField
            label="Voice 类型"
            value={edit.form.voiceType}
            options={voiceTypes}
            onChange={(voiceType) =>
              props.onChange({
                ...edit,
                form: {
                  ...edit.form,
                  voiceType: voiceType as SamplePlacementVoiceType,
                },
              })
            }
          />
          <TextField
            label="媒体 / 发布方"
            value={edit.form.outletName}
            onChange={(outletName) =>
              props.onChange({
                ...edit,
                form: { ...edit.form, outletName },
              })
            }
          />
          <TextField
            label="Voice / 穿着者"
            value={edit.form.voiceName}
            onChange={(voiceName) =>
              props.onChange({
                ...edit,
                form: { ...edit.form, voiceName },
              })
            }
          />
          <TextField
            label="日期"
            type="date"
            value={edit.form.placementDate}
            onChange={(placementDate) =>
              props.onChange({
                ...edit,
                form: { ...edit.form, placementDate },
              })
            }
          />
          <TextField
            label="证据链接"
            type="url"
            value={edit.form.sourceUrl}
            onChange={(sourceUrl) =>
              props.onChange({
                ...edit,
                form: { ...edit.form, sourceUrl },
              })
            }
            wide
          />
          <SelectField
            label="指标口径"
            value={edit.form.metricMode}
            options={metricModes}
            onChange={(metricMode) =>
              props.onChange({
                ...edit,
                form: {
                  ...edit.form,
                  metricMode: metricMode as SamplePlacementMetricMode,
                },
              })
            }
          />
          <TextField
            label="指标来源"
            value={edit.form.metricSource}
            onChange={(metricSource) =>
              props.onChange({
                ...edit,
                form: { ...edit.form, metricSource },
              })
            }
          />
          <TextField
            label="填报触达"
            type="number"
            step="1"
            value={edit.form.reportedReach}
            onChange={(reportedReach) =>
              props.onChange({
                ...edit,
                form: { ...edit.form, reportedReach },
              })
            }
          />
          <TextField
            label="填报互动"
            type="number"
            step="1"
            value={edit.form.reportedEngagements}
            onChange={(reportedEngagements) =>
              props.onChange({
                ...edit,
                form: { ...edit.form, reportedEngagements },
              })
            }
          />
          <TextField
            label="填报影响值"
            type="number"
            step="0.01"
            value={edit.form.reportedImpact}
            onChange={(reportedImpact) =>
              props.onChange({
                ...edit,
                form: { ...edit.form, reportedImpact },
              })
            }
          />
          <TextField
            label="币种"
            value={edit.form.impactCurrency}
            onChange={(impactCurrency) =>
              props.onChange({
                ...edit,
                form: {
                  ...edit.form,
                  impactCurrency: impactCurrency.toUpperCase(),
                },
              })
            }
            maxLength={3}
          />
          {associatedLoan && (
            <div className="studio-impact-edit-looks is-wide">
              <span>采用的 Look</span>
              <div>
                {associatedLoan.items.map((item) => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      checked={edit.form.loanItemIds.includes(item.id)}
                      onChange={() =>
                        props.onChange({
                          ...edit,
                          form: {
                            ...edit.form,
                            loanItemIds: edit.form.loanItemIds.includes(item.id)
                              ? edit.form.loanItemIds.filter(
                                  (id) => id !== item.id,
                                )
                              : [...edit.form.loanItemIds, item.id],
                          },
                        })
                      }
                    />
                    {item.lookNumber || "LOOK"} / {item.workTitle}
                  </label>
                ))}
              </div>
            </div>
          )}
          <label className="studio-impact-file is-wide">
            <span>替换证据图片</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) =>
                props.onChange({
                  ...edit,
                  evidenceFile: event.target.files?.[0] ?? null,
                })
              }
            />
            <strong>
              {edit.evidenceFile?.name || "保留现有图片，或选择新文件 ↗"}
            </strong>
          </label>
          <TextField
            label="证据图片描述"
            value={edit.form.evidenceAltText}
            onChange={(evidenceAltText) =>
              props.onChange({
                ...edit,
                form: { ...edit.form, evidenceAltText },
              })
            }
            wide
          />
          <label className="is-wide">
            <span>内部备注</span>
            <textarea
              value={edit.form.notes}
              rows={3}
              onChange={(event) =>
                props.onChange({
                  ...edit,
                  form: { ...edit.form, notes: event.target.value },
                })
              }
            />
          </label>
          <button type="submit" disabled={props.updating}>
            {props.updating ? "正在保存…" : "保存成果记录 ↗"}
          </button>
        </form>
      )}
    </article>
  );
}

function ImpactMetric(props: {
  index: string;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <article>
      <span>{props.index}</span>
      <small>{props.label}</small>
      <strong>{props.value}</strong>
      <p>{props.detail}</p>
    </article>
  );
}

function Breakdown(props: {
  title: string;
  rows: Array<{ key: string; count: number }>;
}) {
  const max = Math.max(...props.rows.map((row) => row.count), 1);
  return (
    <section className="studio-impact-breakdown">
      <header>
        <span>{props.title}</span>
        <strong>{props.rows.reduce((total, row) => total + row.count, 0)}</strong>
      </header>
      {props.rows.length === 0 ? (
        <p>等待首条已落地或已发布成果。</p>
      ) : (
        <div>
          {props.rows.map((row) => (
            <div key={row.key}>
              <span>{row.key}</span>
              <i>
                <b style={{ width: `${(row.count / max) * 100}%` }} />
              </i>
              <strong>{row.count}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "url" | "date" | "number";
  step?: string;
  maxLength?: number;
  placeholder?: string;
  wide?: boolean;
}) {
  return (
    <label className={props.wide ? "is-wide" : undefined}>
      <span>{props.label}</span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        maxLength={props.maxLength}
        min={props.type === "number" ? 0 : undefined}
        step={props.type === "number" ? props.step ?? "any" : undefined}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{props.label}</span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function editForm(workspace: SamplePlacementWorkspace): PlacementForm {
  const placement = workspace.placement;
  return {
    loanId: placement.loanId ?? "",
    status: placement.status,
    placementType: placement.placementType,
    channel: placement.channel,
    title: placement.title,
    outletName: placement.outletName,
    voiceName: placement.voiceName,
    voiceType: placement.voiceType,
    eventName: placement.eventName,
    market: placement.market,
    country: placement.country,
    placementDate: placement.placementDate ?? "",
    sourceUrl: placement.sourceUrl,
    evidenceAltText: placement.evidenceAltText,
    reportedReach:
      placement.reportedReach === null ? "" : String(placement.reportedReach),
    reportedEngagements:
      placement.reportedEngagements === null
        ? ""
        : String(placement.reportedEngagements),
    reportedImpact:
      placement.reportedImpactCents === null
        ? ""
        : (placement.reportedImpactCents / 100).toFixed(2),
    impactCurrency: placement.impactCurrency,
    metricMode: placement.metricMode,
    metricSource: placement.metricSource,
    notes: placement.notes,
    loanItemIds: workspace.items
      .map((item) => item.sampleLoanItemId)
      .filter((id): id is string => Boolean(id)),
  };
}

function placementFormData(form: PlacementForm, file: File | null) {
  const body = new FormData();
  Object.entries(form).forEach(([key, value]) => {
    body.set(
      key,
      key === "loanItemIds" ? JSON.stringify(value) : String(value),
    );
  });
  if (file) body.set("evidenceImage", file);
  return body;
}

async function requestOverview() {
  const response = await fetch("/api/studio/sample-placements", {
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok || !payload.overview) {
    throw new Error(payload.error || "无法读取成果工作台。");
  }
  return payload.overview;
}

function optionLabel(
  options: Array<{ value: string; label: string }>,
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function mediaUrl(imageKey: string) {
  return `/api/media/${imageKey
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function formatDate(value: string | null) {
  if (!value) return "DATE / TBD";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatPercent(value: number) {
  return `${formatDecimal(value)}%`;
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 1,
  }).format(value);
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toLocaleString("zh-CN")}`;
  }
}

function impactSummary(
  rows: SamplePlacementOverview["metrics"]["impactByCurrency"],
) {
  if (rows.length === 0) return "—";
  if (rows.length === 1) return formatMoney(rows[0].cents, rows[0].currency);
  return `${rows.length} CURRENCIES`;
}
