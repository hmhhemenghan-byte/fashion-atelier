import type { SampleAsset } from "@/db/schema";
import { listAllSampleAssets } from "@/lib/sample-inventory";
import {
  listSampleLoanWorkspaces,
  type SampleLoanWorkspace,
} from "@/lib/sample-loans";
import { listAllWorks } from "@/lib/works";

export const SAMPLE_PERFORMANCE_RANGES = [
  "30",
  "90",
  "180",
  "365",
  "all",
] as const;

export type SamplePerformanceRange =
  (typeof SAMPLE_PERFORMANCE_RANGES)[number];

export type SamplePerformanceFilters = {
  range: SamplePerformanceRange;
  department: string;
  collection: string;
  category: string;
  destination: string;
  color: string;
  purpose: string;
};

export type SamplePerformanceAsset = {
  id: string;
  assetCode: string;
  workId: string | null;
  workTitle: string;
  lookNumber: string;
  imageKey: string;
  collection: string;
  category: string;
  department: string;
  colorLabel: string;
  sizeLabel: string;
  status: string;
  condition: string;
  currentLocation: string;
  deliveryCount: number;
  completedReturns: number;
  averageCycleDays: number | null;
  lastSentAt: string | null;
  lastReturnAt: string | null;
  idleDays: number | null;
  active: boolean;
  overdue: boolean;
  activeLoanCode: string | null;
};

export type SamplePerformanceReport = {
  generatedAt: string;
  period: {
    range: SamplePerformanceRange;
    startAt: string | null;
    endAt: string;
    label: string;
  };
  appliedFilters: SamplePerformanceFilters;
  filterOptions: {
    departments: string[];
    collections: string[];
    categories: string[];
    destinations: string[];
    colors: string[];
    purposes: string[];
  };
  metrics: {
    inventoryCount: number;
    sentAssetCount: number;
    totalDeliveries: number;
    unusedCount: number;
    utilizationRate: number;
    averageDeliveriesPerAsset: number;
    averageReturnDays: number | null;
    onTimeReturnRate: number | null;
    overdueAssetCount: number;
    attentionAssetCount: number;
    activeAssetCount: number;
  };
  trend: Array<{
    key: string;
    label: string;
    deliveries: number;
    uniqueAssets: number;
  }>;
  assets: SamplePerformanceAsset[];
  rankings: {
    mostSent: SamplePerformanceAsset[];
    leastSent: SamplePerformanceAsset[];
    notSent: SamplePerformanceAsset[];
  };
  demand: Array<{
    key: string;
    workId: string | null;
    workTitle: string;
    lookNumber: string;
    imageKey: string;
    collection: string;
    deliveries: number;
    inventoryCount: number;
    availableCount: number;
    pressure: number;
  }>;
  breakdowns: {
    categories: SamplePerformanceBreakdown[];
    departments: SamplePerformanceBreakdown[];
    purposes: SamplePerformanceBreakdown[];
    destinations: SamplePerformanceBreakdown[];
  };
  actions: Array<{
    id: string;
    tone: "urgent" | "attention" | "opportunity" | "ready";
    eyebrow: string;
    title: string;
    detail: string;
    href: string;
  }>;
};

type SamplePerformanceBreakdown = {
  key: string;
  inventoryCount: number;
  sentAssetCount: number;
  deliveries: number;
  utilizationRate: number;
};

type DeliveryEvent = {
  assetId: string;
  loanCode: string;
  shipAt: string;
  returnAt: string | null;
  cycleDays: number | null;
  destination: string;
  purpose: string;
  active: boolean;
  overdue: boolean;
  onTime: boolean | null;
};

