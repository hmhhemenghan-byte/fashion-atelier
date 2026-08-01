import { getDb } from "@/db";
import { sampleAssets, type NewSampleAsset } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  listAllSampleAssets,
  listSampleAuditWorkspaces,
  SAMPLE_ASSET_CATEGORIES,
  SAMPLE_ASSET_CONDITIONS,
  sampleAssetsToCsv,
  type SampleAssetCategory,
  type SampleAssetCondition,
  type SampleAssetWithAssignment,
} from "@/lib/sample-inventory";
import { listSampleLoanWorkspaces } from "@/lib/sample-loans";
import { getWorkById, listAllWorks } from "@/lib/works";

export const dynamic = "force-dynamic";

type CreatePayload = {
  workId?: string;
  assetCode?: string;
  tagCode?: string;
  sizeLabel?: string;
  colorLabel?: string;
  category?: SampleAssetCategory;
  condition?: SampleAssetCondition;
  department?: string;
  homeLocation?: string;
  notes?: string;
};

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const [assets, works, loans, audits] = await Promise.all([
      listAllSampleAssets(),
      listAllWorks(1000),
      listSampleLoanWorkspaces(),
      listSampleAuditWorkspaces(),
    ]);
    const rows = withAssignments(assets, loans);
    if (new URL(request.url).searchParams.get("format") === "csv") {
      const date = new Date().toISOString().slice(0, 10);
      return new Response(sampleAssetsToCsv(rows), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="nera-sample-inventory-${date}.csv"`,
          "cache-control": "private, no-store",
        },
      });
    }
    return Response.json(
      { assets: rows, works, loans, audits },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return inventoryError(error, "无法读取样衣资产库，请稍后重试。");
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as CreatePayload;
    const workId = cleanText(payload.workId, 120);
    const work = workId ? await getWorkById(workId) : null;
    if (!work) {
      return Response.json(
        { error: "请选择资产对应的作品。" },
        { status: 400 },
      );
    }

    const category = payload.category ?? "garment";
    const condition = payload.condition ?? "not_checked";
    if (!SAMPLE_ASSET_CATEGORIES.includes(category)) {
      return Response.json({ error: "样衣类别无效。" }, { status: 400 });
    }
    if (!SAMPLE_ASSET_CONDITIONS.includes(condition)) {
      return Response.json({ error: "样衣品相无效。" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const homeLocation =
      cleanText(payload.homeLocation, 180) || "MAIN RACK";
    const values: NewSampleAsset = {
      id: crypto.randomUUID(),
      workId: work.id,
      workTitle: work.title,
      lookNumber: work.lookNumber,
      imageKey: work.imageKey,
      assetCode:
        normalizeCode(payload.assetCode, 80) || createAssetCode(work, now),
      tagCode: normalizeCode(payload.tagCode, 160) || null,
      sizeLabel: cleanText(payload.sizeLabel, 80),
      colorLabel: cleanText(payload.colorLabel, 120),
      category,
      status: "available",
      condition,
      department:
        cleanText(payload.department, 160).toUpperCase() || "SHOWROOM",
      homeLocation: homeLocation.toUpperCase(),
      currentLocation: homeLocation.toUpperCase(),
      notes: cleanText(payload.notes, 1600),
      lastSeenAt: now,
      createdBy: auth.user.email,
      createdAt: now,
      updatedAt: now,
    };
    const db = await getDb();
    const [asset] = await db.insert(sampleAssets).values(values).returning();
    return Response.json(
      { asset: { asset, assignment: null } },
      { status: 201 },
    );
  } catch (error) {
    return inventoryError(error, "建立样衣资产失败，请稍后重试。");
  }
}

function withAssignments(
  assets: Awaited<ReturnType<typeof listAllSampleAssets>>,
  loans: Awaited<ReturnType<typeof listSampleLoanWorkspaces>>,
): SampleAssetWithAssignment[] {
  const assignments = new Map<
    string,
    NonNullable<SampleAssetWithAssignment["assignment"]>
  >();
  loans.forEach((workspace) => {
    if (
      ["closed", "cancelled", "returned"].includes(workspace.loan.status)
    ) {
      return;
    }
    workspace.items.forEach((item) => {
      if (!item.sampleAssetId) return;
      assignments.set(item.sampleAssetId, {
        loanId: workspace.loan.id,
        loanCode: workspace.loan.loanCode,
        loanStatus: workspace.loan.status,
        loanItemId: item.id,
        projectTitle: workspace.request.projectTitle,
        requesterName: workspace.request.requesterName,
      });
    });
  });
  return assets.map((asset) => ({
    asset,
    assignment: assignments.get(asset.id) ?? null,
  }));
}

function createAssetCode(
  work: NonNullable<Awaited<ReturnType<typeof getWorkById>>>,
  now: string,
) {
  const look =
    normalizeCode(work.lookNumber, 20).replaceAll(/[^A-Z0-9]/g, "") ||
    "LOOK";
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  )
    .join("")
    .toUpperCase();
  return `SMP-${now.slice(2, 10).replaceAll("-", "")}-${look}-${suffix}`;
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeCode(value: unknown, maxLength: number) {
  return cleanText(value, maxLength).toUpperCase();
}

function inventoryError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  return Response.json(
    {
      error: message.includes("no such table")
        ? "样衣资产数据库尚未初始化，请完成新版部署后再试。"
        : message.includes("UNIQUE")
          ? "样衣编号或标签编号已存在，请使用唯一编号。"
          : fallback,
    },
    { status: 500 },
  );
}
