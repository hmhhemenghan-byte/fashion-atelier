import {
  listSampleLoanWorkspaces,
  type SampleLoanWorkspace,
} from "@/lib/sample-loans";
import {
  listSamplePlacementWorkspaces,
  type SamplePlacementChannel,
  type SamplePlacementType,
  type SamplePlacementWorkspace,
} from "@/lib/sample-placements";
import { listAllWorks } from "@/lib/works";

export const COVERAGE_BOOK_RANGES = ["90", "365", "all", "custom"] as const;
export const COVERAGE_BOOK_STATUSES = ["all", "placed", "published"] as const;

export type CoverageBookRange = (typeof COVERAGE_BOOK_RANGES)[number];
export type CoverageBookStatus = (typeof COVERAGE_BOOK_STATUSES)[number];

export type CoverageBookFilters = {
  range: CoverageBookRange;
  from: string;
  to: string;
  collection: string;
  channel: string;
  type: string;
  market: string;
  status: CoverageBookStatus;
};

export type CoverageBookIssue =
  | "missing_evidence"
  | "missing_date"
  | "missing_outlet"
  | "missing_items"
  | "unlinked_loan"
  | "unverified_metrics";

export type CoverageBookPlacement = {
  id: string;
  placementCode: string;
  status: "placed" | "published";
  placementType: SamplePlacementType;
  channel: SamplePlacementChannel;
  title: string;
  outletName: string;
  voiceName: string;
  voiceType: string;
  eventName: string;
  market: string;
  country: string;
  placementDate: string | null;
  sourceUrl: string;
  evidenceImageKey: string;
  evidenceAltText: string;
  metricMode: string;
  metricSource: string;
  reportedReach: number | null;
  reportedEngagements: number | null;
  reportedImpactCents: number | null;
  impactCurrency: string;
  notes: string;
  loan: {
    id: string;
    loanCode: string;
    projectTitle: string;
    requesterName: string;
    organization: string;
  } | null;
  collections: string[];
  items: Array<{
    id: string;
    workId: string | null;
    assetCode: string;
    workTitle: string;
    lookNumber: string;
    imageKey: string;
    featured: boolean;
    creditText: string;
  }>;
  coverImageKey: string;
  issues: CoverageBookIssue[];
};

export type CoverageBookReport = {
  generatedAt: string;
  period: {
    range: CoverageBookRange;
    startAt: string | null;
    endAt: string;
    label: string;
  };
  appliedFilters: CoverageBookFilters;
  filterOptions: {
    collections: string[];
    channels: string[];
    types: string[];
    markets: string[];
  };
  metrics: {
    placementCount: number;
    publishedCount: number;
    sentLoanCount: number;
    coveredLoanCount: number;
    coverageRate: number;
    evidenceCount: number;
    evidenceCoverageRate: number;
    verifiedMetricCount: number;
    lookAppearances: number;
    uniqueLookCount: number;
    reportedReach: number;
    reportedEngagements: number;
    impactByCurrency: Array<{ currency: string; cents: number }>;
  };
  trend: Array<{
    key: string;
    label: string;
    placements: number;
    published: number;
  }>;
  breakdowns: {
    outlets: CoverageBookBreakdown[];
    voices: CoverageBookBreakdown[];
    channels: CoverageBookBreakdown[];
    types: CoverageBookBreakdown[];
    markets: CoverageBookBreakdown[];
    collections: CoverageBookBreakdown[];
  };
  quality: {
    issueCount: number;
    affectedPlacementCount: number;
    counts: Record<CoverageBookIssue, number>;
    records: Array<{
      id: string;
      placementCode: string;
      title: string;
      issues: CoverageBookIssue[];
    }>;
  };
  placements: CoverageBookPlacement[];
};

export type CoverageBookBreakdown = {
  key: string;
  count: number;
  share: number;
};

