import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { showrooms, type NewShowroom } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  getShowroomById,
  getShowroomAccessState,
  listShowroomWorks,
  normalizeShowroomSlug,
  SHOWROOM_STATUSES,
  type ShowroomStatus,
} from "@/lib/showrooms";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

type ShowroomPatch = {
  title?: string;
  slug?: string;
  subtitle?: string;
  audienceLabel?: string;
  introduction?: string;
  status?: ShowroomStatus;
  expiresAt?: string | null;
  contactName?: string;
  contactEmail?: string;
  allowDownloads?: boolean;
};

export async function PATCH(request: Request, context: RouteContext) {
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
    const payload = (await request.json()) as ShowroomPatch;
    const update: Partial<NewShowroom> = {
      updatedAt: new Date().toISOString(),
    };

    if (payload.title !== undefined) {
      update.title = cleanText(payload.title, 160);
      if (!update.title) {
        return Response.json(
          { error: "展厅名称不能为空。" },
          { status: 400 },
        );
      }
    }
    if (payload.slug !== undefined) {
      update.slug = normalizeShowroomSlug(cleanText(payload.slug, 120));
      if (!update.slug) {
        return Response.json(
          { error: "请输入有效的英文网址标识。" },
          { status: 400 },
        );
      }
    }
    if (payload.subtitle !== undefined) {
      update.subtitle = cleanText(payload.subtitle, 240);
    }
    if (payload.audienceLabel !== undefined) {
      update.audienceLabel =
        cleanText(payload.audienceLabel, 160) || "PRIVATE APPOINTMENT";
    }
    if (payload.introduction !== undefined) {
      update.introduction = cleanText(payload.introduction, 3000);
    }
    if (payload.contactName !== undefined) {
      update.contactName = cleanText(payload.contactName, 160);
    }
    if (payload.contactEmail !== undefined) {
      const contactEmail = cleanText(payload.contactEmail, 200);
      if (contactEmail && !isEmail(contactEmail)) {
        return Response.json(
          { error: "请输入有效的联系邮箱。" },
          { status: 400 },
        );
      }
      update.contactEmail = contactEmail;
    }
    if (payload.allowDownloads !== undefined) {
      update.allowDownloads = Boolean(payload.allowDownloads);
    }
    if (payload.expiresAt !== undefined) {
      update.expiresAt = normalizeDate(payload.expiresAt);
      if (payload.expiresAt && !update.expiresAt) {
        return Response.json(
          { error: "请输入有效的到期时间。" },
          { status: 400 },
        );
      }
    }
    if (payload.status !== undefined) {
      if (!SHOWROOM_STATUSES.includes(payload.status)) {
        return Response.json(
          { error: "展厅状态无效。" },
          { status: 400 },
        );
      }
      update.status = payload.status;
    }

    const candidate = { ...current, ...update };
    if (candidate.status === "active") {
      const items = await listShowroomWorks(current.id);
      if (items.length === 0) {
        return Response.json(
          { error: "至少选择 1 件 Look 后才能启用分享。" },
          { status: 400 },
        );
      }
      if (
        candidate.expiresAt &&
        new Date(candidate.expiresAt).getTime() <= Date.now()
      ) {
        return Response.json(
          { error: "启用分享前，请把到期时间调整到未来。" },
          { status: 400 },
        );
      }
      update.activatedAt =
        current.activatedAt ?? new Date().toISOString();
    }

    const db = await getDb();
    const [showroom] = await db
      .update(showrooms)
      .set(update)
      .where(eq(showrooms.id, current.id))
      .returning();
    return Response.json({
      room: {
        showroom,
        items: await listShowroomWorks(showroom.id),
        accessState: getShowroomAccessState(showroom),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Response.json(
      {
        error: message.includes("UNIQUE")
          ? "该展厅网址标识已被使用，请更换一个。"
          : "保存私享展厅失败，请稍后重试。",
      },
      { status: 500 },
    );
  }
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
