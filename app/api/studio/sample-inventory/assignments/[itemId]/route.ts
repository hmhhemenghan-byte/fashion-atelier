import { and, eq, notInArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  sampleAssets,
  sampleLoanItems,
  sampleLoans,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  assetStatusForLoanItem,
  getSampleAsset,
} from "@/lib/sample-inventory";
import { getSampleLoanWorkspace } from "@/lib/sample-loans";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ itemId: string }> };
type AssignPayload = { assetId?: string | null };

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { itemId } = await context.params;
    const db = await getDb();
    const [row] = await db
      .select({ item: sampleLoanItems, loan: sampleLoans })
      .from(sampleLoanItems)
      .innerJoin(sampleLoans, eq(sampleLoanItems.loanId, sampleLoans.id))
      .where(eq(sampleLoanItems.id, itemId))
      .limit(1);
    if (!row) {
      return Response.json(
        { error: "借调样衣不存在。" },
        { status: 404 },
      );
    }
    if (["closed", "cancelled", "returned"].includes(row.loan.status)) {
      return Response.json(
        { error: "已结束的借调单不能重新分配实物样衣。" },
        { status: 409 },
      );
    }

    const payload = (await request.json()) as AssignPayload;
    const assetId =
      typeof payload.assetId === "string" ? payload.assetId.trim() : "";
    const now = new Date().toISOString();

    if (!assetId) {
      if (!row.item.sampleAssetId) {
        return Response.json(
          { error: "该借调项尚未分配实物样衣。" },
          { status: 409 },
        );
      }
      if (!["preparing", "ready"].includes(row.loan.status)) {
        return Response.json(
          { error: "样衣寄出后不能直接解除分配，请先完成归还。" },
          { status: 409 },
        );
      }
      const currentAsset = await getSampleAsset(row.item.sampleAssetId);
      await db.batch([
        db
          .update(sampleLoanItems)
          .set({
            sampleAssetId: null,
            sampleCode: "",
            sizeLabel: "",
            updatedAt: now,
          })
          .where(eq(sampleLoanItems.id, itemId)),
        db
          .update(sampleAssets)
          .set({
            status: "available",
            currentLocation:
              currentAsset?.homeLocation ?? "MAIN RACK",
            updatedAt: now,
          })
          .where(eq(sampleAssets.id, row.item.sampleAssetId)),
      ]);
      return Response.json({
        loan: await getSampleLoanWorkspace(row.loan.id),
      });
    }

    const asset = await getSampleAsset(assetId);
    if (!asset) {
      return Response.json({ error: "样衣资产不存在。" }, { status: 404 });
    }
    if (
      asset.workId &&
      row.item.workId &&
      asset.workId !== row.item.workId
    ) {
      return Response.json(
        { error: "这件实物样衣不属于借调项对应的作品。" },
        { status: 409 },
      );
    }
    if (
      !["available", "reserved"].includes(asset.status) &&
      row.item.sampleAssetId !== asset.id
    ) {
      return Response.json(
        { error: "这件实物样衣当前不可分配。" },
        { status: 409 },
      );
    }

    const [otherAssignment] = await db
      .select({ id: sampleLoanItems.id })
      .from(sampleLoanItems)
      .innerJoin(sampleLoans, eq(sampleLoanItems.loanId, sampleLoans.id))
      .where(
        and(
          eq(sampleLoanItems.sampleAssetId, assetId),
          notInArray(sampleLoans.status, [
            "closed",
            "cancelled",
            "returned",
          ]),
        ),
      )
      .limit(1);
    if (otherAssignment && otherAssignment.id !== itemId) {
      return Response.json(
        { error: "这件实物样衣已被另一条进行中借调占用。" },
        { status: 409 },
      );
    }

    const oldAssetId = row.item.sampleAssetId;
    const nextAssetStatus = assetStatusForLoanItem(row.item.status);
    const operations = [
      db
        .update(sampleLoanItems)
        .set({
          sampleAssetId: asset.id,
          sampleCode: asset.assetCode,
          sizeLabel: asset.sizeLabel,
          updatedAt: now,
        })
        .where(eq(sampleLoanItems.id, itemId)),
      db
        .update(sampleAssets)
        .set({
          status: nextAssetStatus,
          currentLocation:
            nextAssetStatus === "in_transit"
              ? row.item.status === "returning"
                ? "RETURN IN TRANSIT"
                : "IN TRANSIT"
              : nextAssetStatus === "out_on_loan"
                ? "WITH RECIPIENT"
                : asset.currentLocation,
          updatedAt: now,
        })
        .where(eq(sampleAssets.id, asset.id)),
    ] as const;
    await db.batch(operations);
    if (oldAssetId && oldAssetId !== asset.id) {
      const oldAsset = await getSampleAsset(oldAssetId);
      await db
        .update(sampleAssets)
        .set({
          status: "available",
          currentLocation: oldAsset?.homeLocation ?? "MAIN RACK",
          updatedAt: now,
        })
        .where(eq(sampleAssets.id, oldAssetId));
    }
    return Response.json({
      loan: await getSampleLoanWorkspace(row.loan.id),
    });
  } catch {
    return Response.json(
      { error: "分配实物样衣失败，请稍后重试。" },
      { status: 500 },
    );
  }
}
