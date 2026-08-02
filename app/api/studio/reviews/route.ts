import { getDb } from "@/db";
import { designReviewActions, designReviews } from "@/db/schema";
import { requireApiAdmin } from "@/lib/admin";
import { buildDesignReviewOverview, designReviewsToCsv } from "@/lib/design-reviews";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");
    const db = await getDb();

    if (format === "json") {
      const reviews = await db.select().from(designReviews);
      const actions = await db.select().from(designReviewActions);
      return new Response(JSON.stringify({ reviews, actionItems: actions }, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": 'attachment; filename="atelier-reviews.json"',
          "cache-control": "private, no-store",
        },
      });
    }

    if (format === "csv") {
      const overview = await buildDesignReviewOverview();
      const csvData = designReviewsToCsv(overview);
      return new Response(csvData, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="atelier-reviews.csv"',
          "cache-control": "private, no-store",
        },
      });
    }

    const reviews = await db.select().from(designReviews);
    const actions = await db.select().from(designReviewActions);
    return Response.json(
      { reviews, actionItems: actions },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Response.json(
      { error: message || "无法读取设计评审数据。" },
      { status: 500, headers: { "cache-control": "private, no-store" } },
    );
  }
}
