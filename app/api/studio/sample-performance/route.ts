import { requireApiAdmin } from "@/lib/admin";
import {
  buildSamplePerformanceReport,
  SAMPLE_PERFORMANCE_RANGES,
  samplePerformanceToCsv,
  type SamplePerformanceFilters,
  type SamplePerformanceRange,
} from "@/lib/sample-performance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const url = new URL(request.url);
    const filters = performanceFilters(url.searchParams);
    const report = await buildSamplePerformanceReport(filters);
    if (url.searchParams.get("format") === "csv") {
      const date = new Date().toISOString().slice(0, 10);
      return new Response(samplePerformanceToCsv(report), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="nera-sample-performance-${date}.csv"`,
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
          ? "样衣效能数据尚未初始化，请完成新版部署后再试。"
          : "无法生成样衣使用效能报告，请稍后重试。",
      },
      { status: 500 },
    );
  }
}

function performanceFilters(searchParams: URLSearchParams) {
  const requestedRange = cleanText(searchParams.get("range"), 8);
  const range = SAMPLE_PERFORMANCE_RANGES.includes(
    requestedRange as SamplePerformanceRange,
  )
    ? (requestedRange as SamplePerformanceRange)
    : "90";
  return {
    range,
    department: cleanText(searchParams.get("department"), 160),
    collection: cleanText(searchParams.get("collection"), 240),
    category: cleanText(searchParams.get("category"), 80),
    destination: cleanText(searchParams.get("destination"), 160),
    color: cleanText(searchParams.get("color"), 120),
    purpose: cleanText(searchParams.get("purpose"), 120),
  } satisfies SamplePerformanceFilters;
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
