import { getDb } from "@/db";
import { interpretationLabels, interpretationPackages, type NewInterpretationLabel, type NewInterpretationPackage } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { buildCuratorialOverview } from "@/lib/archive-curation";
import { buildInterpretationOverview, interpretationLabelsToCsv, interpretationPackagesToCsv, interpretationSectionsToCsv, listAllInterpretationPackages } from "@/lib/exhibition-interpretation";
import { cleanInterpretationText, interpretationApiError, interpretationPackageCode } from "@/lib/exhibition-interpretation-input";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const overview = await buildInterpretationOverview();
    const format = new URL(request.url).searchParams.get("format");
    const date = new Date().toISOString().slice(0, 10);
    if (format === "packages") return csvResponse(interpretationPackagesToCsv(overview), `nera-interpretation-packages-${date}.csv`);
    if (format === "sections") return csvResponse(interpretationSectionsToCsv(overview), `nera-interpretation-sections-${date}.csv`);
    if (format === "labels") return csvResponse(interpretationLabelsToCsv(overview), `nera-interpretation-labels-${date}.csv`);
    if (format === "json") return new Response(JSON.stringify(overview, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="nera-exhibition-interpretation-${date}.json"`, "cache-control": "private, no-store" } });
    return Response.json({ overview }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return interpretationApiError(error, "无法读取展览释读室，请稍后重试。"); }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError;
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const payload = (await request.json()) as { curatorialProjectId?: string; editor?: string; primaryLanguage?: string; secondaryLanguage?: string };
    const curatorialProjectId = cleanInterpretationText(payload.curatorialProjectId, 120);
    const editor = cleanInterpretationText(payload.editor, 500);
    const primaryLanguage = cleanInterpretationText(payload.primaryLanguage, 40) || "zh-CN";
    const secondaryLanguage = cleanInterpretationText(payload.secondaryLanguage, 40);
    if (!curatorialProjectId || !editor) return Response.json({ error: "请选择已批准策展项目并填写文字负责人。" }, { status: 400 });
    const [curation, existing] = await Promise.all([buildCuratorialOverview(), listAllInterpretationPackages()]);
    const projectWorkspace = curation.projects.find((item) => item.project.id === curatorialProjectId);
    if (!projectWorkspace) return Response.json({ error: "策展项目不存在。" }, { status: 404 });
    if (!["approved", "closed"].includes(projectWorkspace.project.status)) return Response.json({ error: "只能从已批准或已关闭的冻结策展项目建立释读包。" }, { status: 409 });
    const included = projectWorkspace.selections.filter((item) => item.decision === "include");
    if (included.length === 0) return Response.json({ error: "冻结策展项目没有纳入作品。" }, { status: 409 });
    const revision = Math.max(0, ...existing.filter((item) => item.curatorialProjectId === curatorialProjectId).map((item) => item.revision)) + 1;
    const now = new Date(); const nowIso = now.toISOString(); const id = crypto.randomUUID();
    const values: NewInterpretationPackage = {
      id, packageCode: interpretationPackageCode(now, revision), curatorialProjectId, revision,
      status: "draft", decision: "pending", editor, primaryLanguage, secondaryLanguage,
      title: projectWorkspace.project.title, subtitle: "", entranceText: "", curatorialCredit: projectWorkspace.project.curator,
      acknowledgement: "", accessibilityNote: "", rightsNote: "", approvalNote: "", approvedBy: "", approvedAt: null, closedAt: null,
      createdBy: auth.user.email, createdAt: nowIso, updatedAt: nowIso,
    };
    const labels: NewInterpretationLabel[] = included.map((selection, index) => ({
      id: crypto.randomUUID(), interpretationPackageId: id, curatorialSelectionId: selection.id,
      sequence: selection.sequence || index + 1, headline: selection.asset?.workTitle ?? "", bodyPrimary: "", bodySecondary: "",
      objectFacts: [selection.asset?.lookNumber, selection.asset?.sizeLabel, selection.asset?.colorLabel].filter(Boolean).join(" · "),
      creditLine: "NÉRA ATELIER", accessibilityText: "", sourceNote: selection.rationale, rightsStatus: "unchecked",
      createdBy: auth.user.email, createdAt: nowIso, updatedAt: nowIso,
    }));
    const db = await getDb();
    await db.batch([db.insert(interpretationPackages).values(values), db.insert(interpretationLabels).values(labels)]);
    return Response.json({ package: values }, { status: 201 });
  } catch (error) { return interpretationApiError(error, "建立展览释读包失败，请稍后重试。"); }
}

function csvResponse(body: string, filename: string) {
  return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" } });
}
