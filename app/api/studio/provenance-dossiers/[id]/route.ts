import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  provenanceDossiers,
  type NewProvenanceDossier,
  type ProvenanceDossier,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanProvenanceText,
  normalizeProvenanceDate,
  provenanceApiError,
  provenanceSlug,
} from "@/lib/provenance-dossier-input";
import {
  getProvenanceDossier,
  listAllProvenanceDossierChecks,
  PROVENANCE_DOSSIER_DECISIONS,
  PROVENANCE_DOSSIER_STATUSES,
  provenanceDossierMissingFields,
  type ProvenanceDossierDecision,
  type ProvenanceDossierStatus,
} from "@/lib/provenance-dossiers";
import { getProductionAcceptance } from "@/lib/production-acceptances";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  status?: ProvenanceDossierStatus;
  decision?: ProvenanceDossierDecision;
  slug?: string;
  title?: string;
  subtitle?: string;
  designStory?: string;
  materialDisclosure?: string;
  makerDisclosure?: string;
  placeOfMaking?: string;
  madeAt?: string | null;
  careGuidance?: string;
  repairGuidance?: string;
  provenanceNote?: string;
  publicSummary?: string;
};

const transitions: Record<ProvenanceDossierStatus, ProvenanceDossierStatus[]> = {
  draft: ["draft", "in_review", "void"],
  in_review: ["in_review", "draft", "published", "void"],
  published: ["published", "retired"],
  retired: ["retired"],
  void: ["void"],
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const current = await getProvenanceDossier(id);
    if (!current) {
      return Response.json({ error: "溯源档案不存在。" }, { status: 404 });
    }
    const payload = (await request.json()) as UpdatePayload;
    if (["retired", "void"].includes(current.status)) {
      return Response.json(
        { error: "该档案版本已经冻结，不能改写。" },
        { status: 409 },
      );
    }
    if (
      current.status === "published" &&
      (payload.status !== "retired" || Object.keys(payload).some((key) => key !== "status"))
    ) {
      return Response.json(
        { error: "已发布版本不可原地改写；请仅将其退役，再建立新修订。" },
        { status: 409 },
      );
    }
    const update: Partial<NewProvenanceDossier> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;
    for (const [key, maxLength] of [
      ["title", 220],
      ["subtitle", 320],
      ["designStory", 6000],
      ["materialDisclosure", 6000],
      ["makerDisclosure", 3000],
      ["placeOfMaking", 300],
      ["careGuidance", 4000],
      ["repairGuidance", 4000],
      ["provenanceNote", 4000],
      ["publicSummary", 1000],
    ] as const) {
      if (payload[key] !== undefined) {
        update[key] = cleanProvenanceText(payload[key], maxLength);
        changed = true;
      }
    }
    if (payload.slug !== undefined) {
      const slug = provenanceSlug(payload.slug);
      if (!slug) {
        return Response.json({ error: "公开地址不能为空。" }, { status: 400 });
      }
      update.slug = slug;
      changed = true;
    }
    if (payload.madeAt !== undefined) {
      const madeAt = normalizeProvenanceDate(payload.madeAt);
      if (payload.madeAt && !madeAt) {
        return Response.json({ error: "完成日期无效。" }, { status: 400 });
      }
      update.madeAt = madeAt;
      changed = true;
    }
    if (payload.decision !== undefined) {
      if (!PROVENANCE_DOSSIER_DECISIONS.includes(payload.decision)) {
        return Response.json({ error: "档案决定无效。" }, { status: 400 });
      }
      update.decision = payload.decision;
      changed = true;
    }
    if (payload.status !== undefined) {
      if (!PROVENANCE_DOSSIER_STATUSES.includes(payload.status)) {
        return Response.json({ error: "档案状态无效。" }, { status: 400 });
      }
      if (!transitions[current.status].includes(payload.status)) {
        return Response.json(
          { error: "请按草稿、复核、发布的顺序推进档案。" },
          { status: 409 },
        );
      }
      update.status = payload.status;
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }

    const candidate = { ...current, ...update } as ProvenanceDossier;
    if (candidate.status === "published") {
      const [acceptance, checks] = await Promise.all([
        getProductionAcceptance(current.productionAcceptanceId),
        listAllProvenanceDossierChecks(),
      ]);
      if (
        !acceptance ||
        acceptance.status !== "accepted" ||
        !acceptance.acceptanceSeal
      ) {
        return Response.json(
          { error: "来源 NERA-ACCEPT 已失效，不能发布。" },
          { status: 409 },
        );
      }
      if (candidate.decision !== "publish") {
        return Response.json(
          { error: "只有明确的人工“发布”决定可以公开档案。" },
          { status: 409 },
        );
      }
      const missing = provenanceDossierMissingFields(candidate);
      if (missing.length > 0) {
        return Response.json(
          { error: `发布前仍需补齐：${missing.join("、")}。` },
          { status: 409 },
        );
      }
      const critical = checks.filter(
        (check) => check.provenanceDossierId === id && check.critical,
      );
      if (critical.length < 6 || critical.some((check) => check.result !== "pass")) {
        return Response.json(
          { error: "六项公开核对尚未全部通过。" },
          { status: 409 },
        );
      }
      const nowIso = new Date().toISOString();
      update.reviewedBy = auth.user.email;
      update.reviewedAt = nowIso;
      update.publishedBy = auth.user.email;
      update.publishedAt = nowIso;
    } else if (candidate.status === "in_review" && current.status !== "in_review") {
      update.reviewedBy = auth.user.email;
      update.reviewedAt = new Date().toISOString();
    } else if (candidate.status === "retired") {
      update.retiredAt = new Date().toISOString();
    }

    const db = await getDb();
    const [dossier] = await db
      .update(provenanceDossiers)
      .set(update)
      .where(eq(provenanceDossiers.id, id))
      .returning();
    return Response.json({ dossier });
  } catch (error) {
    return provenanceApiError(error, "保存溯源档案失败，请稍后重试。");
  }
}
