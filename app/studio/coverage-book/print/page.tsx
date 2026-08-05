import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import {
  buildCoverageBookReport,
  coverageBookQuery,
  parseCoverageBookFilters,
  type CoverageBookIssue,
} from "@/lib/coverage-book";
import { isAdminEmail } from "@/lib/runtime";
import PrintControls from "./print-controls";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Seasonal Coverage Book — NÉRA ATELIER",
  description: "NÉRA ATELIER 媒体成果与样衣落地覆盖册。",
};

type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

const issueLabels: Record<CoverageBookIssue, string> = {
  missing_evidence: "缺少证据",
  missing_date: "缺少日期",
  missing_outlet: "缺少媒体 / 发布方",
  missing_items: "未关联 Look",
  unlinked_loan: "未关联借出单",
  unverified_metrics: "填报指标未核验",
};

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

export default async function CoverageBookPrintPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = toUrlSearchParams(await searchParams);
  const filters = parseCoverageBookFilters(params);
  const query = coverageBookQuery(filters);
  const user = await requireChatGPTUser(
    `/studio/coverage-book/print${query ? `?${query}` : ""}`,
  );
  const signOutToStudio = await chatGPTSignOutPath("/studio");

  if (!(await isAdminEmail(user.email))) {
    return (
      <main className="coverage-print coverage-print-blocked">
        <p>NÉRA ATELIER / DESIGNER ACCESS</p>
        <h1>此账号没有查看覆盖册的权限。</h1>
        <a href={signOutToStudio}>切换账号 →</a>
      </main>
    );
  }

  const report = await buildCoverageBookReport(filters);
  const { metrics } = report;
  const cover = report.placements.find(
    (placement) => placement.coverImageKey,
  );

  return (
    <main className="coverage-print">
      <nav className="coverage-print-controls" aria-label="覆盖册操作">
        <Link href={`/studio#coverage-book`}>← 返回 Studio</Link>
        <span>建议选择 A4 / 背景图形开启</span>
        <PrintControls />
      </nav>

      <section className="coverage-print-cover">
        {cover && (
          <img
            src={mediaUrl(cover.coverImageKey)}
            alt={cover.evidenceAltText || `${cover.title} 成果证据`}
          />
        )}
        <div className="coverage-print-cover-shade" />
        <header>
          <p>NÉRA ATELIER</p>
          <span>PRIVATE EDITORIAL RECORD / {report.period.label}</span>
        </header>
        <div>
          <small>SEASONAL</small>
          <h1>
            COVERAGE
            <br />
            <i>BOOK</i>
          </h1>
          <p>PLACEMENTS · PEOPLE · PROVENANCE · LOOKS</p>
        </div>
        <footer>
          <span>
            {String(metrics.placementCount).padStart(2, "0")} QUALIFIED
            PLACEMENTS
          </span>
          <time dateTime={report.generatedAt}>
            GENERATED {formatDateTime(report.generatedAt)}
          </time>
        </footer>
      </section>

      <section className="coverage-print-opening coverage-print-page">
        <header>
          <span>01 / EDITORIAL OVERVIEW</span>
          <h2>
            被看见的不是数字，
            <br />
            而是作品进入真实语境的<i>轨迹。</i>
          </h2>
        </header>
        <div className="coverage-print-kpis">
          <article>
            <span>PLACEMENTS</span>
            <strong>{metrics.placementCount}</strong>
            <p>{metrics.publishedCount} 项已经公开发布</p>
          </article>
          <article>
            <span>SEND-OUT COVERAGE</span>
            <strong>{formatPercent(metrics.coverageRate)}</strong>
            <p>
              {metrics.coveredLoanCount} / {metrics.sentLoanCount} 份周期送出单
            </p>
          </article>
          <article>
            <span>EVIDENCE COVERAGE</span>
            <strong>{formatPercent(metrics.evidenceCoverageRate)}</strong>
            <p>{metrics.evidenceCount} 项附有链接或图像证据</p>
          </article>
          <article>
            <span>LOOKS</span>
            <strong>{metrics.uniqueLookCount}</strong>
            <p>{metrics.lookAppearances} 次具体 Look 出现</p>
          </article>
          <article>
            <span>REPORTED REACH</span>
            <strong>{formatNumber(metrics.reportedReach)}</strong>
            <p>原始来源填报，非系统估算</p>
          </article>
          <article>
            <span>VERIFIED METRICS</span>
            <strong>{metrics.verifiedMetricCount}</strong>
            <p>已记录指标来源并完成核验</p>
          </article>
        </div>
        <div className="coverage-print-method">
          <span>MEASUREMENT NOTE</span>
          <p>
            本册仅纳入“已落地”或“已发布”事实。送出覆盖率的分母来自同周期、同系列的真实借出记录；
            触达、互动与影响值保持原始填报和核验状态。系统不会推断 Media Impact Value，
            也不会把不同币种折算或合并。
          </p>
        </div>
      </section>

      <section className="coverage-print-page coverage-print-landscape">
        <header className="coverage-print-section-title">
          <span>02 / COVERAGE STRUCTURE</span>
          <h2>本期成果结构</h2>
          <p>{scopeSummary(report)}</p>
        </header>
        <div className="coverage-print-breakdowns">
          <PrintBreakdown
            title="OUTLETS / 媒体"
            rows={report.breakdowns.outlets}
          />
          <PrintBreakdown
            title="COLLECTIONS / 系列"
            rows={report.breakdowns.collections}
          />
          <PrintBreakdown
            title="CHANNELS / 渠道"
            rows={report.breakdowns.channels}
            labelFor={(key) => channelLabels[key] ?? key}
          />
          <PrintBreakdown
            title="MARKETS / 市场"
            rows={report.breakdowns.markets}
          />
        </div>
        <div className="coverage-print-impact">
          <header>
            <span>REPORTED IMPACT / 原值</span>
            <strong>币种独立呈现</strong>
          </header>
          {metrics.impactByCurrency.length > 0 ? (
            metrics.impactByCurrency.map((item) => (
              <p key={item.currency}>
                <span>{item.currency}</span>
                <strong>{formatMoney(item.cents, item.currency)}</strong>
              </p>
            ))
          ) : (
            <p>当前范围没有填报影响值。</p>
          )}
        </div>
      </section>

      <section className="coverage-print-stories">
        <header className="coverage-print-section-title coverage-print-page">
          <span>03 / PLACEMENT STORIES</span>
          <h2>成果档案</h2>
          <p>每一页都保留作品、上下文、证据与指标来源。</p>
        </header>
        {report.placements.length > 0 ? (
          report.placements.map((placement, index) => (
            <article className="coverage-print-story coverage-print-page" key={placement.id}>
              <div className="coverage-print-story-media">
                {placement.coverImageKey ? (
                  <img
                    src={mediaUrl(placement.coverImageKey)}
                    alt={
                      placement.evidenceAltText ||
                      `${placement.title} 成果证据`
                    }
                  />
                ) : (
                  <span>NO EVIDENCE IMAGE</span>
                )}
                <b>{String(index + 1).padStart(2, "0")}</b>
              </div>
              <div className="coverage-print-story-copy">
                <header>
                  <span>
                    {placement.placementCode} /{" "}
                    {placement.status.toUpperCase()}
                  </span>
                  <time>{placement.placementDate || "DATE PENDING"}</time>
                </header>
                <h3>{placement.title}</h3>
                <p className="coverage-print-story-byline">
                  {[
                    placement.outletName,
                    placement.voiceName,
                    placement.eventName,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "发布主体待补充"}
                </p>
                <div className="coverage-print-tags">
                  <span>
                    {typeLabels[placement.placementType] ??
                      placement.placementType}
                  </span>
                  <span>
                    {channelLabels[placement.channel] ?? placement.channel}
                  </span>
                  {placement.market && <span>{placement.market}</span>}
                  {placement.metricMode === "verified" && (
                    <span>METRICS VERIFIED</span>
                  )}
                </div>
                <dl>
                  <div>
                    <dt>COLLECTION</dt>
                    <dd>
                      {placement.collections.join(" / ") || "尚未关联系列"}
                    </dd>
                  </div>
                  <div>
                    <dt>LOOKS</dt>
                    <dd>
                      {placement.items
                        .map((item) =>
                          [item.lookNumber, item.workTitle]
                            .filter(Boolean)
                            .join(" "),
                        )
                        .join(" / ") || "尚未关联 Look"}
                    </dd>
                  </div>
                  <div>
                    <dt>LOAN / PROJECT</dt>
                    <dd>
                      {[
                        placement.loan?.loanCode,
                        placement.loan?.projectTitle,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "未关联借出单"}
                    </dd>
                  </div>
                  <div>
                    <dt>REPORTED METRICS</dt>
                    <dd>
                      {reportedMetrics(placement) || "未记录"}
                    </dd>
                  </div>
                  <div>
                    <dt>PROVENANCE</dt>
                    <dd>
                      {placement.metricSource ||
                        (placement.metricMode === "not_recorded"
                          ? "未记录指标"
                          : "指标来源待补充")}
                    </dd>
                  </div>
                </dl>
                {placement.notes && (
                  <blockquote>{placement.notes}</blockquote>
                )}
                <footer>
                  {placement.sourceUrl ? (
                    <a href={placement.sourceUrl}>
                      ORIGINAL SOURCE / {shortUrl(placement.sourceUrl)}
                    </a>
                  ) : (
                    <span>ORIGINAL SOURCE / NOT ATTACHED</span>
                  )}
                  {placement.issues.length > 0 && (
                    <span>
                      QA /{" "}
                      {placement.issues
                        .map((issue) => issueLabels[issue])
                        .join(" · ")}
                    </span>
                  )}
                </footer>
              </div>
            </article>
          ))
        ) : (
          <div className="coverage-print-empty coverage-print-page">
            当前筛选范围还没有符合口径的成果记录。
          </div>
        )}
      </section>

      <section className="coverage-print-appendix coverage-print-page">
        <header className="coverage-print-section-title">
          <span>04 / DELIVERY QA</span>
          <h2>交付完整度</h2>
          <p>
            {report.quality.affectedPlacementCount} 项记录包含{" "}
            {report.quality.issueCount} 条待完善信息。
          </p>
        </header>
        <div className="coverage-print-qa-counts">
          {(Object.keys(issueLabels) as CoverageBookIssue[]).map((issue) => (
            <article key={issue}>
              <span>{issueLabels[issue]}</span>
              <strong>{report.quality.counts[issue]}</strong>
            </article>
          ))}
        </div>
        {report.quality.records.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>记录</th>
                <th>成果</th>
                <th>待完善</th>
              </tr>
            </thead>
            <tbody>
              {report.quality.records.map((record) => (
                <tr key={record.id}>
                  <td>{record.placementCode}</td>
                  <td>{record.title}</td>
                  <td>
                    {record.issues
                      .map((issue) => issueLabels[issue])
                      .join(" / ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="coverage-print-ready">
            本期所有成果均通过基础完整度检查。
          </p>
        )}
        <footer>
          <strong>NÉRA ATELIER / PRIVATE RECORD</strong>
          <span>
            GENERATED {formatDateTime(report.generatedAt)} ·{" "}
            {report.period.label}
          </span>
        </footer>
      </section>
    </main>
  );
}

function PrintBreakdown({
  title,
  rows,
  labelFor = (key) => key,
}: {
  title: string;
  rows: Array<{ key: string; count: number; share: number }>;
  labelFor?: (key: string) => string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <article>
      <h3>{title}</h3>
      {rows.slice(0, 8).map((row) => (
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
      {rows.length === 0 && <p>暂无数据</p>}
    </article>
  );
}

function toUrlSearchParams(
  values: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else if (value) {
      params.set(key, value);
    }
  });
  return params;
}

function scopeSummary(report: Awaited<ReturnType<typeof buildCoverageBookReport>>) {
  const filters = report.appliedFilters;
  const scope = [
    filters.collection,
    filters.market,
    filters.channel ? channelLabels[filters.channel] ?? filters.channel : "",
    filters.type ? typeLabels[filters.type] ?? filters.type : "",
    filters.status === "all"
      ? ""
      : filters.status === "published"
        ? "仅已发布"
        : "仅已落地",
  ].filter(Boolean);
  return [report.period.label, ...scope].join(" · ");
}

function reportedMetrics(
  placement: Awaited<
    ReturnType<typeof buildCoverageBookReport>
  >["placements"][number],
) {
  const values = [
    placement.reportedReach === null
      ? ""
      : `Reach ${formatNumber(placement.reportedReach)}`,
    placement.reportedEngagements === null
      ? ""
      : `Engagements ${formatNumber(placement.reportedEngagements)}`,
    placement.reportedImpactCents === null
      ? ""
      : `Reported impact ${formatMoney(
          placement.reportedImpactCents,
          placement.impactCurrency,
        )}`,
  ].filter(Boolean);
  return values.join(" · ");
}

function mediaUrl(key: string) {
  return `/api/media/${key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

function shortUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return value;
  }
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}
