import { requireApiAdmin } from "@/lib/admin";
import { buildSeasonCommandOverview } from "@/lib/season-command";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const overview = await buildSeasonCommandOverview();
    const url = new URL(request.url);
    const format = url.searchParams.get("format");
    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === "csv") {
      const csvContent = agendaToCsv(overview.agenda);
      return new Response(csvContent, {
        headers: {
          "cache-control": "private, no-store",
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="nera-season-command-agenda-${dateStr}.csv"`,
        },
      });
    }

    if (format === "json" && url.searchParams.has("download")) {
      return new Response(JSON.stringify(overview, null, 2), {
        headers: {
          "cache-control": "private, no-store",
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="nera-season-command-overview-${dateStr}.json"`,
        },
      });
    }

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

function agendaToCsv(agenda: Array<Record<string, unknown>>) {
  const columns = [
    "id",
    "kind",
    "urgency",
    "eyebrow",
    "title",
    "detail",
    "dueAt",
    "collectionId",
    "href",
  ];
  const lines = [columns.map(csvCell).join(",")];
  for (const item of agenda) {
    lines.push(columns.map((col) => csvCell(item[col])).join(","));
  }
  return `\ufeff${lines.join("\r\n")}`;
}

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
