import { requireApiAdmin } from "@/lib/admin";
import { getEditorialOverview } from "@/lib/editorial-operations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const overview = await getEditorialOverview();
    const requestUrl = new URL(request.url);
    const download = requestUrl.searchParams.get("download") === "1";
    return Response.json(
      { overview },
      download
        ? {
            headers: {
              "cache-control": "private, no-store",
              "content-disposition": `attachment; filename="nera-editorial-qa-${overview.generatedAt.slice(0, 10)}.json"`,
            },
          }
        : undefined,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Response.json(
      {
        error: message.includes("no such table")
          ? "内容数据库尚未完成初始化，请部署最新版本后再试。"
          : "无法读取 Editorial Operations，请稍后重试。",
      },
      { status: 500 },
    );
  }
}
