import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { technicalPacks, works, type TechnicalPack } from "@/db/schema";
import { mediaUrl } from "@/lib/works";
import type { PublicArchiveAdapter } from "../types";

export type PublicTechnicalPackDTO = {
  id: string;
  techPackCode: string;
  workId: string;
  revision: number;
  status: "approved" | "locked";
  sampleStage: string;
  baseSize: string;
  unit: string;
  fitIntent: string;
  patternReference: string;
  constructionSummary: string;
  gradingNotes: string;
  finishingNotes: string;
  labelNotes: string;
  packagingNotes: string;
  sketchImageUrl: string | null;
  sketchAltText: string;
  approvedAt: string | null;
  createdAt: string;
  href: string;
};

export class TechnicalPackPublicAdapter
  implements PublicArchiveAdapter<TechnicalPack, PublicTechnicalPackDTO>
{
  type = "technical" as const;

  async loadPublishable(sourceId: string): Promise<PublicTechnicalPackDTO | null> {
    const db = await getDb();
    const [record] = await db
      .select()
      .from(technicalPacks)
      .where(eq(technicalPacks.id, sourceId))
      .limit(1);

    if (!record || !["approved", "locked"].includes(record.status)) {
      return null;
    }

    // Verify linked work exists and is published
    const [linkedWork] = await db
      .select()
      .from(works)
      .where(eq(works.id, record.workId))
      .limit(1);

    if (!linkedWork || linkedWork.status !== "published") {
      return null;
    }

    return this.toPublicDocument(record);
  }

  toPublicDocument(source: TechnicalPack): PublicTechnicalPackDTO {
    const status = source.status as "approved" | "locked";
    return {
      id: source.id,
      techPackCode: source.techPackCode,
      workId: source.workId,
      revision: source.revision,
      status: ["approved", "locked"].includes(status) ? status : "approved",
      sampleStage: source.sampleStage,
      baseSize: source.baseSize,
      unit: source.unit,
      fitIntent: source.fitIntent,
      patternReference: source.patternReference,
      constructionSummary: source.constructionSummary,
      gradingNotes: source.gradingNotes,
      finishingNotes: source.finishingNotes,
      labelNotes: source.labelNotes,
      packagingNotes: source.packagingNotes,
      sketchImageUrl: source.sketchImageKey
        ? mediaUrl(source.sketchImageKey)
        : null,
      sketchAltText: source.sketchAltText,
      approvedAt: source.approvedAt,
      createdAt: source.createdAt,
      href: `/technical-packs/${encodeURIComponent(source.techPackCode)}`,
    };
  }
}

export const technicalPackPublicAdapter = new TechnicalPackPublicAdapter();
