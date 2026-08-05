import { getDb } from "@/db";
import { curatorialSelections, type NewCuratorialSelection } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { getCuratorialProject, listAllCuratorialSelections } from "@/lib/archive-curation";
import { cleanCurationText, curationApiError, curationInteger } from "@/lib/archive-curation-input";
import { getSampleAsset } from "@/lib/sample-inventory";

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError;
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const payload = (await request.json()) as { curatorialProjectId?: string; sampleAssetId?: string; sequence?: number | string };
    const projectId = cleanCurationText(payload.curatorialProjectId, 120); const assetId = cleanCurationText(payload.sampleAssetId, 120);
    const [project, asset] = await Promise.all([getCuratorialProject(projectId), getSampleAsset(assetId)]);
    if (!project) return Response.json({ error: "策展项目不存在。" }, { status: 404 });
    if (!asset) return Response.json({ error: "实物档案不存在。" }, { status: 404 });
    if (["approved", "closed", "void"].includes(project.status)) return Response.json({ error: "该策展选择已经冻结。" }, { status: 409 });
    const existing = await listAllCuratorialSelections();
    if (existing.some((item) => item.curatorialProjectId === project.id && item.sampleAssetId === asset.id)) return Response.json({ error: "该实物已在当前策展项目中。" }, { status: 409 });
    const now = new Date().toISOString();
    const values: NewCuratorialSelection = { id: crypto.randomUUID(), curatorialProjectId: project.id, sampleAssetId: asset.id, decision: "proposed", role: "dialogue", sequence: curationInteger(payload.sequence, existing.filter((item) => item.curatorialProjectId === project.id).length + 1), rationale: "", displayIntent: "", conservationNote: "", createdBy: auth.user.email, createdAt: now, updatedAt: now };
    const db = await getDb(); await db.insert(curatorialSelections).values(values);
    return Response.json({ selection: values }, { status: 201 });
  } catch (error) { return curationApiError(error, "加入策展选择失败，请稍后重试。"); }
}
