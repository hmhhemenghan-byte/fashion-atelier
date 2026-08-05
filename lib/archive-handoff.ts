import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  archiveSnapshots,
  type ArchiveSnapshot,
  type NewArchiveSnapshot,
} from "@/db/schema";
import {
  listAllCollectionAssignments,
  listAllCollections,
} from "@/lib/collections";
import { listEditorialEvents } from "@/lib/editorial-calendar";
import {
  getEditorialOverview,
  type EditorialOverview,
} from "@/lib/editorial-operations";
import {
  listAllDesignReviewActions,
  listAllDesignReviews,
} from "@/lib/design-reviews";
import {
  listAllFittingImages,
  listAllFittingIssues,
  listAllFittingSessions,
} from "@/lib/fittings";
import {
  listAllSampleSignoffChecks,
  listAllSampleSignoffImages,
  listAllSampleSignoffs,
} from "@/lib/sample-signoffs";
import {
  listAllProductionReleaseChecks,
  listAllProductionReleases,
} from "@/lib/production-releases";
import {
  listAllProductionExceptionActions,
  listAllProductionExceptions,
} from "@/lib/production-exceptions";
import {
  listAllProductionAcceptanceChecks,
  listAllProductionAcceptanceImages,
  listAllProductionAcceptances,
} from "@/lib/production-acceptances";
import {
  listAllProvenanceDossierChecks,
  listAllProvenanceDossiers,
} from "@/lib/provenance-dossiers";
import {
  listAllConservationReportChecks,
  listAllConservationReportImages,
  listAllConservationReports,
} from "@/lib/conservation-reports";
import {
  listAllExhibitionReadinessChecks,
  listAllExhibitionReadinessImages,
  listAllExhibitionReadinessPlans,
} from "@/lib/exhibition-readiness";
import {
  listAllExhibitionWatches,
  listAllExhibitionWatchObservations,
  listAllExhibitionWatchImages,
} from "@/lib/exhibition-watch";
import {
  listAllExhibitionRecoveries,
  listAllExhibitionRecoveryChecks,
  listAllExhibitionRecoveryImages,
} from "@/lib/exhibition-recovery";
import {
  listAllCuratorialProjects,
  listAllCuratorialSelections,
} from "@/lib/archive-curation";
import {
  listAllInterpretationLabels,
  listAllInterpretationPackages,
  listAllInterpretationSections,
} from "@/lib/exhibition-interpretation";
import {
  listAllExhibitionDeliveryItems,
  listAllExhibitionDeliveryPackages,
} from "@/lib/exhibition-delivery";
import {
  listAllExhibitionInstallationChecks,
  listAllExhibitionInstallationGates,
  listAllExhibitionInstallationImages,
} from "@/lib/exhibition-installation";
import { listAllExhibitionOpeningGates, listAllExhibitionOpeningItems } from "@/lib/exhibition-opening";
import {
  listAllMaterials,
  listAllWorkMaterials,
} from "@/lib/materials";
import {
  listAllTechPackConstructionNotes,
  listAllTechPackMeasurements,
  listAllTechnicalPacks,
} from "@/lib/technical-packs";
import { listAllWorkProcessEntries } from "@/lib/process";
import { listAllPublications } from "@/lib/publications";
import {
  listAllOutreachCampaigns,
  listAllOutreachRecipients,
} from "@/lib/outreach";
import {
  listAllRelationshipActivities,
  listAllRelationshipContacts,
  listAllRelationshipOpportunities,
} from "@/lib/relationships";
import {
  listAllSampleLoanItems,
  listAllSampleLoans,
} from "@/lib/sample-loans";
import {
  listAllSamplePlacementItems,
  listAllSamplePlacements,
} from "@/lib/sample-placements";
import { listAllSampleCommunications } from "@/lib/sample-correspondence";
import {
  listAllSampleAssets,
  listAllSampleAuditItems,
  listAllSampleAudits,
} from "@/lib/sample-inventory";
import {
  listAllShowroomRequestItems,
  listAllShowroomRequests,
} from "@/lib/showroom-requests";
import {
  listAllShowroomAssignments,
  listAllShowrooms,
} from "@/lib/showrooms";
import { listAllWorkImages, listAllWorks, mediaUrl } from "@/lib/works";

export const ARCHIVE_SCHEMA_VERSION = 27;
export const ARCHIVE_FORMAT = "nera-archive/27";

export type ArchiveInventory = {
  works: number;
  workImages: number;
  processEntries: number;
  collections: number;
  collectionAssignments: number;
  publications: number;
  calendarEvents: number;
  showrooms: number;
  showroomAssignments: number;
  showroomRequests: number;
  showroomRequestItems: number;
  sampleLoans: number;
  sampleLoanItems: number;
  sampleCommunications: number;
  sampleAssets: number;
  sampleAudits: number;
  sampleAuditItems: number;
  samplePlacements: number;
  samplePlacementItems: number;
  relationshipContacts: number;
  relationshipOpportunities: number;
  relationshipActivities: number;
  outreachCampaigns: number;
  outreachRecipients: number;
  designReviews: number;
  designReviewActions: number;
  materials: number;
  workMaterials: number;
  technicalPacks: number;
  techPackMeasurements: number;
  techPackConstructionNotes: number;
  fittingSessions: number;
  fittingIssues: number;
  fittingImages: number;
  sampleSignoffs: number;
  sampleSignoffChecks: number;
  sampleSignoffImages: number;
  productionReleases: number;
  productionReleaseChecks: number;
  productionExceptions: number;
  productionExceptionActions: number;
  productionAcceptances: number;
  productionAcceptanceChecks: number;
  productionAcceptanceImages: number;
  provenanceDossiers: number;
  provenanceDossierChecks: number;
  conservationReports: number;
  conservationReportChecks: number;
  conservationReportImages: number;
  exhibitionReadinessPlans: number;
  exhibitionReadinessChecks: number;
  exhibitionReadinessImages: number;
  exhibitionWatches: number;
  exhibitionWatchObservations: number;
  exhibitionWatchImages: number;
  exhibitionRecoveries: number;
  exhibitionRecoveryChecks: number;
  exhibitionRecoveryImages: number;
  curatorialProjects: number;
  curatorialSelections: number;
  interpretationPackages: number;
  interpretationSections: number;
  interpretationLabels: number;
  exhibitionDeliveryPackages: number;
  exhibitionDeliveryItems: number;
  exhibitionInstallationGates: number;
  exhibitionInstallationChecks: number;
  exhibitionInstallationImages: number;
  exhibitionOpeningGates: number;
  exhibitionOpeningItems: number;
  mediaAssets: number;
  mediaBytes: number;
};

export type ArchiveMediaItem = {
  id: string;
  kind:
    | "work"
    | "gallery"
    | "process"
    | "collection"
    | "placement"
    | "material"
    | "technical-pack"
    | "fitting"
    | "sample-signoff"
    | "production-acceptance"
    | "conservation"
    | "exhibition-readiness"
    | "exhibition-watch"
    | "exhibition-recovery"
    | "exhibition-installation";
  recordId: string;
  parentId: string | null;
  title: string;
  altText: string;
  objectKey: string;
  mediaPath: string;
  publicUrl: string;
  contentType: string;
  bytes: number;
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
};

