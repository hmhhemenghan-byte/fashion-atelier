/**
 * Server-only Public Archive Publication Policy & Contracts.
 *
 * Enforces positive allowlist transformation and database/server-side 404 semantics
 * for all 6 public archive entity types.
 */

import {
  workPublicAdapter,
  type PublicWorkDTO,
} from "./adapters/work";
import {
  collectionPublicAdapter,
  type PublicCollectionDTO,
} from "./adapters/collection";
import {
  materialPublicAdapter,
  type PublicMaterialDTO,
} from "./adapters/material";
import {
  technicalPackPublicAdapter,
  type PublicTechnicalPackDTO,
} from "./adapters/technical-pack";
import {
  provenancePublicAdapter,
  type PublicProvenanceDTO,
} from "./adapters/provenance";
import {
  conservationPublicAdapter,
  type PublicConservationDTO,
} from "./adapters/conservation";
import type {
  PublicArchiveAdapter,
  PublicArchiveEntityType,
} from "./types";

export type {
  PublicArchiveAdapter,
  PublicArchiveEntityType,
};

export type PublicArchiveDTO =
  | PublicWorkDTO
  | PublicCollectionDTO
  | PublicMaterialDTO
  | PublicTechnicalPackDTO
  | PublicProvenanceDTO
  | PublicConservationDTO;

export {
  workPublicAdapter,
  collectionPublicAdapter,
  materialPublicAdapter,
  technicalPackPublicAdapter,
  provenancePublicAdapter,
  conservationPublicAdapter,
};

export const PUBLIC_ARCHIVE_ADAPTERS = {
  work: workPublicAdapter,
  collection: collectionPublicAdapter,
  material: materialPublicAdapter,
  technical: technicalPackPublicAdapter,
  provenance: provenancePublicAdapter,
  conservation: conservationPublicAdapter,
} as const;

export function getPublicArchiveAdapter(type: PublicArchiveEntityType) {
  return PUBLIC_ARCHIVE_ADAPTERS[type];
}
