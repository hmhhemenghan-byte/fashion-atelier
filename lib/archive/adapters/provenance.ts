import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  productionAcceptances,
  provenanceDossiers,
  works,
  type ProvenanceDossier,
} from "@/db/schema";
import type { PublicArchiveAdapter } from "../types";

export type PublicProvenanceDTO = {
  id: string;
  dossierCode: string;
  slug: string;
  workId: string;
  revision: number;
  status: "published";
  title: string;
  subtitle: string;
  designStory: string;
  materialDisclosure: string;
  makerDisclosure: string;
  placeOfMaking: string;
  madeAt: string | null;
  careGuidance: string;
  repairGuidance: string;
  provenanceNote: string;
  publicSummary: string;
  publishedAt: string | null;
  createdAt: string;
  href: string;
};

export class ProvenancePublicAdapter
  implements PublicArchiveAdapter<ProvenanceDossier, PublicProvenanceDTO>
{
  type = "provenance" as const;

  async loadPublishable(sourceId: string): Promise<PublicProvenanceDTO | null> {
    const db = await getDb();
    const [record] = await db
      .select()
      .from(provenanceDossiers)
      .where(eq(provenanceDossiers.id, sourceId))
      .limit(1);

    if (!record || record.status !== "published") {
      return null;
    }

    // Verify production acceptance is accepted and has seal
    const [acceptance] = await db
      .select()
      .from(productionAcceptances)
      .where(eq(productionAcceptances.id, record.productionAcceptanceId))
      .limit(1);

    if (
      !acceptance ||
      acceptance.status !== "accepted" ||
      !acceptance.acceptanceSeal
    ) {
      return null;
    }

    // Verify linked work is published
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

  toPublicDocument(source: ProvenanceDossier): PublicProvenanceDTO {
    return {
      id: source.id,
      dossierCode: source.dossierCode,
      slug: source.slug,
      workId: source.workId,
      revision: source.revision,
      status: "published",
      title: source.title,
      subtitle: source.subtitle,
      designStory: source.designStory,
      materialDisclosure: source.materialDisclosure,
      makerDisclosure: source.makerDisclosure,
      placeOfMaking: source.placeOfMaking,
      madeAt: source.madeAt,
      careGuidance: source.careGuidance,
      repairGuidance: source.repairGuidance,
      provenanceNote: source.provenanceNote,
      publicSummary: source.publicSummary,
      publishedAt: source.publishedAt,
      createdAt: source.createdAt,
      href: `/provenance/${encodeURIComponent(source.slug)}`,
    };
  }
}

export const provenancePublicAdapter = new ProvenancePublicAdapter();
