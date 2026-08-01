import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  showroomRequests,
  type NewShowroomRequest,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  getShowroomRequestWorkspace,
  SHOWROOM_REQUEST_STATUSES,
  type ShowroomRequestStatus,
} from "@/lib/showroom-requests";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type RequestPatch = {
  status?: ShowroomRequestStatus;
  internalNotes?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getShowroomRequestWorkspace(id);
    if (!current) {
      return Response.json(
        { error: "Pull Request 不存在。" },
        { status: 404 },
      );
    }

    const payload = (await request.json()) as RequestPatch;
    const update: Partial<NewShowroomRequest> = {
      updatedAt: new Date().toISOString(),
    };
    if (payload.status !== undefined) {
      if (!SHOWROOM_REQUEST_STATUSES.includes(payload.status)) {
        return Response.json(
          { error: "审核状态无效。" },
          { status: 400 },
        );
      }
      update.status = payload.status;
      if (payload.status === "submitted") {
        update.reviewedAt = null;
        update.reviewedBy = null;
      } else {
        update.reviewedAt = new Date().toISOString();
        update.reviewedBy = auth.user.email;
      }
    }
    if (payload.internalNotes !== undefined) {
      update.internalNotes = cleanText(payload.internalNotes, 3000);
    }
    if (
      payload.status === undefined &&
      payload.internalNotes === undefined
    ) {
      return Response.json(
        { error: "没有可保存的修改。" },
        { status: 400 },
      );
    }

    const db = await getDb();
    await db
      .update(showroomRequests)
      .set(update)
      .where(eq(showroomRequests.id, id));
    return Response.json({
      request: await getShowroomRequestWorkspace(id),
    });
  } catch {
    return Response.json(
      { error: "保存 Pull Request 失败，请稍后重试。" },
      { status: 500 },
    );
  }
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
