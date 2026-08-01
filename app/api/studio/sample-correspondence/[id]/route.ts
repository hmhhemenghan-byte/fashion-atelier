import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  sampleCommunications,
  type NewSampleCommunication,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  getSampleCommunication,
  SAMPLE_COMMUNICATION_CHANNELS,
  SAMPLE_COMMUNICATION_DIRECTIONS,
  SAMPLE_COMMUNICATION_KINDS,
  SAMPLE_COMMUNICATION_STATUSES,
  type SampleCommunicationChannel,
  type SampleCommunicationDirection,
  type SampleCommunicationKind,
  type SampleCommunicationStatus,
} from "@/lib/sample-correspondence";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
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

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getSampleCommunication(id);
    if (!current) {
      return Response.json(
        { error: "沟通记录不存在。" },
        { status: 404 },
      );
    }

    const payload = (await request.json()) as UpdatePayload;
    const now = new Date().toISOString();
    const update: Partial<NewSampleCommunication> = { updatedAt: now };
    let changed = false;

    if (payload.kind !== undefined) {
      if (!SAMPLE_COMMUNICATION_KINDS.includes(payload.kind)) {
        return Response.json({ error: "沟通类型无效。" }, { status: 400 });
      }
      update.kind = payload.kind;
      changed = true;
    }
    if (payload.channel !== undefined) {
      if (!SAMPLE_COMMUNICATION_CHANNELS.includes(payload.channel)) {
        return Response.json({ error: "沟通渠道无效。" }, { status: 400 });
      }
      update.channel = payload.channel;
      changed = true;
    }
    if (payload.direction !== undefined) {
      if (!SAMPLE_COMMUNICATION_DIRECTIONS.includes(payload.direction)) {
        return Response.json({ error: "沟通方向无效。" }, { status: 400 });
      }
      update.direction = payload.direction;
      changed = true;
    }
    if (payload.status !== undefined) {
      if (!SAMPLE_COMMUNICATION_STATUSES.includes(payload.status)) {
        return Response.json({ error: "沟通状态无效。" }, { status: 400 });
      }
      update.status = payload.status;
      if (payload.status !== "draft" && !current.occurredAt) {
        update.occurredAt = now;
      }
      update.resolvedAt = payload.status === "resolved" ? now : null;
      changed = true;
    }

    for (const field of [
      ["recipientName", 180],
      ["recipientAddress", 320],
      ["subject", 240],
      ["body", 6000],
    ] as const) {
      const [key, maxLength] = field;
      if (payload[key] !== undefined) {
        const value = cleanText(payload[key], maxLength);
        if ((key === "subject" || key === "body") && !value) {
          return Response.json(
            { error: "沟通主题和正文不能为空。" },
            { status: 400 },
          );
        }
        update[key] = value;
        changed = true;
      }
    }

    if (payload.followUpAt !== undefined) {
      const value = normalizeDate(payload.followUpAt);
      if (payload.followUpAt && !value) {
        return Response.json(
          { error: "请输入有效的跟进日期。" },
          { status: 400 },
        );
      }
      update.followUpAt = value;
      changed = true;
    }
    if (payload.occurredAt !== undefined) {
      const value = normalizeDateTime(payload.occurredAt);
      if (payload.occurredAt && !value) {
        return Response.json(
          { error: "请输入有效的沟通时间。" },
          { status: 400 },
        );
      }
      update.occurredAt = value;
      changed = true;
    }
    if (!changed) {
      return Response.json(
        { error: "没有可保存的修改。" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const [communication] = await db
      .update(sampleCommunications)
      .set(update)
      .where(eq(sampleCommunications.id, id))
      .returning();
    return Response.json({ communication });
  } catch {
    return Response.json(
      { error: "更新样衣沟通记录失败，请稍后重试。" },
      { status: 500 },
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