type ReportSource = {
  assets: SampleAsset[];
  works: Awaited<ReturnType<typeof listAllWorks>>;
  loans: SampleLoanWorkspace[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function buildSamplePerformanceReport(
  filters: SamplePerformanceFilters,
  now = new Date(),
) {
  const [assets, works, loans] = await Promise.all([
    listAllSampleAssets(),
    listAllWorks(5000),
    listSampleLoanWorkspaces(5000),
  ]);
  return calculateSamplePerformance({ assets, works, loans }, filters, now);
}

export function calculateSamplePerformance(
  source: ReportSource,
  filters: SamplePerformanceFilters,
  now = new Date(),
): SamplePerformanceReport {
  const generatedAt = now.toISOString();
  const rangeStart = performanceRangeStart(filters.range, now);
  const worksById = new Map(source.works.map((work) => [work.id, work]));
  const collectionFor = (asset: SampleAsset) =>
    (asset.workId ? worksById.get(asset.workId)?.collection : "") || "";

  const activeAssets = source.assets.filter(
    (asset) => asset.status !== "archived",
  );
  const filterOptions = {
    departments: uniqueSorted(activeAssets.map((asset) => asset.department)),
    collections: uniqueSorted(activeAssets.map(collectionFor)),
    categories: uniqueSorted(activeAssets.map((asset) => asset.category)),
    destinations: uniqueSorted(
      source.loans.map((workspace) => workspace.request.deliveryCity),
    ),
    colors: uniqueSorted(activeAssets.map((asset) => asset.colorLabel)),
    purposes: uniqueSorted(
      source.loans.map((workspace) => workspace.request.purpose),
    ),
  };

  const scopedAssets = activeAssets.filter(
    (asset) =>
      matchesFilter(asset.department, filters.department) &&
      matchesFilter(collectionFor(asset), filters.collection) &&
      matchesFilter(asset.category, filters.category) &&
      matchesFilter(asset.colorLabel, filters.color),
  );
  const scopedAssetIds = new Set(scopedAssets.map((asset) => asset.id));
  const allEvents = deliveryEvents(source.loans, now).filter(
    (event) =>
      scopedAssetIds.has(event.assetId) &&
      matchesFilter(event.destination, filters.destination) &&
      matchesFilter(event.purpose, filters.purpose),
  );
  const periodEvents = allEvents.filter((event) => {
    const timestamp = Date.parse(event.shipAt);
    return (
      Number.isFinite(timestamp) &&
      (!rangeStart || timestamp >= rangeStart.getTime()) &&
      timestamp <= now.getTime()
    );
  });

  const periodEventsByAsset = groupBy(periodEvents, (event) => event.assetId);
  const allEventsByAsset = groupBy(allEvents, (event) => event.assetId);
  const assetRows = scopedAssets.map((asset) =>
    performanceAsset(
      asset,
      collectionFor(asset),
      periodEventsByAsset.get(asset.id) ?? [],
      allEventsByAsset.get(asset.id) ?? [],
      now,
    ),
  );

  const sentAssetCount = assetRows.filter(
    (asset) => asset.deliveryCount > 0,
  ).length;
  const completed = periodEvents.filter(
    (event) => event.cycleDays !== null,
  );
  const returnEventsWithDue = periodEvents.filter(
    (event) => event.onTime !== null,
  );
  const metrics = {
    inventoryCount: assetRows.length,
    sentAssetCount,
    totalDeliveries: periodEvents.length,
    unusedCount: assetRows.length - sentAssetCount,
    utilizationRate: percent(sentAssetCount, assetRows.length),
    averageDeliveriesPerAsset: average(
      periodEvents.length,
      assetRows.length,
      2,
    ),
    averageReturnDays:
      completed.length > 0
        ? rounded(
            completed.reduce(
              (total, event) => total + (event.cycleDays ?? 0),
              0,
            ) / completed.length,
            1,
          )
        : null,
    onTimeReturnRate:
      returnEventsWithDue.length > 0
        ? percent(
            returnEventsWithDue.filter((event) => event.onTime).length,
            returnEventsWithDue.length,
          )
        : null,
    overdueAssetCount: assetRows.filter((asset) => asset.overdue).length,
    attentionAssetCount: assetRows.filter((asset) =>
      ["worn", "damaged"].includes(asset.condition) ||
      ["maintenance", "missing"].includes(asset.status),
    ).length,
    activeAssetCount: assetRows.filter((asset) => asset.active).length,
  };

  const mostSent = [...assetRows]
    .filter((asset) => asset.deliveryCount > 0)
    .sort(
      (left, right) =>
        right.deliveryCount - left.deliveryCount ||
        compareNullableDates(right.lastSentAt, left.lastSentAt) ||
        left.assetCode.localeCompare(right.assetCode),
    )
    .slice(0, 12);
  const leastSent = [...assetRows]
    .filter((asset) => asset.deliveryCount > 0)
    .sort(
      (left, right) =>
        left.deliveryCount - right.deliveryCount ||
        compareNullableDates(left.lastSentAt, right.lastSentAt) ||
        left.assetCode.localeCompare(right.assetCode),
    )
    .slice(0, 12);
  const notSent = [...assetRows]
    .filter((asset) => asset.deliveryCount === 0)
    .sort(
      (left, right) =>
        (right.idleDays ?? Number.MAX_SAFE_INTEGER) -
          (left.idleDays ?? Number.MAX_SAFE_INTEGER) ||
        left.assetCode.localeCompare(right.assetCode),
    )
    .slice(0, 24);

  const report: SamplePerformanceReport = {
    generatedAt,
    period: {
      range: filters.range,
      startAt: rangeStart?.toISOString() ?? null,
      endAt: generatedAt,
      label: rangeLabel(filters.range),
    },
    appliedFilters: filters,
    filterOptions,
    metrics,
    trend: buildTrend(periodEvents, rangeStart, now, filters.range),
    assets: assetRows.sort(
      (left, right) =>
        right.deliveryCount - left.deliveryCount ||
        left.assetCode.localeCompare(right.assetCode),
    ),
    rankings: { mostSent, leastSent, notSent },
    demand: buildDemand(assetRows),
    breakdowns: {
      categories: buildAssetBreakdown(assetRows, "category"),
      departments: buildAssetBreakdown(assetRows, "department"),
      purposes: buildEventBreakdown(periodEvents, "purpose"),
      destinations: buildEventBreakdown(periodEvents, "destination"),
    },
    actions: [],
  };
  report.actions = buildActions(report);
  return report;
}

export function samplePerformanceToCsv(report: SamplePerformanceReport) {
  const columns = [
    "period",
    "assetCode",
    "workTitle",
    "lookNumber",
    "collection",
    "category",
    "department",
    "color",
    "size",
    "status",
    "condition",
    "currentLocation",
    "deliveries",
    "completedReturns",
    "averageCycleDays",
    "lastSentAt",
    "lastReturnAt",
    "idleDays",
    "active",
    "overdue",
    "activeLoanCode",
  ] as const;
  const lines = [columns.map(csvCell).join(",")];
  report.assets.forEach((asset) => {
    lines.push(
      [
        report.period.label,
        asset.assetCode,
        asset.workTitle,
        asset.lookNumber,
        asset.collection,
        asset.category,
        asset.department,
        asset.colorLabel,
        asset.sizeLabel,
        asset.status,
        asset.condition,
        asset.currentLocation,
        asset.deliveryCount,
        asset.completedReturns,
        asset.averageCycleDays,
        asset.lastSentAt,
        asset.lastReturnAt,
        asset.idleDays,
        asset.active,
        asset.overdue,
        asset.activeLoanCode,
      ]
        .map(csvCell)
        .join(","),
    );
  });
  return `\ufeff${lines.join("\r\n")}`;
}

function deliveryEvents(
  workspaces: SampleLoanWorkspace[],
  now: Date,
): DeliveryEvent[] {
  return workspaces.flatMap((workspace) => {
    if (workspace.loan.status === "cancelled") return [];
    return workspace.items.flatMap((item) => {
      if (!item.sampleAssetId || !wasSent(workspace, item.status)) return [];
      const shipAt =
        validIso(workspace.loan.outboundSentAt) ??
        validIso(workspace.loan.createdAt);
      if (!shipAt) return [];
      const returned =
        ["returned", "closed"].includes(workspace.loan.status) ||
        ["returned", "damaged", "lost"].includes(item.status);
      const returnAt = returned
        ? validIso(workspace.loan.returnReceivedAt) ??
          validIso(item.updatedAt) ??
          null
        : null;
      const cycleDays = returnAt
        ? durationDays(shipAt, returnAt)
        : null;
      const active =
        !returned &&
        !["unavailable"].includes(item.status) &&
        !["returned", "closed", "cancelled"].includes(workspace.loan.status);
      const dueAt = dueDateEnd(workspace.loan.expectedReturnAt);
      const overdue =
        Boolean(active && dueAt && dueAt.getTime() < now.getTime());
      const onTime =
        returnAt && dueAt
          ? Date.parse(returnAt) <= dueAt.getTime()
          : null;
      return [
        {
          assetId: item.sampleAssetId,
          loanCode: workspace.loan.loanCode,
          shipAt,
          returnAt,
          cycleDays,
          destination: workspace.request.deliveryCity,
          purpose: workspace.request.purpose,
          active,
          overdue,
          onTime,
        },
      ];
    });
  });
}

function wasSent(workspace: SampleLoanWorkspace, itemStatus: string) {
  return (
    Boolean(workspace.loan.outboundSentAt) ||
    [
      "dispatched",
      "delivered",
      "in_use",
      "return_due",
      "return_in_transit",
      "returned",
      "closed",
    ].includes(workspace.loan.status) ||
    [
      "dispatched",
      "with_recipient",
      "returning",
      "returned",
      "damaged",
      "lost",
    ].includes(itemStatus)
  );
}

function performanceAsset(
  asset: SampleAsset,
  collection: string,
  periodEvents: DeliveryEvent[],
  allEvents: DeliveryEvent[],
  now: Date,
): SamplePerformanceAsset {
  const cycleDays = periodEvents
    .map((event) => event.cycleDays)
    .filter((value): value is number => value !== null);
  const lastSentAt = latestDate(allEvents.map((event) => event.shipAt));
  const lastReturnAt = latestDate(
    allEvents
      .map((event) => event.returnAt)
      .filter((value): value is string => Boolean(value)),
  );
  const activeEvent = [...allEvents]
    .filter((event) => event.active)
    .sort((left, right) => Date.parse(right.shipAt) - Date.parse(left.shipAt))[0];
  return {
    id: asset.id,
    assetCode: asset.assetCode,
    workId: asset.workId,
    workTitle: asset.workTitle,
    lookNumber: asset.lookNumber,
    imageKey: asset.imageKey,
    collection,
    category: asset.category,
    department: asset.department,
    colorLabel: asset.colorLabel,
    sizeLabel: asset.sizeLabel,
    status: asset.status,
    condition: asset.condition,
    currentLocation: asset.currentLocation,
    deliveryCount: periodEvents.length,
    completedReturns: cycleDays.length,
    averageCycleDays:
      cycleDays.length > 0
        ? rounded(
            cycleDays.reduce((total, value) => total + value, 0) /
              cycleDays.length,
            1,
          )
        : null,
    lastSentAt,
    lastReturnAt,
    idleDays: lastSentAt
      ? Math.max(0, Math.floor((now.getTime() - Date.parse(lastSentAt)) / DAY_MS))
      : null,
    active: Boolean(activeEvent),
    overdue: allEvents.some((event) => event.overdue),
    activeLoanCode: activeEvent?.loanCode ?? null,
  };
}

function buildTrend(
  events: DeliveryEvent[],
  rangeStart: Date | null,
  now: Date,
  range: SamplePerformanceRange,
) {
  const earliestEvent = events.reduce(
    (earliest, event) => Math.min(earliest, Date.parse(event.shipAt)),
    now.getTime(),
  );
  const start =
    rangeStart?.getTime() ??
    Math.min(earliestEvent, now.getTime() - 30 * DAY_MS);
  const bucketCount = range === "365" || range === "all" ? 12 : 6;
  const span = Math.max(DAY_MS, now.getTime() - start);
  const bucketMs = span / bucketCount;
  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = start + bucketMs * index;
    const bucketEnd =
      index === bucketCount - 1
        ? now.getTime() + 1
        : start + bucketMs * (index + 1);
    const bucketEvents = events.filter((event) => {
      const timestamp = Date.parse(event.shipAt);
      return timestamp >= bucketStart && timestamp < bucketEnd;
    });
    return {
      key: `${Math.round(bucketStart)}-${index}`,
      label: shortDate(new Date(bucketStart)),
      deliveries: bucketEvents.length,
      uniqueAssets: new Set(bucketEvents.map((event) => event.assetId)).size,
    };
  });
}

