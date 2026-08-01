import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  sampleAssets,
  sampleLoanItems,
  sampleLoans,
  showroomRequests,
  type NewSampleLoan,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  getSampleLoanWorkspace,
  SAMPLE_LOAN_STATUSES,
  type SampleLoanItemStatus,
  type SampleLoanStatus,
} from "@/lib/sample-loans";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type LoanPatch = {
  status?: SampleLoanStatus;
  contactPhone?: string;
  deliveryAddress?: string;
  outboundCarrier?: string;
  outboundTracking?: string;
  outboundSentAt?: string | null;
  deliveredAt?: string | null;
  expectedReturnAt?: string | null;
  returnCarrier?: string;
  returnTracking?: string;
  returnReceivedAt?: string | null;
  logisticsNotes?: string;
};

const normalItemStatuses = [
  "reserved",
  "packing",
  "dispatched",
  "with_recipient",
  "returning",
] as const;

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getSampleLoanWorkspace(id);
    if (!current) {
      return Response.json(
        { error: "样衣借调单不存在。" },
        { status: 404 },
      );
    }

    const payload = (await request.json()) as LoanPatch;
    const now = new Date().toISOString();
    const update: Partial<NewSampleLoan> = { updatedAt: now };
    let changed = false;

    if (payload.status !== undefined) {
      if (!SAMPLE_LOAN_STATUSES.includes(payload.status)) {
        return Response.json(
          { error: "借调状态无效。" },
          { status: 400 },
        );
      }
      if (
        payload.status === "closed" &&
        current.items.some(
          (item) =>
            !["returned", "damaged", "lost", "unavailable"].includes(
              item.status,
            ),
        )
      ) {
        return Response.json(
          { error: "所有样衣完成归还或异常登记后，才能关闭借调单。" },
          { status: 409 },
        );
      }
      update.status = payload.status;
      if (payload.status === "dispatched" && !current.loan.outboundSentAt) {
        update.outboundSentAt = now;
      }
      if (payload.status === "delivered" && !current.loan.deliveredAt) {
        update.deliveredAt = now;
      }
      if (payload.status === "returned" && !current.loan.returnReceivedAt) {
        update.returnReceivedAt = now;
      }
      update.closedAt = payload.status === "closed" ? now : null;
      changed = true;
    }

    const textFields: Array<{
      key:
        | "contactPhone"
        | "deliveryAddress"
        | "outboundCarrier"
        | "outboundTracking"
        | "returnCarrier"
        | "returnTracking"
        | "logisticsNotes";
      max: number;
    }> = [
      { key: "contactPhone", max: 80 },
      { key: "deliveryAddress", max: 1000 },
      { key: "outboundCarrier", max: 120 },
      { key: "outboundTracking", max: 200 },
      { key: "returnCarrier", max: 120 },
      { key: "returnTracking", max: 200 },
      { key: "logisticsNotes", max: 3000 },
    ];
    textFields.forEach(({ key, max }) => {
      if (payload[key] !== undefined) {
        update[key] = cleanText(payload[key], max);
        changed = true;
      }
    });

    const dateTimeFields = [
      "outboundSentAt",
      "deliveredAt",
      "returnReceivedAt",
    ] as const;
    for (const key of dateTimeFields) {
      if (payload[key] === undefined) continue;
      const value = normalizeDateTime(payload[key]);
      if (payload[key] && !value) {
        return Response.json(
          { error: "请输入有效的物流时间。" },
          { status: 400 },
        );
      }
      update[key] = value;
      changed = true;
    }
    if (payload.expectedReturnAt !== undefined) {
      const value = normalizeDate(payload.expectedReturnAt);
      if (payload.expectedReturnAt && !value) {
        return Response.json(
          { error: "请输入有效的预计归还日期。" },
          { status: 400 },
        );
      }
      update.expectedReturnAt = value;
      changed = true;
    }
    if (!changed) {
      return Response.json(
        { error: "没有可保存的修改。" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const updateLoan = db
      .update(sampleLoans)
      .set(update)
      .where(eq(sampleLoans.id, id));
    const itemStatus = payload.status
      ? mappedItemStatus(payload.status)
      : null;
    const updateItems = itemStatus
      ? db
          .update(sampleLoanItems)
          .set({ status: itemStatus, updatedAt: now })
          .where(
            and(
              eq(sampleLoanItems.loanId, id),
              inArray(sampleLoanItems.status, normalItemStatuses),
            ),
          )
      : null;
    const assetStatus = payload.status
      ? mappedAssetStatus(payload.status)
      : null;
    const normalAssetIds = current.items
      .filter(
        (item) =>
          item.sampleAssetId &&
          normalItemStatuses.includes(
            item.status as (typeof normalItemStatuses)[number],
          ),
      )
      .map((item) => item.sampleAssetId as string);
    const updateAssets =
      assetStatus && normalAssetIds.length > 0
        ? db
            .update(sampleAssets)
            .set({
              status: assetStatus,
              updatedAt: now,
              ...(payload.status === "returned" ||
              payload.status === "closed" ||
              payload.status === "cancelled"
                ? {
                    currentLocation: sql<string>`${sampleAssets.homeLocation}`,
                    lastSeenAt: now,
                  }
                : payload.status === "dispatched"
                  ? { currentLocation: "IN TRANSIT" }
                  : payload.status === "return_in_transit"
                    ? { currentLocation: "RETURN IN TRANSIT" }
                    : ["delivered", "in_use", "return_due"].includes(
                          payload.status ?? "",
                        )
                      ? {
                          currentLocation:
                            current.request.deliveryCity.toUpperCase() ||
                            "WITH RECIPIENT",
                        }
                      : {}),
            })
            .where(inArray(sampleAssets.id, normalAssetIds))
        : null;
    const completeRequest =
      payload.status === "closed"
        ? db
            .update(showroomRequests)
            .set({
              status: "completed",
              reviewedBy: auth.user.email,
              reviewedAt: now,
              updatedAt: now,
            })
            .where(eq(showroomRequests.id, current.loan.requestId))
        : null;

    await updateLoan;
    if (updateItems) await updateItems;
    if (updateAssets) await updateAssets;
    if (completeRequest) await completeRequest;

    return Response.json({
      loan: await getSampleLoanWorkspace(id),
    });
  } catch {
    return Response.json(
      { error: "保存样衣借调单失败，请稍后重试。" },
      { status: 500 },
    );
  }
}

function mappedItemStatus(
  status: SampleLoanStatus,
): SampleLoanItemStatus | null {
  if (status === "preparing") return "reserved";
  if (status === "ready") return "packing";
  if (status === "dispatched") return "dispatched";
  if (
    status === "delivered" ||
    status === "in_use" ||
    status === "return_due"
  ) {
    return "with_recipient";
  }
  if (status === "return_in_transit") return "returning";
  if (status === "returned") return "returned";
  return null;
}

function mappedAssetStatus(status: SampleLoanStatus) {
  if (status === "preparing" || status === "ready") return "reserved" as const;
  if (status === "dispatched" || status === "return_in_transit") {
    return "in_transit" as const;
  }
  if (
    status === "delivered" ||
    status === "in_use" ||
    status === "return_due"
  ) {
    return "out_on_loan" as const;
  }
  if (
    status === "returned" ||
    status === "closed" ||
    status === "cancelled"
  ) {
    return "available" as const;
  }
  return null;
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? value
    : null;
}

function normalizeDateTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
