import { getDb } from "@/db";
import {
  sampleSignoffChecks,
  sampleSignoffs,
  type NewSampleSignoff,
  type NewSampleSignoffCheck,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  getFittingSession,
  listAllFittingSessions,
} from "@/lib/fittings";
import {
  cleanSampleSignoffText,
  normalizeSampleSignoffDateTime,
  sampleSignoffApiError,
  sampleSignoffCode,
} from "@/lib/sample-signoff-input";
import {
  buildSampleSignoffOverview,
  DEFAULT_SAMPLE_SIGNOFF_CHECKS,
  listAllSampleSignoffs,
  SAMPLE_SIGNOFF_TYPES,
  sampleSignoffChecksToCsv,
  sampleSignoffImagesToCsv,
  sampleSignoffsToCsv,
  type SampleSignoffType,
} from "@/lib/sample-signoffs";
import { getTechnicalPack } from "@/lib/technical-packs";
import { getWorkById } from "@/lib/works";

export const dynamic = "force-dynamic";

type CreatePayload = {
  technicalPackId?: string;
  fittingSessionId?: string;
  sampleType?: SampleSignoffType;
  sampleSize?: string;
  makerReference?: string;
  receivedAt?: string | null;
  physicalLocation?: string;
  notes?: string;
};

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const overview = await buildSampleSignoffOverview();
    const format = new URL(request.url).searchParams.get("format");
    const date = new Date().toISOString().slice(0, 10);
    if (format === "signoffs") {
      return csvResponse(
        sampleSignoffsToCsv(overview),
        `nera-sample-signoffs-${date}.csv`,
      );
    }
    if (format === "checks") {
      return csvResponse(
        sampleSignoffChecksToCsv(overview),
        `nera-sample-signoff-checks-${date}.csv`,
      );
    }
    if (format === "images") {
      return csvResponse(
        sampleSignoffImagesToCsv(overview),
        `nera-sample-signoff-evidence-${date}.csv`,
      );
    }
    if (format === "json") {
      return new Response(JSON.stringify(overview, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="nera-final-sample-gate-${date}.json"`,
          "cache-control": "private, no-store",
        },
      });
    }
    return Response.json(
      { overview },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return sampleSignoffApiError(
      error,
      "无法读取封样签核台，请稍后重试。",
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
    const technicalPackId = cleanSampleSignoffText(
      payload.technicalPackId,
      120,
    );
    const fittingSessionId = cleanSampleSignoffText(
      payload.fittingSessionId,
      120,
    );
    if (!technicalPackId || !fittingSessionId) {
      return Response.json(
        { error: "请选择已批准技术包与其最新批准试身。" },
        { status: 400 },
      );
    }
    const [pack, fitting] = await Promise.all([
      getTechnicalPack(technicalPackId),
      getFittingSession(fittingSessionId),
    ]);
    if (!pack) {
      return Response.json({ error: "技术包不存在。" }, { status: 404 });
    }
    if (!["approved", "locked"].includes(pack.status)) {
      return Response.json(
        { error: "技术包批准或锁定后，才能进入封样签核。" },
        { status: 409 },
      );
    }
    if (
      !fitting ||
      fitting.technicalPackId !== pack.id ||
      !["approved", "closed"].includes(fitting.status) ||
      fitting.decision !== "approve"
    ) {
      return Response.json(
        { error: "请选择该技术包已批准的试身结论。" },
        { status: 409 },
      );
    }
    const allFittings = await listAllFittingSessions();
    const latestFitting = allFittings
      .filter((session) => session.technicalPackId === pack.id)
      .sort(
        (left, right) =>
          right.round - left.round ||
          timestamp(right.updatedAt) - timestamp(left.updatedAt),
      )[0];
    if (!latestFitting || latestFitting.id !== fitting.id) {
      return Response.json(
        { error: "封样必须引用该技术包的最新试身轮次。" },
        { status: 409 },
      );
    }
    const work = await getWorkById(pack.workId);
    if (!work) {
      return Response.json({ error: "对应 Look 不存在。" }, { status: 404 });
    }
    const sampleType =
      payload.sampleType === undefined
        ? "preproduction"
        : payload.sampleType;
    if (!SAMPLE_SIGNOFF_TYPES.includes(sampleType)) {
      return Response.json({ error: "样衣类型无效。" }, { status: 400 });
    }
    const receivedAt = normalizeSampleSignoffDateTime(payload.receivedAt);
    if (payload.receivedAt && !receivedAt) {
      return Response.json({ error: "收样时间无效。" }, { status: 400 });
    }
    const existing = await listAllSampleSignoffs();
    const round =
      existing
        .filter((signoff) => signoff.technicalPackId === pack.id)
        .reduce((latest, signoff) => Math.max(latest, signoff.round), 0) + 1;
    const now = new Date();
    const nowIso = now.toISOString();
    const signoffId = crypto.randomUUID();
    const values: NewSampleSignoff = {
      id: signoffId,
      signoffCode: sampleSignoffCode(work.lookNumber, round, now),
      technicalPackId: pack.id,
      fittingSessionId: fitting.id,
      workId: work.id,
      round,
      sampleType,
      status: "draft",
      decision: "pending",
      sampleSize:
        cleanSampleSignoffText(payload.sampleSize, 80) ||
        fitting.sampleSize ||
        pack.baseSize,
      makerReference: cleanSampleSignoffText(payload.makerReference, 180),
      receivedAt,
      reviewedAt: null,
      physicalLocation: cleanSampleSignoffText(
        payload.physicalLocation,
        240,
      ),
      materialLotReference: "",
      colorStandardReference: "",
      overallObservation: "",
      approvalNote: "",
      approvedBy: "",
      approvedAt: null,
      sealCode: null,
      sealedAt: null,
      notes: cleanSampleSignoffText(payload.notes, 4000),
      createdBy: auth.user.email,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const checks: NewSampleSignoffCheck[] =
      DEFAULT_SAMPLE_SIGNOFF_CHECKS.map((check, index) => ({
        id: crypto.randomUUID(),
        sampleSignoffId: signoffId,
        category: check.category,
        title: check.title,
        requirement: check.requirement,
        result: "pending",
        observation: "",
        critical: true,
        sortOrder: index,
        createdBy: auth.user.email,
        createdAt: nowIso,
        updatedAt: nowIso,
      }));
    const db = await getDb();
    await db.batch([
      db.insert(sampleSignoffs).values(values),
      db.insert(sampleSignoffChecks).values(checks),
    ]);
    return Response.json({ signoff: values }, { status: 201 });
  } catch (error) {
    return sampleSignoffApiError(
      error,
      "建立封样签核失败，请稍后重试。",
    );
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

function timestamp(value: string | null): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}