function buildDemand(assets: SamplePerformanceAsset[]) {
  const groups = new Map<
    string,
    SamplePerformanceReport["demand"][number]
  >();
  assets.forEach((asset) => {
    const key = asset.workId ?? `${asset.workTitle}:${asset.lookNumber}`;
    const current = groups.get(key) ?? {
      key,
      workId: asset.workId,
      workTitle: asset.workTitle,
      lookNumber: asset.lookNumber,
      imageKey: asset.imageKey,
      collection: asset.collection,
      deliveries: 0,
      inventoryCount: 0,
      availableCount: 0,
      pressure: 0,
    };
    current.deliveries += asset.deliveryCount;
    current.inventoryCount += 1;
    if (asset.status === "available") current.availableCount += 1;
    groups.set(key, current);
  });
  return Array.from(groups.values())
    .map((item) => ({
      ...item,
      pressure: rounded(item.deliveries / Math.max(1, item.inventoryCount), 2),
    }))
    .sort(
      (left, right) =>
        right.pressure - left.pressure ||
        right.deliveries - left.deliveries ||
        left.workTitle.localeCompare(right.workTitle),
    )
    .slice(0, 12);
}

function buildAssetBreakdown(
  assets: SamplePerformanceAsset[],
  key: "category" | "department",
) {
  const groups = new Map<string, SamplePerformanceAsset[]>();
  assets.forEach((asset) => {
    const value = asset[key] || "UNSPECIFIED";
    const current = groups.get(value) ?? [];
    current.push(asset);
    groups.set(value, current);
  });
  return Array.from(groups.entries())
    .map(([value, rows]) => {
      const sent = rows.filter((asset) => asset.deliveryCount > 0).length;
      return {
        key: value,
        inventoryCount: rows.length,
        sentAssetCount: sent,
        deliveries: rows.reduce(
          (total, asset) => total + asset.deliveryCount,
          0,
        ),
        utilizationRate: percent(sent, rows.length),
      };
    })
    .sort(
      (left, right) =>
        right.deliveries - left.deliveries ||
        left.key.localeCompare(right.key),
    );
}

