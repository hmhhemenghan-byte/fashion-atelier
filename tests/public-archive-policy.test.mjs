import assert from "node:assert/strict";
import test from "node:test";
import {
  workPublicAdapter,
  collectionPublicAdapter,
  materialPublicAdapter,
  technicalPackPublicAdapter,
  provenancePublicAdapter,
  conservationPublicAdapter,
  PUBLIC_ARCHIVE_ADAPTERS,
} from "../lib/archive/public-policy";

const CANARY_SECRET_EMAIL = "SECRET_SUPPLIER_EMAIL@supplier.com";
const CANARY_PRIVATE_COST = "PRIVATE_COST_999";
const CANARY_CONFIDENTIAL_NOTE = "CONFIDENTIAL_FITTING_NOTE";
const CANARY_DESIGNER_ID = "SECRET_DESIGNER_ID_888";
const CANARY_INTERNAL_APPROVAL = "CONFIDENTIAL_INTERNAL_APPROVAL_NOTE";

test("Public Archive Adapters — Registry completeness", () => {
  assert.equal(typeof PUBLIC_ARCHIVE_ADAPTERS.work, "object");
  assert.equal(typeof PUBLIC_ARCHIVE_ADAPTERS.collection, "object");
  assert.equal(typeof PUBLIC_ARCHIVE_ADAPTERS.material, "object");
  assert.equal(typeof PUBLIC_ARCHIVE_ADAPTERS.technical, "object");
  assert.equal(typeof PUBLIC_ARCHIVE_ADAPTERS.provenance, "object");
  assert.equal(typeof PUBLIC_ARCHIVE_ADAPTERS.conservation, "object");
});

test("Work Public Adapter — Allowlist & Canary Protection", () => {
  const sourceWork = {
    id: "work-001",
    title: "Silk Draped Gown",
    collection: "AW 2027",
    lookNumber: "LOOK 01",
    description: "Hand-draped silk gown.",
    altText: "Front view of silk gown",
    imageKey: "works/work-001/hero.jpg",
    imageType: "image/jpeg",
    imageSize: 102400,
    status: "published",
    sortOrder: 1,
    createdBy: CANARY_DESIGNER_ID,
    publishedAt: "2026-08-01T00:00:00Z",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  };

  const dto = workPublicAdapter.toPublicDocument(sourceWork);
  assert.equal(dto.id, "work-001");
  assert.equal(dto.status, "published");
  assert.equal(dto.imageUrl, "/api/media/works/work-001/hero.jpg");
  assert.equal(dto.href, "/works/work-001");

  const dtoString = JSON.stringify(dto);
  assert.ok(!dtoString.includes(CANARY_DESIGNER_ID), "Designer ID leaked into public Work DTO");
});

test("Collection Public Adapter — Allowlist & Canary Protection", () => {
  const sourceCollection = {
    id: "col-001",
    slug: "second-skin",
    title: "SECOND SKIN",
    subtitle: "AW 2027 Collection",
    season: "AW",
    year: 2027,
    statement: "Exploring body architecture.",
    heroImageKey: "collections/hero.jpg",
    heroImageType: "image/jpeg",
    heroImageSize: 204800,
    heroAltText: "Collection hero image",
    status: "published",
    featured: true,
    sortOrder: 0,
    createdBy: CANARY_DESIGNER_ID,
    publishedAt: "2026-08-01T00:00:00Z",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  };

  const dto = collectionPublicAdapter.toPublicDocument(sourceCollection);
  assert.equal(dto.id, "col-001");
  assert.equal(dto.slug, "second-skin");
  assert.equal(dto.status, "published");
  assert.equal(dto.href, "/collections/second-skin");

  const dtoString = JSON.stringify(dto);
  assert.ok(!dtoString.includes(CANARY_DESIGNER_ID), "Designer ID leaked into public Collection DTO");
});

