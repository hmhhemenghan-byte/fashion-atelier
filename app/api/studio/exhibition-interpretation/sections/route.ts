import { getDb } from "@/db";
import { interpretationSections, type NewInterpretationSection } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { getInterpretationPackage, listAllInterpretationSections } from "@/lib/exhibition-interpretation";
import { cleanInterpretationText, interpretationApiError, normalizeInterpretationInteger } from "@/lib/exhibition-interpretation-input";

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError;
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const payload = (await request.json()) as { interpretationPackageId?: string; titlePrimary?: string; sequence?: number | string };
    const packageId = cleanInterpretationText(payload.interpretationPackageId, 120); const item = await getInterpretationPackage(packageId);
    if (!item) return Response.json({ error: "展览释读包不存在。" }, { status: 404 });
    if (["approved", "closed", "void"].includes(item.status)) return Response.json({ error: "该释读包已经冻结。" }, { status: 409 });
    const existing = await listAllInterpretationSections(); const now = new Date().toISOString();
    const values: NewInterpretationSection = { id: crypto.randomUUID(), interpretationPackageId: packageId, sequence: normalizeInterpretationInteger(payload.sequence, existing.filter((section) => section.interpretationPackageId === packageId).length + 1), titlePrimary: cleanInterpretationText(payload.titlePrimary, 500), titleSecondary: "", bodyPrimary: "", bodySecondary: "", createdBy: auth.user.email, createdAt: now, updatedAt: now };
    const db = await getDb(); await db.insert(interpretationSections).values(values);
    return Response.json({ section: values }, { status: 201 });
  } catch (error) { return interpretationApiError(error, "新增叙事章节失败，请稍后重试。"); }
}
