import { getDb } from "@/db";
import {
  sampleAuditItems,
  sampleAudits,
  type NewSampleAudit,
  type NewSampleAuditItem,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  getSampleAuditWorkspace,
  listAssetsForAuditScope,
  listSampleAuditWorkspaces,
} from "@/lib/sample-inventory";

export const dynamic = "force-dynamic";

type CreatePayload = {
  label?: string;
  scopeLocation?: string;
  scopeDepartment?: string;
  notes?: string;
};

export async function GET() {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    return Response.json(
      { audits: await listSampleAuditWorkspaces() },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return auditError(error, "无法读取盘点记录，请稍后重试。");
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as CreatePayload;
    const label = cleanText(payload.label, 180);
    if (label.length < 2) {
      return Response.json(
        { error: "请填写至少 2 个字符的盘点名称。" },
        { status: 400 },
      );
    }
    const scopeLocation = cleanText(payload.scopeLocation, 180).toUpperCase();
    const scopeDepartment = cleanText(
      payload.scopeDepartment,
      160,
    ).toUpperCase();
    const assets = await listAssetsForAuditScope({
      location: scopeLocation,
      department: scopeDepartment,
    });
    if (assets.length === 0) {
      return Response.json(
        { error: "当前盘点范围内没有可核对的样衣资产。" },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const auditId = crypto.randomUUID();
    const audit: NewSampleAudit = {
      id: auditId,
      auditCode: createAuditCode(now),
      label,
      scopeLocation,
      scopeDepartment,
      status: "counting",
      notes: cleanText(payload.notes, 1600),
      startedAt: now,
      createdBy: auth.user.email,
      createdAt: now,
      updatedAt: now,
    };
    const items: NewSampleAuditItem[] = assets.map((asset) => ({
      id: crypto.randomUUID(),
      auditId,
      sampleAssetId: asset.id,
      assetCode: asset.assetCode,
      workTitle: asset.workTitle,
      expectedStatus: asset.status,
      expectedLocation: asset.currentLocation,
      observedCondition: "not_checked",
      result: "pending",
      createdAt: now,
      updatedAt: now,
    }));
    const db = await getDb();
    await db.batch([
      db.insert(sampleAudits).values(audit),
      db.insert(sampleAuditItems).values(items),
    ]);
    return Response.json(
      { audit: await getSampleAuditWorkspace(auditId) },
      { status: 201 },
    );
  } catch (error) {
    return auditError(error, "建立盘点会话失败，请稍后重试。");
  }
}

function createAuditCode(now: string) {
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  )
    .join("")
    .toUpperCase();
  return `AUD-${now.slice(2, 10).replaceAll("-", "")}-${suffix}`;
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function auditError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  return Response.json(
    {
      error: message.includes("no such table")
        ? "样衣盘点数据库尚未初始化，请完成新版部署后再试。"
        : fallback,
    },
    { status: 500 },
  );
}
