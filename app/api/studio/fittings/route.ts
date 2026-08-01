import { getDb } from "@/db";
import {
  fittingSessions,
  type NewFittingSession,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanFittingText,
  fittingApiError,
  fittingCode,
  normalizeFittingDateTime,
} from "@/lib/fitting-input";
import {
  buildFittingOverview,
  fittingImagesToCsv,
  fittingIssuesToCsv,
  fittingSessionsToCsv,
  listAllFittingSessions,
} from "@/lib/fittings";
import { getTechnicalPack } from "@/lib/technical-packs";
import { getWorkById } from "@/lib/works";

export const dynamic = "force-dynamic";

type CreatePayload = {
  technicalPackId?: string;
  sampleSize?: string;
  fittingAt?: string | null;
  location?: string;
  fitModelReference?: string;
  objective?: string;
  notes?: string;
};

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const overview = await buildFittingOverview();
    const format = new URL(request.url).searchParams.get("format");
    const date = new Date().toISOString().slice(0, 10);
    if (format === "sessions") {
      return csvResponse(
        fittingSessionsToCsv(overview),
        `nera-fitting-sessions-${date}.csv`,
      );
    }
    if (format === "issues") {
      return csvResponse(
        fittingIssuesToCsv(overview),
        `nera-fitting-issues-${date}.csv`,
      );
    }
    if (format === "images") {
      return csvResponse(
        fittingImagesToCsv(overview),
        `nera-fitting-evidence-${date}.csv`,
      );
    }
    if (format === "json") {
      return new Response(JSON.stringify(overview, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="nera-fitting-room-${date}.json"`,
          "cache-control": "private, no-store",
        },
      });
    }
    return Response.json(
      { overview },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return fittingApiError(error, "无法读取试身审版室，请稍后重试。");
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as CreatePayload;
    const technicalPackId = cleanFittingText(
      payload.technicalPackId,
      120,
    );
    if (!technicalPackId) {
      return Response.json({ error: "请选择对应技术包。" }, { status: 400 });
    }
    const pack = await getTechnicalPack(technicalPackId);
    if (!pack) {
      return Response.json({ error: "技术包不存在。" }, { status: 404 });
    }
    const work = await getWorkById(pack.workId);
    if (!work) {
      return Response.json({ error: "对应 Look 不存在。" }, { status: 404 });
    }
    const fittingAt = normalizeFittingDateTime(payload.fittingAt);
    if (payload.fittingAt && !fittingAt) {
      return Response.json({ error: "试身时间无效。" }, { status: 400 });
    }
    const sessions = await listAllFittingSessions();
    const round =
      sessions
        .filter((session) => session.technicalPackId === technicalPackId)
        .reduce((latest, session) => Math.max(latest, session.round), 0) + 1;
    const now = new Date();
    const timestamp = now.toISOString();
    const values: NewFittingSession = {
      id: crypto.randomUUID(),
      fittingCode: fittingCode(work.lookNumber, round, now),
      technicalPackId,
      workId: work.id,
      round,
      status: "planned",
      decision: "pending",
      sampleSize:
        cleanFittingText(payload.sampleSize, 80) || pack.baseSize,
      fittingAt,
      location: cleanFittingText(payload.location, 240),
      fitModelReference: cleanFittingText(
        payload.fitModelReference,
        180,
      ),
      objective: cleanFittingText(payload.objective, 2000),
      balanceNotes: "",
      silhouetteNotes: "",
      movementNotes: "",
      comfortNotes: "",
      conclusion: "",
      nextFittingAt: null,
      approvalNote: "",
      approvedBy: "",
      approvedAt: null,
      notes: cleanFittingText(payload.notes, 4000),
      createdBy: auth.user.email,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const db = await getDb();
    const [session] = await db
      .insert(fittingSessions)
      .values(values)
      .returning();
    return Response.json({ session }, { status: 201 });
  } catch (error) {
    return fittingApiError(error, "建立试身场次失败，请稍后重试。");
  }
}

function csvResponse(body: string, filename: string) {
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
