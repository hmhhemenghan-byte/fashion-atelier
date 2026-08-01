"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  SamplePerformanceFilters,
  SamplePerformanceRange,
  SamplePerformanceReport,
} from "@/lib/sample-performance";

type ApiPayload = {
  report?: SamplePerformanceReport;
  error?: string;
};

type RankingView = "most" | "least" | "unused";

const defaultFilters: SamplePerformanceFilters = {
  range: "90",
  department: "",
  collection: "",
  category: "",
  destination: "",
  color: "",
  purpose: "",
};

const ranges: Array<{ value: SamplePerformanceRange; label: string }> = [
  { value: "30", label: "最近 30 天" },
  { value: "90", label: "最近 90 天" },
  { value: "180", label: "最近 180 天" },
  { value: "365", label: "最近一年" },
  { value: "all", label: "全部历史" },
];

const rankingViews: Array<{
  value: RankingView;
  label: string;
  eyebrow: string;
}> = [
  { value: "most", label: "高频流转", eyebrow: "MOST SENT" },
  { value: "least", label: "低频流转", eyebrow: "LEAST SENT" },
  { value: "unused", label: "尚未送出", eyebrow: "NOT SENT" },
];

export default function SamplePerformance() {
  const [filters, setFilters] =
    useState<SamplePerformanceFilters>(defaultFilters);
  const [report, setReport] = useState<SamplePerformanceReport | null>(null);
  const [rankingView, setRankingView] = useState<RankingView>("most");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(performanceUrl(filters), {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as ApiPayload;
        if (!response.ok || !payload.report) {
          throw new Error(payload.error || "无法读取样衣效能报告。");
        }
        setReport(payload.report);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof Error ? cause.message : "无法读取样衣效能报告。",
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
    window.addEventListener("nera:loan-updated", refresh);
    window.addEventListener("nera:inventory-updated", refresh);
    return () => {
      window.removeEventListener("nera:loan-updated", refresh);
      window.removeEventListener("nera:inventory-updated", refresh);
    };
  }, []);

  const rankingRows = useMemo(() => {
    if (!report) return [];
    if (rankingView === "most") return report.rankings.mostSent;
    if (rankingView === "least") return report.rankings.leastSent;
    return report.rankings.notSent;
  }, [rankingView, report]);

  if (!report && loading) {
    return (
      <section className="studio-performance is-loading">
        <p>正在计算 Sample Performance…</p>
      </section>
    );
  }

  if (!report) {
    return (
      <section className="studio-performance is-loading is-error">
        <p>{error || "样衣效能报告暂不可用。"}</p>
      </section>
    );
  }

  const { metrics } = report;
  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => key !== "range" && Boolean(value),
  ).length;

  return (
    <section
      className={`studio-performance${loading ? " is-refreshing" : ""}`}
      id="sample-performance"
      aria-labelledby="sample-performance-title"
      aria-busy={loading}
    >
      <header className="studio-performance-hero">
        <span className="studio-performance-number" aria-hidden="true">
          13
        </span>
        <div>
          <span>13 / SAMPLE PERFORMANCE</span>
          <h2 id="sample-performance-title">
            送出。周转。<i>再配置。</i>
          </h2>
          <p>
            从每一次实体借调中识别真正被使用的 Look、沉睡库存与供给压力，让样衣在正确的机会之间持续流动。
          </p>
        </div>
        <aside>
          <span>UTILIZATION / {report.period.label}</span>
          <div
            className="studio-performance-ring"
            style={{
              background: `conic-gradient(var(--acid) ${Math.min(
                100,
                metrics.utilizationRate,
              ) * 3.6}deg, rgba(255,255,255,.13) 0deg)`,
            }}
            aria-label={`样衣使用率 ${formatPercent(metrics.utilizationRate)}`}
          >
            <strong>{formatNumber(metrics.utilizationRate)}</strong>
            <small>% USED</small>
          </div>
          <dl>
            <div>
              <dt>SENT ASSETS</dt>
              <dd>
                {metrics.sentAssetCount}/{metrics.inventoryCount}
              </dd>
            </div>
            <div>
              <dt>DELIVERIES</dt>
              <dd>{metrics.totalDeliveries}</dd>
            </div>
            <div className={metrics.unusedCount ? "is-alert" : ""}>
              <dt>NOT SENT</dt>
              <dd>{metrics.unusedCount}</dd>
            </div>
            <div className={metrics.overdueAssetCount ? "is-alert" : ""}>
              <dt>OVERDUE</dt>
              <dd>{metrics.overdueAssetCount}</dd>
            </div>
          </dl>
        </aside>
      </header>

      <div className="studio-performance-method">
        <span>MEASUREMENT / 计算口径</span>
        <p>
          仅统计已绑定实体资产且已经发出的借调项；使用率是周期内至少送出一次的资产占当前筛选资产的比例。
          本区只呈现可核验的运营效能；刊登、穿着与外部填报指标由下方 Placement &amp;
          Impact 独立记录，避免把库存流转与媒体成果混为同一口径。
        </p>
      </div>

      {error && (
        <div className="studio-performance-notice" role="status">
          {error}
        </div>
      )}

      <section className="studio-performance-controls">
        <header>
          <div>
            <span>REPORT SCOPE</span>
            <h3>选择观察范围</h3>
          </div>
          <div>
            <strong>{activeFilterCount} ACTIVE FILTERS</strong>
            <a href={performanceUrl(filters, true)} download>
              导出效能 CSV ↘
            </a>
          </div>
        </header>
        <div>
          <PerformanceSelect
            label="时间周期"
            value={filters.range}
            options={ranges}
            onChange={(value) =>
              setFilters({
                ...filters,
                range: value as SamplePerformanceRange,
              })
            }
          />
          <PerformanceSelect
            label="部门"
            value={filters.department}
            emptyLabel="全部部门"
            options={optionRows(report.filterOptions.departments)}
            onChange={(value) =>
              setFilters({ ...filters, department: value })
            }
          />
          <PerformanceSelect
            label="系列"
            value={filters.collection}
            emptyLabel="全部系列"
            options={optionRows(report.filterOptions.collections)}
            onChange={(value) =>
              setFilters({ ...filters, collection: value })
            }
          />
          <PerformanceSelect
            label="类别"
            value={filters.category}
            emptyLabel="全部类别"
            options={report.filterOptions.categories.map((value) => ({
              value,
              label: categoryLabel(value),
            }))}
            onChange={(value) => setFilters({ ...filters, category: value })}
          />
          <PerformanceSelect
            label="目的地"
            value={filters.destination}
            emptyLabel="全部目的地"
            options={optionRows(report.filterOptions.destinations)}
            onChange={(value) =>
              setFilters({ ...filters, destination: value })
            }
          />
          <PerformanceSelect
            label="颜色"
            value={filters.color}
            emptyLabel="全部颜色"
            options={optionRows(report.filterOptions.colors)}
            onChange={(value) => setFilters({ ...filters, color: value })}
          />
          <PerformanceSelect
            label="用途"
            value={filters.purpose}
            emptyLabel="全部用途"
            options={report.filterOptions.purposes.map((value) => ({
              value,
              label: purposeLabel(value),
            }))}
            onChange={(value) => setFilters({ ...filters, purpose: value })}
          />
          <button
            type="button"
            disabled={activeFilterCount === 0}
            onClick={() =>
              setFilters({ ...defaultFilters, range: filters.range })
            }
          >
            清除细分条件
          </button>
        </div>
      </section>

      <section className="studio-performance-metrics">
        <MetricCard
          index="01"
          label="AVG DELIVERIES / SAMPLE"
          value={formatNumber(metrics.averageDeliveriesPerAsset)}
          detail="平均每件样衣送出次数"
        />
        <MetricCard
          index="02"
          label="AVG RETURN TIME"
          value={
            metrics.averageReturnDays === null
              ? "—"
              : formatNumber(metrics.averageReturnDays)
          }
          suffix={metrics.averageReturnDays === null ? "" : "D"}
          detail="仅计算已完成归还的借调"
        />
        <MetricCard
          index="03"
          label="ON-TIME RETURN"
          value={
            metrics.onTimeReturnRate === null
              ? "—"
              : formatNumber(metrics.onTimeReturnRate)
          }
          suffix={metrics.onTimeReturnRate === null ? "" : "%"}
          detail="有明确归还日期的按时率"
          alert={
            metrics.onTimeReturnRate !== null &&
            metrics.onTimeReturnRate < 80
          }
        />
        <MetricCard
          index="04"
          label="ACTIVE / ATTENTION"
          value={`${metrics.activeAssetCount}/${metrics.attentionAssetCount}`}
          detail="流转中资产 / 品相与状态异常"
          alert={metrics.attentionAssetCount > 0}
        />
      </section>

      <section className="studio-performance-overview">
        <div className="studio-performance-trend">
          <header>
            <div>
              <span>SEND-OUT RHYTHM</span>
              <h3>送出节奏</h3>
            </div>
            <strong>{report.period.label}</strong>
          </header>
          <div className="studio-performance-chart">
            {report.trend.map((bucket) => {
              const maximum = Math.max(
                1,
                ...report.trend.map((item) => item.deliveries),
              );
              return (
                <div key={bucket.key}>
                  <span>{bucket.deliveries}</span>
                  <i
                    style={{
                      height: `${Math.max(
                        bucket.deliveries > 0 ? 8 : 2,
                        (bucket.deliveries / maximum) * 100,
                      )}%`,
                    }}
                  />
                  <small>{bucket.label}</small>
                  <em>{bucket.uniqueAssets} ITEMS</em>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="studio-performance-brief">
          <span>PERFORMANCE READ</span>
          <strong>
            {performanceHeadline(metrics.utilizationRate, metrics.unusedCount)}
          </strong>
          <p>{performanceNarrative(report)}</p>
          <dl>
            <div>
              <dt>INVENTORY</dt>
              <dd>{metrics.inventoryCount}</dd>
            </div>
            <div>
              <dt>UNUSED SHARE</dt>
              <dd>
                {formatPercent(
                  metrics.inventoryCount
                    ? (metrics.unusedCount / metrics.inventoryCount) * 100
                    : 0,
                )}
              </dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="studio-performance-ranking">
        <header>
          <div>
            <span>ITEM-LEVEL PERFORMANCE</span>
            <h3>单件使用排行</h3>
          </div>
          <strong>{String(report.assets.length).padStart(2, "0")} ITEMS</strong>
        </header>
        <div className="studio-performance-tabs" role="tablist">
          {rankingViews.map((view) => (
            <button
              type="button"
              role="tab"
              aria-selected={rankingView === view.value}
              className={rankingView === view.value ? "is-active" : ""}
              key={view.value}
              onClick={() => setRankingView(view.value)}
            >
              <span>{view.eyebrow}</span>
              <strong>{view.label}</strong>
            </button>
          ))}
        </div>
        {rankingRows.length === 0 ? (
          <div className="studio-performance-empty">
            <span>NO ACTIVITY</span>
            <h4>
              {report.assets.length === 0
                ? "当前范围尚未登记样衣资产。"
                : "当前分类没有对应记录。"}
            </h4>
            <p>借调完成实物分配并标记发出后，系统会自动形成使用排行。</p>
          </div>
        ) : (
          <div className="studio-performance-rank-list">
            {rankingRows.map((asset, index) => (
              <article
                key={asset.id}
                className={`${asset.overdue ? "is-overdue" : ""}${
                  asset.deliveryCount === 0 ? " is-unused" : ""
                }`}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {asset.imageKey ? (
                  <img src={mediaUrl(asset.imageKey)} alt={asset.workTitle} />
                ) : (
                  <div className="studio-performance-no-image">NÉRA</div>
                )}
                <div>
                  <small>
                    {asset.lookNumber || categoryLabel(asset.category)} ·{" "}
                    {asset.assetCode}
                  </small>
                  <h4>{asset.workTitle}</h4>
                  <p>
                    {asset.collection || "NO COLLECTION"} · {asset.department}
                  </p>
                </div>
                <dl>
                  <div>
                    <dt>SEND-OUTS</dt>
                    <dd>{asset.deliveryCount}</dd>
                  </div>
                  <div>
                    <dt>AVG CYCLE</dt>
                    <dd>
                      {asset.averageCycleDays === null
                        ? "—"
                        : `${formatNumber(asset.averageCycleDays)}D`}
                    </dd>
                  </div>
                  <div>
                    <dt>LAST SENT</dt>
                    <dd>
                      {asset.lastSentAt
                        ? formatDate(asset.lastSentAt)
                        : "NEVER"}
                    </dd>
                  </div>
                </dl>
                <b>
                  {asset.overdue
                    ? "OVERDUE"
                    : asset.active
                      ? "IN CIRCULATION"
                      : asset.deliveryCount === 0
                        ? "UNTAPPED"
                        : "AVAILABLE"}
                </b>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="studio-performance-demand">
        <header>
          <div>
            <span>LOOK PRESSURE</span>
            <h3>需求与供给压力</h3>
          </div>
          <strong>DELIVERIES ÷ PHYSICAL UNITS</strong>
        </header>
        {report.demand.length === 0 ? (
          <div className="studio-performance-empty">
            <span>NO PHYSICAL UNITS</span>
            <h4>登记实物后即可观察 Look 压力。</h4>
          </div>
        ) : (
          <div>
            {report.demand.slice(0, 8).map((item, index) => (
              <article key={item.key}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {item.imageKey ? (
                  <img src={mediaUrl(item.imageKey)} alt={item.workTitle} />
                ) : (
                  <div className="studio-performance-no-image">NÉRA</div>
                )}
                <div>
                  <small>{item.lookNumber || item.collection}</small>
                  <h4>{item.workTitle}</h4>
                  <p>{item.collection || "NO COLLECTION"}</p>
                </div>
                <dl>
                  <div>
                    <dt>DELIVERIES</dt>
                    <dd>{item.deliveries}</dd>
                  </div>
                  <div>
                    <dt>UNITS</dt>
                    <dd>{item.inventoryCount}</dd>
                  </div>
                  <div className={item.availableCount === 0 ? "is-alert" : ""}>
                    <dt>AVAILABLE</dt>
                    <dd>{item.availableCount}</dd>
                  </div>
                </dl>
                <strong>{formatNumber(item.pressure)}×</strong>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="studio-performance-breakdowns">
        <BreakdownBlock
          eyebrow="PRODUCT MIX"
          title="按类别"
          rows={report.breakdowns.categories}
          labelFor={categoryLabel}
          mode="utilization"
        />
        <BreakdownBlock
          eyebrow="TEAM USE"
          title="按部门"
          rows={report.breakdowns.departments}
          mode="utilization"
        />
        <BreakdownBlock
          eyebrow="ACTIVATION"
          title="按用途"
          rows={report.breakdowns.purposes}
          labelFor={purposeLabel}
          mode="deliveries"
        />
        <BreakdownBlock
          eyebrow="DESTINATION"
          title="按目的地"
          rows={report.breakdowns.destinations}
          mode="deliveries"
        />
      </section>

      <section className="studio-performance-actions">
        <header>
          <div>
            <span>ACTION QUEUE</span>
            <h3>下一步处置</h3>
          </div>
          <strong>AUTOMATIC READ · HUMAN DECISION</strong>
        </header>
        <div>
          {report.actions.map((action, index) => (
            <a
              key={action.id}
              className={`is-${action.tone}`}
              href={action.href}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <small>{action.eyebrow}</small>
                <h4>{action.title}</h4>
                <p>{action.detail}</p>
              </div>
              <b>处理 ↑</b>
            </a>
          ))}
        </div>
        <footer>
          报告生成于 {formatDateTime(report.generatedAt)} ·
          系统只提供运营判断，不会自动联系外部收件方或改变资产状态。
        </footer>
      </section>
    </section>
  );
}

function PerformanceSelect(props: {
  label: string;
  value: string;
  emptyLabel?: string;
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
        {props.emptyLabel && <option value="">{props.emptyLabel}</option>}
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricCard(props: {
  index: string;
  label: string;
  value: string;
  suffix?: string;
  detail: string;
  alert?: boolean;
}) {
  return (
    <article className={props.alert ? "is-alert" : ""}>
      <span>{props.index}</span>
      <small>{props.label}</small>
      <strong>
        {props.value}
        {props.suffix && <i>{props.suffix}</i>}
      </strong>
      <p>{props.detail}</p>
    </article>
  );
}

function BreakdownBlock(props: {
  eyebrow: string;
  title: string;
  rows: SamplePerformanceReport["breakdowns"]["categories"];
  labelFor?: (value: string) => string;
  mode: "utilization" | "deliveries";
}) {
  const maximum = Math.max(
    1,
    ...props.rows.map((row) =>
      props.mode === "utilization" ? row.utilizationRate : row.deliveries,
    ),
  );
  return (
    <article>
      <header>
        <span>{props.eyebrow}</span>
        <h3>{props.title}</h3>
      </header>
      {props.rows.length === 0 ? (
        <p className="studio-performance-breakdown-empty">暂无数据</p>
      ) : (
        <div>
          {props.rows.slice(0, 7).map((row) => {
            const value =
              props.mode === "utilization"
                ? row.utilizationRate
                : row.deliveries;
            return (
              <div key={row.key}>
                <span>{props.labelFor?.(row.key) ?? row.key}</span>
                <i>
                  <b
                    style={{
                      width: `${Math.max(
                        value > 0 ? 2 : 0,
                        (value / maximum) * 100,
                      )}%`,
                    }}
                  />
                </i>
                <strong>
                  {props.mode === "utilization"
                    ? formatPercent(value)
                    : `${value} OUT`}
                </strong>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function performanceUrl(
  filters: SamplePerformanceFilters,
  csv = false,
) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  if (csv) params.set("format", "csv");
  return `/api/studio/sample-performance?${params.toString()}`;
}

function optionRows(values: string[]) {
  return values.map((value) => ({ value, label: value }));
}

function performanceHeadline(utilization: number, unused: number) {
  if (utilization >= 75) return "样衣正在形成稳定的流转节奏。";
  if (utilization >= 40) return "一部分资产活跃，另一部分仍有释放空间。";
  if (unused > 0) return "多数资产仍停留在陈列状态。";
  return "等待第一批可比较的借调数据。";
}

function performanceNarrative(report: SamplePerformanceReport) {
  const { metrics } = report;
  if (metrics.inventoryCount === 0) {
    return "先在 Phase 12 登记实体样衣，并将它们分配到借调项。";
  }
  if (metrics.totalDeliveries === 0) {
    return `当前 ${metrics.inventoryCount} 件资产在所选周期尚无已发出记录；可以从私人 Showroom 或编辑选样中优先激活。`;
  }
  const returnRead =
    metrics.averageReturnDays === null
      ? "归还周期仍待更多完整记录"
      : `完整归还平均需要 ${formatNumber(metrics.averageReturnDays)} 天`;
  return `${metrics.sentAssetCount} 件资产完成 ${metrics.totalDeliveries} 次送出，${returnRead}。`;
}

function categoryLabel(value: string) {
  return (
    {
      garment: "服装",
      accessory: "配饰",
      footwear: "鞋履",
      bag: "包袋",
      jewelry: "珠宝",
      other: "其他",
    }[value] ?? value
  );
}

function purposeLabel(value: string) {
  return (
    {
      editorial_shoot: "编辑拍摄",
      red_carpet: "红毯与造型",
      fitting: "试装",
      buyer_review: "买手审阅",
      event: "活动",
      other: "其他",
    }[value] ?? value
  );
}

function mediaUrl(imageKey: string) {
  return `/api/media/${imageKey
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number) {
  return `${formatNumber(value)}%`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date)
    : value;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
    : value;
}