function buildEventBreakdown(
  events: DeliveryEvent[],
  key: "purpose" | "destination",
) {
  const groups = groupBy(events, (event) => event[key] || "UNSPECIFIED");
  return Array.from(groups.entries())
    .map(([value, rows]) => ({
      key: value,
      inventoryCount: 0,
      sentAssetCount: new Set(rows.map((event) => event.assetId)).size,
      deliveries: rows.length,
      utilizationRate: 0,
    }))
    .sort(
      (left, right) =>
        right.deliveries - left.deliveries ||
        left.key.localeCompare(right.key),
    );
}

function buildActions(report: SamplePerformanceReport) {
  const actions: SamplePerformanceReport["actions"] = [];
  if (report.metrics.overdueAssetCount > 0) {
    actions.push({
      id: "overdue",
      tone: "urgent",
      eyebrow: "RETURN RISK",
      title: `${report.metrics.overdueAssetCount} 件样衣已经逾期`,
      detail: "优先确认收件方与回程物流，避免后续请求继续占用不可用库存。",
      href: "#sample-fulfilment",
    });
  }
  if (report.metrics.attentionAssetCount > 0) {
    actions.push({
      id: "condition",
      tone: "attention",
      eyebrow: "CONDITION",
      title: `${report.metrics.attentionAssetCount} 件资产需要检查`,
      detail: "损坏、磨损、维护中或缺失资产应在下一次借调前完成处置。",
      href: "#sample-inventory",
    });
  }
  const pressure = report.demand.find(
    (item) => item.deliveries > 0 && item.availableCount === 0,
  );
  if (pressure) {
    actions.push({
      id: `pressure-${pressure.key}`,
      tone: "opportunity",
      eyebrow: "DEMAND PRESSURE",
      title: `${pressure.lookNumber || "LOOK"} · ${pressure.workTitle} 暂无可用样衣`,
      detail: `${pressure.deliveries} 次送出由 ${pressure.inventoryCount} 件资产承担；可考虑补样或调整预约顺序。`,
      href: "#sample-inventory",
    });
  }
  if (report.metrics.unusedCount > 0) {
    actions.push({
      id: "unused",
      tone: "opportunity",
      eyebrow: "UNTAPPED",
      title: `${report.metrics.unusedCount} 件样衣在当前周期未被送出`,
      detail: "可优先加入下一轮编辑选样、跨部门借用或私人 Showroom 推荐。",
      href: "#showroom-manager",
    });
  }
  if (actions.length === 0) {
    actions.push({
      id: "ready",
      tone: "ready",
      eyebrow: "BALANCED",
      title: "当前没有需要立即处理的效能异常",
      detail: "继续积累借调与归还记录，趋势判断会随数据完整度持续提高。",
      href: "#sample-performance",
    });
  }
  return actions.slice(0, 4);
}

