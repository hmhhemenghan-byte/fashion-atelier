import { getDb } from "@/db";
import {
  sampleCommunications,
  type NewSampleCommunication,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  listAllSampleCommunications,
  SAMPLE_COMMUNICATION_CHANNELS,
  SAMPLE_COMMUNICATION_DIRECTIONS,
  SAMPLE_COMMUNICATION_KINDS,
  SAMPLE_COMMUNICATION_STATUSES,
  sampleCorrespondenceToCsv,
  type SampleCommunicationChannel,
  type SampleCommunicationDirection,
  type SampleCommunicationKind,
  type SampleCommunicationStatus,
} from "@/lib/sample-correspondence";
import {
  getSampleLoanWorkspace,
  listSampleLoanWorkspaces,
} from "@/lib/sample-loans";

export const dynamic = "force-dynamic";

type CreatePayload = {
  loanId?: string;
  kind?: SampleCommunicationKind;
  channel?: SampleCommunicationChannel;
  direction?: SampleCommunicationDirection;
  status?: SampleCommunicationStatus;
  recipientName?: string;
  recipientAddress?: string;
  subject?: string;
  body?: string;
  followUpAt?: string | null;
  occurredAt?: string | null;
};

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const [loans, communications] = await Promise.all([
      listSampleLoanWorkspaces(),
      listAllSampleCommunications(),
    ]);
    if (new URL(request.url).searchParams.get("format") === "csv") {
      const date = new Date().toISOString().slice(0, 10);
      return new Response(sampleCorrespondenceToCsv(communications, loans), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="nera-sample-correspondence-${date}.csv"`,
          "cache-control": "private, no-store",
        },
      });
    }
    return Response.json(
      { loans, communications },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return correspondenceError(
      error,
      "无法读取样衣沟通台账，请稍后重试。",
    );
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as CreatePayload;
    const loanId = cleanText(payload.loanId, 120);
    if (!loanId || !(await getSampleLoanWorkspace(loanId))) {
      return Response.json(
        { error: "请选择有效的样衣借调单。" },
        { status: 400 },
      );
    }

    const kind = payload.kind ?? "custom";
    const channel = payload.channel ?? "email";
    const direction = payload.direction ?? "outbound";
    const status = payload.status ?? "draft";
    if (!SAMPLE_COMMUNICATION_KINDS.includes(kind)) {
      return Response.json({ error: "沟通类型无效。" }, { status: 400 });
    }
    if (!SAMPLE_COMMUNICATION_CHANNELS.includes(channel)) {
      return Response.json({ error: "沟通渠道无效。" }, { status: 400 });
    }
    if (!SAMPLE_COMMUNICATION_DIRECTIONS.includes(direction)) {
      return Response.json({ error: "沟通方向无效。" }, { status: 400 });
    }
    if (!SAMPLE_COMMUNICATION_STATUSES.includes(status)) {
      return Response.json({ error: "沟通状态无效。" }, { status: 400 });
    }

    const subject = cleanText(payload.subject, 240);
    const body = cleanText(payload.body, 6000);
    if (!subject || !body) {
      return Response.json(
        { error: "请填写沟通主题和正文。" },
        { status: 400 },
      );
    }

    const followUpAt = normalizeDate(payload.followUpAt);
    if (payload.followUpAt && !followUpAt) {
      return Response.json(
        { error: "请输入有效的跟进日期。" },
        { status: 400 },
      );
    }
    const explicitOccurredAt = normalizeDateTime(payload.occurredAt);
    if (payload.occurredAt && !explicitOccurredAt) {
      return Response.json(
        { error: "请输入有效的沟通时间。" },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const values: NewSampleCommunication = {
      id: crypto.randomUUID(),
      loanId,
      kind,
      channel,
      direction,
      status,
      recipientName: cleanText(payload.recipientName, 180),
      recipientAddress: cleanText(payload.recipientAddress, 320),
      subject,
      body,
      followUpAt,
      occurredAt:
        explicitOccurredAt ?? (status === "draft" ? null : now),
      resolvedAt: status === "resolved" ? now : null,
      createdBy: auth.user.email,
      createdAt: now,
      updatedAt: now,
    };

    const db = await getDb();
    const [communication] = await db
      .insert(sampleCommunications)
      .values(values)
      .returning();
    return Response.json({ communication }, { status: 201 });
  } catch (error) {
    return correspondenceError(
      error,
      "保存样衣沟通记录失败，请稍后重试。",
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

function normalizeDateTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function correspondenceError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  return Response.json(
    {
      error: message.includes("no such table")
        ? "样衣沟通数据库尚未初始化，请完成新版部署后再试。"
        : fallback,
    },
    { status: 500 },
  );
}
