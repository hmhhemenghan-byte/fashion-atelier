import { requireApiAdmin } from "@/lib/admin";
import { buildSeasonCommandOverview } from "@/lib/season-command";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const overview = await buildSeasonCommandOverview();
    return Response.json(
      { overview },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Response.json(
      {
        error: message.includes("no such table")
          ? "季度作战台的数据源尚未完成初始化，请部署最新版本后再试。"
          : "无法读取季度作战台，请稍后重试。",
      },
      {
        status: 500,
        headers: { "cache-control": "private, no-store" },
      },
    );
  }
}