type CoverageBookSource = {
  placements: SamplePlacementWorkspace[];
  loans: SampleLoanWorkspace[];
  works: Awaited<ReturnType<typeof listAllWorks>>;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const outcomeStatuses = new Set(["placed", "published"]);
const sentLoanStatuses = new Set([
  "dispatched",
  "delivered",
  "in_use",
  "return_due",
  "return_in_transit",
  "returned",
  "closed",
]);

export async function buildCoverageBookReport(
  filters: CoverageBookFilters,
  now = new Date(),
) {
  const [placements, loans, works] = await Promise.all([
    listSamplePlacementWorkspaces(5000),
    listSampleLoanWorkspaces(5000),
    listAllWorks(5000),
  ]);
  return calculateCoverageBook({ placements, loans, works }, filters, now);
}

export function calculateCoverageBook(
  source: CoverageBookSource,
  requestedFilters: CoverageBookFilters,
  now = new Date(),
): CoverageBookReport {
  const filters = normalizeCoverageBookFilters(requestedFilters);
  const period = coverageBookPeriod(filters, now);
  const worksById = new Map(source.works.map((work) => [work.id, work]));
  const worksBySnapshot = new Map(
    source.works.map((work) => [
      snapshotKey(work.title, work.lookNumber),
      work,
    ]),
  );
  const collectionForItem = (
    item: SamplePlacementWorkspace["items"][number],
  ) => {
    if (item.workId) return worksById.get(item.workId)?.collection ?? "";
    return worksBySnapshot.get(snapshotKey(item.workTitle, item.lookNumber))
      ?.collection ?? "";
  };

  const allOutcomes = source.placements
    .filter(({ placement }) => outcomeStatuses.has(placement.status))
    .map((workspace) =>
      coveragePlacement(workspace, workspace.items.map(collectionForItem)),
    );
  const filterOptions = {
    collections: uniqueSorted(
      allOutcomes.flatMap((placement) => placement.collections),
    ),
    channels: uniqueSorted(
      allOutcomes.map((placement) => placement.channel),
    ),
    types: uniqueSorted(
      allOutcomes.map((placement) => placement.placementType),
    ),
    markets: uniqueSorted(
      allOutcomes.map((placement) => placement.market),
    ),
  };

  const placements = allOutcomes
    .filter(
      (placement) =>
        inCoveragePeriod(placement.placementDate, period, filters.range) &&
        matchesFilter(placement.collections, filters.collection) &&
        matchesFilter(placement.channel, filters.channel) &&
        matchesFilter(placement.placementType, filters.type) &&
        matchesFilter(placement.market, filters.market) &&
        (filters.status === "all" || placement.status === filters.status),
    )
    .sort(
      (left, right) =>
        compareDates(right.placementDate, left.placementDate) ||
        left.title.localeCompare(right.title),
    );

  const periodSentLoans = source.loans.filter((workspace) => {
    if (!sentLoanStatuses.has(workspace.loan.status)) return false;
    const sentAt = workspace.loan.outboundSentAt ?? workspace.loan.createdAt;
    if (!inCoveragePeriod(dayOnly(sentAt), period, filters.range)) return false;
    if (!filters.collection) return true;
    const collections = uniqueSorted(
      workspace.items.map((item) => {
        if (item.workId) return worksById.get(item.workId)?.collection ?? "";
        return (
          worksBySnapshot.get(snapshotKey(item.workTitle, item.lookNumber))
            ?.collection ?? ""
        );
      }),
    );
    return matchesFilter(collections, filters.collection);
  });
  const sentLoanIds = new Set(
    periodSentLoans.map((workspace) => workspace.loan.id),
  );
  const coveredLoanIds = new Set(
    placements
      .map((placement) => placement.loan?.id)
      .filter(
        (id): id is string => Boolean(id) && sentLoanIds.has(id as string),
      ),
  );
  const evidenceCount = placements.filter(
    (placement) =>
      Boolean(placement.sourceUrl) || Boolean(placement.evidenceImageKey),
  ).length;
  const impact = new Map<string, number>();
  placements.forEach((placement) => {
    if (placement.reportedImpactCents === null) return;
    const currency = placement.impactCurrency || "USD";
    impact.set(
      currency,
      (impact.get(currency) ?? 0) + placement.reportedImpactCents,
    );
  });
  const uniqueLooks = new Set(
    placements.flatMap((placement) =>
      placement.items.map(
        (item) =>
          item.workId ??
          snapshotKey(item.workTitle, item.lookNumber) ??
          item.id,
      ),
    ),
  );

  const issueCounts: Record<CoverageBookIssue, number> = {
    missing_evidence: 0,
    missing_date: 0,
    missing_outlet: 0,
    missing_items: 0,
    unlinked_loan: 0,
    unverified_metrics: 0,
  };
  placements.forEach((placement) => {
    placement.issues.forEach((issue) => {
      issueCounts[issue] += 1;
    });
  });

  return {
    generatedAt: now.toISOString(),
    period,
    appliedFilters: filters,
    filterOptions,
    metrics: {
      placementCount: placements.length,
      publishedCount: placements.filter(
        (placement) => placement.status === "published",
      ).length,
      sentLoanCount: periodSentLoans.length,
      coveredLoanCount: coveredLoanIds.size,
      coverageRate: percent(coveredLoanIds.size, periodSentLoans.length),
      evidenceCount,
      evidenceCoverageRate: percent(evidenceCount, placements.length),
      verifiedMetricCount: placements.filter(
        (placement) => placement.metricMode === "verified",
      ).length,
      lookAppearances: placements.reduce(
        (total, placement) => total + placement.items.length,
        0,
      ),
      uniqueLookCount: uniqueLooks.size,
      reportedReach: placements.reduce(
        (total, placement) => total + (placement.reportedReach ?? 0),
        0,
      ),
      reportedEngagements: placements.reduce(
        (total, placement) =>
          total + (placement.reportedEngagements ?? 0),
        0,
      ),
      impactByCurrency: Array.from(impact, ([currency, cents]) => ({
        currency,
        cents,
      })).sort((left, right) => left.currency.localeCompare(right.currency)),
    },
    trend: buildMonthlyTrend(placements, period),
    breakdowns: {
      outlets: breakdown(
        placements.map((placement) => placement.outletName || "未填写"),
        placements.length,
      ),
      voices: breakdown(
        placements.map(
          (placement) => placement.voiceName || placement.voiceType || "未填写",
        ),
        placements.length,
      ),
      channels: breakdown(
        placements.map((placement) => placement.channel),
        placements.length,
      ),
      types: breakdown(
        placements.map((placement) => placement.placementType),
        placements.length,
      ),
      markets: breakdown(
        placements.map((placement) => placement.market || "未填写"),
        placements.length,
      ),
      collections: breakdown(
        placements.flatMap((placement) =>
          placement.collections.length > 0
            ? placement.collections
            : ["未关联系列"],
        ),
        placements.length,
      ),
    },
    quality: {
      issueCount: Object.values(issueCounts).reduce(
        (total, count) => total + count,
        0,
      ),
      affectedPlacementCount: placements.filter(
        (placement) => placement.issues.length > 0,
      ).length,
      counts: issueCounts,
      records: placements
        .filter((placement) => placement.issues.length > 0)
        .map((placement) => ({
          id: placement.id,
          placementCode: placement.placementCode,
          title: placement.title,
          issues: placement.issues,
        })),
    },
    placements,
  };
}

export function parseCoverageBookFilters(
  searchParams: URLSearchParams,
): CoverageBookFilters {
  const requestedRange = cleanText(searchParams.get("range"), 8);
  const requestedStatus = cleanText(searchParams.get("status"), 20);
  return normalizeCoverageBookFilters({
    range: COVERAGE_BOOK_RANGES.includes(requestedRange as CoverageBookRange)
      ? (requestedRange as CoverageBookRange)
      : "365",
    from: cleanText(searchParams.get("from"), 10),
    to: cleanText(searchParams.get("to"), 10),
    collection: cleanText(searchParams.get("collection"), 240),
    channel: cleanText(searchParams.get("channel"), 80),
    type: cleanText(searchParams.get("type"), 80),
    market: cleanText(searchParams.get("market"), 160),
    status: COVERAGE_BOOK_STATUSES.includes(
      requestedStatus as CoverageBookStatus,
    )
      ? (requestedStatus as CoverageBookStatus)
      : "all",
  });
}

export function coverageBookQuery(
  filters: CoverageBookFilters,
  format?: "csv" | "json",
) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  if (format) params.set("format", format);
  return params.toString();
}

