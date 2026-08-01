import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import {
  showroomRequestItems,
  showroomRequests,
  type NewShowroomRequest,
  type NewShowroomRequestItem,
} from "@/db/schema";
import { rejectCrossOriginWrite } from "@/lib/admin";
import {
  SHOWROOM_REQUEST_PURPOSES,
  SHOWROOM_REQUEST_ROLES,
  type ShowroomRequestPurpose,
  type ShowroomRequestRole,
} from "@/lib/showroom-requests";
import {
  getShowroomBySlug,
  listShowroomWorks,
  verifyShowroomToken,
} from "@/lib/showrooms";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

type RequestPayload = {
  accessKey?: string;
  requesterName?: string;
  requesterEmail?: string;
  organization?: string;
  requesterRole?: ShowroomRequestRole;
  purpose?: ShowroomRequestPurpose;
  projectTitle?: string;
  neededFrom?: string | null;
  neededUntil?: string | null;
  deliveryCity?: string;
  notes?: string;
  consent?: boolean;
  items?: Array<{ workId?: string; note?: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonError("请使用有效的请求格式。", 415);
  }

  try {
    const { slug } = await context.params;
    const showroom = await getShowroomBySlug(slug);
    if (!showroom) return jsonError("当前私享展厅不可用。", 404);

    const payload = (await request.json()) as RequestPayload;
    if (!(await verifyShowroomToken(showroom, payload.accessKey))) {
      return jsonError("邀请链接已失效，请向工作室索取新链接。", 403);
    }

    const requesterName = cleanText(payload.requesterName, 160);
    const requesterEmail = cleanText(payload.requesterEmail, 200).toLowerCase();
    const organization = cleanText(payload.organization, 200);
    const projectTitle = cleanText(payload.projectTitle, 200);
    const deliveryCity = cleanText(payload.deliveryCity, 160);
    const notes = cleanText(payload.notes, 3000);
    const requesterRole = pickRole(payload.requesterRole);
    const purpose = pickPurpose(payload.purpose);
    const neededFrom = normalizeDate(payload.neededFrom);
    const neededUntil = normalizeDate(payload.neededUntil);

    if (requesterName.length < 2 || !isEmail(requesterEmail)) {
      return jsonError("请填写姓名与有效的工作邮箱。", 400);
    }
    if (!requesterRole || !purpose || projectTitle.length < 2) {
      return jsonError("请补充身份、需求类型与项目名称。", 400);
    }
    if (
      (payload.neededFrom && !neededFrom) ||
      (payload.neededUntil && !neededUntil)
    ) {
      return jsonError("请选择有效的需求日期。", 400);
    }
    if (
      neededFrom &&
      neededUntil &&
      neededUntil.localeCompare(neededFrom) < 0
    ) {
      return jsonError("归还日期不能早于需求开始日期。", 400);
    }
    if (payload.consent !== true) {
      return jsonError("提交前请确认工作室可以处理本次请求资料。", 400);
    }
    if (
      !Array.isArray(payload.items) ||
      payload.items.length < 1 ||
      payload.items.length > 30
    ) {
      return jsonError("请选择 1–30 件可申请的 Look。", 400);
    }

    const uniqueItems = payload.items.filter(
      (item, index, rows) =>
        typeof item.workId === "string" &&
        item.workId.length <= 120 &&
        rows.findIndex((candidate) => candidate.workId === item.workId) ===
          index,
    );
    if (uniqueItems.length !== payload.items.length) {
      return jsonError("Pull List 中存在无效或重复的 Look。", 400);
    }

    const lineup = await listShowroomWorks(showroom.id);
    const requestable = new Map(
      lineup
        .filter((item) => item.assignment.sampleStatus !== "unavailable")
        .map((item) => [item.work.id, item]),
    );
    if (
      uniqueItems.some(
        (item) => !requestable.has(item.workId as string),
      )
    ) {
      return jsonError("Pull List 中有 Look 已不再开放申请，请刷新后重试。", 409);
    }

    const db = await getDb();
    const duplicateWindow = new Date(Date.now() - 5 * 60_000).toISOString();
    const [duplicate] = await db
      .select({ referenceCode: showroomRequests.referenceCode })
      .from(showroomRequests)
      .where(
        and(
          eq(showroomRequests.showroomId, showroom.id),
          eq(showroomRequests.requesterEmail, requesterEmail),
          eq(showroomRequests.projectTitle, projectTitle),
          gte(showroomRequests.createdAt, duplicateWindow),
        ),
      )
      .limit(1);
    if (duplicate) {
      return Response.json(
        {
          referenceCode: duplicate.referenceCode,
          status: "submitted",
          duplicate: true,
        },
        {
          status: 200,
          headers: { "cache-control": "no-store" },
        },
      );
    }

    const requestId = crypto.randomUUID();
    const now = new Date().toISOString();
    const referenceCode = createReferenceCode(now);
    const values: NewShowroomRequest = {
      id: requestId,
      showroomId: showroom.id,
      referenceCode,
      requesterName,
      requesterEmail,
      organization,
      requesterRole,
      purpose,
      projectTitle,
      neededFrom,
      neededUntil,
      deliveryCity,
      notes,
      status: "submitted",
      consent: true,
      createdAt: now,
      updatedAt: now,
    };
    const itemValues: NewShowroomRequestItem[] = uniqueItems.map(
      (item, index) => {
        const lineupItem = requestable.get(item.workId as string);
        if (!lineupItem) {
          throw new Error("Request lineup changed during validation.");
        }
        return {
          id: crypto.randomUUID(),
          requestId,
          workId: lineupItem.work.id,
          workTitle: lineupItem.work.title,
          lookNumber: lineupItem.work.lookNumber,
          imageKey: lineupItem.work.imageKey,
          sampleStatus:
            lineupItem.assignment.sampleStatus === "available"
              ? "available"
              : "on_request",
          itemNote: cleanText(item.note, 500),
          sortOrder: index,
          createdAt: now,
        };
      },
    );

    await db.batch([
      db.insert(showroomRequests).values(values),
      db.insert(showroomRequestItems).values(itemValues),
    ]);

    return Response.json(
      {
        referenceCode,
        status: "submitted",
        submittedAt: now,
        itemCount: itemValues.length,
      },
      {
        status: 201,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(
      message.includes("UNIQUE")
        ? "请求编号冲突，请重新提交。"
        : message.includes("no such table")
          ? "会面回应功能正在初始化，请稍后再试。"
          : "暂时无法提交请求，请稍后再试。",
      500,
    );
  }
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? value
    : null;
}

function pickRole(value: unknown): ShowroomRequestRole | null {
  return typeof value === "string" &&
    SHOWROOM_REQUEST_ROLES.includes(value as ShowroomRequestRole)
    ? (value as ShowroomRequestRole)
    : null;
}

function pickPurpose(value: unknown): ShowroomRequestPurpose | null {
  return typeof value === "string" &&
    SHOWROOM_REQUEST_PURPOSES.includes(value as ShowroomRequestPurpose)
    ? (value as ShowroomRequestPurpose)
    : null;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function createReferenceCode(date: string) {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  )
    .join("")
    .toUpperCase();
  return `NR-${date.slice(2, 10).replaceAll("-", "")}-${suffix}`;
}

function jsonError(message: string, status: number) {
  return Response.json(
    { error: message },
    { status, headers: { "cache-control": "no-store" } },
  );
}