test("Material Public Adapter — Allowlist & Supplier Privacy Protection", () => {
  const sourceMaterial = {
    id: "mat-001",
    materialCode: "MAT-WOOL-01",
    name: "Architectural Double Wool",
    category: "fabric",
    status: "approved",
    composition: "100% Virgin Wool",
    construction: "Double Woven",
    colorName: "Midnight Black",
    colorCode: "BLK-01",
    supplierName: CANARY_SECRET_EMAIL,
    supplierReference: CANARY_PRIVATE_COST,
    origin: "Biella, Italy",
    weight: "480 gsm",
    width: "150 cm",
    handFeel: "Structured, crisp",
    finish: "Matte",
    certifications: "GOTS, OEKO-TEX 100",
    swatchImageKey: "materials/mat-001/swatch.jpg",
    swatchImageType: "image/jpeg",
    swatchImageSize: 51200,
    swatchAltText: "Black wool swatch",
    notes: CANARY_CONFIDENTIAL_NOTE,
    createdBy: CANARY_DESIGNER_ID,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  };

  const dto = materialPublicAdapter.toPublicDocument(sourceMaterial);
  assert.equal(dto.id, "mat-001");
  assert.equal(dto.materialCode, "MAT-WOOL-01");
  assert.equal(dto.status, "approved");
  assert.equal(dto.composition, "100% Virgin Wool");

  const dtoString = JSON.stringify(dto);
  assert.ok(!dtoString.includes(CANARY_SECRET_EMAIL), "Supplier email leaked into public Material DTO");
  assert.ok(!dtoString.includes(CANARY_PRIVATE_COST), "Private cost leaked into public Material DTO");
  assert.ok(!dtoString.includes(CANARY_CONFIDENTIAL_NOTE), "Confidential note leaked into public Material DTO");
  assert.ok(!dtoString.includes(CANARY_DESIGNER_ID), "Designer ID leaked into public Material DTO");
});

test("Technical Pack Public Adapter — Allowlist & Internal Notes Protection", () => {
  const sourceTechPack = {
    id: "tp-001",
    techPackCode: "TP-LOOK-01",
    workId: "work-001",
    revision: 2,
    status: "approved",
    sampleStage: "final",
    baseSize: "36",
    unit: "cm",
    fitIntent: "Tailored fit with sculpted shoulders",
    patternReference: "PAT-2027-01",
    constructionSummary: "Bound seams, hand-finished armholes",
    gradingNotes: "+/- 4cm chest grading per size",
    finishingNotes: "Steam press with wooden clapper",
    labelNotes: "Main label at interior neck",
    packagingNotes: "Breathable garment bag",
    sketchImageKey: "tech/tp-001/sketch.png",
    sketchImageType: "image/png",
    sketchImageSize: 80000,
    sketchAltText: "Technical flats",
    approvalNote: CANARY_INTERNAL_APPROVAL,
    approvedBy: CANARY_SECRET_EMAIL,
    approvedAt: "2026-08-01T00:00:00Z",
    notes: CANARY_CONFIDENTIAL_NOTE,
    createdBy: CANARY_DESIGNER_ID,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  };

  const dto = technicalPackPublicAdapter.toPublicDocument(sourceTechPack);
  assert.equal(dto.id, "tp-001");
  assert.equal(dto.techPackCode, "TP-LOOK-01");
  assert.equal(dto.status, "approved");
  assert.equal(dto.baseSize, "36");

  const dtoString = JSON.stringify(dto);
  assert.ok(!dtoString.includes(CANARY_INTERNAL_APPROVAL), "Approval note leaked into public TechPack DTO");
  assert.ok(!dtoString.includes(CANARY_SECRET_EMAIL), "ApprovedBy email leaked into public TechPack DTO");
  assert.ok(!dtoString.includes(CANARY_CONFIDENTIAL_NOTE), "Internal notes leaked into public TechPack DTO");
  assert.ok(!dtoString.includes(CANARY_DESIGNER_ID), "Designer ID leaked into public TechPack DTO");
});

