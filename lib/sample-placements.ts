import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  samplePlacementItems,
  samplePlacements,
  type SamplePlacement,
  type SamplePlacementItem,
} from "@/db/schema";
import {
  listSampleLoanWorkspaces,
  type SampleLoanWorkspace,
} from "@/lib/sample-loans";

export const SAMPLE_PLACEMENT_STATUSES = [
  "pending",
  "shot",
  "placed",
  "published",
  "not_placed",
  "archived",
] as const;

export const SAMPLE_PLACEMENT_TYPES = [
  "editorial",
  "red_carpet",
  "celebrity",
  "influencer",
  "film_tv",
  "event",
  "buyer",
  "other",
] as const;

export const SAMPLE_PLACEMENT_CHANNELS = [
  "print",
  "online",
  "social",
  "broadcast",
  "event",
  "other",
] as const;

export const SAMPLE_PLACEMENT_VOICE_TYPES = [
  "media",
  "celebrity",
  "influencer",
  "partner",
  "owned_media",
  "other",
] as const;

export const SAMPLE_PLACEMENT_METRIC_MODES = [
  "not_recorded",
  "reported",
  "verified",
] as const;

export type SamplePlacementStatus =
  (typeof SAMPLE_PLACEMENT_STATUSES)[number];
export type SamplePlacementType = (typeof SAMPLE_PLACEMENT_TYPES)[number];
export type SamplePlacementChannel =
  (typeof SAMPLE_PLACEMENT_CHANNELS)[number];
export type SamplePlacementVoiceType =
  (typeof SAMPLE_PLACEMENT_VOICE_TYPES)[number];
export type SamplePlacementMetricMode =
  (typeof SAMPLE_PLACEMENT_METRIC_MODES)[number];

export type SamplePlacementLoanContext = {
  id: string;
  loanCode: string;
  status: SampleLoanWorkspace["loan"]["status"];
  createdAt: string;
  projectTitle: string;
  requesterName: string;
  organization: string;
  purpose: string;
  destinationCity: string;
  outboundSentAt: string | null;
};

export type SamplePlacementWorkspace = {
  placement: SamplePlacement;
  loan: SamplePlacementLoanContext | null;
  items: SamplePlacementItem[];
};

export type SamplePlacementOverview = {
  generatedAt: string;
  metrics: {
    sentLoanCount: number;
    placementCount: number;
    outcomeCount: number;
    publishedCount: number;
    coveredLoanCount: number;
    coveredSendOutRate: number;
    outcomesPerSendOut: number;
    evidenceCount: number;
    evidenceCoverageRate: number;
    verifiedMetricCount: number;
    reportedReach: number;
    reportedEngagements: number;
    unlinkedCount: number;
    impactByCurrency: Array<{ currency: string; cents: number }>;
  };
  breakdowns: {
    channels: Array<{ key: string; count: number }>;
    types: Array<{ key: string; count: number }>;
    voices: Array<{ key: string; count: number }>;
    outlets: Array<{ key: string; count: number }>;
  };
  placements: SamplePlacementWorkspace[];
  loans: SampleLoanWorkspace[];
};

const sentLoanStatuses = new Set([
  "dispatched",
  "delivered",
  "in_use",
  "return_due",
  "return_in_transit",
  "returned",
  "closed",
]);
const outcomeStatuses = new Set<SamplePlacementStatus>([
  "placed",
  "published",
]);

export async function listAllSamplePlacements(limit = 1000) {
  const db = await getDb();
  return db
    .select()
    .from(samplePlacements)
    .orderBy(
      desc(samplePlacements.placementDate),
      desc(samplePlacements.updatedAt),
    )
    .limit(limit);
}

export async function listAllSamplePlacementItems() {
  const db = await getDb();
  return db
    .select()
    .from(samplePlacementItems)
    .orderBy(
      asc(samplePlacementItems.placementId),
      asc(samplePlacementItems.sortOrder),
      asc(samplePlacementItems.createdAt),
    );
}