export function coverageBookToCsv(report: CoverageBookReport) {
  const columns = [
    "period",
    "placementCode",
    "status",
    "date",
    "title",
    "outlet",
    "voice",
    "type",
    "channel",
    "market",
    "country",
    "collections",
    "loanCode",
    "project",
    "looks",
    "assetCodes",
    "evidenceUrl",
    "evidenceImageKey",
    "metricMode",
    "metricSource",
    "reportedReach",
    "reportedEngagements",
    "reportedImpact",
    "impactCurrency",
    "qualityIssues",
    "notes",
  ] as const;
  const lines = [columns.map(csvCell).join(",")];
  report.placements.forEach((placement) => {
    lines.push(
      [
        report.period.label,
        placement.placementCode,
        placement.status,
        placement.placementDate,
        placement.title,
        placement.outletName,
        placement.voiceName,
        placement.placementType,
        placement.channel,
        placement.market,
        placement.country,
        placement.collections.join(" | "),
        placement.loan?.loanCode ?? "",
        placement.loan?.projectTitle ?? "",
        placement.items
          .map((item) =>
            [item.lookNumber, item.workTitle].filter(Boolean).join(" "),
          )
          .join(" | "),
        placement.items
          .map((item) => item.assetCode)
          .filter(Boolean)
          .join(" | "),
        placement.sourceUrl,
        placement.evidenceImageKey,
        placement.metricMode,
        placement.metricSource,
        placement.reportedReach,
        placement.reportedEngagements,
        placement.reportedImpactCents === null
          ? ""
          : (placement.reportedImpactCents / 100).toFixed(2),
        placement.impactCurrency,
        placement.issues.join(" | "),
        placement.notes,
      ]
        .map(csvCell)
        .join(","),
    );
  });
  return `\ufeff${lines.join("\r\n")}`;
}

