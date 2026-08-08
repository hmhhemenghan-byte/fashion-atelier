import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { materials, type Material } from "@/db/schema";
import { mediaUrl } from "@/lib/works";
import type { PublicArchiveAdapter } from "../types";

export type PublicMaterialDTO = {
  id: string;
  materialCode: string;
  name: string;
  category: string;
  status: "approved";
  composition: string;
  construction: string;
  colorName: string;
  colorCode: string;
  origin: string;
  weight: string;
  width: string;
  handFeel: string;
  finish: string;
  certifications: string;
  swatchImageUrl: string | null;
  swatchAltText: string;
  createdAt: string;
  href: string;
};

export class MaterialPublicAdapter
  implements PublicArchiveAdapter<Material, PublicMaterialDTO>
{
  type = "material" as const;

  async loadPublishable(sourceId: string): Promise<PublicMaterialDTO | null> {
    const db = await getDb();
    const [record] = await db
      .select()
      .from(materials)
      .where(eq(materials.id, sourceId))
      .limit(1);

    if (!record || record.status !== "approved") {
      return null;
    }

    return this.toPublicDocument(record);
  }

  toPublicDocument(source: Material): PublicMaterialDTO {
    return {
      id: source.id,
      materialCode: source.materialCode,
      name: source.name,
      category: source.category,
      status: "approved",
      composition: source.composition,
      construction: source.construction,
      colorName: source.colorName,
      colorCode: source.colorCode,
      origin: source.origin,
      weight: source.weight,
      width: source.width,
      handFeel: source.handFeel,
      finish: source.finish,
      certifications: source.certifications,
      swatchImageUrl: source.swatchImageKey
        ? mediaUrl(source.swatchImageKey)
        : null,
      swatchAltText: source.swatchAltText,
      createdAt: source.createdAt,
      href: `/materials/${encodeURIComponent(source.materialCode)}`,
    };
  }
}

export const materialPublicAdapter = new MaterialPublicAdapter();
