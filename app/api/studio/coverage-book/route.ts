import { requireApiAdmin } from "@/lib/admin";
import {
  buildCoverageBookReport,
  coverageBookToCsv,
  parseCoverageBookFilters,
} from "@/lib/coverage-book";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const url = new URL(request.url);
    const report = await buildCoverageBookReport(
      parseCoverageBookFilters(url.searchParams),
    );
    const format = url.searchParams.get("format");
    const date = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      return new Response(coverageBookToCsv(report), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="nera-coverage-book-${date}.csv"`,
          "cache-control": "private, no-store",
        },
      });
    }
    if (format === "json") {
      return new Response(JSON.stringify(report, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="nera-coverage-book-${date}.json"`,
          "cache-control": "private, no-store",
        },
      });
    }
    return Response.json(
      { report },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Response.json(
      {
        error: message.includes("no such table")
          ? "覆盖册数据尚未初始化，请完成新版部署后再试。"
          : "无法生成媒体覆盖册，请稍后重试。",
      },
      { status: 500 },
    );
  }
}