export type ArchiveBundle = {
  format: typeof ARCHIVE_FORMAT;
  schemaVersion: number;
  generatedAt: string;
  source: {
    brand: "NÉRA ATELIER";
    application: "Fashion Showcase";
    origin: string | null;
  };
  inventory: ArchiveInventory;
  datasets: {
    works: Awaited<ReturnType<typeof listAllWorks>>;
    workImages: Awaited<ReturnType<typeof listAllWorkImages>>;
    processEntries: Awaited<ReturnType<typeof listAllWorkProcessEntries>>;
    collections: Awaited<ReturnType<typeof listAllCollections>>;
    collectionAssignments: Awaited<
      ReturnType<typeof listAllCollectionAssignments>
    >;
    publications: Awaited<ReturnType<typeof listAllPublications>>;
    editorialEvents: Awaited<ReturnType<typeof listEditorialEvents>>;
    showrooms: Awaited<ReturnType<typeof listAllShowrooms>>;
    showroomAssignments: Awaited<
      ReturnType<typeof listAllShowroomAssignments>
    >;
    showroomRequests: Awaited<ReturnType<typeof listAllShowroomRequests>>;
    showroomRequestItems: Awaited<
      ReturnType<typeof listAllShowroomRequestItems>
    >;
    sampleLoans: Awaited<ReturnType<typeof listAllSampleLoans>>;
    sampleLoanItems: Awaited<ReturnType<typeof listAllSampleLoanItems>>;
    sampleCommunications: Awaited<
      ReturnType<typeof listAllSampleCommunications>
    >;
    sampleAssets: Awaited<ReturnType<typeof listAllSampleAssets>>;
    sampleAudits: Awaited<ReturnType<typeof listAllSampleAudits>>;
    sampleAuditItems: Awaited<ReturnType<typeof listAllSampleAuditItems>>;
    samplePlacements: Awaited<ReturnType<typeof listAllSamplePlacements>>;
    samplePlacementItems: Awaited<
      ReturnType<typeof listAllSamplePlacementItems>
    >;
    relationshipContacts: Awaited<
      ReturnType<typeof listAllRelationshipContacts>
    >;
    relationshipOpportunities: Awaited<
      ReturnType<typeof listAllRelationshipOpportunities>
    >;
    relationshipActivities: Awaited<
      ReturnType<typeof listAllRelationshipActivities>
    >;
    outreachCampaigns: Awaited<ReturnType<typeof listAllOutreachCampaigns>>;
    outreachRecipients: Awaited<ReturnType<typeof listAllOutreachRecipients>>;
    designReviews: Awaited<ReturnType<typeof listAllDesignReviews>>;
    designReviewActions: Awaited<
      ReturnType<typeof listAllDesignReviewActions>
    >;
    materials: Awaited<ReturnType<typeof listAllMaterials>>;
    workMaterials: Awaited<ReturnType<typeof listAllWorkMaterials>>;
    technicalPacks: Awaited<ReturnType<typeof listAllTechnicalPacks>>;
    techPackMeasurements: Awaited<
      ReturnType<typeof listAllTechPackMeasurements>
    >;
    techPackConstructionNotes: Awaited<
      ReturnType<typeof listAllTechPackConstructionNotes>
    >;
    fittingSessions: Awaited<ReturnType<typeof listAllFittingSessions>>;
    fittingIssues: Awaited<ReturnType<typeof listAllFittingIssues>>;
    fittingImages: Awaited<ReturnType<typeof listAllFittingImages>>;
    sampleSignoffs: Awaited<ReturnType<typeof listAllSampleSignoffs>>;
    sampleSignoffChecks: Awaited<
      ReturnType<typeof listAllSampleSignoffChecks>
    >;
    sampleSignoffImages: Awaited<
      ReturnType<typeof listAllSampleSignoffImages>
    >;
    productionReleases: Awaited<
      ReturnType<typeof listAllProductionReleases>
    >;
    productionReleaseChecks: Awaited<
      ReturnType<typeof listAllProductionReleaseChecks>
    >;
    productionExceptions: Awaited<
      ReturnType<typeof listAllProductionExceptions>
    >;
    productionExceptionActions: Awaited<
      ReturnType<typeof listAllProductionExceptionActions>
    >;
    productionAcceptances: Awaited<
      ReturnType<typeof listAllProductionAcceptances>
    >;
    productionAcceptanceChecks: Awaited<
      ReturnType<typeof listAllProductionAcceptanceChecks>
    >;
    productionAcceptanceImages: Awaited<
      ReturnType<typeof listAllProductionAcceptanceImages>
    >;
    provenanceDossiers: Awaited<ReturnType<typeof listAllProvenanceDossiers>>;
    provenanceDossierChecks: Awaited<
      ReturnType<typeof listAllProvenanceDossierChecks>
    >;
    conservationReports: Awaited<ReturnType<typeof listAllConservationReports>>;
    conservationReportChecks: Awaited<
      ReturnType<typeof listAllConservationReportChecks>
    >;
    conservationReportImages: Awaited<
      ReturnType<typeof listAllConservationReportImages>
    >;
    exhibitionReadinessPlans: Awaited<
      ReturnType<typeof listAllExhibitionReadinessPlans>
    >;
    exhibitionReadinessChecks: Awaited<
      ReturnType<typeof listAllExhibitionReadinessChecks>
    >;
    exhibitionReadinessImages: Awaited<
      ReturnType<typeof listAllExhibitionReadinessImages>
    >;
    exhibitionWatches: Awaited<ReturnType<typeof listAllExhibitionWatches>>;
    exhibitionWatchObservations: Awaited<ReturnType<typeof listAllExhibitionWatchObservations>>;
    exhibitionWatchImages: Awaited<ReturnType<typeof listAllExhibitionWatchImages>>;
    exhibitionRecoveries: Awaited<ReturnType<typeof listAllExhibitionRecoveries>>;
    exhibitionRecoveryChecks: Awaited<ReturnType<typeof listAllExhibitionRecoveryChecks>>;
    exhibitionRecoveryImages: Awaited<ReturnType<typeof listAllExhibitionRecoveryImages>>;
    curatorialProjects: Awaited<ReturnType<typeof listAllCuratorialProjects>>;
    curatorialSelections: Awaited<ReturnType<typeof listAllCuratorialSelections>>;
    interpretationPackages: Awaited<ReturnType<typeof listAllInterpretationPackages>>;
    interpretationSections: Awaited<ReturnType<typeof listAllInterpretationSections>>;
    interpretationLabels: Awaited<ReturnType<typeof listAllInterpretationLabels>>;
    exhibitionDeliveryPackages: Awaited<ReturnType<typeof listAllExhibitionDeliveryPackages>>;
    exhibitionDeliveryItems: Awaited<ReturnType<typeof listAllExhibitionDeliveryItems>>;
    exhibitionInstallationGates: Awaited<ReturnType<typeof listAllExhibitionInstallationGates>>;
    exhibitionInstallationChecks: Awaited<ReturnType<typeof listAllExhibitionInstallationChecks>>;
    exhibitionInstallationImages: Awaited<ReturnType<typeof listAllExhibitionInstallationImages>>;
    exhibitionOpeningGates: Awaited<ReturnType<typeof listAllExhibitionOpeningGates>>;
    exhibitionOpeningItems: Awaited<ReturnType<typeof listAllExhibitionOpeningItems>>;
  };
  mediaManifest: ArchiveMediaItem[];
  editorialQa: EditorialOverview;
  integrity: {
    algorithm: "SHA-256";
    scope: "datasets + media manifest";
    manifestHash: string;
  };
};

export type ArchiveSnapshotSummary = Omit<ArchiveSnapshot, "dataJson">;

export type ArchiveDelta = {
  works: number;
  collections: number;
  processEntries: number;
  publications: number;
  calendarEvents: number;
  showrooms: number;
  showroomAssignments: number;
  showroomRequests: number;
  showroomRequestItems: number;
  sampleLoans: number;
  sampleLoanItems: number;
  sampleCommunications: number;
  sampleAssets: number;
  sampleAudits: number;
  sampleAuditItems: number;
  samplePlacements: number;
  samplePlacementItems: number;
  relationshipContacts: number;
  relationshipOpportunities: number;
  relationshipActivities: number;
  outreachCampaigns: number;
  outreachRecipients: number;
  designReviews: number;
  designReviewActions: number;
  materials: number;
  workMaterials: number;
  technicalPacks: number;
  techPackMeasurements: number;
  techPackConstructionNotes: number;
  fittingSessions: number;
  fittingIssues: number;
  fittingImages: number;
  sampleSignoffs: number;
  sampleSignoffChecks: number;
  sampleSignoffImages: number;
  productionReleases: number;
  productionReleaseChecks: number;
  productionExceptions: number;
  productionExceptionActions: number;
  productionAcceptances: number;
  productionAcceptanceChecks: number;
  productionAcceptanceImages: number;
  provenanceDossiers: number;
  provenanceDossierChecks: number;
  conservationReports: number;
  conservationReportChecks: number;
  conservationReportImages: number;
  exhibitionReadinessPlans: number;
  exhibitionReadinessChecks: number;
  exhibitionReadinessImages: number;
  exhibitionWatches: number;
  exhibitionWatchObservations: number;
  exhibitionWatchImages: number;
  exhibitionRecoveries: number;
  exhibitionRecoveryChecks: number;
  exhibitionRecoveryImages: number;
  curatorialProjects: number;
  curatorialSelections: number;
  interpretationPackages: number;
  interpretationSections: number;
  interpretationLabels: number;
  exhibitionDeliveryPackages: number;
  exhibitionDeliveryItems: number;
  exhibitionInstallationGates: number;
  exhibitionInstallationChecks: number;
  exhibitionInstallationImages: number;
  exhibitionOpeningGates: number;
  exhibitionOpeningItems: number;
  mediaAssets: number;
  mediaBytes: number;
};

export type HandoffChecklistItem = {
  id: string;
  label: string;
  detail: string;
  status: "ready" | "attention";
};

export type ArchiveHandoffOverview = {
  generatedAt: string;
  portabilityScore: number;
  statusLabel: "HANDOFF READY" | "REFINE PACKAGE" | "CREATE SNAPSHOT";
  inventory: ArchiveInventory;
  editorialScore: number;
  altCoverage: number;
  issueCount: number;
  currentManifestHash: string;
  latestIsCurrent: boolean;
  latestSnapshot: ArchiveSnapshotSummary | null;
  latestDelta: ArchiveDelta | null;
  snapshots: ArchiveSnapshotSummary[];
  checklist: HandoffChecklistItem[];
};

