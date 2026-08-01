import { requireApiAdmin } from "@/lib/admin";
import {
  archiveMediaToCsv,
  buildArchiveBundle,
} from "@/lib/archive-handoff";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const requestUrl = new URL(request.url);
    const bundle = await buildArchiveBundle(requestUrl.origin);
    const format = requestUrl.searchParams.get("format");
    const date = bundle.generatedAt.slice(0, 10);

    if (format === "media-csv") {
      return new Response(archiveMediaToCsv(bundle.mediaManifest), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="nera-media-manifest-${date}.csv"`,
          "cache-control": "private, no-store",
        },
      });
    }

    return new Response(JSON.stringify(bundle, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="nera-full-handoff-${date}.json"`,
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return Response.json(
      { error: "无法生成交接数据包，请稍后重试。" },
      { status: 500 },
    );
  }
}
