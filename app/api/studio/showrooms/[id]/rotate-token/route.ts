import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { showrooms } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  createShowroomToken,
  getShowroomById,
} from "@/lib/showrooms";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  try {
    const current = await getShowroomById(id);
    if (!current) {
      return Response.json({ error: "私享展厅不存在。" }, { status: 404 });
    }
    const access = await createShowroomToken();
    const db = await getDb();
    const [showroom] = await db
      .update(showrooms)
      .set({
        accessTokenHash: access.hash,
        accessTokenHint: access.hint,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(showrooms.id, current.id))
      .returning();
    return Response.json({ showroom, shareToken: access.token });
  } catch {
    return Response.json(
      { error: "无法更新分享凭证，请稍后重试。" },
      { status: 500 },
    );
  }
}
