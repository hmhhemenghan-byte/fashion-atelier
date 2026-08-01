"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CoverageBookBreakdown,
  CoverageBookFilters,
  CoverageBookIssue,
  CoverageBookRange,
  CoverageBookReport,
  CoverageBookStatus,
} from "@/lib/coverage-book";

type ApiPayload = {
  report?: CoverageBookReport;
  error?: string;
};

const defaultFilters: CoverageBookFilters = {
  range: "365",
  from: "",
  to: "",
  collection: "",
  channel: "",
  type: "",
  market: "",
  status: "all",
};

const rangeOptions: Array<{ value: CoverageBookRange; label: string }> = [
  { value: "90", label: "最近 90 天" },
  { value: "365", label: "最近一年" },
  { value: "all", label: "全部历史" },
  { value: "custom", label: "自定义日期" },
];

const statusOptions: Array<{ value: CoverageBookStatus; label: string }> = [
  { value: "all", label: "已落地 + 已发布" },
  { value: "placed", label: "仅已落地" },
  { value: "published", label: "仅已发布" },
];

const channelLabels: Record<string, string> = {
  print: "纸媒",
  online: "线上媒体",
  social: "社交媒体",
  broadcast: "广播 / 影视",
  event: "现场活动",
  other: "其他",
};

const typeLabels: Record<string, string> = {
  editorial: "编辑大片",
  red_carpet: "红毯",
  celebrity: "艺人造型",
  influencer: "创作者内容",
  film_tv: "影视",
  event: "活动",
  buyer: "买手展示",
  other: "其他",
};

const issueLabels: Record<CoverageBookIssue, string> = {
  missing_evidence: "缺少证据",
  missing_date: "缺少日期",
  missing_outlet: "缺少媒体 / 发布方",
  missing_items: "未关联 Look",
  unlinked_loan: "未关联借出单",
  unverified_metrics: "填报指标未核验",
};