export async function listSamplePlacementWorkspaces(
  limit = 500,
): Promise<SamplePlacementWorkspace[]> {
  const [placements, loans] = await Promise.all([
    listAllSamplePlacements(limit),
    listSampleLoanWorkspaces(500),
  ]);
  if (placements.length === 0) return [];

  const db = await getDb();
  const items = await db
    .select()
    .from(samplePlacementItems)
    .where(
      inArray(
        samplePlacementItems.placementId,
        placements.map((placement) => placement.id),
      ),
    )
    .orderBy(
      asc(samplePlacementItems.placementId),
      asc(samplePlacementItems.sortOrder),
    );
  const itemsByPlacement = new Map<string, SamplePlacementItem[]>();
  items.forEach((item) => {
    const current = itemsByPlacement.get(item.placementId) ?? [];
    current.push(item);
    itemsByPlacement.set(item.placementId, current);
  });
  const loanById = new Map(loans.map((workspace) => [workspace.loan.id, workspace]));

  return placements.map((placement) => ({
    placement,
    loan: placement.loanId
      ? loanContext(loanById.get(placement.loanId))
      : null,
    items: itemsByPlacement.get(placement.id) ?? [],
  }));
}

export async function getSamplePlacementWorkspace(id: string) {
  const db = await getDb();
  const [placement] = await db
    .select()
    .from(samplePlacements)
    .where(eq(samplePlacements.id, id))
    .limit(1);
  if (!placement) return null;

  const [items, loans] = await Promise.all([
    db
      .select()
      .from(samplePlacementItems)
      .where(eq(samplePlacementItems.placementId, id))
      .orderBy(asc(samplePlacementItems.sortOrder)),
    listSampleLoanWorkspaces(500),
  ]);
  const loan = placement.loanId
    ? loans.find((workspace) => workspace.loan.id === placement.loanId)
    : undefined;
  return {
    placement,
    loan: loanContext(loan),
    items,
  } satisfies SamplePlacementWorkspace;
}

export async function buildSamplePlacementOverview(): Promise<SamplePlacementOverview> {
  const [placements, loans] = await Promise.all([
    listSamplePlacementWorkspaces(),
    listSampleLoanWorkspaces(500),
  ]);
  const sentLoans = loans.filter((workspace) =>
    sentLoanStatuses.has(workspace.loan.status),
  );
  const sentLoanIds = new Set(
    sentLoans.map((workspace) => workspace.loan.id),
  );
  const outcomes = placements.filter((workspace) =>
    outcomeStatuses.has(workspace.placement.status),
  );
  const coveredLoanIds = new Set(
    outcomes
      .map((workspace) => workspace.placement.loanId)
      .filter(
        (id): id is string => Boolean(id) && sentLoanIds.has(id as string),
      ),
  );
  const evidenceCount = outcomes.filter(
    ({ placement }) =>
      Boolean(placement.sourceUrl) || Boolean(placement.evidenceImageKey),
  ).length;
  const impact = new Map<string, number>();
  outcomes.forEach(({ placement }) => {
    if (placement.reportedImpactCents === null) return;
    const currency = placement.impactCurrency || "USD";
    impact.set(
      currency,
      (impact.get(currency) ?? 0) + placement.reportedImpactCents,
    );
  });

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      sentLoanCount: sentLoans.length,
      placementCount: placements.length,
      outcomeCount: outcomes.length,
      publishedCount: placements.filter(
        ({ placement }) => placement.status === "published",
      ).length,
      coveredLoanCount: coveredLoanIds.size,
      coveredSendOutRate: ratio(coveredLoanIds.size, sentLoans.length),
      outcomesPerSendOut: decimalRatio(outcomes.length, sentLoans.length),
      evidenceCount,
      evidenceCoverageRate: ratio(evidenceCount, outcomes.length),
      verifiedMetricCount: outcomes.filter(
        ({ placement }) => placement.metricMode === "verified",
      ).length,
      reportedReach: outcomes.reduce(
        (total, { placement }) => total + (placement.reportedReach ?? 0),
        0,
      ),
      reportedEngagements: outcomes.reduce(
        (total, { placement }) =>
          total + (placement.reportedEngagements ?? 0),
        0,
      ),
      unlinkedCount: placements.filter(
        ({ placement }) => !placement.loanId,
      ).length,
      impactByCurrency: Array.from(impact, ([currency, cents]) => ({
        currency,
        cents,
      })).sort((left, right) => left.currency.localeCompare(right.currency)),
    },
    breakdowns: {
      channels: breakdown(outcomes, ({ placement }) => placement.channel),
      types: breakdown(outcomes, ({ placement }) => placement.placementType),
      voices: breakdown(
        outcomes,
        ({ placement }) => placement.voiceName || placement.voiceType,
      ),
      outlets: breakdown(
        outcomes,
        ({ placement }) => placement.outletName || "未填写",
      ),
    },
    placements,
    loans,
  };
}