function coveragePlacement(
  workspace: SamplePlacementWorkspace,
  rawCollections: string[],
): CoverageBookPlacement {
  const { placement, loan, items } = workspace;
  const hasReportedMetrics =
    placement.reportedReach !== null ||
    placement.reportedEngagements !== null ||
    placement.reportedImpactCents !== null;
  const issues: CoverageBookIssue[] = [];
  if (!placement.sourceUrl && !placement.evidenceImageKey) {
    issues.push("missing_evidence");
  }
  if (!placement.placementDate) issues.push("missing_date");
  if (!placement.outletName) issues.push("missing_outlet");
  if (items.length === 0) issues.push("missing_items");
  if (!placement.loanId) issues.push("unlinked_loan");
  if (hasReportedMetrics && placement.metricMode !== "verified") {
    issues.push("unverified_metrics");
  }
  const preferredItem =
    items.find((item) => item.featured && item.imageKey) ??
    items.find((item) => item.imageKey);

  return {
    id: placement.id,
    placementCode: placement.placementCode,
    status: placement.status as "placed" | "published",
    placementType: placement.placementType,
    channel: placement.channel,
    title: placement.title,
    outletName: placement.outletName,
    voiceName: placement.voiceName,
    voiceType: placement.voiceType,
    eventName: placement.eventName,
    market: placement.market,
    country: placement.country,
    placementDate: placement.placementDate,
    sourceUrl: placement.sourceUrl,
    evidenceImageKey: placement.evidenceImageKey,
    evidenceAltText: placement.evidenceAltText,
    metricMode: placement.metricMode,
    metricSource: placement.metricSource,
    reportedReach: placement.reportedReach,
    reportedEngagements: placement.reportedEngagements,
    reportedImpactCents: placement.reportedImpactCents,
    impactCurrency: placement.impactCurrency,
    notes: placement.notes,
    loan: loan
      ? {
          id: loan.id,
          loanCode: loan.loanCode,
          projectTitle: loan.projectTitle,
          requesterName: loan.requesterName,
          organization: loan.organization,
        }
      : null,
    collections: uniqueSorted(rawCollections),
    items: items.map((item) => ({
      id: item.id,
      workId: item.workId,
      assetCode: item.assetCode,
      workTitle: item.workTitle,
      lookNumber: item.lookNumber,
      imageKey: item.imageKey,
      featured: item.featured,
      creditText: item.creditText,
    })),
    coverImageKey: placement.evidenceImageKey || preferredItem?.imageKey || "",
    issues,
  };
}

function normalizeCoverageBookFilters(
  filters: CoverageBookFilters,
): CoverageBookFilters {
  let from = validDay(filters.from) ?? "";
  let to = validDay(filters.to) ?? "";
  if (from && to && from > to) [from, to] = [to, from];
  const range = COVERAGE_BOOK_RANGES.includes(filters.range)
    ? filters.range
    : "365";
  return {
    range,
    from: range === "custom" ? from : "",
    to: range === "custom" ? to : "",
    collection: cleanText(filters.collection, 240),
    channel: cleanText(filters.channel, 80),
    type: cleanText(filters.type, 80),
    market: cleanText(filters.market, 160),
    status: COVERAGE_BOOK_STATUSES.includes(filters.status)
      ? filters.status
      : "all",
  };
}