export async function buildArchiveBundle(
  origin?: string,
): Promise<ArchiveBundle> {
  const [
    workRows,
    workImageRows,
    processRows,
    collectionRows,
    assignmentRows,
    publicationRows,
    eventRows,
    showroomRows,
    showroomAssignmentRows,
    showroomRequestRows,
    showroomRequestItemRows,
    sampleLoanRows,
    sampleLoanItemRows,
    sampleCommunicationRows,
    sampleAssetRows,
    sampleAuditRows,
    sampleAuditItemRows,
    samplePlacementRows,
    samplePlacementItemRows,
    relationshipContactRows,
    relationshipOpportunityRows,
    relationshipActivityRows,
    outreachCampaignRows,
    outreachRecipientRows,
    designReviewRows,
    designReviewActionRows,
    materialRows,
    workMaterialRows,
    technicalPackRows,
    techPackMeasurementRows,
    techPackConstructionNoteRows,
    fittingSessionRows,
    fittingIssueRows,
    fittingImageRows,
    sampleSignoffRows,
    sampleSignoffCheckRows,
    sampleSignoffImageRows,
    productionReleaseRows,
    productionReleaseCheckRows,
    productionExceptionRows,
    productionExceptionActionRows,
    productionAcceptanceRows,
    productionAcceptanceCheckRows,
    productionAcceptanceImageRows,
    provenanceDossierRows,
    provenanceDossierCheckRows,
    conservationReportRows,
    conservationReportCheckRows,
    conservationReportImageRows,
    exhibitionReadinessPlanRows,
    exhibitionReadinessCheckRows,
    exhibitionReadinessImageRows,
    exhibitionWatchRows,
    exhibitionWatchObservationRows,
    exhibitionWatchImageRows,
    exhibitionRecoveryRows,
    exhibitionRecoveryCheckRows,
    exhibitionRecoveryImageRows,
    curatorialProjectRows,
    curatorialSelectionRows,
    interpretationPackageRows,
    interpretationSectionRows,
    interpretationLabelRows,
    exhibitionDeliveryPackageRows,
    exhibitionDeliveryItemRows,
    exhibitionInstallationGateRows,
    exhibitionInstallationCheckRows,
    exhibitionInstallationImageRows,
    exhibitionOpeningGateRows,
    exhibitionOpeningItemRows,
    editorialQa,
  ] = await Promise.all([
    listAllWorks(1000),
    listAllWorkImages(),
    listAllWorkProcessEntries(),
    listAllCollections(1000),
    listAllCollectionAssignments(),
    listAllPublications(1000),
    listEditorialEvents(1000),
    listAllShowrooms(1000),
    listAllShowroomAssignments(),
    listAllShowroomRequests(1000),
    listAllShowroomRequestItems(),
    listAllSampleLoans(1000),
    listAllSampleLoanItems(),
    listAllSampleCommunications(),
    listAllSampleAssets(),
    listAllSampleAudits(),
    listAllSampleAuditItems(),
    listAllSamplePlacements(),
    listAllSamplePlacementItems(),
    listAllRelationshipContacts(),
    listAllRelationshipOpportunities(),
    listAllRelationshipActivities(),
    listAllOutreachCampaigns(),
    listAllOutreachRecipients(),
    listAllDesignReviews(),
    listAllDesignReviewActions(),
    listAllMaterials(),
    listAllWorkMaterials(),
    listAllTechnicalPacks(),
    listAllTechPackMeasurements(),
    listAllTechPackConstructionNotes(),
    listAllFittingSessions(),
    listAllFittingIssues(),
    listAllFittingImages(),
    listAllSampleSignoffs(),
    listAllSampleSignoffChecks(),
    listAllSampleSignoffImages(),
    listAllProductionReleases(),
    listAllProductionReleaseChecks(),
    listAllProductionExceptions(),
    listAllProductionExceptionActions(),
    listAllProductionAcceptances(),
    listAllProductionAcceptanceChecks(),
    listAllProductionAcceptanceImages(),
    listAllProvenanceDossiers(),
    listAllProvenanceDossierChecks(),
    listAllConservationReports(),
    listAllConservationReportChecks(),
    listAllConservationReportImages(),
    listAllExhibitionReadinessPlans(),
    listAllExhibitionReadinessChecks(),
    listAllExhibitionReadinessImages(),
    listAllExhibitionWatches(),
    listAllExhibitionWatchObservations(),
    listAllExhibitionWatchImages(),
    listAllExhibitionRecoveries(),
    listAllExhibitionRecoveryChecks(),
    listAllExhibitionRecoveryImages(),
    listAllCuratorialProjects(),
    listAllCuratorialSelections(),
    listAllInterpretationPackages(),
    listAllInterpretationSections(),
    listAllInterpretationLabels(),
    listAllExhibitionDeliveryPackages(),
    listAllExhibitionDeliveryItems(),
    listAllExhibitionInstallationGates(),
    listAllExhibitionInstallationChecks(),
    listAllExhibitionInstallationImages(),
    listAllExhibitionOpeningGates(),
    listAllExhibitionOpeningItems(),
    getEditorialOverview(),
  ]);

  const normalizedOrigin = normalizeOrigin(origin);
  const workById = new Map(workRows.map((work) => [work.id, work]));
  const mediaManifest = buildMediaManifest({
    origin: normalizedOrigin,
    works: workRows,
    workImages: workImageRows,
    processEntries: processRows,
    collections: collectionRows,
    samplePlacements: samplePlacementRows,
    materials: materialRows,
    technicalPacks: technicalPackRows,
    fittingImages: fittingImageRows,
    fittingSessions: fittingSessionRows,
    sampleSignoffImages: sampleSignoffImageRows,
    sampleSignoffs: sampleSignoffRows,
    productionAcceptances: productionAcceptanceRows,
    productionAcceptanceImages: productionAcceptanceImageRows,
    conservationReports: conservationReportRows,
    conservationReportImages: conservationReportImageRows,
    exhibitionReadinessPlans: exhibitionReadinessPlanRows,
    exhibitionReadinessImages: exhibitionReadinessImageRows,
    exhibitionWatches: exhibitionWatchRows,
    exhibitionWatchImages: exhibitionWatchImageRows,
    exhibitionRecoveries: exhibitionRecoveryRows,
    exhibitionRecoveryImages: exhibitionRecoveryImageRows,
    exhibitionInstallationGates: exhibitionInstallationGateRows,
    exhibitionInstallationImages: exhibitionInstallationImageRows,
    workById,
  });
  const datasets = {
    works: workRows,
    workImages: workImageRows,
    processEntries: processRows,
    collections: collectionRows,
    collectionAssignments: assignmentRows,
    publications: publicationRows,
    editorialEvents: eventRows,
    showrooms: showroomRows,
    showroomAssignments: showroomAssignmentRows,
    showroomRequests: showroomRequestRows,
    showroomRequestItems: showroomRequestItemRows,
    sampleLoans: sampleLoanRows,
    sampleLoanItems: sampleLoanItemRows,
    sampleCommunications: sampleCommunicationRows,
    sampleAssets: sampleAssetRows,
    sampleAudits: sampleAuditRows,
    sampleAuditItems: sampleAuditItemRows,
    samplePlacements: samplePlacementRows,
    samplePlacementItems: samplePlacementItemRows,
    relationshipContacts: relationshipContactRows,
    relationshipOpportunities: relationshipOpportunityRows,
    relationshipActivities: relationshipActivityRows,
    outreachCampaigns: outreachCampaignRows,
    outreachRecipients: outreachRecipientRows,
    designReviews: designReviewRows,
    designReviewActions: designReviewActionRows,
    materials: materialRows,
    workMaterials: workMaterialRows,
    technicalPacks: technicalPackRows,
    techPackMeasurements: techPackMeasurementRows,
    techPackConstructionNotes: techPackConstructionNoteRows,
    fittingSessions: fittingSessionRows,
    fittingIssues: fittingIssueRows,
    fittingImages: fittingImageRows,
    sampleSignoffs: sampleSignoffRows,
    sampleSignoffChecks: sampleSignoffCheckRows,
    sampleSignoffImages: sampleSignoffImageRows,
    productionReleases: productionReleaseRows,
    productionReleaseChecks: productionReleaseCheckRows,
    productionExceptions: productionExceptionRows,
    productionExceptionActions: productionExceptionActionRows,
    productionAcceptances: productionAcceptanceRows,
    productionAcceptanceChecks: productionAcceptanceCheckRows,
    productionAcceptanceImages: productionAcceptanceImageRows,
    provenanceDossiers: provenanceDossierRows,
    provenanceDossierChecks: provenanceDossierCheckRows,
    conservationReports: conservationReportRows,
    conservationReportChecks: conservationReportCheckRows,
    conservationReportImages: conservationReportImageRows,
    exhibitionReadinessPlans: exhibitionReadinessPlanRows,
    exhibitionReadinessChecks: exhibitionReadinessCheckRows,
    exhibitionReadinessImages: exhibitionReadinessImageRows,
    exhibitionWatches: exhibitionWatchRows,
    exhibitionWatchObservations: exhibitionWatchObservationRows,
    exhibitionWatchImages: exhibitionWatchImageRows,
    exhibitionRecoveries: exhibitionRecoveryRows,
    exhibitionRecoveryChecks: exhibitionRecoveryCheckRows,
    exhibitionRecoveryImages: exhibitionRecoveryImageRows,
    curatorialProjects: curatorialProjectRows,
    curatorialSelections: curatorialSelectionRows,
    interpretationPackages: interpretationPackageRows,
    interpretationSections: interpretationSectionRows,
    interpretationLabels: interpretationLabelRows,
    exhibitionDeliveryPackages: exhibitionDeliveryPackageRows,
    exhibitionDeliveryItems: exhibitionDeliveryItemRows,
    exhibitionInstallationGates: exhibitionInstallationGateRows,
    exhibitionInstallationChecks: exhibitionInstallationCheckRows,
    exhibitionInstallationImages: exhibitionInstallationImageRows,
    exhibitionOpeningGates: exhibitionOpeningGateRows,
    exhibitionOpeningItems: exhibitionOpeningItemRows,
  };
  const inventory: ArchiveInventory = {
    works: workRows.length,
    workImages: workImageRows.length,
    processEntries: processRows.length,
    collections: collectionRows.length,
    collectionAssignments: assignmentRows.length,
    publications: publicationRows.length,
    calendarEvents: eventRows.length,
    showrooms: showroomRows.length,
    showroomAssignments: showroomAssignmentRows.length,
    showroomRequests: showroomRequestRows.length,
    showroomRequestItems: showroomRequestItemRows.length,
    sampleLoans: sampleLoanRows.length,
    sampleLoanItems: sampleLoanItemRows.length,
    sampleCommunications: sampleCommunicationRows.length,
    sampleAssets: sampleAssetRows.length,
    sampleAudits: sampleAuditRows.length,
    sampleAuditItems: sampleAuditItemRows.length,
    samplePlacements: samplePlacementRows.length,
    samplePlacementItems: samplePlacementItemRows.length,
    relationshipContacts: relationshipContactRows.length,
    relationshipOpportunities: relationshipOpportunityRows.length,
    relationshipActivities: relationshipActivityRows.length,
    outreachCampaigns: outreachCampaignRows.length,
    outreachRecipients: outreachRecipientRows.length,
    designReviews: designReviewRows.length,
    designReviewActions: designReviewActionRows.length,
    materials: materialRows.length,
    workMaterials: workMaterialRows.length,
    technicalPacks: technicalPackRows.length,
    techPackMeasurements: techPackMeasurementRows.length,
    techPackConstructionNotes: techPackConstructionNoteRows.length,
    fittingSessions: fittingSessionRows.length,
    fittingIssues: fittingIssueRows.length,
    fittingImages: fittingImageRows.length,
    sampleSignoffs: sampleSignoffRows.length,
    sampleSignoffChecks: sampleSignoffCheckRows.length,
    sampleSignoffImages: sampleSignoffImageRows.length,
    productionReleases: productionReleaseRows.length,
    productionReleaseChecks: productionReleaseCheckRows.length,
    productionExceptions: productionExceptionRows.length,
    productionExceptionActions: productionExceptionActionRows.length,
    productionAcceptances: productionAcceptanceRows.length,
    productionAcceptanceChecks: productionAcceptanceCheckRows.length,
    productionAcceptanceImages: productionAcceptanceImageRows.length,
    provenanceDossiers: provenanceDossierRows.length,
    provenanceDossierChecks: provenanceDossierCheckRows.length,
    conservationReports: conservationReportRows.length,
    conservationReportChecks: conservationReportCheckRows.length,
    conservationReportImages: conservationReportImageRows.length,
    exhibitionReadinessPlans: exhibitionReadinessPlanRows.length,
    exhibitionReadinessChecks: exhibitionReadinessCheckRows.length,
    exhibitionReadinessImages: exhibitionReadinessImageRows.length,
    exhibitionWatches: exhibitionWatchRows.length,
    exhibitionWatchObservations: exhibitionWatchObservationRows.length,
    exhibitionWatchImages: exhibitionWatchImageRows.length,
    exhibitionRecoveries: exhibitionRecoveryRows.length,
    exhibitionRecoveryChecks: exhibitionRecoveryCheckRows.length,
    exhibitionRecoveryImages: exhibitionRecoveryImageRows.length,
    curatorialProjects: curatorialProjectRows.length,
    curatorialSelections: curatorialSelectionRows.length,
    interpretationPackages: interpretationPackageRows.length,
    interpretationSections: interpretationSectionRows.length,
    interpretationLabels: interpretationLabelRows.length,
    exhibitionDeliveryPackages: exhibitionDeliveryPackageRows.length,
    exhibitionDeliveryItems: exhibitionDeliveryItemRows.length,
    exhibitionInstallationGates: exhibitionInstallationGateRows.length,
    exhibitionInstallationChecks: exhibitionInstallationCheckRows.length,
    exhibitionInstallationImages: exhibitionInstallationImageRows.length,
    exhibitionOpeningGates: exhibitionOpeningGateRows.length,
    exhibitionOpeningItems: exhibitionOpeningItemRows.length,
    mediaAssets: mediaManifest.length,
    mediaBytes: mediaManifest.reduce((total, item) => total + item.bytes, 0),
  };
  const stableMediaManifest = mediaManifest.map((item) => ({
    id: item.id,
    kind: item.kind,
    recordId: item.recordId,
    parentId: item.parentId,
    title: item.title,
    altText: item.altText,
    objectKey: item.objectKey,
    mediaPath: item.mediaPath,
    contentType: item.contentType,
    bytes: item.bytes,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
  const manifestHash = await sha256(
    canonicalJson({
      schemaVersion: ARCHIVE_SCHEMA_VERSION,
      datasets,
      mediaManifest: stableMediaManifest,
    }),
  );

  return {
    format: ARCHIVE_FORMAT,
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    source: {
      brand: "NÉRA ATELIER",
      application: "Fashion Showcase",
      origin: normalizedOrigin || null,
    },
    inventory,
    datasets,
    mediaManifest,
    editorialQa,
    integrity: {
      algorithm: "SHA-256",
      scope: "datasets + media manifest",
      manifestHash,
    },
  };
}

export async function getArchiveHandoffOverview(
  origin?: string,
): Promise<ArchiveHandoffOverview> {
  const [bundle, snapshots] = await Promise.all([
    buildArchiveBundle(origin),
    listArchiveSnapshots(),
  ]);
  const latestSnapshot = snapshots[0] ?? null;
  const latestIsCurrent =
    latestSnapshot?.manifestHash === bundle.integrity.manifestHash;
  const latestDelta = latestSnapshot
    ? createDelta(bundle.inventory, latestSnapshot)
    : null;
  const mediaQuality =
    10 + Math.round((bundle.editorialQa.summary.media.altCoverage / 100) * 10);
  const editorialQuality = Math.round(bundle.editorialQa.score * 0.2);
  const archiveRecency = latestIsCurrent ? 20 : latestSnapshot ? 8 : 0;
  const portabilityScore = Math.min(
    100,
    20 + 20 + mediaQuality + editorialQuality + archiveRecency,
  );

  return {
    generatedAt: bundle.generatedAt,
    portabilityScore,
    statusLabel:
      portabilityScore >= 85 && latestIsCurrent
        ? "HANDOFF READY"
        : latestSnapshot
          ? "REFINE PACKAGE"
          : "CREATE SNAPSHOT",
    inventory: bundle.inventory,
    editorialScore: bundle.editorialQa.score,
    altCoverage: bundle.editorialQa.summary.media.altCoverage,
    issueCount: bundle.editorialQa.issues.length,
    currentManifestHash: bundle.integrity.manifestHash,
    latestIsCurrent,
    latestSnapshot,
    latestDelta,
    snapshots,
    checklist: [
      {
        id: "source",
        label: "源码与数据库结构",
        detail: "应用源码、Drizzle 数据表与逐版本迁移文件均在仓库内。",
        status: "ready",
      },
      {
        id: "bundle",
        label: "完整结构化数据包",
        detail: `已覆盖 ${bundle.inventory.works} 件作品、${bundle.inventory.collections} 个系列、${bundle.inventory.materials} 项材料与 ${bundle.inventory.workMaterials} 条 Look 用料、${bundle.inventory.technicalPacks} 个技术包、${bundle.inventory.techPackMeasurements} 条尺寸规格与 ${bundle.inventory.techPackConstructionNotes} 条工艺说明、${bundle.inventory.fittingSessions} 轮试身、${bundle.inventory.fittingIssues} 条版型问题与 ${bundle.inventory.fittingImages} 张私密试身证据、${bundle.inventory.sampleSignoffs} 次封样签核、${bundle.inventory.sampleSignoffChecks} 条人工核对与 ${bundle.inventory.sampleSignoffImages} 张私密封样证据、${bundle.inventory.productionReleases} 份生产放行包与 ${bundle.inventory.productionReleaseChecks} 条准备核对、${bundle.inventory.productionExceptions} 条生产偏差与 ${bundle.inventory.productionExceptionActions} 条人工处置记录、${bundle.inventory.productionAcceptances} 次成衣验收、${bundle.inventory.productionAcceptanceChecks} 条实物核对与 ${bundle.inventory.productionAcceptanceImages} 张私密验收证据、${bundle.inventory.provenanceDossiers} 份成衣溯源档案与 ${bundle.inventory.provenanceDossierChecks} 条公开核对、${bundle.inventory.conservationReports} 份养护报告、${bundle.inventory.conservationReportChecks} 条状态检查与 ${bundle.inventory.conservationReportImages} 张私密养护证据、${bundle.inventory.exhibitionReadinessPlans} 份展陈方案、${bundle.inventory.exhibitionReadinessChecks} 条安全核对与 ${bundle.inventory.exhibitionReadinessImages} 张私密试装证据、${bundle.inventory.exhibitionWatches} 条展期监测、${bundle.inventory.exhibitionWatchObservations} 条现场观察与 ${bundle.inventory.exhibitionWatchImages} 张私密监测证据、${bundle.inventory.exhibitionRecoveries} 条展后复原、${bundle.inventory.exhibitionRecoveryChecks} 条复原核对与 ${bundle.inventory.exhibitionRecoveryImages} 张私密接收证据、${bundle.inventory.curatorialProjects} 个策展项目与 ${bundle.inventory.curatorialSelections} 条实物选择、${bundle.inventory.publications} 个发布包、${bundle.inventory.calendarEvents} 条保存排期、${bundle.inventory.designReviews} 次设计评审与 ${bundle.inventory.designReviewActions} 项修改任务、${bundle.inventory.showrooms} 个私享展厅、${bundle.inventory.showroomRequests} 条专业回应、${bundle.inventory.sampleLoans} 条样衣借调、${bundle.inventory.samplePlacements} 条成果记录、${bundle.inventory.sampleCommunications} 条沟通记录、${bundle.inventory.sampleAssets} 件实物资产、${bundle.inventory.sampleAudits} 次盘点，以及 ${bundle.inventory.relationshipContacts} 位联系人、${bundle.inventory.relationshipOpportunities} 个机会、${bundle.inventory.relationshipActivities} 条互动或待办、${bundle.inventory.outreachCampaigns} 个外联活动与 ${bundle.inventory.outreachRecipients} 个独立审核对象。`,
        status: "ready",
      },
      {
        id: "media",
        label: "R2 媒体交接清单",
        detail:
          bundle.editorialQa.summary.media.missingAlt === 0
            ? `${bundle.inventory.mediaAssets} 个对象均带有迁移键、类型、尺寸和描述。`
            : `${bundle.inventory.mediaAssets} 个对象已索引，${bundle.editorialQa.summary.media.missingAlt} 项仍需补充图片描述。`,
        status:
          bundle.editorialQa.summary.media.missingAlt === 0
            ? "ready"
            : "attention",
      },
      {
        id: "qa",
        label: "编辑质量检查",
        detail: `当前准备度 ${bundle.editorialQa.score}/100，仍有 ${bundle.editorialQa.issues.length} 项检查。`,
        status: bundle.editorialQa.score >= 85 ? "ready" : "attention",
      },
      {
        id: "snapshot",
        label: "不可变交接快照",
        detail: latestIsCurrent
          ? "最新快照与当前数据校验摘要一致，可作为交接基线。"
          : latestSnapshot
            ? "当前数据已发生变化，请创建新快照锁定最新基线。"
            : "尚未创建交接基线，请在导出前生成首个快照。",
        status: latestIsCurrent ? "ready" : "attention",
      },
    ],
  };
}

export async function listArchiveSnapshots(
  limit = 30,
): Promise<ArchiveSnapshotSummary[]> {
  const db = await getDb();
  return db
    .select({
      id: archiveSnapshots.id,
      label: archiveSnapshots.label,
      notes: archiveSnapshots.notes,
      schemaVersion: archiveSnapshots.schemaVersion,
      manifestHash: archiveSnapshots.manifestHash,
      workCount: archiveSnapshots.workCount,
      collectionCount: archiveSnapshots.collectionCount,
      processCount: archiveSnapshots.processCount,
      publicationCount: archiveSnapshots.publicationCount,
      calendarEventCount: archiveSnapshots.calendarEventCount,
      showroomCount: archiveSnapshots.showroomCount,
      showroomAssignmentCount: archiveSnapshots.showroomAssignmentCount,
      showroomRequestCount: archiveSnapshots.showroomRequestCount,
      showroomRequestItemCount: archiveSnapshots.showroomRequestItemCount,
      sampleLoanCount: archiveSnapshots.sampleLoanCount,
      sampleLoanItemCount: archiveSnapshots.sampleLoanItemCount,
      sampleCommunicationCount: archiveSnapshots.sampleCommunicationCount,
      sampleAssetCount: archiveSnapshots.sampleAssetCount,
      sampleAuditCount: archiveSnapshots.sampleAuditCount,
      sampleAuditItemCount: archiveSnapshots.sampleAuditItemCount,
      samplePlacementCount: archiveSnapshots.samplePlacementCount,
      samplePlacementItemCount: archiveSnapshots.samplePlacementItemCount,
      relationshipContactCount: archiveSnapshots.relationshipContactCount,
      relationshipOpportunityCount:
        archiveSnapshots.relationshipOpportunityCount,
      relationshipActivityCount: archiveSnapshots.relationshipActivityCount,
      outreachCampaignCount: archiveSnapshots.outreachCampaignCount,
      outreachRecipientCount: archiveSnapshots.outreachRecipientCount,
      designReviewCount: archiveSnapshots.designReviewCount,
      designReviewActionCount: archiveSnapshots.designReviewActionCount,
      materialCount: archiveSnapshots.materialCount,
      workMaterialCount: archiveSnapshots.workMaterialCount,
      technicalPackCount: archiveSnapshots.technicalPackCount,
      techPackMeasurementCount: archiveSnapshots.techPackMeasurementCount,
      techPackConstructionNoteCount:
        archiveSnapshots.techPackConstructionNoteCount,
      fittingSessionCount: archiveSnapshots.fittingSessionCount,
      fittingIssueCount: archiveSnapshots.fittingIssueCount,
      fittingImageCount: archiveSnapshots.fittingImageCount,
      sampleSignoffCount: archiveSnapshots.sampleSignoffCount,
      sampleSignoffCheckCount: archiveSnapshots.sampleSignoffCheckCount,
      sampleSignoffImageCount: archiveSnapshots.sampleSignoffImageCount,
      productionReleaseCount: archiveSnapshots.productionReleaseCount,
      productionReleaseCheckCount:
        archiveSnapshots.productionReleaseCheckCount,
      productionExceptionCount: archiveSnapshots.productionExceptionCount,
      productionExceptionActionCount:
        archiveSnapshots.productionExceptionActionCount,
      productionAcceptanceCount:
        archiveSnapshots.productionAcceptanceCount,
      productionAcceptanceCheckCount:
        archiveSnapshots.productionAcceptanceCheckCount,
      productionAcceptanceImageCount:
        archiveSnapshots.productionAcceptanceImageCount,
      provenanceDossierCount: archiveSnapshots.provenanceDossierCount,
      provenanceDossierCheckCount:
        archiveSnapshots.provenanceDossierCheckCount,
      conservationReportCount: archiveSnapshots.conservationReportCount,
      conservationReportCheckCount:
        archiveSnapshots.conservationReportCheckCount,
      conservationReportImageCount:
        archiveSnapshots.conservationReportImageCount,
      exhibitionReadinessPlanCount:
        archiveSnapshots.exhibitionReadinessPlanCount,
      exhibitionReadinessCheckCount:
        archiveSnapshots.exhibitionReadinessCheckCount,
      exhibitionReadinessImageCount:
        archiveSnapshots.exhibitionReadinessImageCount,
      exhibitionWatchCount: archiveSnapshots.exhibitionWatchCount,
      exhibitionWatchObservationCount:
        archiveSnapshots.exhibitionWatchObservationCount,
      exhibitionWatchImageCount: archiveSnapshots.exhibitionWatchImageCount,
      exhibitionRecoveryCount: archiveSnapshots.exhibitionRecoveryCount,
      exhibitionRecoveryCheckCount: archiveSnapshots.exhibitionRecoveryCheckCount,
      exhibitionRecoveryImageCount: archiveSnapshots.exhibitionRecoveryImageCount,
      curatorialProjectCount: archiveSnapshots.curatorialProjectCount,
      curatorialSelectionCount: archiveSnapshots.curatorialSelectionCount,
      interpretationPackageCount: archiveSnapshots.interpretationPackageCount,
      interpretationSectionCount: archiveSnapshots.interpretationSectionCount,
      interpretationLabelCount: archiveSnapshots.interpretationLabelCount,
      exhibitionDeliveryPackageCount: archiveSnapshots.exhibitionDeliveryPackageCount,
      exhibitionDeliveryItemCount: archiveSnapshots.exhibitionDeliveryItemCount,
      exhibitionInstallationGateCount: archiveSnapshots.exhibitionInstallationGateCount,
      exhibitionInstallationCheckCount: archiveSnapshots.exhibitionInstallationCheckCount,
      exhibitionInstallationImageCount: archiveSnapshots.exhibitionInstallationImageCount,
      exhibitionOpeningGateCount: archiveSnapshots.exhibitionOpeningGateCount,
      exhibitionOpeningItemCount: archiveSnapshots.exhibitionOpeningItemCount,
      mediaCount: archiveSnapshots.mediaCount,
      mediaBytes: archiveSnapshots.mediaBytes,
      createdBy: archiveSnapshots.createdBy,
      createdAt: archiveSnapshots.createdAt,
    })
    .from(archiveSnapshots)
    .orderBy(desc(archiveSnapshots.createdAt))
    .limit(limit);
}

export async function getArchiveSnapshot(id: string) {
  const db = await getDb();
  const [snapshot] = await db
    .select()
    .from(archiveSnapshots)
    .where(eq(archiveSnapshots.id, id))
    .limit(1);
  return snapshot ?? null;
}

export function toArchiveSnapshotSummary(
  snapshot: ArchiveSnapshot,
): ArchiveSnapshotSummary {
  return {
    id: snapshot.id,
    label: snapshot.label,
    notes: snapshot.notes,
    schemaVersion: snapshot.schemaVersion,
    manifestHash: snapshot.manifestHash,
    workCount: snapshot.workCount,
    collectionCount: snapshot.collectionCount,
    processCount: snapshot.processCount,
    publicationCount: snapshot.publicationCount,
    calendarEventCount: snapshot.calendarEventCount,
    showroomCount: snapshot.showroomCount,
    showroomAssignmentCount: snapshot.showroomAssignmentCount,
    showroomRequestCount: snapshot.showroomRequestCount,
    showroomRequestItemCount: snapshot.showroomRequestItemCount,
    sampleLoanCount: snapshot.sampleLoanCount,
    sampleLoanItemCount: snapshot.sampleLoanItemCount,
    sampleCommunicationCount: snapshot.sampleCommunicationCount,
    sampleAssetCount: snapshot.sampleAssetCount,
    sampleAuditCount: snapshot.sampleAuditCount,
    sampleAuditItemCount: snapshot.sampleAuditItemCount,
    samplePlacementCount: snapshot.samplePlacementCount,
    samplePlacementItemCount: snapshot.samplePlacementItemCount,
    relationshipContactCount: snapshot.relationshipContactCount,
    relationshipOpportunityCount: snapshot.relationshipOpportunityCount,
    relationshipActivityCount: snapshot.relationshipActivityCount,
    outreachCampaignCount: snapshot.outreachCampaignCount,
    outreachRecipientCount: snapshot.outreachRecipientCount,
    designReviewCount: snapshot.designReviewCount,
    designReviewActionCount: snapshot.designReviewActionCount,
    materialCount: snapshot.materialCount,
    workMaterialCount: snapshot.workMaterialCount,
    technicalPackCount: snapshot.technicalPackCount,
    techPackMeasurementCount: snapshot.techPackMeasurementCount,
    techPackConstructionNoteCount: snapshot.techPackConstructionNoteCount,
    fittingSessionCount: snapshot.fittingSessionCount,
    fittingIssueCount: snapshot.fittingIssueCount,
    fittingImageCount: snapshot.fittingImageCount,
    sampleSignoffCount: snapshot.sampleSignoffCount,
    sampleSignoffCheckCount: snapshot.sampleSignoffCheckCount,
    sampleSignoffImageCount: snapshot.sampleSignoffImageCount,
    productionReleaseCount: snapshot.productionReleaseCount,
    productionReleaseCheckCount: snapshot.productionReleaseCheckCount,
    productionExceptionCount: snapshot.productionExceptionCount,
    productionExceptionActionCount: snapshot.productionExceptionActionCount,
    productionAcceptanceCount: snapshot.productionAcceptanceCount,
    productionAcceptanceCheckCount: snapshot.productionAcceptanceCheckCount,
    productionAcceptanceImageCount: snapshot.productionAcceptanceImageCount,
    provenanceDossierCount: snapshot.provenanceDossierCount,
    provenanceDossierCheckCount: snapshot.provenanceDossierCheckCount,
    conservationReportCount: snapshot.conservationReportCount,
    conservationReportCheckCount: snapshot.conservationReportCheckCount,
    conservationReportImageCount: snapshot.conservationReportImageCount,
    exhibitionReadinessPlanCount: snapshot.exhibitionReadinessPlanCount,
    exhibitionReadinessCheckCount: snapshot.exhibitionReadinessCheckCount,
    exhibitionReadinessImageCount: snapshot.exhibitionReadinessImageCount,
    exhibitionWatchCount: snapshot.exhibitionWatchCount,
    exhibitionWatchObservationCount: snapshot.exhibitionWatchObservationCount,
    exhibitionWatchImageCount: snapshot.exhibitionWatchImageCount,
    exhibitionRecoveryCount: snapshot.exhibitionRecoveryCount,
    exhibitionRecoveryCheckCount: snapshot.exhibitionRecoveryCheckCount,
    exhibitionRecoveryImageCount: snapshot.exhibitionRecoveryImageCount,
    curatorialProjectCount: snapshot.curatorialProjectCount,
    curatorialSelectionCount: snapshot.curatorialSelectionCount,
    interpretationPackageCount: snapshot.interpretationPackageCount,
    interpretationSectionCount: snapshot.interpretationSectionCount,
    interpretationLabelCount: snapshot.interpretationLabelCount,
    exhibitionDeliveryPackageCount: snapshot.exhibitionDeliveryPackageCount,
    exhibitionDeliveryItemCount: snapshot.exhibitionDeliveryItemCount,
    exhibitionInstallationGateCount: snapshot.exhibitionInstallationGateCount,
    exhibitionInstallationCheckCount: snapshot.exhibitionInstallationCheckCount,
    exhibitionInstallationImageCount: snapshot.exhibitionInstallationImageCount,
    exhibitionOpeningGateCount: snapshot.exhibitionOpeningGateCount,
    exhibitionOpeningItemCount: snapshot.exhibitionOpeningItemCount,
    mediaCount: snapshot.mediaCount,
    mediaBytes: snapshot.mediaBytes,
    createdBy: snapshot.createdBy,
    createdAt: snapshot.createdAt,
  };
}

export async function createArchiveSnapshot(input: {
  label: string;
  notes: string;
  createdBy: string;
  origin?: string;
}) {
  const bundle = await buildArchiveBundle(input.origin);
  const values: NewArchiveSnapshot = {
    id: crypto.randomUUID(),
    label: input.label,
    notes: input.notes,
    schemaVersion: bundle.schemaVersion,
    manifestHash: bundle.integrity.manifestHash,
    dataJson: JSON.stringify(bundle, null, 2),
    workCount: bundle.inventory.works,
    collectionCount: bundle.inventory.collections,
    processCount: bundle.inventory.processEntries,
    publicationCount: bundle.inventory.publications,
    calendarEventCount: bundle.inventory.calendarEvents,
    showroomCount: bundle.inventory.showrooms,
    showroomAssignmentCount: bundle.inventory.showroomAssignments,
    showroomRequestCount: bundle.inventory.showroomRequests,
    showroomRequestItemCount: bundle.inventory.showroomRequestItems,
    sampleLoanCount: bundle.inventory.sampleLoans,
    sampleLoanItemCount: bundle.inventory.sampleLoanItems,
    sampleCommunicationCount: bundle.inventory.sampleCommunications,
    sampleAssetCount: bundle.inventory.sampleAssets,
    sampleAuditCount: bundle.inventory.sampleAudits,
    sampleAuditItemCount: bundle.inventory.sampleAuditItems,
    samplePlacementCount: bundle.inventory.samplePlacements,
    samplePlacementItemCount: bundle.inventory.samplePlacementItems,
    relationshipContactCount: bundle.inventory.relationshipContacts,
    relationshipOpportunityCount: bundle.inventory.relationshipOpportunities,
    relationshipActivityCount: bundle.inventory.relationshipActivities,
    outreachCampaignCount: bundle.inventory.outreachCampaigns,
    outreachRecipientCount: bundle.inventory.outreachRecipients,
    designReviewCount: bundle.inventory.designReviews,
    designReviewActionCount: bundle.inventory.designReviewActions,
    materialCount: bundle.inventory.materials,
    workMaterialCount: bundle.inventory.workMaterials,
    technicalPackCount: bundle.inventory.technicalPacks,
    techPackMeasurementCount: bundle.inventory.techPackMeasurements,
    techPackConstructionNoteCount:
      bundle.inventory.techPackConstructionNotes,
    fittingSessionCount: bundle.inventory.fittingSessions,
    fittingIssueCount: bundle.inventory.fittingIssues,
    fittingImageCount: bundle.inventory.fittingImages,
    sampleSignoffCount: bundle.inventory.sampleSignoffs,
    sampleSignoffCheckCount: bundle.inventory.sampleSignoffChecks,
    sampleSignoffImageCount: bundle.inventory.sampleSignoffImages,
    productionReleaseCount: bundle.inventory.productionReleases,
    productionReleaseCheckCount: bundle.inventory.productionReleaseChecks,
    productionExceptionCount: bundle.inventory.productionExceptions,
    productionExceptionActionCount:
      bundle.inventory.productionExceptionActions,
    productionAcceptanceCount: bundle.inventory.productionAcceptances,
    productionAcceptanceCheckCount:
      bundle.inventory.productionAcceptanceChecks,
    productionAcceptanceImageCount:
      bundle.inventory.productionAcceptanceImages,
    provenanceDossierCount: bundle.inventory.provenanceDossiers,
    provenanceDossierCheckCount: bundle.inventory.provenanceDossierChecks,
    conservationReportCount: bundle.inventory.conservationReports,
    conservationReportCheckCount: bundle.inventory.conservationReportChecks,
    conservationReportImageCount: bundle.inventory.conservationReportImages,
    exhibitionReadinessPlanCount: bundle.inventory.exhibitionReadinessPlans,
    exhibitionReadinessCheckCount: bundle.inventory.exhibitionReadinessChecks,
    exhibitionReadinessImageCount: bundle.inventory.exhibitionReadinessImages,
    exhibitionWatchCount: bundle.inventory.exhibitionWatches,
    exhibitionWatchObservationCount: bundle.inventory.exhibitionWatchObservations,
    exhibitionWatchImageCount: bundle.inventory.exhibitionWatchImages,
    exhibitionRecoveryCount: bundle.inventory.exhibitionRecoveries,
    exhibitionRecoveryCheckCount: bundle.inventory.exhibitionRecoveryChecks,
    exhibitionRecoveryImageCount: bundle.inventory.exhibitionRecoveryImages,
    curatorialProjectCount: bundle.inventory.curatorialProjects,
    curatorialSelectionCount: bundle.inventory.curatorialSelections,
    interpretationPackageCount: bundle.inventory.interpretationPackages,
    interpretationSectionCount: bundle.inventory.interpretationSections,
    interpretationLabelCount: bundle.inventory.interpretationLabels,
    exhibitionDeliveryPackageCount: bundle.inventory.exhibitionDeliveryPackages,
    exhibitionDeliveryItemCount: bundle.inventory.exhibitionDeliveryItems,
    exhibitionInstallationGateCount: bundle.inventory.exhibitionInstallationGates,
    exhibitionInstallationCheckCount: bundle.inventory.exhibitionInstallationChecks,
    exhibitionInstallationImageCount: bundle.inventory.exhibitionInstallationImages,
    exhibitionOpeningGateCount: bundle.inventory.exhibitionOpeningGates,
    exhibitionOpeningItemCount: bundle.inventory.exhibitionOpeningItems,
    mediaCount: bundle.inventory.mediaAssets,
    mediaBytes: bundle.inventory.mediaBytes,
    createdBy: input.createdBy,
  };
  const db = await getDb();
  const [snapshot] = await db
    .insert(archiveSnapshots)
    .values(values)
    .returning();
  return snapshot;
}

export function archiveMediaToCsv(items: ArchiveMediaItem[]) {
  const columns: Array<keyof ArchiveMediaItem> = [
    "id",
    "kind",
    "recordId",
    "parentId",
    "title",
    "altText",
    "objectKey",
    "mediaPath",
    "publicUrl",
    "contentType",
    "bytes",
    "status",
    "createdAt",
    "updatedAt",
  ];
  const lines = [columns.map(csvCell).join(",")];
  items.forEach((item) => {
    lines.push(columns.map((column) => csvCell(item[column])).join(","));
  });
  return `\ufeff${lines.join("\r\n")}`;
}

function buildMediaManifest(input: {
  origin: string;
  works: Awaited<ReturnType<typeof listAllWorks>>;
  workImages: Awaited<ReturnType<typeof listAllWorkImages>>;
  processEntries: Awaited<ReturnType<typeof listAllWorkProcessEntries>>;
  collections: Awaited<ReturnType<typeof listAllCollections>>;
  samplePlacements: Awaited<ReturnType<typeof listAllSamplePlacements>>;
  materials: Awaited<ReturnType<typeof listAllMaterials>>;
  technicalPacks: Awaited<ReturnType<typeof listAllTechnicalPacks>>;
  fittingSessions: Awaited<ReturnType<typeof listAllFittingSessions>>;
  fittingImages: Awaited<ReturnType<typeof listAllFittingImages>>;
  sampleSignoffs: Awaited<ReturnType<typeof listAllSampleSignoffs>>;
  sampleSignoffImages: Awaited<
    ReturnType<typeof listAllSampleSignoffImages>
  >;
  productionAcceptances: Awaited<
    ReturnType<typeof listAllProductionAcceptances>
  >;
  productionAcceptanceImages: Awaited<
    ReturnType<typeof listAllProductionAcceptanceImages>
  >;
  conservationReports: Awaited<ReturnType<typeof listAllConservationReports>>;
  conservationReportImages: Awaited<
    ReturnType<typeof listAllConservationReportImages>
  >;
  exhibitionReadinessPlans: Awaited<
    ReturnType<typeof listAllExhibitionReadinessPlans>
  >;
  exhibitionReadinessImages: Awaited<
    ReturnType<typeof listAllExhibitionReadinessImages>
  >;
  exhibitionWatches: Awaited<ReturnType<typeof listAllExhibitionWatches>>;
  exhibitionWatchImages: Awaited<ReturnType<typeof listAllExhibitionWatchImages>>;
  exhibitionRecoveries: Awaited<ReturnType<typeof listAllExhibitionRecoveries>>;
  exhibitionRecoveryImages: Awaited<ReturnType<typeof listAllExhibitionRecoveryImages>>;
  exhibitionInstallationGates: Awaited<ReturnType<typeof listAllExhibitionInstallationGates>>;
  exhibitionInstallationImages: Awaited<ReturnType<typeof listAllExhibitionInstallationImages>>;
  workById: Map<
    string,
    Awaited<ReturnType<typeof listAllWorks>>[number]
  >;
}) {
  const items: ArchiveMediaItem[] = [];
  const fittingSessionById = new Map(
    input.fittingSessions.map((session) => [session.id, session]),
  );
  const sampleSignoffById = new Map(
    input.sampleSignoffs.map((signoff) => [signoff.id, signoff]),
  );
  const productionAcceptanceById = new Map(
    input.productionAcceptances.map((acceptance) => [acceptance.id, acceptance]),
  );
  const conservationReportById = new Map(
    input.conservationReports.map((report) => [report.id, report]),
  );
  const exhibitionReadinessPlanById = new Map(
    input.exhibitionReadinessPlans.map((plan) => [plan.id, plan]),
  );
  const exhibitionWatchById = new Map(
    input.exhibitionWatches.map((watch) => [watch.id, watch]),
  );
  const exhibitionRecoveryById = new Map(
    input.exhibitionRecoveries.map((recovery) => [recovery.id, recovery]),
  );
  const exhibitionInstallationGateById = new Map(
    input.exhibitionInstallationGates.map((gate) => [gate.id, gate]),
  );
  input.works.forEach((work) => {
    items.push(
      mediaItem({
        origin: input.origin,
        id: `work:${work.id}`,
        kind: "work",
        recordId: work.id,
        parentId: null,
        title: work.title,
        altText: work.altText,
        objectKey: work.imageKey,
        contentType: work.imageType,
        bytes: work.imageSize,
        status: work.status,
        createdAt: work.createdAt,
        updatedAt: work.updatedAt,
      }),
    );
  });
  input.workImages.forEach((image) => {
    const work = input.workById.get(image.workId);
    items.push(
      mediaItem({
        origin: input.origin,
        id: `gallery:${image.id}`,
        kind: "gallery",
        recordId: image.id,
        parentId: image.workId,
        title: image.label,
        altText: image.altText,
        objectKey: image.imageKey,
        contentType: image.imageType,
        bytes: image.imageSize,
        status: work?.status ?? "draft",
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
      }),
    );
  });
  input.processEntries.forEach((entry) => {
    if (!entry.imageKey) return;
    items.push(
      mediaItem({
        origin: input.origin,
        id: `process:${entry.id}`,
        kind: "process",
        recordId: entry.id,
        parentId: entry.workId,
        title: entry.title,
        altText: entry.altText,
        objectKey: entry.imageKey,
        contentType: entry.imageType || "application/octet-stream",
        bytes: entry.imageSize ?? 0,
        status: entry.status,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }),
    );
  });
  input.collections.forEach((collection) => {
    if (!collection.heroImageKey) return;
    items.push(
      mediaItem({
        origin: input.origin,
        id: `collection:${collection.id}`,
        kind: "collection",
        recordId: collection.id,
        parentId: null,
        title: collection.title,
        altText: collection.heroAltText,
        objectKey: collection.heroImageKey,
        contentType:
          collection.heroImageType || "application/octet-stream",
        bytes: collection.heroImageSize ?? 0,
        status: collection.status,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
      }),
    );
  });
  input.samplePlacements.forEach((placement) => {
    if (!placement.evidenceImageKey) return;
    items.push(
      mediaItem({
        origin: input.origin,
        id: `placement:${placement.id}`,
        kind: "placement",
        recordId: placement.id,
        parentId: placement.loanId,
        title: placement.title,
        altText:
          placement.evidenceAltText || `${placement.title} 成果证据`,
        objectKey: placement.evidenceImageKey,
        contentType:
          placement.evidenceImageType || "application/octet-stream",
        bytes: placement.evidenceImageSize,
        status: "draft",
        createdAt: placement.createdAt,
        updatedAt: placement.updatedAt,
      }),
    );
  });
  input.materials.forEach((material) => {
    if (!material.swatchImageKey) return;
    items.push(
      mediaItem({
        origin: input.origin,
        id: `material:${material.id}`,
        kind: "material",
        recordId: material.id,
        parentId: null,
        title: `${material.materialCode} / ${material.name}`,
        altText:
          material.swatchAltText || `${material.name} 材料色卡`,
        objectKey: material.swatchImageKey,
        contentType:
          material.swatchImageType || "application/octet-stream",
        bytes: material.swatchImageSize ?? 0,
        status:
          material.status === "approved" ? "published" : "draft",
        createdAt: material.createdAt,
        updatedAt: material.updatedAt,
      }),
    );
  });
  input.technicalPacks.forEach((pack) => {
    if (!pack.sketchImageKey) return;
    const work = input.workById.get(pack.workId);
    items.push(
      mediaItem({
        origin: input.origin,
        id: `technical-pack:${pack.id}`,
        kind: "technical-pack",
        recordId: pack.id,
        parentId: pack.workId,
        title: `${pack.techPackCode} / ${work?.title ?? "Technical Pack"}`,
        altText:
          pack.sketchAltText || `${pack.techPackCode} 技术平面图`,
        objectKey: pack.sketchImageKey,
        contentType:
          pack.sketchImageType || "application/octet-stream",
        bytes: pack.sketchImageSize ?? 0,
        status: ["approved", "locked"].includes(pack.status)
          ? "published"
          : "draft",
        createdAt: pack.createdAt,
        updatedAt: pack.updatedAt,
      }),
    );
  });
  input.fittingImages.forEach((image) => {
    const session = fittingSessionById.get(image.fittingSessionId);
    const work = session ? input.workById.get(session.workId) : null;
    items.push(
      mediaItem({
        origin: input.origin,
        id: `fitting:${image.id}`,
        kind: "fitting",
        recordId: image.id,
        parentId: image.fittingSessionId,
        title: `${session?.fittingCode ?? "Fitting"} / ${work?.title ?? image.angle}`,
        altText: image.altText,
        objectKey: image.imageKey,
        contentType: image.imageType,
        bytes: image.imageSize,
        status: "draft",
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
      }),
    );
  });
  input.sampleSignoffImages.forEach((image) => {
    const signoff = sampleSignoffById.get(image.sampleSignoffId);
    const work = signoff ? input.workById.get(signoff.workId) : null;
    items.push(
      mediaItem({
        origin: input.origin,
        id: `sample-signoff:${image.id}`,
        kind: "sample-signoff",
        recordId: image.id,
        parentId: image.sampleSignoffId,
        title: `${signoff?.signoffCode ?? "Final Sample"} / ${work?.title ?? image.angle}`,
        altText: image.altText,
        objectKey: image.imageKey,
        contentType: image.imageType,
        bytes: image.imageSize,
        status: "draft",
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
      }),
    );
  });
  input.productionAcceptanceImages.forEach((image) => {
    const acceptance = productionAcceptanceById.get(
      image.productionAcceptanceId,
    );
    const work = acceptance ? input.workById.get(acceptance.workId) : null;
    items.push(
      mediaItem({
        origin: input.origin,
        id: `production-acceptance:${image.id}`,
        kind: "production-acceptance",
        recordId: image.id,
        parentId: image.productionAcceptanceId,
        title: `${acceptance?.acceptanceCode ?? "Edition Acceptance"} / ${work?.title ?? image.angle}`,
        altText: image.altText,
        objectKey: image.imageKey,
        contentType: image.imageType,
        bytes: image.imageSize,
        status: "draft",
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
      }),
    );
  });
  input.conservationReportImages.forEach((image) => {
    const report = conservationReportById.get(image.conservationReportId);
    const work = report?.workId ? input.workById.get(report.workId) : null;
    items.push(
      mediaItem({
        origin: input.origin,
        id: `conservation:${image.id}`,
        kind: "conservation",
        recordId: image.id,
        parentId: image.conservationReportId,
        title: `${report?.reportCode ?? "Conservation"} / ${work?.title ?? image.angle}`,
        altText: image.altText,
        objectKey: image.imageKey,
        contentType: image.imageType,
        bytes: image.imageSize,
        status: "draft",
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
      }),
    );
  });
  input.exhibitionReadinessImages.forEach((image) => {
    const plan = exhibitionReadinessPlanById.get(image.exhibitionReadinessPlanId);
    const work = plan?.workId ? input.workById.get(plan.workId) : null;
    items.push(
      mediaItem({
        origin: input.origin,
        id: `exhibition-readiness:${image.id}`,
        kind: "exhibition-readiness",
        recordId: image.id,
        parentId: image.exhibitionReadinessPlanId,
        title: `${plan?.planCode ?? "Exhibition Readiness"} / ${work?.title ?? image.angle}`,
        altText: image.altText,
        objectKey: image.imageKey,
        contentType: image.imageType,
        bytes: image.imageSize,
        status: "draft",
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
      }),
    );
  });
  input.exhibitionWatchImages.forEach((image) => {
    const watch = exhibitionWatchById.get(image.exhibitionWatchId);
    const plan = watch ? exhibitionReadinessPlanById.get(watch.exhibitionReadinessPlanId) : null;
    const work = plan?.workId ? input.workById.get(plan.workId) : null;
    items.push(
      mediaItem({
        origin: input.origin,
        id: `exhibition-watch:${image.id}`,
        kind: "exhibition-watch",
        recordId: image.id,
        parentId: image.exhibitionWatchId,
        title: `${watch?.watchCode ?? "Exhibition Watch"} / ${work?.title ?? image.angle}`,
        altText: image.altText,
        objectKey: image.imageKey,
        contentType: image.imageType,
        bytes: image.imageSize,
        status: "draft",
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
      }),
    );
  });
  input.exhibitionRecoveryImages.forEach((image) => {
    const recovery = exhibitionRecoveryById.get(image.exhibitionRecoveryId);
    const watch = recovery ? exhibitionWatchById.get(recovery.exhibitionWatchId) : null;
    const plan = watch ? exhibitionReadinessPlanById.get(watch.exhibitionReadinessPlanId) : null;
    const work = plan?.workId ? input.workById.get(plan.workId) : null;
    items.push(
      mediaItem({
        origin: input.origin,
        id: `exhibition-recovery:${image.id}`,
        kind: "exhibition-recovery",
        recordId: image.id,
        parentId: image.exhibitionRecoveryId,
        title: `${recovery?.recoveryCode ?? "Exhibition Recovery"} / ${work?.title ?? image.angle}`,
        altText: image.altText,
        objectKey: image.imageKey,
        contentType: image.imageType,
        bytes: image.imageSize,
        status: "draft",
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
      }),
    );
  });
  input.exhibitionInstallationImages.forEach((image) => {
    const gate = exhibitionInstallationGateById.get(image.exhibitionInstallationGateId);
    items.push(
      mediaItem({
        origin: input.origin,
        id: `exhibition-installation:${image.id}`,
        kind: "exhibition-installation",
        recordId: image.id,
        parentId: image.exhibitionInstallationGateId,
        title: `${gate?.gateCode ?? "Exhibition Installation"} / ${image.angle}`,
        altText: image.altText,
        objectKey: image.imageKey,
        contentType: image.imageType,
        bytes: image.imageSize,
        status: "draft",
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
      }),
    );
  });
  return items.sort(
    (left, right) =>
      left.objectKey.localeCompare(right.objectKey) ||
      left.id.localeCompare(right.id),
  );
}

function mediaItem(
  input: Omit<ArchiveMediaItem, "mediaPath" | "publicUrl"> & {
    origin: string;
  },
): ArchiveMediaItem {
  const mediaPath = mediaUrl(input.objectKey);
  return {
    id: input.id,
    kind: input.kind,
    recordId: input.recordId,
    parentId: input.parentId,
    title: input.title,
    altText: input.altText,
    objectKey: input.objectKey,
    mediaPath,
    publicUrl: input.origin ? `${input.origin}${mediaPath}` : mediaPath,
    contentType: input.contentType,
    bytes: input.bytes,
    status: input.status,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

function createDelta(
  inventory: ArchiveInventory,
  snapshot: ArchiveSnapshotSummary,
): ArchiveDelta {
  return {
    works: inventory.works - snapshot.workCount,
    collections: inventory.collections - snapshot.collectionCount,
    processEntries: inventory.processEntries - snapshot.processCount,
    publications: inventory.publications - snapshot.publicationCount,
    calendarEvents: inventory.calendarEvents - snapshot.calendarEventCount,
    showrooms: inventory.showrooms - snapshot.showroomCount,
    showroomAssignments:
      inventory.showroomAssignments - snapshot.showroomAssignmentCount,
    showroomRequests:
      inventory.showroomRequests - snapshot.showroomRequestCount,
    showroomRequestItems:
      inventory.showroomRequestItems - snapshot.showroomRequestItemCount,
    sampleLoans: inventory.sampleLoans - snapshot.sampleLoanCount,
    sampleLoanItems:
      inventory.sampleLoanItems - snapshot.sampleLoanItemCount,
    sampleCommunications:
      inventory.sampleCommunications - snapshot.sampleCommunicationCount,
    sampleAssets: inventory.sampleAssets - snapshot.sampleAssetCount,
    sampleAudits: inventory.sampleAudits - snapshot.sampleAuditCount,
    sampleAuditItems:
      inventory.sampleAuditItems - snapshot.sampleAuditItemCount,
    samplePlacements:
      inventory.samplePlacements - snapshot.samplePlacementCount,
    samplePlacementItems:
      inventory.samplePlacementItems - snapshot.samplePlacementItemCount,
    relationshipContacts:
      inventory.relationshipContacts - snapshot.relationshipContactCount,
    relationshipOpportunities:
      inventory.relationshipOpportunities -
      snapshot.relationshipOpportunityCount,
    relationshipActivities:
      inventory.relationshipActivities - snapshot.relationshipActivityCount,
    outreachCampaigns:
      inventory.outreachCampaigns - snapshot.outreachCampaignCount,
    outreachRecipients:
      inventory.outreachRecipients - snapshot.outreachRecipientCount,
    designReviews:
      inventory.designReviews - snapshot.designReviewCount,
    designReviewActions:
      inventory.designReviewActions - snapshot.designReviewActionCount,
    materials: inventory.materials - snapshot.materialCount,
    workMaterials:
      inventory.workMaterials - snapshot.workMaterialCount,
    technicalPacks:
      inventory.technicalPacks - snapshot.technicalPackCount,
    techPackMeasurements:
      inventory.techPackMeasurements - snapshot.techPackMeasurementCount,
    techPackConstructionNotes:
      inventory.techPackConstructionNotes -
      snapshot.techPackConstructionNoteCount,
    fittingSessions:
      inventory.fittingSessions - snapshot.fittingSessionCount,
    fittingIssues: inventory.fittingIssues - snapshot.fittingIssueCount,
    fittingImages: inventory.fittingImages - snapshot.fittingImageCount,
    sampleSignoffs:
      inventory.sampleSignoffs - snapshot.sampleSignoffCount,
    sampleSignoffChecks:
      inventory.sampleSignoffChecks - snapshot.sampleSignoffCheckCount,
    sampleSignoffImages:
      inventory.sampleSignoffImages - snapshot.sampleSignoffImageCount,
    productionReleases:
      inventory.productionReleases - snapshot.productionReleaseCount,
    productionReleaseChecks:
      inventory.productionReleaseChecks -
      snapshot.productionReleaseCheckCount,
    productionExceptions:
      inventory.productionExceptions - snapshot.productionExceptionCount,
    productionExceptionActions:
      inventory.productionExceptionActions -
      snapshot.productionExceptionActionCount,
    productionAcceptances:
      inventory.productionAcceptances - snapshot.productionAcceptanceCount,
    productionAcceptanceChecks:
      inventory.productionAcceptanceChecks -
      snapshot.productionAcceptanceCheckCount,
    productionAcceptanceImages:
      inventory.productionAcceptanceImages -
      snapshot.productionAcceptanceImageCount,
    provenanceDossiers:
      inventory.provenanceDossiers - snapshot.provenanceDossierCount,
    provenanceDossierChecks:
      inventory.provenanceDossierChecks - snapshot.provenanceDossierCheckCount,
    conservationReports:
      inventory.conservationReports - snapshot.conservationReportCount,
    conservationReportChecks:
      inventory.conservationReportChecks - snapshot.conservationReportCheckCount,
    conservationReportImages:
      inventory.conservationReportImages - snapshot.conservationReportImageCount,
    exhibitionReadinessPlans:
      inventory.exhibitionReadinessPlans - snapshot.exhibitionReadinessPlanCount,
    exhibitionReadinessChecks:
      inventory.exhibitionReadinessChecks - snapshot.exhibitionReadinessCheckCount,
    exhibitionReadinessImages:
      inventory.exhibitionReadinessImages - snapshot.exhibitionReadinessImageCount,
    exhibitionWatches:
      inventory.exhibitionWatches - snapshot.exhibitionWatchCount,
    exhibitionWatchObservations:
      inventory.exhibitionWatchObservations - snapshot.exhibitionWatchObservationCount,
    exhibitionWatchImages:
      inventory.exhibitionWatchImages - snapshot.exhibitionWatchImageCount,
    exhibitionRecoveries:
      inventory.exhibitionRecoveries - snapshot.exhibitionRecoveryCount,
    exhibitionRecoveryChecks:
      inventory.exhibitionRecoveryChecks - snapshot.exhibitionRecoveryCheckCount,
    exhibitionRecoveryImages:
      inventory.exhibitionRecoveryImages - snapshot.exhibitionRecoveryImageCount,
    curatorialProjects:
      inventory.curatorialProjects - snapshot.curatorialProjectCount,
    curatorialSelections:
      inventory.curatorialSelections - snapshot.curatorialSelectionCount,
    interpretationPackages:
      inventory.interpretationPackages - snapshot.interpretationPackageCount,
    interpretationSections:
      inventory.interpretationSections - snapshot.interpretationSectionCount,
    interpretationLabels:
      inventory.interpretationLabels - snapshot.interpretationLabelCount,
    exhibitionDeliveryPackages:
      inventory.exhibitionDeliveryPackages - snapshot.exhibitionDeliveryPackageCount,
    exhibitionDeliveryItems:
      inventory.exhibitionDeliveryItems - snapshot.exhibitionDeliveryItemCount,
    exhibitionInstallationGates:
      inventory.exhibitionInstallationGates - snapshot.exhibitionInstallationGateCount,
    exhibitionInstallationChecks:
      inventory.exhibitionInstallationChecks - snapshot.exhibitionInstallationCheckCount,
    exhibitionInstallationImages:
      inventory.exhibitionInstallationImages - snapshot.exhibitionInstallationImageCount,
    exhibitionOpeningGates:
      inventory.exhibitionOpeningGates - snapshot.exhibitionOpeningGateCount,
    exhibitionOpeningItems:
      inventory.exhibitionOpeningItems - snapshot.exhibitionOpeningItemCount,
    mediaAssets: inventory.mediaAssets - snapshot.mediaCount,
    mediaBytes: inventory.mediaBytes - snapshot.mediaBytes,
  };
}

function normalizeOrigin(value?: string) {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`;
}

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
