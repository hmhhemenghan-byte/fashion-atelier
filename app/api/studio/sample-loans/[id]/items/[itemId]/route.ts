import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  sampleAssets,
  sampleLoanItems,
  type NewSampleLoanItem,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  getSampleLoanWorkspace,
  SAMPLE_CONDITIONS,
  SAMPLE_LOAN_ITEM_STATUSES,
  type SampleCondition,
  type SampleLoanItemStatus,
} from "@/lib/sample-loans";
import { assetStatusForLoanItem } from "@/lib/sample-inventory";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};
type ItemPatch = {
  sampleCode?: string;
  sizeLabel?: string;
  status?: SampleLoanItemStatus;
  outboundCondition?: SampleCondition;
  returnCondition?: SampleCondition;
  conditionNotes?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id, itemId } = await context.params;
    const current = await getSampleLoanWorkspace(id);
    if (!current) {
      return Response.json(
        { error: "样衣借调单不存在。" },
        { status: 404 },
      );
    }
    const currentItem = current.items.find((item) => item.id === itemId);
    if (!currentItem) {
      return Response.json(
        { error: "借调样衣不存在。" },
        { status: 404 },
      );
    }

    const payload = (await request.json()) as ItemPatch;
    const update: Partial<NewSampleLoanItem> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;
    if (payload.sampleCode !== undefined) {
      update.sampleCode = cleanText(payload.sampleCode, 120);
      changed = true;
    }
    if (payload.sizeLabel !== undefined) {
      update.sizeLabel = cleanText(payload.sizeLabel, 80);
      changed = true;
    }
    if (payload.conditionNotes !== undefined) {
      update.conditionNotes = cleanText(payload.conditionNotes, 1200);
      changed = true;
    }
    if (payload.status !== undefined) {
      if (!SAMPLE_LOAN_ITEM_STATUSES.includes(payload.status)) {
        return Response.json(
          { error: "样衣状态无效。" },
          { status: 400 },
        );
      }
      update.status = payload.status;
      changed = true;
    }
    for (const key of [
      "outboundCondition",
      "returnCondition",
    ] as const) {
      const value = payload[key];
      if (value === undefined) continue;
      if (!SAMPLE_CONDITIONS.includes(value)) {
        return Response.json(
          { error: "样衣状况记录无效。" },
          { status: 400 },
        );
      }
      update[key] = value;
      changed = true;
    }
    if (!changed) {
      return Response.json(
        { error: "没有可保存的修改。" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const updateItem = db
      .update(sampleLoanItems)
      .set(update)
      .where(
        and(
          eq(sampleLoanItems.id, itemId),
          eq(sampleLoanItems.loanId, id),
        ),
      );
    if (currentItem.sampleAssetId) {
      const nextStatus = payload.status ?? currentItem.status;
      const assetUpdate = {
        status: assetStatusForLoanItem(nextStatus),
        updatedAt: update.updatedAt as string,
        ...(nextStatus === "returned"
          ? {
              currentLocation: sql<string>`${sampleAssets.homeLocation}`,
              lastSeenAt: update.updatedAt as string,
            }
          : nextStatus === "dispatched"
            ? { currentLocation: "IN TRANSIT" }
            : nextStatus === "with_recipient"
              ? {
                  currentLocation:
                    current.request.deliveryCity.toUpperCase() ||
                    "WITH RECIPIENT",
                }
              : nextStatus === "returning"
                ? { currentLocation: "RETURN IN TRANSIT" }
                : {}),
        ...(nextStatus === "damaged"
          ? { condition: "damaged" as const }
          : payload.returnCondition &&
              payload.returnCondition !== "not_checked"
            ? { condition: payload.returnCondition }
            : payload.outboundCondition &&
                payload.outboundCondition !== "not_checked"
              ? { condition: payload.outboundCondition }
              : {}),
      };
      await db.batch([
        updateItem,
        db
          .update(sampleAssets)
          .set(assetUpdate)
          .where(eq(sampleAssets.id, currentItem.sampleAssetId)),
      ]);
    } else {
      await updateItem;
    }
    return Response.json({
      loan: await getSampleLoanWorkspace(id),
    });
  } catch {
    return Response.json(
      { error: "保存样衣状态失败，请稍后重试。" },
      { status: 500 },
    );
  }
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