export default function CoverageBook() {
  const [filters, setFilters] =
    useState<CoverageBookFilters>(defaultFilters);
  const [report, setReport] = useState<CoverageBookReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const query = useMemo(() => reportQuery(filters), [filters]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/studio/coverage-book?${reportQuery(filters)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json()) as ApiPayload;
        if (!response.ok || !payload.report) {
          throw new Error(payload.error || "无法读取媒体覆盖册。");
        }
        setReport(payload.report);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof Error ? cause.message : "无法读取媒体覆盖册。",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [filters, refreshKey]);

  useEffect(() => {
    const refresh = () => setRefreshKey((current) => current + 1);
    window.addEventListener("nera:placement-updated", refresh);
    window.addEventListener("nera:loan-updated", refresh);
    return () => {
      window.removeEventListener("nera:placement-updated", refresh);
      window.removeEventListener("nera:loan-updated", refresh);
    };
  }, []);

  if (!report && loading) {
    return (
      <section className="studio-coverage is-loading">
        <p>正在编排 Seasonal Coverage Book…</p>
      </section>
    );
  }

  if (!report) {
    return (
      <section className="studio-coverage is-loading is-error">
        <p>{error || "媒体覆盖册暂不可用。"}</p>
      </section>
    );
  }

  const activeFilterCount = [
    filters.collection,
    filters.channel,
    filters.type,
    filters.market,
    filters.status === "all" ? "" : filters.status,
    filters.range === "custom" ? filters.from : "",
    filters.range === "custom" ? filters.to : "",
  ].filter(Boolean).length;
  const maxTrend = Math.max(
    1,
    ...report.trend.map((row) => row.placements),
  );
  const { metrics } = report;

  return (
    <section
      className={`studio-coverage${loading ? " is-refreshing" : ""}`}
      id="coverage-book"
      aria-labelledby="coverage-book-title"
      aria-busy={loading}
    >
      <header className="studio-coverage-hero">
        <span aria-hidden="true">15</span>
        <div>
          <small>15 / SEASONAL COVERAGE BOOK</small>
          <h2 id="coverage-book-title">
            证据。叙事。<i>归册。</i>
          </h2>
          <p>
            把每一次真实落地组织成可交付的季刊：从媒体、市场与系列结构，到具体
            Look、原始证据和指标来源，形成一份随数据持续更新的品牌成果档案。
          </p>
        </div>
        <aside>
          <small>BOOK STATUS / {report.period.label}</small>
          <strong>{String(metrics.placementCount).padStart(2, "0")}</strong>
          <span>QUALIFIED PLACEMENTS</span>
          <dl>
            <div>
              <dt>PUBLISHED</dt>
              <dd>{metrics.publishedCount}</dd>
            </div>
            <div>
              <dt>LOOKS</dt>
              <dd>{metrics.uniqueLookCount}</dd>
            </div>
            <div>
              <dt>EVIDENCE</dt>
              <dd>{formatPercent(metrics.evidenceCoverageRate)}</dd>
            </div>
          </dl>
        </aside>
      </header>

      <div className="studio-coverage-method">
        <span>EDITORIAL STANDARD / 口径</span>
        <p>
          仅纳入状态为“已落地”或“已发布”的成果。Coverage Rate
          以同周期、同系列的真实送出单为分母；触达、互动与影响值保持原始填报口径，
          未核验内容不会伪装成系统测量，不同币种永不合并。
        </p>
      </div>

      {error && (
        <div className="studio-coverage-notice" role="status">
          {error}
        </div>
      )}

      <section className="studio-coverage-controls">
        <header>
          <div>
            <span>BOOK SCOPE</span>
            <h3>定义本期覆盖范围</h3>
          </div>
          <div>
            <strong>{activeFilterCount} ACTIVE FILTERS</strong>
            <button type="button" onClick={() => setFilters(defaultFilters)}>
              重置
            </button>
          </div>
        </header>
        <div className="studio-coverage-filter-grid">
          <CoverageSelect
            label="时间周期"
            value={filters.range}
            options={rangeOptions}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                range: value as CoverageBookRange,
              }))
            }
          />
          <CoverageSelect
            label="系列"
            value={filters.collection}
            emptyLabel="全部系列"
            options={options(report.filterOptions.collections)}
            onChange={(value) =>
              setFilters((current) => ({ ...current, collection: value }))
            }
          />
          <CoverageSelect
            label="渠道"
            value={filters.channel}
            emptyLabel="全部渠道"
            options={report.filterOptions.channels.map((value) => ({
              value,
              label: channelLabels[value] ?? value,
            }))}
            onChange={(value) =>
              setFilters((current) => ({ ...current, channel: value }))
            }
          />
          <CoverageSelect
            label="成果类型"
            value={filters.type}
            emptyLabel="全部类型"
            options={report.filterOptions.types.map((value) => ({
              value,
              label: typeLabels[value] ?? value,
            }))}
            onChange={(value) =>
              setFilters((current) => ({ ...current, type: value }))
            }
          />
          <CoverageSelect
            label="市场"
            value={filters.market}
            emptyLabel="全部市场"
            options={options(report.filterOptions.markets)}
            onChange={(value) =>
              setFilters((current) => ({ ...current, market: value }))
            }
          />
          <CoverageSelect
            label="成果状态"
            value={filters.status}
            options={statusOptions}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                status: value as CoverageBookStatus,
              }))
            }
          />
          {filters.range === "custom" && (
            <>
              <CoverageDate
                label="起始日期"
                value={filters.from}
                onChange={(value) =>
                  setFilters((current) => ({ ...current, from: value }))
                }
              />
              <CoverageDate
                label="结束日期"
                value={filters.to}
                onChange={(value) =>
                  setFilters((current) => ({ ...current, to: value }))
                }
              />
            </>
          )}
        </div>
        <footer>
          <a
            className="is-primary"
            href={`/studio/coverage-book/print?${query}`}
            target="_blank"
            rel="noreferrer"
          >
            打开可打印覆盖册 ↗
          </a>
          <a href={`/api/studio/coverage-book?${query}&format=csv`} download>
            CSV 数据 ↘
          </a>
          <a href={`/api/studio/coverage-book?${query}&format=json`} download>
            JSON 快照 ↘
          </a>
        </footer>
      </section>

      <section className="studio-coverage-metrics" aria-label="覆盖成果指标">
        <CoverageMetric
          eyebrow="SEND-OUT COVERAGE"
          value={formatPercent(metrics.coverageRate)}
          detail={`${metrics.coveredLoanCount} / ${metrics.sentLoanCount} 份周期送出单形成成果`}
        />
        <CoverageMetric
          eyebrow="EVIDENCE COVERAGE"
          value={formatPercent(metrics.evidenceCoverageRate)}
          detail={`${metrics.evidenceCount} 份成果附有链接或图像证据`}
        />
        <CoverageMetric
          eyebrow="LOOK APPEARANCES"
          value={formatNumber(metrics.lookAppearances)}
          detail={`${metrics.uniqueLookCount} 个不同 Look 被记录`}
        />
        <CoverageMetric
          eyebrow="VERIFIED METRICS"
          value={formatNumber(metrics.verifiedMetricCount)}
          detail="带来源且完成核验的成果记录"
        />
        <CoverageMetric
          eyebrow="REPORTED REACH"
          value={formatNumber(metrics.reportedReach)}
          detail="外部 / 人工填报触达，不是系统估算"
        />
        <CoverageMetric
          eyebrow="REPORTED ENGAGEMENTS"
          value={formatNumber(metrics.reportedEngagements)}
          detail="按原始来源累计的互动"
        />
      </section>

      <section className="studio-coverage-analysis">
        <article className="studio-coverage-trend">
          <header>
            <span>MONTHLY PULSE</span>
            <h3>成果时间线</h3>
          </header>
          <div className="studio-coverage-chart">
            {report.trend.map((row) => (
              <div key={row.key}>
                <span>
                  <i
                    style={{
                      height: `${Math.max(
                        row.placements ? 8 : 1,
                        (row.placements / maxTrend) * 100,
                      )}%`,
                    }}
                  />
                  <b
                    style={{
                      height: `${Math.max(
                        row.published ? 8 : 1,
                        (row.published / maxTrend) * 100,
                      )}%`,
                    }}
                  />
                </span>
                <strong>{row.placements}</strong>
                <small>{row.label}</small>
              </div>
            ))}
          </div>
          <footer>
            <span><i /> 全部落地</span>
            <span><b /> 已发布</span>
          </footer>
        </article>
        <article className="studio-coverage-impact">
          <header>
            <span>REPORTED IMPACT</span>
            <h3>按币种保留原值</h3>
          </header>
          {metrics.impactByCurrency.length > 0 ? (
            <div>
              {metrics.impactByCurrency.map((item) => (
                <p key={item.currency}>
                  <span>{item.currency}</span>
                  <strong>{formatMoney(item.cents, item.currency)}</strong>
                </p>
              ))}
            </div>
          ) : (
            <p className="is-empty">
              当前范围没有填报影响值。系统不会推断或生成媒体价值。
            </p>
          )}
          <small>
            REPORTED VALUES ONLY · CURRENCIES ARE NEVER CONSOLIDATED
          </small>
        </article>
      </section>

      <section className="studio-coverage-breakdowns">
        <Breakdown title="媒体 / 发布方" eyebrow="OUTLETS" rows={report.breakdowns.outlets} />
        <Breakdown title="人物 / 声量主体" eyebrow="VOICES" rows={report.breakdowns.voices} />
        <Breakdown title="系列表现" eyebrow="COLLECTIONS" rows={report.breakdowns.collections} />
        <Breakdown
          title="渠道结构"
          eyebrow="CHANNELS"
          rows={report.breakdowns.channels}
          labelFor={(value) => channelLabels[value] ?? value}
        />
        <Breakdown
          title="成果类型"
          eyebrow="PLACEMENT TYPES"
          rows={report.breakdowns.types}
          labelFor={(value) => typeLabels[value] ?? value}
        />
        <Breakdown title="市场分布" eyebrow="MARKETS" rows={report.breakdowns.markets} />
      </section>

      <section className="studio-coverage-editorial">
        <header>
          <div>
            <span>EDITORIAL SEQUENCE</span>
            <h3>本期成果编排</h3>
          </div>
          <strong>{report.placements.length} STORIES</strong>
        </header>
        {report.placements.length > 0 ? (
          <div className="studio-coverage-stories">
            {report.placements.map((placement, index) => (
              <article key={placement.id}>
                <div className="studio-coverage-story-media">
                  {placement.coverImageKey ? (
                    <img
                      src={mediaUrl(placement.coverImageKey)}
                      alt={
                        placement.evidenceAltText ||
                        `${placement.title} 成果证据`
                      }
                    />
                  ) : (
                    <span>NO<br />EVIDENCE</span>
                  )}
                  <b>{String(index + 1).padStart(2, "0")}</b>
                </div>
                <div className="studio-coverage-story-copy">
                  <small>
                    {placement.placementCode} /{" "}
                    {placement.status === "published"
                      ? "PUBLISHED"
                      : "PLACED"}
                  </small>
                  <h4>{placement.title}</h4>
                  <p>
                    {[
                      placement.outletName,
                      placement.voiceName,
                      placement.eventName,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "发布主体待补充"}
                  </p>
                  <div>
                    <span>{typeLabels[placement.placementType] ?? placement.placementType}</span>
                    <span>{channelLabels[placement.channel] ?? placement.channel}</span>
                    {placement.market && <span>{placement.market}</span>}
                    {placement.metricMode === "verified" && (
                      <span className="is-verified">METRICS VERIFIED</span>
                    )}
                  </div>
                  <dl>
                    <div>
                      <dt>DATE</dt>
                      <dd>{placement.placementDate || "待补充"}</dd>
                    </div>
                    <div>
                      <dt>COLLECTION</dt>
                      <dd>{placement.collections.join(" / ") || "待关联"}</dd>
                    </div>
                    <div>
                      <dt>LOOKS</dt>
                      <dd>
                        {placement.items
                          .map((item) => item.lookNumber || item.workTitle)
                          .join(" / ") || "待关联"}
                      </dd>
                    </div>
                    <div>
                      <dt>LOAN</dt>
                      <dd>{placement.loan?.loanCode || "未关联"}</dd>
                    </div>
                  </dl>
                  <footer>
                    {placement.sourceUrl ? (
                      <a
                        href={placement.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        查看原始来源 ↗
                      </a>
                    ) : (
                      <span>无外部来源链接</span>
                    )}
                    {placement.issues.length > 0 && (
                      <span>{placement.issues.length} QUALITY NOTES</span>
                    )}
                  </footer>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="studio-coverage-empty">
            <span>Ø</span>
            <strong>当前范围还没有合格成果</strong>
            <p>调整筛选范围，或先在 Placement &amp; Impact 中完成成果记录。</p>
          </div>
        )}
      </section>

      <section className="studio-coverage-quality">
        <header>
          <div>
            <span>EDITORIAL QA / 交付检查</span>
            <h3>出版前完整度</h3>
          </div>
          <strong>
            {report.quality.affectedPlacementCount} RECORDS /{" "}
            {report.quality.issueCount} NOTES
          </strong>
        </header>
        <div className="studio-coverage-quality-counts">
          {(Object.keys(issueLabels) as CoverageBookIssue[]).map((issue) => (
            <article
              key={issue}
              className={report.quality.counts[issue] ? "is-alert" : ""}
            >
              <span>{issueLabels[issue]}</span>
              <strong>{report.quality.counts[issue]}</strong>
            </article>
          ))}
        </div>
        {report.quality.records.length > 0 ? (
          <ol>
            {report.quality.records.map((record) => (
              <li key={record.id}>
                <span>{record.placementCode}</span>
                <strong>{record.title}</strong>
                <p>
                  {record.issues.map((issue) => issueLabels[issue]).join(" / ")}
                </p>
                <a href="#sample-impact">回到成果台账 ↑</a>
              </li>
            ))}
          </ol>
        ) : (
          <p className="studio-coverage-quality-ready">
            本期所有成果均通过基础完整度检查。
          </p>
        )}
      </section>
    </section>
  );
}

function CoverageMetric({
  eyebrow,
  value,
  detail,
}: {
  eyebrow: string;
  value: string;
  detail: string;
}) {
  return (
    <article>
      <span>{eyebrow}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function CoverageSelect({
  label,
  value,
  options: rows,
  emptyLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  emptyLabel?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {emptyLabel && <option value="">{emptyLabel}</option>}
        {rows.map((row) => (
          <option key={row.value} value={row.value}>
            {row.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CoverageDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Breakdown({
  title,
  eyebrow,
  rows,
  labelFor = (value) => value,
}: {
  title: string;
  eyebrow: string;
  rows: CoverageBookBreakdown[];
  labelFor?: (value: string) => string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <article>
      <header>
        <span>{eyebrow}</span>
        <h3>{title}</h3>
      </header>
      {rows.length > 0 ? (
        <div>
          {rows.slice(0, 6).map((row) => (
            <p key={row.key}>
              <span>
                <b>{labelFor(row.key)}</b>
                <i>
                  <em style={{ width: `${(row.count / max) * 100}%` }} />
                </i>
              </span>
              <strong>{row.count}</strong>
              <small>{formatPercent(row.share)}</small>
            </p>
          ))}
        </div>
      ) : (
        <p className="is-empty">当前范围暂无数据。</p>
      )}
    </article>
  );
}

function options(values: string[]) {
  return values.map((value) => ({ value, label: value }));
}

function reportQuery(filters: CoverageBookFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

function mediaUrl(key: string) {
  return `/api/media/${key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}
