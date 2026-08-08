/**
 * Core type contracts for Public Archive publication policy.
 */

export type PublicArchiveEntityType =
  | "work"
  | "collection"
  | "material"
  | "technical"
  | "provenance"
  | "conservation";

export interface PublicArchiveAdapter<TSource, TPublic> {
  type: PublicArchiveEntityType;
  loadPublishable(sourceId: string): Promise<TPublic | null>;
  toPublicDocument(source: TSource): TPublic;
}
