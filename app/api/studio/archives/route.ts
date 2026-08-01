import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  createArchiveSnapshot,
  getArchiveHandoffOverview,
  toArchiveSnapshotSummary,
} from "@/lib/archive-handoff";

export const dynamic = "force-dynamic";

type SnapshotPayload = {
  label?: string;
  notes?: string;
};

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const overview = await getArchiveHandoffOverview(
      new URL(request.url).origin,
    );
    return Response.json(
      { overview },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return archiveError(error, "无法读取交接档案，请稍后重试。");
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as SnapshotPayload;
    const label = cleanText(payload.label, 120);
    const notes = cleanText(payload.notes, 2000);
    if (label.length < 2) {
      return Response.json(
        { error: "请填写至少 2 个字符的快照名称。" },
        { status: 400 },
      );
    }
    const snapshot = await createArchiveSnapshot({
      label,
      notes,
      createdBy: auth.user.email,
      origin: new URL(request.url).origin,
    });
    return Response.json(
      { snapshot: toArchiveSnapshotSummary(snapshot) },
      { status: 201 },
    );
  } catch (error) {
    return archiveError(error, "创建交接快照失败，请稍后重试。");
  }
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function archiveError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  return Response.json(
    {
      error: message.includes("no such table")
        ? "交接档案数据库尚未初始化，请完成新版部署后再试。"
        : fallback,
    },
    { status: 500 },
  );
}