function coverageBookPeriod(
  filters: CoverageBookFilters,
  now: Date,
): CoverageBookReport["period"] {
  const today = isoDay(now);
  if (filters.range === "all") {
    return {
      range: filters.range,
      startAt: null,
      endAt: today,
      label: "全部历史",
    };
  }
  if (filters.range === "custom") {
    const startAt = filters.from || null;
    const endAt = filters.to || today;
    return {
      range: filters.range,
      startAt,
      endAt,
      label: startAt
        ? `${startAt} — ${endAt}`
        : `截至 ${endAt}`,
    };
  }
  const days = Number(filters.range);
  return {
    range: filters.range,
    startAt: isoDay(new Date(startOfUtcDay(now).getTime() - (days - 1) * DAY_MS)),
    endAt: today,
    label: `最近 ${filters.range} 天`,
  };
}

function inCoveragePeriod(
  value: string | null,
  period: CoverageBookReport["period"],
  range: CoverageBookRange,
) {
  if (!value) return range === "all";
  const day = validDay(value);
  if (!day) return range === "all";
  return (
    (!period.startAt || day >= period.startAt) &&
    day <= period.endAt
  );
}

function buildMonthlyTrend(
  placements: CoverageBookPlacement[],
  period: CoverageBookReport["period"],
) {
  const dated = placements.filter(
    (placement): placement is CoverageBookPlacement & {
      placementDate: string;
    } => Boolean(validDay(placement.placementDate)),
  );
  const firstDay =
    period.startAt ??
    dated
      .map((placement) => placement.placementDate)
      .sort((left, right) => left.localeCompare(right))[0] ??
    period.endAt;
  const start = monthStart(firstDay);
  const end = monthStart(period.endAt);
  const buckets: CoverageBookReport["trend"] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 240) {
    const key = isoMonth(cursor);
    const rows = dated.filter(
      (placement) => placement.placementDate.slice(0, 7) === key,
    );
    buckets.push({
      key,
      label: monthLabel(cursor),
      placements: rows.length,
      published: rows.filter((placement) => placement.status === "published")
        .length,
    });
    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    );
    guard += 1;
  }
  return buckets;
}

function breakdown(values: string[], denominator: number) {
  const counts = new Map<string, number>();
  values.forEach((rawValue) => {
    const value = rawValue.trim() || "未填写";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return Array.from(counts, ([key, count]) => ({
    key,
    count,
    share: percent(count, denominator),
  }))
    .sort(
      (left, right) =>
        right.count - left.count || left.key.localeCompare(right.key),
    )
    .slice(0, 12);
}

function matchesFilter(value: string | string[], filter: string) {
  if (!filter) return true;
  const expected = filter.trim().toLocaleLowerCase();
  return Array.isArray(value)
    ? value.some((item) => item.trim().toLocaleLowerCase() === expected)
    : value.trim().toLocaleLowerCase() === expected;
}

function uniqueSorted(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));
}

function compareDates(left: string | null, right: string | null) {
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  return left.localeCompare(right);
}

function percent(numerator: number, denominator: number) {
  return denominator > 0
    ? Math.round((numerator / denominator) * 1000) / 10
    : 0;
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function validDay(value: string | null | undefined) {
  if (!value) return null;
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const parsed = new Date(`${day}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && isoDay(parsed) === day
    ? day
    : null;
}

function dayOnly(value: string | null | undefined) {
  if (!value) return null;
  const direct = validDay(value);
  if (direct) return direct;
  const normalized = value.includes("T")
    ? value
    : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(normalized);
  return Number.isFinite(parsed.getTime()) ? isoDay(parsed) : null;
}

function monthStart(day: string) {
  const date = new Date(`${day}T00:00:00.000Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function isoMonth(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function snapshotKey(title: string, lookNumber: string) {
  return `${title.trim().toLocaleLowerCase()}\u0000${lookNumber
    .trim()
    .toLocaleLowerCase()}`;
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
