import { requireApiAdmin } from "@/lib/admin";
import {
  listShowroomRequestWorkspaces,
  showroomRequestsToCsv,
} from "@/lib/showroom-requests";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const workspaces = await listShowroomRequestWorkspaces();
    if (new URL(request.url).searchParams.get("format") === "csv") {
      const date = new Date().toISOString().slice(0, 10);
      return new Response(showroomRequestsToCsv(workspaces), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="nera-pull-requests-${date}.csv"`,
          "cache-control": "private, no-store",
        },
      });
    }

    return Response.json(
      { requests: workspaces },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Response.json(
      {
        error: message.includes("no such table")
          ? "会面回应数据库尚未初始化，请完成新版部署后再试。"
          : "无法读取 Pull Request，请稍后重试。",
      },
      { status: 500 },
    );
  }
}