export function samplePlacementsToCsv(
  workspaces: SamplePlacementWorkspace[],
) {
  const columns = [
    "placementCode",
    "status",
    "placementType",
    "channel",
    "title",
    "outlet",
    "voice",
    "voiceType",
    "event",
    "market",
    "country",
    "placementDate",
    "sourceUrl",
    "evidenceImageKey",
    "metricMode",
    "metricSource",
    "reportedReach",
    "reportedEngagements",
    "reportedImpact",
    "impactCurrency",
    "loanCode",
    "loanProject",
    "requester",
    "organization",
    "assetCode",
    "lookNumber",
    "workTitle",
    "featured",
    "creditText",
    "notes",
  ] as const;
  const lines = [columns.map(csvCell).join(",")];

  workspaces.forEach(({ placement, loan, items }) => {
    const rows = items.length > 0 ? items : [null];
    rows.forEach((item) => {
      lines.push(
        [
          placement.placementCode,
          placement.status,
          placement.placementType,
          placement.channel,
          placement.title,
          placement.outletName,
          placement.voiceName,
          placement.voiceType,
          placement.eventName,
          placement.market,
          placement.country,
          placement.placementDate,
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
          loan?.loanCode ?? "",
          loan?.projectTitle ?? "",
          loan?.requesterName ?? "",
          loan?.organization ?? "",
          item?.assetCode ?? "",
          item?.lookNumber ?? "",
          item?.workTitle ?? "",
          item?.featured ? "yes" : "no",
          item?.creditText ?? "",
          placement.notes,
        ]
          .map(csvCell)
          .join(","),
      );
    });
  });

  return `\ufeff${lines.join("\r\n")}`;
}

function loanContext(
  workspace: SampleLoanWorkspace | undefined,
): SamplePlacementLoanContext | null {
  if (!workspace) return null;
  return {
    id: workspace.loan.id,
    loanCode: workspace.loan.loanCode,
    status: workspace.loan.status,
    createdAt: workspace.loan.createdAt,
    projectTitle: workspace.request.projectTitle,
    requesterName: workspace.request.requesterName,
    organization: workspace.request.organization,
    purpose: workspace.request.purpose,
    destinationCity: workspace.request.deliveryCity,
    outboundSentAt: workspace.loan.outboundSentAt,
  };
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0
    ? Math.round((numerator / denominator) * 1000) / 10
    : 0;
}

function decimalRatio(numerator: number, denominator: number) {
  return denominator > 0
    ? Math.round((numerator / denominator) * 100) / 100
    : 0;
}

function breakdown(
  rows: SamplePlacementWorkspace[],
  readKey: (workspace: SamplePlacementWorkspace) => string,
) {
  const values = new Map<string, number>();
  rows.forEach((workspace) => {
    const key = readKey(workspace).trim() || "未填写";
    values.set(key, (values.get(key) ?? 0) + 1);
  });
  return Array.from(values, ([key, count]) => ({ key, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.key.localeCompare(right.key),
    )
    .slice(0, 8);
}

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
