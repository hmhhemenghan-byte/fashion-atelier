import { getDb } from "@/db";
import {
  provenanceDossierChecks,
  provenanceDossiers,
  type NewProvenanceDossier,
  type NewProvenanceDossierCheck,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanProvenanceText,
  provenanceApiError,
  provenanceDossierCode,
  provenanceSlug,
} from "@/lib/provenance-dossier-input";
import {
  buildProvenanceDossierOverview,
  DEFAULT_PROVENANCE_DOSSIER_CHECKS,
  listAllProvenanceDossiers,
  provenanceDossierChecksToCsv,
  provenanceDossiersToCsv,
} from "@/lib/provenance-dossiers";
import { getProductionAcceptance } from "@/lib/production-acceptances";
import { getWorkById } from "@/lib/works";

export const dynamic = "force-dynamic";

type CreatePayload = {
  productionAcceptanceId?: string;
  title?: string;
  subtitle?: string;
};

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const overview = await buildProvenanceDossierOverview();
    const format = new URL(request.url).searchParams.get("format");
    const date = new Date().toISOString().slice(0, 10);
    if (format === "dossiers") {
      return csvResponse(
        provenanceDossiersToCsv(overview),
        `nera-provenance-dossiers-${date}.csv`,
      );
    }
    if (format === "checks") {
      return csvResponse(
        provenanceDossierChecksToCsv(overview),
        `nera-provenance-checks-${date}.csv`,
      );
    }
    if (format === "json") {
      return new Response(JSON.stringify(overview, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="nera-provenance-dossiers-${date}.json"`,
          "cache-control": "private, no-store",
        },
      });
    }
    return Response.json(
      { overview },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return provenanceApiError(error, "无法读取成衣溯源档案，请稍后重试。");
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const payload = (await request.json()) as CreatePayload;
    const productionAcceptanceId = cleanProvenanceText(
      payload.productionAcceptanceId,
      120,
    );
    if (!productionAcceptanceId) {
      return Response.json(
        { error: "请选择已经通过 NERA-ACCEPT 的实物版本。" },
        { status: 400 },
      );
    }
    const acceptance = await getProductionAcceptance(productionAcceptanceId);
    if (
      !acceptance ||
      acceptance.status !== "accepted" ||
      !acceptance.acceptanceSeal
    ) {
      return Response.json(
        { error: "只有已签署 NERA-ACCEPT 的实物版本可以建立公开溯源档案。" },
        { status: 409 },
      );
    }
    const work = await getWorkById(acceptance.workId);
    if (!work) {
      return Response.json({ error: "对应作品不存在。" }, { status: 404 });
    }
    const all = await listAllProvenanceDossiers();
    const revision =
      all
        .filter((item) => item.productionAcceptanceId === acceptance.id)
        .reduce((latest, item) => Math.max(latest, item.revision), 0) + 1;
    const now = new Date();
    const nowIso = now.toISOString();
    const id = crypto.randomUUID();
    const slugBase = provenanceSlug(
      `${work.lookNumber}-${work.title}-r${revision}`,
    );
    const slug = `${slugBase || "provenance"}-${id.slice(0, 6)}`;
    const values: NewProvenanceDossier = {
      id,
      dossierCode: provenanceDossierCode(work.lookNumber, revision, now),
      slug,
      productionAcceptanceId: acceptance.id,
      workId: work.id,
      revision,
      status: "draft",
      decision: "pending",
      title: cleanProvenanceText(payload.title, 220) || work.title,
      subtitle: cleanProvenanceText(payload.subtitle, 320),
      designStory: work.description,
      materialDisclosure: "",
      makerDisclosure: "",
      placeOfMaking: "",
      madeAt: null,
      careGuidance: "",
      repairGuidance: "",
      provenanceNote: `来源验收：${acceptance.acceptanceSeal}`,
      publicSummary: work.description,
      reviewedBy: "",
      reviewedAt: null,
      publishedBy: "",
      publishedAt: null,
      retiredAt: null,
      createdBy: auth.user.email,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const checks: NewProvenanceDossierCheck[] =
      DEFAULT_PROVENANCE_DOSSIER_CHECKS.map((check, index) => ({
        id: crypto.randomUUID(),
        provenanceDossierId: id,
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
      db.insert(provenanceDossiers).values(values),
      db.insert(provenanceDossierChecks).values(checks),
    ]);
    return Response.json({ dossier: values }, { status: 201 });
  } catch (error) {
    return provenanceApiError(error, "建立溯源档案失败，请稍后重试。");
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
