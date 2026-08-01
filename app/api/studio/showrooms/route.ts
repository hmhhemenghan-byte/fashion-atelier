import { getDb } from "@/db";
import { showrooms, type NewShowroom } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  createShowroomToken,
  getShowroomAccessState,
  listShowroomWorkspaces,
  normalizeShowroomSlug,
} from "@/lib/showrooms";

export const dynamic = "force-dynamic";

type ShowroomPayload = {
  title?: string;
  slug?: string;
  subtitle?: string;
  audienceLabel?: string;
  introduction?: string;
  expiresAt?: string | null;
  contactName?: string;
  contactEmail?: string;
  allowDownloads?: boolean;
};

export async function GET() {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    return Response.json(
      { rooms: await listShowroomWorkspaces() },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return showroomError(error, "无法读取私享展厅，请稍后重试。");
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as ShowroomPayload;
    const title = cleanText(payload.title, 160);
    const slug = normalizeShowroomSlug(cleanText(payload.slug, 120));
    if (!title || !slug) {
      return Response.json(
        { error: "展厅名称与英文网址标识为必填项。" },
        { status: 400 },
      );
    }
    const expiresAt = normalizeFutureDate(payload.expiresAt);
    if (payload.expiresAt && !expiresAt) {
      return Response.json(
        { error: "到期时间必须晚于当前时间。" },
        { status: 400 },
      );
    }
    const contactEmail = cleanText(payload.contactEmail, 200);
    if (contactEmail && !isEmail(contactEmail)) {
      return Response.json(
        { error: "请输入有效的联系邮箱。" },
        { status: 400 },
      );
    }

    const access = await createShowroomToken();
    const values: NewShowroom = {
      id: crypto.randomUUID(),
      slug,
      title,
      subtitle: cleanText(payload.subtitle, 240),
      audienceLabel:
        cleanText(payload.audienceLabel, 160) || "PRIVATE APPOINTMENT",
      introduction: cleanText(payload.introduction, 3000),
      status: "draft",
      accessTokenHash: access.hash,
      accessTokenHint: access.hint,
      expiresAt,
      contactName: cleanText(payload.contactName, 160),
      contactEmail,
      allowDownloads: payload.allowDownloads !== false,
      createdBy: auth.user.email,
    };
    const db = await getDb();
    const [showroom] = await db
      .insert(showrooms)
      .values(values)
      .returning();
    return Response.json(
      {
        room: {
          showroom,
          items: [],
          accessState: getShowroomAccessState(showroom),
        },
        shareToken: access.token,
      },
      { status: 201 },
    );
  } catch (error) {
    return showroomError(error, "创建私享展厅失败，请稍后重试。");
  }
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeFutureDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() > Date.now()
    ? date.toISOString()
    : null;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function showroomError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  return Response.json(
    {
      error: message.includes("no such table")
        ? "私享展厅数据库尚未初始化，请完成新版部署后再试。"
        : message.includes("UNIQUE")
          ? "该展厅网址标识已被使用，请更换一个。"
          : fallback,
    },
    { status: 500 },
  );
}