function performanceRangeStart(
  range: SamplePerformanceRange,
  now: Date,
) {
  if (range === "all") return null;
  return new Date(now.getTime() - Number(range) * DAY_MS);
}

function rangeLabel(range: SamplePerformanceRange) {
  return range === "all" ? "全部历史" : `最近 ${range} 天`;
}

function matchesFilter(value: string, filter: string) {
  return (
    !filter ||
    value.trim().toLocaleLowerCase() === filter.trim().toLocaleLowerCase()
  );
}

function uniqueSorted(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));
}

function groupBy<T>(rows: T[], keyFor: (row: T) => string) {
  const groups = new Map<string, T[]>();
  rows.forEach((row) => {
    const key = keyFor(row);
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  });
  return groups;
}

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? rounded((numerator / denominator) * 100, 1) : 0;
}

function average(total: number, denominator: number, digits: number) {
  return denominator > 0 ? rounded(total / denominator, digits) : 0;
}

function rounded(value: number, digits: number) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function validIso(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function dueDateEnd(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function durationDays(start: string, end: string) {
  const difference = Date.parse(end) - Date.parse(start);
  return Number.isFinite(difference)
    ? rounded(Math.max(0, difference) / DAY_MS, 1)
    : null;
}

function latestDate(values: string[]) {
  const valid = values
    .map((value) => ({ value, timestamp: Date.parse(value) }))
    .filter((item) => Number.isFinite(item.timestamp))
    .sort((left, right) => right.timestamp - left.timestamp);
  return valid[0]?.value ?? null;
}

function compareNullableDates(left: string | null, right: string | null) {
  return (left ? Date.parse(left) : 0) - (right ? Date.parse(right) : 0);
}

function shortDate(date: Date) {
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