test("Provenance Public Adapter — Allowlist & Internal Acceptance Protection", () => {
  const sourceProvenance = {
    id: "prov-001",
    dossierCode: "DOS-2026-001",
    slug: "draped-gown-provenance",
    productionAcceptanceId: "acc-123-secret",
    workId: "work-001",
    revision: 1,
    status: "published",
    decision: "publish",
    title: "Silk Draped Gown Provenance",
    subtitle: "Archive Piece #01",
    designStory: "Created during summer workshop in Paris.",
    materialDisclosure: "Organically farmed mulberry silk.",
    makerDisclosure: "Atelier NÉRA Paris team.",
    placeOfMaking: "Paris Atelier",
    madeAt: "2026-06-15",
    careGuidance: "Dry clean only.",
    repairGuidance: "Atelier re-stitching service available.",
    provenanceNote: "Exhibited at Paris Fashion Week.",
    publicSummary: "Masterpiece silk gown with complete origin chain.",
    reviewedBy: CANARY_SECRET_EMAIL,
    reviewedAt: "2026-07-20T00:00:00Z",
    publishedBy: CANARY_DESIGNER_ID,
    publishedAt: "2026-08-01T00:00:00Z",
    retiredAt: null,
    createdBy: CANARY_DESIGNER_ID,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  };

  const dto = provenancePublicAdapter.toPublicDocument(sourceProvenance);
  assert.equal(dto.id, "prov-001");
  assert.equal(dto.dossierCode, "DOS-2026-001");
  assert.equal(dto.status, "published");
  assert.equal(dto.placeOfMaking, "Paris Atelier");

  const dtoString = JSON.stringify(dto);
  assert.ok(!dtoString.includes("acc-123-secret"), "Production acceptance ID leaked into public Provenance DTO");
  assert.ok(!dtoString.includes(CANARY_SECRET_EMAIL), "Reviewer email leaked into public Provenance DTO");
  assert.ok(!dtoString.includes(CANARY_DESIGNER_ID), "Publisher/Creator ID leaked into public Provenance DTO");
});

test("Conservation Public Adapter — Allowlist & Internal Auditor Protection", () => {
  const sourceConservation = {
    id: "rep-001",
    reportCode: "REP-2026-001",
    sampleAssetId: "asset-456-secret",
    workId: "work-001",
    sequence: 1,
    status: "approved",
    decision: "monitor",
    assessedAt: "2026-07-10",
    assessmentLocation: "Vault A",
    overallCondition: "excellent",
    conditionSummary: "Garment is in pristine condition.",
    proposedTreatment: "Annual velvet brush and humidity check.",
    handlingRestriction: "Cotton gloves required.",
    storageGuidance: "Acid-free padded hanger in climate vault.",
    environmentalNotes: "Maintain 50% RH +/- 5%.",
    nextReviewAt: "2027-07-10",
    treatmentCompletedAt: null,
    approvalNote: CANARY_INTERNAL_APPROVAL,
    approvedBy: CANARY_SECRET_EMAIL,
    approvedAt: "2026-07-12T00:00:00Z",
    closedBy: CANARY_DESIGNER_ID,
    closedAt: null,
    createdBy: CANARY_DESIGNER_ID,
    createdAt: "2026-07-10T00:00:00Z",
    updatedAt: "2026-07-12T00:00:00Z",
  };

  const dto = conservationPublicAdapter.toPublicDocument(sourceConservation);
  assert.equal(dto.id, "rep-001");
  assert.equal(dto.reportCode, "REP-2026-001");
  assert.equal(dto.status, "approved");
  assert.equal(dto.overallCondition, "excellent");

  const dtoString = JSON.stringify(dto);
  assert.ok(!dtoString.includes(CANARY_INTERNAL_APPROVAL), "Approval note leaked into public Conservation DTO");
  assert.ok(!dtoString.includes(CANARY_SECRET_EMAIL), "Approver email leaked into public Conservation DTO");
  assert.ok(!dtoString.includes(CANARY_DESIGNER_ID), "Closer/Creator ID leaked into public Conservation DTO");
});
