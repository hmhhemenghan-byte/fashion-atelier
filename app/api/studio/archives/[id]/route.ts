import { requireApiAdmin } from "@/lib/admin";
import {
  getArchiveSnapshot,
  toArchiveSnapshotSummary,
} from "@/lib/archive-handoff";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!id || id.length > 120) {
    return Response.json({ error: "快照标识无效。" }, { status: 400 });
  }

  try {
    const snapshot = await getArchiveSnapshot(id);
    if (!snapshot) {
      return Response.json({ error: "交接快照不存在。" }, { status: 404 });
    }
    const download = new URL(request.url).searchParams.get("download") === "1";
    if (download) {
      return new Response(snapshot.dataJson, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="nera-archive-snapshot-${snapshot.createdAt.slice(0, 10)}-${snapshot.id.slice(0, 8)}.json"`,
          "cache-control": "private, no-store",
        },
      });
    }
    return Response.json(
      { snapshot: toArchiveSnapshotSummary(snapshot) },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Response.json(
      {
        error: message.includes("no such table")
          ? "交接档案数据库尚未初始化，请完成新版部署后再试。"
          : "无法读取交接快照，请稍后重试。",
      },
      { status: 500 },
    );
  }
}
