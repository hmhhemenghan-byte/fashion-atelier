import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { conservationReports, type ConservationReport } from "@/db/schema";
import type { PublicArchiveAdapter } from "../types";

export type PublicConservationDTO = {
  id: string;
  reportCode: string;
  sampleAssetId: string;
  workId: string | null;
  sequence: number;
  status: "approved" | "closed";
  overallCondition: string;
  conditionSummary: string;
  proposedTreatment: string;
  handlingRestriction: string;
  storageGuidance: string;
  environmentalNotes: string;
  assessedAt: string | null;
  assessmentLocation: string;
  approvedAt: string | null;
  createdAt: string;
  href: string;
};

export class ConservationPublicAdapter
  implements PublicArchiveAdapter<ConservationReport, PublicConservationDTO>
{
  type = "conservation" as const;

  async loadPublishable(
    sourceId: string,
  ): Promise<PublicConservationDTO | null> {
    const db = await getDb();
    const [record] = await db
      .select()
      .from(conservationReports)
      .where(eq(conservationReports.id, sourceId))
      .limit(1);

    if (!record || !["approved", "closed"].includes(record.status)) {
      return null;
    }

    return this.toPublicDocument(record);
  }

  toPublicDocument(source: ConservationReport): PublicConservationDTO {
    const status = source.status as "approved" | "closed";
    return {
      id: source.id,
      reportCode: source.reportCode,
      sampleAssetId: source.sampleAssetId,
      workId: source.workId,
      sequence: source.sequence,
      status: ["approved", "closed"].includes(status) ? status : "approved",
      overallCondition: source.overallCondition,
      conditionSummary: source.conditionSummary,
      proposedTreatment: source.proposedTreatment,
      handlingRestriction: source.handlingRestriction,
      storageGuidance: source.storageGuidance,
      environmentalNotes: source.environmentalNotes,
      assessedAt: source.assessedAt,
      assessmentLocation: source.assessmentLocation,
      approvedAt: source.approvedAt,
      createdAt: source.createdAt,
      href: `/conservation/${encodeURIComponent(source.reportCode)}`,
    };
  }
}

export const conservationPublicAdapter = new ConservationPublicAdapter();
