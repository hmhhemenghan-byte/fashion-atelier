import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const works = sqliteTable(
  "works",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    collection: text("collection").notNull().default("SECOND SKIN / AW 2027"),
    lookNumber: text("look_number").notNull().default(""),
    description: text("description").notNull().default(""),
    altText: text("alt_text").notNull(),
    imageKey: text("image_key").notNull().unique(),
    imageType: text("image_type").notNull(),
    imageSize: integer("image_size").notNull(),
    status: text("status", { enum: ["draft", "published"] })
      .notNull()
      .default("draft"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    publishedAt: text("published_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("works_status_sort_idx").on(table.status, table.sortOrder),
    index("works_created_at_idx").on(table.createdAt),
  ],
);

export const workImages = sqliteTable(
  "work_images",
  {
    id: text("id").primaryKey(),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    imageKey: text("image_key").notNull().unique(),
    imageType: text("image_type").notNull(),
    imageSize: integer("image_size").notNull(),
    label: text("label").notNull().default("DETAIL"),
    altText: text("alt_text").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("work_images_work_sort_idx").on(table.workId, table.sortOrder)],
);

export const workProcessEntries = sqliteTable(
  "work_process_entries",
  {
    id: text("id").primaryKey(),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    stage: text("stage", {
      enum: [
        "research",
        "sketch",
        "material",
        "draping",
        "pattern",
        "fitting",
        "construction",
        "final",
      ],
    })
      .notNull()
      .default("research"),
    title: text("title").notNull(),
    notes: text("notes").notNull().default(""),
    dateLabel: text("date_label").notNull().default(""),
    imageKey: text("image_key").unique(),
    imageType: text("image_type"),
    imageSize: integer("image_size"),
    altText: text("alt_text").notNull().default(""),
    status: text("status", { enum: ["draft", "published"] })
      .notNull()
      .default("draft"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    publishedAt: text("published_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("work_process_work_sort_idx").on(table.workId, table.sortOrder),
    index("work_process_work_status_idx").on(table.workId, table.status),
    index("work_process_stage_idx").on(table.stage),
  ],
);

export const collections = sqliteTable(
  "collections",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    season: text("season").notNull().default(""),
    year: integer("year").notNull(),
    statement: text("statement").notNull().default(""),
    heroImageKey: text("hero_image_key").unique(),
    heroImageType: text("hero_image_type"),
    heroImageSize: integer("hero_image_size"),
    heroAltText: text("hero_alt_text").notNull().default(""),
    status: text("status", { enum: ["draft", "published"] })
      .notNull()
      .default("draft"),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    publishedAt: text("published_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("collections_status_sort_idx").on(
      table.status,
      table.sortOrder,
      table.publishedAt,
    ),
    index("collections_featured_idx").on(table.featured, table.status),
  ],
);

export const collectionWorks = sqliteTable(
  "collection_works",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    lookNumber: text("look_number").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.workId] }),
    index("collection_works_collection_sort_idx").on(
      table.collectionId,
      table.sortOrder,
    ),
    index("collection_works_work_idx").on(table.workId),
  ],
);

export const publications = sqliteTable(
  "publications",
  {
    id: text("id").primaryKey(),
    collectionId: text("collection_id")
      .notNull()
      .unique()
      .references(() => collections.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    headline: text("headline").notNull(),
    deck: text("deck").notNull().default(""),
    body: text("body").notNull().default(""),
    city: text("city").notNull().default(""),
    releaseDate: text("release_date").notNull().default(""),
    releaseAt: text("release_at"),
    contactName: text("contact_name").notNull().default(""),
    contactEmail: text("contact_email").notNull().default(""),
    photography: text("photography").notNull().default(""),
    styling: text("styling").notNull().default(""),
    casting: text("casting").notNull().default(""),
    hair: text("hair").notNull().default(""),
    makeup: text("makeup").notNull().default(""),
    production: text("production").notNull().default(""),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    status: text("status", {
      enum: ["draft", "scheduled", "published"],
    })
      .notNull()
      .default("draft"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    publishedAt: text("published_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("publications_status_release_idx").on(
      table.status,
      table.releaseAt,
      table.publishedAt,
    ),
    index("publications_sort_idx").on(table.sortOrder, table.createdAt),
  ],
);

export const editorialEvents = sqliteTable(
  "editorial_events",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    eventType: text("event_type", {
      enum: [
        "design_review",
        "fitting",
        "shoot",
        "lookbook",
        "press",
        "launch",
        "internal",
      ],
    })
      .notNull()
      .default("internal"),
    channel: text("channel", {
      enum: ["atelier", "site", "press", "showroom", "social"],
    })
      .notNull()
      .default("atelier"),
    status: text("status", {
      enum: ["planned", "in_progress", "ready", "completed", "cancelled"],
    })
      .notNull()
      .default("planned"),
    priority: text("priority", {
      enum: ["standard", "high", "critical"],
    })
      .notNull()
      .default("standard"),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at"),
    timezone: text("timezone").notNull().default("Europe/Paris"),
    allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
    location: text("location").notNull().default(""),
    notes: text("notes").notNull().default(""),
    collectionId: text("collection_id").references(() => collections.id, {
      onDelete: "set null",
    }),
    workId: text("work_id").references(() => works.id, {
      onDelete: "set null",
    }),
    publicationId: text("publication_id").references(() => publications.id, {
      onDelete: "set null",
    }),
    createdBy: text("created_by").notNull(),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("editorial_events_start_status_idx").on(
      table.startsAt,
      table.status,
    ),
    index("editorial_events_collection_idx").on(table.collectionId),
    index("editorial_events_work_idx").on(table.workId),
    index("editorial_events_publication_idx").on(table.publicationId),
  ],
);

export const showrooms = sqliteTable(
  "showrooms",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    audienceLabel: text("audience_label")
      .notNull()
      .default("PRIVATE APPOINTMENT"),
    introduction: text("introduction").notNull().default(""),
    status: text("status", {
      enum: ["draft", "active", "closed"],
    })
      .notNull()
      .default("draft"),
    accessTokenHash: text("access_token_hash").notNull(),
    accessTokenHint: text("access_token_hint").notNull(),
    expiresAt: text("expires_at"),
    contactName: text("contact_name").notNull().default(""),
    contactEmail: text("contact_email").notNull().default(""),
    allowDownloads: integer("allow_downloads", { mode: "boolean" })
      .notNull()
      .default(true),
    createdBy: text("created_by").notNull(),
    activatedAt: text("activated_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("showrooms_status_updated_idx").on(
      table.status,
      table.updatedAt,
    ),
    index("showrooms_expires_at_idx").on(table.expiresAt),
  ],
);

export const showroomWorks = sqliteTable(
  "showroom_works",
  {
    showroomId: text("showroom_id")
      .notNull()
      .references(() => showrooms.id, { onDelete: "cascade" }),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    note: text("note").notNull().default(""),
    sampleStatus: text("sample_status", {
      enum: ["available", "on_request", "unavailable"],
    })
      .notNull()
      .default("on_request"),
    sortOrder: integer("sort_order").notNull().default(0),
    featured: integer("featured", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.showroomId, table.workId] }),
    index("showroom_works_showroom_sort_idx").on(
      table.showroomId,
      table.sortOrder,
    ),
    index("showroom_works_work_idx").on(table.workId),
  ],
);

export const showroomRequests = sqliteTable(
  "showroom_requests",
  {
    id: text("id").primaryKey(),
    showroomId: text("showroom_id")
      .notNull()
      .references(() => showrooms.id, { onDelete: "cascade" }),
    referenceCode: text("reference_code").notNull().unique(),
    requesterName: text("requester_name").notNull(),
    requesterEmail: text("requester_email").notNull(),
    organization: text("organization").notNull().default(""),
    requesterRole: text("requester_role", {
      enum: ["buyer", "stylist", "editorial", "talent", "other"],
    }).notNull(),
    purpose: text("purpose", {
      enum: [
        "editorial_shoot",
        "red_carpet",
        "fitting",
        "buyer_review",
        "event",
        "other",
      ],
    }).notNull(),
    projectTitle: text("project_title").notNull(),
    neededFrom: text("needed_from"),
    neededUntil: text("needed_until"),
    deliveryCity: text("delivery_city").notNull().default(""),
    notes: text("notes").notNull().default(""),
    status: text("status", {
      enum: [
        "submitted",
        "reviewing",
        "approved",
        "declined",
        "completed",
        "cancelled",
      ],
    })
      .notNull()
      .default("submitted"),
    internalNotes: text("internal_notes").notNull().default(""),
    consent: integer("consent", { mode: "boolean" }).notNull().default(false),
    reviewedBy: text("reviewed_by"),
    reviewedAt: text("reviewed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("showroom_requests_showroom_created_idx").on(
      table.showroomId,
      table.createdAt,
    ),
    index("showroom_requests_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
    index("showroom_requests_email_created_idx").on(
      table.requesterEmail,
      table.createdAt,
    ),
  ],
);

export const showroomRequestItems = sqliteTable(
  "showroom_request_items",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => showroomRequests.id, { onDelete: "cascade" }),
    workId: text("work_id").references(() => works.id, {
      onDelete: "set null",
    }),
    workTitle: text("work_title").notNull(),
    lookNumber: text("look_number").notNull().default(""),
    imageKey: text("image_key").notNull().default(""),
    sampleStatus: text("sample_status", {
      enum: ["available", "on_request"],
    })
      .notNull()
      .default("on_request"),
    itemNote: text("item_note").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("showroom_request_items_request_sort_idx").on(
      table.requestId,
      table.sortOrder,
    ),
    index("showroom_request_items_work_idx").on(table.workId),
  ],
);

export const sampleLoans = sqliteTable(
  "sample_loans",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .unique()
      .references(() => showroomRequests.id, { onDelete: "cascade" }),
    loanCode: text("loan_code").notNull().unique(),
    status: text("status", {
      enum: [
        "preparing",
        "ready",
        "dispatched",
        "delivered",
        "in_use",
        "return_due",
        "return_in_transit",
        "returned",
        "closed",
        "cancelled",
      ],
    })
      .notNull()
      .default("preparing"),
    contactPhone: text("contact_phone").notNull().default(""),
    deliveryAddress: text("delivery_address").notNull().default(""),
    outboundCarrier: text("outbound_carrier").notNull().default(""),
    outboundTracking: text("outbound_tracking").notNull().default(""),
    outboundSentAt: text("outbound_sent_at"),
    deliveredAt: text("delivered_at"),
    expectedReturnAt: text("expected_return_at"),
    returnCarrier: text("return_carrier").notNull().default(""),
    returnTracking: text("return_tracking").notNull().default(""),
    returnReceivedAt: text("return_received_at"),
    logisticsNotes: text("logistics_notes").notNull().default(""),
    createdBy: text("created_by").notNull(),
    closedAt: text("closed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("sample_loans_status_return_idx").on(
      table.status,
      table.expectedReturnAt,
    ),
    index("sample_loans_created_at_idx").on(table.createdAt),
  ],
);

export const sampleAssets = sqliteTable(
  "sample_assets",
  {
    id: text("id").primaryKey(),
    workId: text("work_id").references(() => works.id, {
      onDelete: "set null",
    }),
    workTitle: text("work_title").notNull(),
    lookNumber: text("look_number").notNull().default(""),
    imageKey: text("image_key").notNull().default(""),
    assetCode: text("asset_code").notNull().unique(),
    tagCode: text("tag_code").unique(),
    sizeLabel: text("size_label").notNull().default(""),
    colorLabel: text("color_label").notNull().default(""),
    category: text("category", {
      enum: [
        "garment",
        "accessory",
        "footwear",
        "bag",
        "jewelry",
        "other",
      ],
    })
      .notNull()
      .default("garment"),
    status: text("status", {
      enum: [
        "available",
        "reserved",
        "in_transit",
        "out_on_loan",
        "maintenance",
        "missing",
        "archived",
      ],
    })
      .notNull()
      .default("available"),
    condition: text("condition", {
      enum: ["not_checked", "excellent", "good", "worn", "damaged"],
    })
      .notNull()
      .default("not_checked"),
    department: text("department").notNull().default("SHOWROOM"),
    homeLocation: text("home_location").notNull().default("MAIN RACK"),
    currentLocation: text("current_location").notNull().default("MAIN RACK"),
    notes: text("notes").notNull().default(""),
    lastSeenAt: text("last_seen_at"),
    lastAuditAt: text("last_audit_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("sample_assets_work_idx").on(table.workId),
    index("sample_assets_status_location_idx").on(
      table.status,
      table.currentLocation,
    ),
    index("sample_assets_department_idx").on(table.department),
    index("sample_assets_updated_at_idx").on(table.updatedAt),
  ],
);

export const sampleLoanItems = sqliteTable(
  "sample_loan_items",
  {
    id: text("id").primaryKey(),
    loanId: text("loan_id")
      .notNull()
      .references(() => sampleLoans.id, { onDelete: "cascade" }),
    requestItemId: text("request_item_id").references(
      () => showroomRequestItems.id,
      { onDelete: "set null" },
    ),
    workId: text("work_id").references(() => works.id, {
      onDelete: "set null",
    }),
    sampleAssetId: text("sample_asset_id").references(
      () => sampleAssets.id,
      { onDelete: "set null" },
    ),
    workTitle: text("work_title").notNull(),
    lookNumber: text("look_number").notNull().default(""),
    imageKey: text("image_key").notNull().default(""),
    sampleCode: text("sample_code").notNull().default(""),
    sizeLabel: text("size_label").notNull().default(""),
    status: text("status", {
      enum: [
        "reserved",
        "packing",
        "dispatched",
        "with_recipient",
        "returning",
        "returned",
        "unavailable",
        "damaged",
        "lost",
      ],
    })
      .notNull()
      .default("reserved"),
    outboundCondition: text("outbound_condition", {
      enum: ["not_checked", "excellent", "good", "worn", "damaged"],
    })
      .notNull()
      .default("not_checked"),
    returnCondition: text("return_condition", {
      enum: ["not_checked", "excellent", "good", "worn", "damaged"],
    })
      .notNull()
      .default("not_checked"),
    conditionNotes: text("condition_notes").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("sample_loan_items_loan_sort_idx").on(
      table.loanId,
      table.sortOrder,
    ),
    index("sample_loan_items_status_idx").on(table.status),
    index("sample_loan_items_work_idx").on(table.workId),
    index("sample_loan_items_asset_idx").on(table.sampleAssetId),
  ],
);

export const samplePlacements = sqliteTable(
  "sample_placements",
  {
    id: text("id").primaryKey(),
    placementCode: text("placement_code").notNull().unique(),
    loanId: text("loan_id").references(() => sampleLoans.id, {
      onDelete: "set null",
    }),
    status: text("status", {
      enum: [
        "pending",
        "shot",
        "placed",
        "published",
        "not_placed",
        "archived",
      ],
    })
      .notNull()
      .default("pending"),
    placementType: text("placement_type", {
      enum: [
        "editorial",
        "red_carpet",
        "celebrity",
        "influencer",
        "film_tv",
        "event",
        "buyer",
        "other",
      ],
    })
      .notNull()
      .default("editorial"),
    channel: text("channel", {
      enum: ["print", "online", "social", "broadcast", "event", "other"],
    })
      .notNull()
      .default("print"),
    title: text("title").notNull(),
    outletName: text("outlet_name").notNull().default(""),
    voiceName: text("voice_name").notNull().default(""),
    voiceType: text("voice_type", {
      enum: [
        "media",
        "celebrity",
        "influencer",
        "partner",
        "owned_media",
        "other",
      ],
    })
      .notNull()
      .default("media"),
    eventName: text("event_name").notNull().default(""),
    market: text("market").notNull().default(""),
    country: text("country").notNull().default(""),
    placementDate: text("placement_date"),
    sourceUrl: text("source_url").notNull().default(""),
    evidenceImageKey: text("evidence_image_key").notNull().default(""),
    evidenceImageType: text("evidence_image_type").notNull().default(""),
    evidenceImageSize: integer("evidence_image_size").notNull().default(0),
    evidenceAltText: text("evidence_alt_text").notNull().default(""),
    reportedReach: integer("reported_reach"),
    reportedEngagements: integer("reported_engagements"),
    reportedImpactCents: integer("reported_impact_cents"),
    impactCurrency: text("impact_currency").notNull().default("USD"),
    metricMode: text("metric_mode", {
      enum: ["not_recorded", "reported", "verified"],
    })
      .notNull()
      .default("not_recorded"),
    metricSource: text("metric_source").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").notNull(),
    verifiedBy: text("verified_by"),
    verifiedAt: text("verified_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("sample_placements_status_date_idx").on(
      table.status,
      table.placementDate,
    ),
    index("sample_placements_loan_idx").on(table.loanId),
    index("sample_placements_channel_voice_idx").on(
      table.channel,
      table.voiceType,
    ),
    index("sample_placements_updated_at_idx").on(table.updatedAt),
  ],
);

export const samplePlacementItems = sqliteTable(
  "sample_placement_items",
  {
    id: text("id").primaryKey(),
    placementId: text("placement_id")
      .notNull()
      .references(() => samplePlacements.id, { onDelete: "cascade" }),
    sampleLoanItemId: text("sample_loan_item_id").references(
      () => sampleLoanItems.id,
      { onDelete: "set null" },
    ),
    sampleAssetId: text("sample_asset_id").references(
      () => sampleAssets.id,
      { onDelete: "set null" },
    ),
    workId: text("work_id").references(() => works.id, {
      onDelete: "set null",
    }),
    assetCode: text("asset_code").notNull().default(""),
    workTitle: text("work_title").notNull(),
    lookNumber: text("look_number").notNull().default(""),
    imageKey: text("image_key").notNull().default(""),
    featured: integer("featured", { mode: "boolean" })
      .notNull()
      .default(false),
    creditText: text("credit_text").notNull().default(""),
    notes: text("notes").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("sample_placement_items_placement_loan_item_uidx").on(
      table.placementId,
      table.sampleLoanItemId,
    ),
    index("sample_placement_items_placement_sort_idx").on(
      table.placementId,
      table.sortOrder,
    ),
    index("sample_placement_items_asset_idx").on(table.sampleAssetId),
    index("sample_placement_items_work_idx").on(table.workId),
  ],
);

export const sampleCommunications = sqliteTable(
  "sample_communications",
  {
    id: text("id").primaryKey(),
    loanId: text("loan_id")
      .notNull()
      .references(() => sampleLoans.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: [
        "confirmation",
        "dispatch",
        "delivery",
        "return_reminder",
        "overdue",
        "return_received",
        "exception",
        "custom",
      ],
    })
      .notNull()
      .default("custom"),
    channel: text("channel", {
      enum: ["email", "phone", "messaging", "in_person", "internal"],
    })
      .notNull()
      .default("email"),
    direction: text("direction", {
      enum: ["outbound", "inbound", "internal"],
    })
      .notNull()
      .default("outbound"),
    status: text("status", {
      enum: ["draft", "logged", "acknowledged", "resolved"],
    })
      .notNull()
      .default("draft"),
    recipientName: text("recipient_name").notNull().default(""),
    recipientAddress: text("recipient_address").notNull().default(""),
    subject: text("subject").notNull().default(""),
    body: text("body").notNull().default(""),
    followUpAt: text("follow_up_at"),
    occurredAt: text("occurred_at"),
    resolvedAt: text("resolved_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("sample_communications_loan_created_idx").on(
      table.loanId,
      table.createdAt,
    ),
    index("sample_communications_follow_up_idx").on(
      table.status,
      table.followUpAt,
    ),
    index("sample_communications_kind_idx").on(table.kind),
  ],
);

export const sampleAudits = sqliteTable(
  "sample_audits",
  {
    id: text("id").primaryKey(),
    auditCode: text("audit_code").notNull().unique(),
    label: text("label").notNull(),
    scopeLocation: text("scope_location").notNull().default(""),
    scopeDepartment: text("scope_department").notNull().default(""),
    status: text("status", {
      enum: ["counting", "review", "completed", "cancelled"],
    })
      .notNull()
      .default("counting"),
    notes: text("notes").notNull().default(""),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("sample_audits_status_started_idx").on(
      table.status,
      table.startedAt,
    ),
    index("sample_audits_created_at_idx").on(table.createdAt),
  ],
);

export const sampleAuditItems = sqliteTable(
  "sample_audit_items",
  {
    id: text("id").primaryKey(),
    auditId: text("audit_id")
      .notNull()
      .references(() => sampleAudits.id, { onDelete: "cascade" }),
    sampleAssetId: text("sample_asset_id").references(
      () => sampleAssets.id,
      { onDelete: "set null" },
    ),
    assetCode: text("asset_code").notNull(),
    workTitle: text("work_title").notNull().default(""),
    expectedStatus: text("expected_status").notNull().default(""),
    expectedLocation: text("expected_location").notNull().default(""),
    observedLocation: text("observed_location").notNull().default(""),
    observedCondition: text("observed_condition", {
      enum: ["not_checked", "excellent", "good", "worn", "damaged"],
    })
      .notNull()
      .default("not_checked"),
    result: text("result", {
      enum: [
        "pending",
        "matched",
        "accounted_out",
        "misplaced",
        "missing",
        "unexpected",
      ],
    })
      .notNull()
      .default("pending"),
    scannedAt: text("scanned_at"),
    resolvedAt: text("resolved_at"),
    resolutionNote: text("resolution_note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("sample_audit_items_audit_asset_uidx").on(
      table.auditId,
      table.sampleAssetId,
    ),
    index("sample_audit_items_audit_result_idx").on(
      table.auditId,
      table.result,
    ),
  ],
);

export const relationshipContacts = sqliteTable(
  "relationship_contacts",
  {
    id: text("id").primaryKey(),
    contactCode: text("contact_code").notNull().unique(),
    name: text("name").notNull(),
    organization: text("organization").notNull().default(""),
    roleTitle: text("role_title").notNull().default(""),
    contactType: text("contact_type", {
      enum: [
        "editor",
        "stylist",
        "buyer",
        "talent_team",
        "influencer",
        "media",
        "partner",
        "production",
        "other",
      ],
    })
      .notNull()
      .default("other"),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    market: text("market").notNull().default(""),
    city: text("city").notNull().default(""),
    preferredChannel: text("preferred_channel", {
      enum: ["email", "phone", "messaging", "in_person", "none"],
    })
      .notNull()
      .default("email"),
    tier: text("tier", {
      enum: ["priority", "core", "developing", "dormant"],
    })
      .notNull()
      .default("developing"),
    status: text("status", {
      enum: ["active", "paused", "archived"],
    })
      .notNull()
      .default("active"),
    contactability: text("contactability", {
      enum: ["unknown", "business_context", "opted_in", "do_not_contact"],
    })
      .notNull()
      .default("unknown"),
    sourceType: text("source_type", {
      enum: [
        "manual",
        "showroom_request",
        "sample_loan",
        "placement",
        "publication",
        "other",
      ],
    })
      .notNull()
      .default("manual"),
    sourceId: text("source_id").notNull().default(""),
    tagsJson: text("tags_json").notNull().default("[]"),
    notes: text("notes").notNull().default(""),
    lastContactAt: text("last_contact_at"),
    nextFollowUpAt: text("next_follow_up_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("relationship_contacts_status_tier_idx").on(
      table.status,
      table.tier,
    ),
    index("relationship_contacts_type_market_idx").on(
      table.contactType,
      table.market,
    ),
    index("relationship_contacts_follow_up_idx").on(
      table.status,
      table.nextFollowUpAt,
    ),
    index("relationship_contacts_email_idx").on(table.email),
    index("relationship_contacts_source_idx").on(
      table.sourceType,
      table.sourceId,
    ),
  ],
);

export const relationshipOpportunities = sqliteTable(
  "relationship_opportunities",
  {
    id: text("id").primaryKey(),
    opportunityCode: text("opportunity_code").notNull().unique(),
    contactId: text("contact_id")
      .notNull()
      .references(() => relationshipContacts.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: text("kind", {
      enum: [
        "editorial",
        "dressing",
        "buyer",
        "press",
        "partnership",
        "event",
        "content",
        "other",
      ],
    })
      .notNull()
      .default("editorial"),
    stage: text("stage", {
      enum: [
        "signal",
        "qualified",
        "ready",
        "conversation",
        "sample",
        "active",
        "won",
        "lost",
        "on_hold",
      ],
    })
      .notNull()
      .default("signal"),
    priority: text("priority", {
      enum: ["low", "normal", "high", "urgent"],
    })
      .notNull()
      .default("normal"),
    collection: text("collection").notNull().default(""),
    market: text("market").notNull().default(""),
    sourceType: text("source_type", {
      enum: [
        "manual",
        "showroom_request",
        "sample_loan",
        "placement",
        "publication",
        "other",
      ],
    })
      .notNull()
      .default("manual"),
    sourceId: text("source_id").notNull().default(""),
    summary: text("summary").notNull().default(""),
    nextAction: text("next_action").notNull().default(""),
    nextActionAt: text("next_action_at"),
    outcome: text("outcome").notNull().default(""),
    closedAt: text("closed_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("relationship_opportunities_contact_stage_idx").on(
      table.contactId,
      table.stage,
    ),
    index("relationship_opportunities_stage_action_idx").on(
      table.stage,
      table.nextActionAt,
    ),
    index("relationship_opportunities_priority_idx").on(table.priority),
    index("relationship_opportunities_source_idx").on(
      table.sourceType,
      table.sourceId,
    ),
  ],
);

export const relationshipActivities = sqliteTable(
  "relationship_activities",
  {
    id: text("id").primaryKey(),
    contactId: text("contact_id")
      .notNull()
      .references(() => relationshipContacts.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id").references(
      () => relationshipOpportunities.id,
      { onDelete: "set null" },
    ),
    kind: text("kind", {
      enum: [
        "note",
        "email",
        "call",
        "meeting",
        "introduction",
        "sample",
        "coverage",
        "follow_up",
        "other",
      ],
    })
      .notNull()
      .default("note"),
    channel: text("channel", {
      enum: ["email", "phone", "messaging", "in_person", "internal"],
    })
      .notNull()
      .default("internal"),
    direction: text("direction", {
      enum: ["inbound", "outbound", "internal"],
    })
      .notNull()
      .default("internal"),
    status: text("status", {
      enum: ["planned", "completed", "cancelled"],
    })
      .notNull()
      .default("planned"),
    subject: text("subject").notNull(),
    notes: text("notes").notNull().default(""),
    dueAt: text("due_at"),
    occurredAt: text("occurred_at"),
    completedAt: text("completed_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("relationship_activities_contact_time_idx").on(
      table.contactId,
      table.occurredAt,
      table.createdAt,
    ),
    index("relationship_activities_opportunity_idx").on(
      table.opportunityId,
      table.createdAt,
    ),
    index("relationship_activities_status_due_idx").on(
      table.status,
      table.dueAt,
    ),
  ],
);

export const outreachCampaigns = sqliteTable(
  "outreach_campaigns",
  {
    id: text("id").primaryKey(),
    campaignCode: text("campaign_code").notNull().unique(),
    title: text("title").notNull(),
    objective: text("objective", {
      enum: [
        "collection_launch",
        "press_preview",
        "showroom_invitation",
        "editorial_pitch",
        "buyer_follow_up",
        "event_follow_up",
        "partnership",
        "other",
      ],
    })
      .notNull()
      .default("collection_launch"),
    status: text("status", {
      enum: [
        "draft",
        "review",
        "ready",
        "active",
        "paused",
        "completed",
        "archived",
      ],
    })
      .notNull()
      .default("draft"),
    language: text("language", {
      enum: ["zh", "en", "bilingual"],
    })
      .notNull()
      .default("bilingual"),
    collectionId: text("collection_id").references(() => collections.id, {
      onDelete: "set null",
    }),
    publicationId: text("publication_id").references(() => publications.id, {
      onDelete: "set null",
    }),
    showroomId: text("showroom_id").references(() => showrooms.id, {
      onDelete: "set null",
    }),
    market: text("market").notNull().default(""),
    audienceNote: text("audience_note").notNull().default(""),
    subjectLine: text("subject_line").notNull().default(""),
    coreMessage: text("core_message").notNull().default(""),
    callToAction: text("call_to_action").notNull().default(""),
    embargoAt: text("embargo_at"),
    windowStartAt: text("window_start_at"),
    windowEndAt: text("window_end_at"),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("outreach_campaigns_status_window_idx").on(
      table.status,
      table.windowStartAt,
    ),
    index("outreach_campaigns_collection_idx").on(
      table.collectionId,
      table.createdAt,
    ),
    index("outreach_campaigns_publication_idx").on(table.publicationId),
    index("outreach_campaigns_showroom_idx").on(table.showroomId),
  ],
);

export const outreachRecipients = sqliteTable(
  "outreach_recipients",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => outreachCampaigns.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => relationshipContacts.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id").references(
      () => relationshipOpportunities.id,
      { onDelete: "set null" },
    ),
    status: text("status", {
      enum: [
        "proposed",
        "blocked",
        "approved",
        "drafted",
        "recorded_sent",
        "replied",
        "skipped",
      ],
    })
      .notNull()
      .default("proposed"),
    eligibilitySnapshot: text("eligibility_snapshot", {
      enum: [
        "eligible",
        "missing_channel",
        "consent_unknown",
        "do_not_contact",
        "inactive",
      ],
    })
      .notNull()
      .default("consent_unknown"),
    angle: text("angle").notNull().default(""),
    draftSubject: text("draft_subject").notNull().default(""),
    draftBody: text("draft_body").notNull().default(""),
    approvalNote: text("approval_note").notNull().default(""),
    approvedAt: text("approved_at"),
    sentAt: text("sent_at"),
    repliedAt: text("replied_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("outreach_recipients_campaign_contact_uidx").on(
      table.campaignId,
      table.contactId,
    ),
    index("outreach_recipients_campaign_status_idx").on(
      table.campaignId,
      table.status,
    ),
    index("outreach_recipients_contact_status_idx").on(
      table.contactId,
      table.status,
    ),
    index("outreach_recipients_opportunity_idx").on(table.opportunityId),
  ],
);

export const materials = sqliteTable(
  "materials",
  {
    id: text("id").primaryKey(),
    materialCode: text("material_code").notNull().unique(),
    name: text("name").notNull(),
    category: text("category", {
      enum: [
        "fabric",
        "knit",
        "leather",
        "lining",
        "trim",
        "hardware",
        "embellishment",
        "other",
      ],
    })
      .notNull()
      .default("fabric"),
    status: text("status", {
      enum: ["research", "sampling", "approved", "hold", "archived"],
    })
      .notNull()
      .default("research"),
    composition: text("composition").notNull().default(""),
    construction: text("construction").notNull().default(""),
    colorName: text("color_name").notNull().default(""),
    colorCode: text("color_code").notNull().default(""),
    supplierName: text("supplier_name").notNull().default(""),
    supplierReference: text("supplier_reference").notNull().default(""),
    origin: text("origin").notNull().default(""),
    weight: text("weight").notNull().default(""),
    width: text("width").notNull().default(""),
    handFeel: text("hand_feel").notNull().default(""),
    finish: text("finish").notNull().default(""),
    certifications: text("certifications").notNull().default(""),
    swatchImageKey: text("swatch_image_key").unique(),
    swatchImageType: text("swatch_image_type"),
    swatchImageSize: integer("swatch_image_size"),
    swatchAltText: text("swatch_alt_text").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("materials_status_category_idx").on(table.status, table.category),
    index("materials_supplier_idx").on(table.supplierName),
    index("materials_updated_at_idx").on(table.updatedAt),
  ],
);

export const workMaterials = sqliteTable(
  "work_materials",
  {
    id: text("id").primaryKey(),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    role: text("role", {
      enum: [
        "shell",
        "lining",
        "interlining",
        "trim",
        "hardware",
        "embellishment",
        "label",
        "other",
      ],
    })
      .notNull()
      .default("shell"),
    status: text("status", {
      enum: ["proposed", "selected", "approved", "dropped"],
    })
      .notNull()
      .default("proposed"),
    placement: text("placement").notNull().default(""),
    colorway: text("colorway").notNull().default(""),
    consumption: text("consumption").notNull().default(""),
    unit: text("unit", {
      enum: ["m", "yd", "pcs", "g", "set", "other"],
    })
      .notNull()
      .default("m"),
    notes: text("notes").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("work_materials_work_sort_idx").on(table.workId, table.sortOrder),
    index("work_materials_material_idx").on(table.materialId),
    index("work_materials_status_idx").on(table.status),
  ],
);

export const technicalPacks = sqliteTable(
  "technical_packs",
  {
    id: text("id").primaryKey(),
    techPackCode: text("tech_pack_code").notNull().unique(),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull().default(1),
    status: text("status", {
      enum: ["draft", "review", "approved", "locked"],
    })
      .notNull()
      .default("draft"),
    sampleStage: text("sample_stage", {
      enum: [
        "concept",
        "toile",
        "prototype",
        "fit",
        "preproduction",
        "final",
      ],
    })
      .notNull()
      .default("concept"),
    baseSize: text("base_size").notNull().default(""),
    unit: text("unit", { enum: ["cm", "in"] })
      .notNull()
      .default("cm"),
    fitIntent: text("fit_intent").notNull().default(""),
    patternReference: text("pattern_reference").notNull().default(""),
    constructionSummary: text("construction_summary").notNull().default(""),
    gradingNotes: text("grading_notes").notNull().default(""),
    finishingNotes: text("finishing_notes").notNull().default(""),
    labelNotes: text("label_notes").notNull().default(""),
    packagingNotes: text("packaging_notes").notNull().default(""),
    sketchImageKey: text("sketch_image_key").unique(),
    sketchImageType: text("sketch_image_type"),
    sketchImageSize: integer("sketch_image_size"),
    sketchAltText: text("sketch_alt_text").notNull().default(""),
    approvalNote: text("approval_note").notNull().default(""),
    approvedBy: text("approved_by").notNull().default(""),
    approvedAt: text("approved_at"),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("technical_packs_work_revision_uidx").on(
      table.workId,
      table.revision,
    ),
    index("technical_packs_status_stage_idx").on(
      table.status,
      table.sampleStage,
    ),
    index("technical_packs_work_updated_idx").on(
      table.workId,
      table.updatedAt,
    ),
  ],
);

export const techPackMeasurements = sqliteTable(
  "tech_pack_measurements",
  {
    id: text("id").primaryKey(),
    techPackId: text("tech_pack_id")
      .notNull()
      .references(() => technicalPacks.id, { onDelete: "cascade" }),
    pointCode: text("point_code").notNull().default(""),
    label: text("label").notNull(),
    value: text("value").notNull().default(""),
    tolerancePlus: text("tolerance_plus").notNull().default(""),
    toleranceMinus: text("tolerance_minus").notNull().default(""),
    method: text("method").notNull().default(""),
    status: text("status", { enum: ["active", "removed"] })
      .notNull()
      .default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("tech_pack_measurements_pack_sort_idx").on(
      table.techPackId,
      table.sortOrder,
    ),
    index("tech_pack_measurements_pack_status_idx").on(
      table.techPackId,
      table.status,
    ),
  ],
);

export const techPackConstructionNotes = sqliteTable(
  "tech_pack_construction_notes",
  {
    id: text("id").primaryKey(),
    techPackId: text("tech_pack_id")
      .notNull()
      .references(() => technicalPacks.id, { onDelete: "cascade" }),
    category: text("category", {
      enum: [
        "seam",
        "stitch",
        "finish",
        "trim",
        "label",
        "artwork",
        "packing",
        "other",
      ],
    })
      .notNull()
      .default("seam"),
    title: text("title").notNull(),
    instruction: text("instruction").notNull().default(""),
    priority: text("priority", {
      enum: ["standard", "important", "critical"],
    })
      .notNull()
      .default("standard"),
    status: text("status", {
      enum: ["open", "confirmed", "removed"],
    })
      .notNull()
      .default("open"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("tech_pack_notes_pack_sort_idx").on(
      table.techPackId,
      table.sortOrder,
    ),
    index("tech_pack_notes_pack_status_idx").on(
      table.techPackId,
      table.status,
    ),
  ],
);

export const fittingSessions = sqliteTable(
  "fitting_sessions",
  {
    id: text("id").primaryKey(),
    fittingCode: text("fitting_code").notNull().unique(),
    technicalPackId: text("technical_pack_id")
      .notNull()
      .references(() => technicalPacks.id, { onDelete: "cascade" }),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    round: integer("round").notNull().default(1),
    status: text("status", {
      enum: ["planned", "in_review", "approved", "closed", "cancelled"],
    })
      .notNull()
      .default("planned"),
    decision: text("decision", {
      enum: ["pending", "approve", "revise", "hold"],
    })
      .notNull()
      .default("pending"),
    sampleSize: text("sample_size").notNull().default(""),
    fittingAt: text("fitting_at"),
    location: text("location").notNull().default(""),
    fitModelReference: text("fit_model_reference").notNull().default(""),
    objective: text("objective").notNull().default(""),
    balanceNotes: text("balance_notes").notNull().default(""),
    silhouetteNotes: text("silhouette_notes").notNull().default(""),
    movementNotes: text("movement_notes").notNull().default(""),
    comfortNotes: text("comfort_notes").notNull().default(""),
    conclusion: text("conclusion").notNull().default(""),
    nextFittingAt: text("next_fitting_at"),
    approvalNote: text("approval_note").notNull().default(""),
    approvedBy: text("approved_by").notNull().default(""),
    approvedAt: text("approved_at"),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("fitting_sessions_pack_round_uidx").on(
      table.technicalPackId,
      table.round,
    ),
    index("fitting_sessions_status_date_idx").on(
      table.status,
      table.fittingAt,
    ),
    index("fitting_sessions_work_updated_idx").on(
      table.workId,
      table.updatedAt,
    ),
  ],
);

export const fittingIssues = sqliteTable(
  "fitting_issues",
  {
    id: text("id").primaryKey(),
    fittingSessionId: text("fitting_session_id")
      .notNull()
      .references(() => fittingSessions.id, { onDelete: "cascade" }),
    category: text("category", {
      enum: [
        "balance",
        "proportion",
        "ease",
        "length",
        "shape",
        "mobility",
        "construction",
        "styling",
        "other",
      ],
    })
      .notNull()
      .default("balance"),
    area: text("area").notNull().default(""),
    side: text("side", {
      enum: ["all", "front", "back", "left", "right", "inside"],
    })
      .notNull()
      .default("all"),
    observation: text("observation").notNull(),
    alteration: text("alteration").notNull().default(""),
    pointCode: text("point_code").notNull().default(""),
    severity: text("severity", {
      enum: ["note", "important", "critical"],
    })
      .notNull()
      .default("important"),
    status: text("status", {
      enum: ["open", "in_progress", "resolved", "removed"],
    })
      .notNull()
      .default("open"),
    ownerName: text("owner_name").notNull().default(""),
    dueAt: text("due_at"),
    resolvedAt: text("resolved_at"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("fitting_issues_session_sort_idx").on(
      table.fittingSessionId,
      table.sortOrder,
    ),
    index("fitting_issues_status_due_idx").on(
      table.status,
      table.dueAt,
    ),
  ],
);

export const fittingImages = sqliteTable(
  "fitting_images",
  {
    id: text("id").primaryKey(),
    fittingSessionId: text("fitting_session_id")
      .notNull()
      .references(() => fittingSessions.id, { onDelete: "cascade" }),
    imageKey: text("image_key").notNull().unique(),
    imageType: text("image_type").notNull(),
    imageSize: integer("image_size").notNull(),
    angle: text("angle", {
      enum: ["front", "side", "back", "detail", "movement", "other"],
    })
      .notNull()
      .default("front"),
    caption: text("caption").notNull().default(""),
    altText: text("alt_text").notNull(),
    status: text("status", { enum: ["active", "removed"] })
      .notNull()
      .default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("fitting_images_session_sort_idx").on(
      table.fittingSessionId,
      table.sortOrder,
    ),
    index("fitting_images_session_status_idx").on(
      table.fittingSessionId,
      table.status,
    ),
  ],
);

export const sampleSignoffs = sqliteTable(
  "sample_signoffs",
  {
    id: text("id").primaryKey(),
    signoffCode: text("signoff_code").notNull().unique(),
    technicalPackId: text("technical_pack_id")
      .notNull()
      .references(() => technicalPacks.id, { onDelete: "cascade" }),
    fittingSessionId: text("fitting_session_id")
      .notNull()
      .references(() => fittingSessions.id, { onDelete: "cascade" }),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    round: integer("round").notNull().default(1),
    sampleType: text("sample_type", {
      enum: ["preproduction", "final", "showroom", "reference"],
    })
      .notNull()
      .default("preproduction"),
    status: text("status", {
      enum: ["draft", "in_review", "approved", "sealed", "void"],
    })
      .notNull()
      .default("draft"),
    decision: text("decision", {
      enum: ["pending", "approve", "revise", "hold"],
    })
      .notNull()
      .default("pending"),
    sampleSize: text("sample_size").notNull().default(""),
    makerReference: text("maker_reference").notNull().default(""),
    receivedAt: text("received_at"),
    reviewedAt: text("reviewed_at"),
    physicalLocation: text("physical_location").notNull().default(""),
    materialLotReference: text("material_lot_reference")
      .notNull()
      .default(""),
    colorStandardReference: text("color_standard_reference")
      .notNull()
      .default(""),
    overallObservation: text("overall_observation")
      .notNull()
      .default(""),
    approvalNote: text("approval_note").notNull().default(""),
    approvedBy: text("approved_by").notNull().default(""),
    approvedAt: text("approved_at"),
    sealCode: text("seal_code").unique(),
    sealedAt: text("sealed_at"),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("sample_signoffs_pack_round_uidx").on(
      table.technicalPackId,
      table.round,
    ),
    index("sample_signoffs_status_received_idx").on(
      table.status,
      table.receivedAt,
    ),
    index("sample_signoffs_work_updated_idx").on(
      table.workId,
      table.updatedAt,
    ),
  ],
);

export const sampleSignoffChecks = sqliteTable(
  "sample_signoff_checks",
  {
    id: text("id").primaryKey(),
    sampleSignoffId: text("sample_signoff_id")
      .notNull()
      .references(() => sampleSignoffs.id, { onDelete: "cascade" }),
    category: text("category", {
      enum: [
        "silhouette",
        "measurements",
        "materials",
        "trims",
        "construction",
        "finishing",
        "color",
        "labels",
      ],
    }).notNull(),
    title: text("title").notNull(),
    requirement: text("requirement").notNull().default(""),
    result: text("result", {
      enum: ["pending", "pass", "fail", "na"],
    })
      .notNull()
      .default("pending"),
    observation: text("observation").notNull().default(""),
    critical: integer("critical", { mode: "boolean" })
      .notNull()
      .default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("sample_signoff_checks_signoff_category_uidx").on(
      table.sampleSignoffId,
      table.category,
    ),
    index("sample_signoff_checks_signoff_sort_idx").on(
      table.sampleSignoffId,
      table.sortOrder,
    ),
    index("sample_signoff_checks_result_idx").on(table.result),
  ],
);

export const sampleSignoffImages = sqliteTable(
  "sample_signoff_images",
  {
    id: text("id").primaryKey(),
    sampleSignoffId: text("sample_signoff_id")
      .notNull()
      .references(() => sampleSignoffs.id, { onDelete: "cascade" }),
    imageKey: text("image_key").notNull().unique(),
    imageType: text("image_type").notNull(),
    imageSize: integer("image_size").notNull(),
    angle: text("angle", {
      enum: ["front", "side", "back", "detail", "label", "seal", "other"],
    })
      .notNull()
      .default("front"),
    caption: text("caption").notNull().default(""),
    altText: text("alt_text").notNull(),
    status: text("status", { enum: ["active", "removed"] })
      .notNull()
      .default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("sample_signoff_images_signoff_sort_idx").on(
      table.sampleSignoffId,
      table.sortOrder,
    ),
    index("sample_signoff_images_signoff_status_idx").on(
      table.sampleSignoffId,
      table.status,
    ),
  ],
);

export const productionReleases = sqliteTable(
  "production_releases",
  {
    id: text("id").primaryKey(),
    releaseCode: text("release_code").notNull().unique(),
    sampleSignoffId: text("sample_signoff_id")
      .notNull()
      .references(() => sampleSignoffs.id, { onDelete: "cascade" }),
    technicalPackId: text("technical_pack_id")
      .notNull()
      .references(() => technicalPacks.id, { onDelete: "cascade" }),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull().default(1),
    releaseMode: text("release_mode", {
      enum: ["atelier", "small_batch", "production", "reference"],
    })
      .notNull()
      .default("atelier"),
    status: text("status", {
      enum: [
        "draft",
        "in_review",
        "ready",
        "released",
        "superseded",
        "void",
      ],
    })
      .notNull()
      .default("draft"),
    decision: text("decision", {
      enum: ["pending", "release", "revise", "hold"],
    })
      .notNull()
      .default("pending"),
    factoryName: text("factory_name").notNull().default(""),
    factoryReference: text("factory_reference").notNull().default(""),
    sizeRange: text("size_range").notNull().default(""),
    colorways: text("colorways").notNull().default(""),
    plannedWindowStart: text("planned_window_start"),
    plannedWindowEnd: text("planned_window_end"),
    qualityStandard: text("quality_standard").notNull().default(""),
    packagingInstruction: text("packaging_instruction")
      .notNull()
      .default(""),
    releaseSummary: text("release_summary").notNull().default(""),
    openRisk: text("open_risk").notNull().default(""),
    internalNotes: text("internal_notes").notNull().default(""),
    approvedBy: text("approved_by").notNull().default(""),
    approvedAt: text("approved_at"),
    authorizationCode: text("authorization_code").unique(),
    releasedAt: text("released_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("production_releases_signoff_sequence_uidx").on(
      table.sampleSignoffId,
      table.sequence,
    ),
    index("production_releases_status_window_idx").on(
      table.status,
      table.plannedWindowStart,
    ),
    index("production_releases_work_updated_idx").on(
      table.workId,
      table.updatedAt,
    ),
  ],
);

export const productionReleaseChecks = sqliteTable(
  "production_release_checks",
  {
    id: text("id").primaryKey(),
    productionReleaseId: text("production_release_id")
      .notNull()
      .references(() => productionReleases.id, { onDelete: "cascade" }),
    category: text("category", {
      enum: [
        "reference",
        "revision",
        "grading",
        "bom",
        "color",
        "labels",
        "quality",
        "schedule",
      ],
    }).notNull(),
    title: text("title").notNull(),
    requirement: text("requirement").notNull().default(""),
    result: text("result", {
      enum: ["pending", "ready", "blocked", "na"],
    })
      .notNull()
      .default("pending"),
    observation: text("observation").notNull().default(""),
    critical: integer("critical", { mode: "boolean" })
      .notNull()
      .default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("production_release_checks_release_category_uidx").on(
      table.productionReleaseId,
      table.category,
    ),
    index("production_release_checks_release_sort_idx").on(
      table.productionReleaseId,
      table.sortOrder,
    ),
    index("production_release_checks_result_idx").on(table.result),
  ],
);

export const productionExceptions = sqliteTable(
  "production_exceptions",
  {
    id: text("id").primaryKey(),
    exceptionCode: text("exception_code").notNull().unique(),
    productionReleaseId: text("production_release_id")
      .notNull()
      .references(() => productionReleases.id, { onDelete: "cascade" }),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    category: text("category", {
      enum: [
        "material",
        "color",
        "construction",
        "measurement",
        "finish",
        "label",
        "packaging",
        "schedule",
        "other",
      ],
    })
      .notNull()
      .default("other"),
    severity: text("severity", {
      enum: ["low", "medium", "high", "critical"],
    })
      .notNull()
      .default("medium"),
    status: text("status", {
      enum: [
        "open",
        "in_review",
        "decided",
        "verified",
        "closed",
        "withdrawn",
      ],
    })
      .notNull()
      .default("open"),
    decision: text("decision", {
      enum: [
        "pending",
        "accept_once",
        "rework",
        "revise_definition",
        "reject",
        "hold",
      ],
    })
      .notNull()
      .default("pending"),
    title: text("title").notNull(),
    sourceName: text("source_name").notNull().default(""),
    sourceReference: text("source_reference").notNull().default(""),
    affectedScope: text("affected_scope").notNull().default(""),
    observedDeviation: text("observed_deviation").notNull().default(""),
    proposedResponse: text("proposed_response").notNull().default(""),
    designImpact: text("design_impact").notNull().default(""),
    qualityRisk: text("quality_risk").notNull().default(""),
    evidenceReference: text("evidence_reference").notNull().default(""),
    ownerName: text("owner_name").notNull().default(""),
    discoveredAt: text("discovered_at"),
    dueAt: text("due_at"),
    decidedBy: text("decided_by").notNull().default(""),
    decidedAt: text("decided_at"),
    verificationNote: text("verification_note").notNull().default(""),
    verifiedBy: text("verified_by").notNull().default(""),
    verifiedAt: text("verified_at"),
    resolutionNote: text("resolution_note").notNull().default(""),
    successorReleaseCode: text("successor_release_code")
      .notNull()
      .default(""),
    closedAt: text("closed_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("production_exceptions_release_status_idx").on(
      table.productionReleaseId,
      table.status,
    ),
    index("production_exceptions_work_updated_idx").on(
      table.workId,
      table.updatedAt,
    ),
    index("production_exceptions_status_due_idx").on(
      table.status,
      table.dueAt,
    ),
    index("production_exceptions_severity_idx").on(table.severity),
  ],
);

export const productionExceptionActions = sqliteTable(
  "production_exception_actions",
  {
    id: text("id").primaryKey(),
    productionExceptionId: text("production_exception_id")
      .notNull()
      .references(() => productionExceptions.id, { onDelete: "cascade" }),
    actionType: text("action_type", {
      enum: [
        "reported",
        "review_note",
        "evidence",
        "response",
        "decision",
        "verification",
        "closure",
      ],
    })
      .notNull()
      .default("review_note"),
    note: text("note").notNull(),
    reference: text("reference").notNull().default(""),
    occurredAt: text("occurred_at").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("production_exception_actions_exception_time_idx").on(
      table.productionExceptionId,
      table.occurredAt,
    ),
    index("production_exception_actions_type_idx").on(table.actionType),
  ],
);

export const productionAcceptances = sqliteTable(
  "production_acceptances",
  {
    id: text("id").primaryKey(),
    acceptanceCode: text("acceptance_code").notNull().unique(),
    productionReleaseId: text("production_release_id")
      .notNull()
      .references(() => productionReleases.id, { onDelete: "cascade" }),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull().default(1),
    status: text("status", {
      enum: ["draft", "in_review", "accepted", "rejected", "void"],
    })
      .notNull()
      .default("draft"),
    decision: text("decision", {
      enum: ["pending", "accept", "rework", "hold", "reject"],
    })
      .notNull()
      .default("pending"),
    editionReference: text("edition_reference").notNull().default(""),
    colorway: text("colorway").notNull().default(""),
    sizeRange: text("size_range").notNull().default(""),
    receivedQuantity: integer("received_quantity").notNull().default(0),
    inspectedQuantity: integer("inspected_quantity").notNull().default(0),
    receivedAt: text("received_at"),
    inspectedAt: text("inspected_at"),
    physicalLocation: text("physical_location").notNull().default(""),
    inspectionStandard: text("inspection_standard").notNull().default(""),
    overallObservation: text("overall_observation").notNull().default(""),
    dispositionNote: text("disposition_note").notNull().default(""),
    acceptedBy: text("accepted_by").notNull().default(""),
    acceptedAt: text("accepted_at"),
    acceptanceSeal: text("acceptance_seal").unique(),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("production_acceptances_release_sequence_uidx").on(
      table.productionReleaseId,
      table.sequence,
    ),
    index("production_acceptances_work_status_idx").on(
      table.workId,
      table.status,
    ),
    index("production_acceptances_status_received_idx").on(
      table.status,
      table.receivedAt,
    ),
  ],
);

export const productionAcceptanceChecks = sqliteTable(
  "production_acceptance_checks",
  {
    id: text("id").primaryKey(),
    productionAcceptanceId: text("production_acceptance_id")
      .notNull()
      .references(() => productionAcceptances.id, { onDelete: "cascade" }),
    category: text("category", {
      enum: [
        "identity",
        "material_color",
        "measurements",
        "construction",
        "finishing",
        "labels",
        "packaging",
        "quantity",
      ],
    }).notNull(),
    title: text("title").notNull(),
    requirement: text("requirement").notNull().default(""),
    result: text("result", {
      enum: ["pending", "pass", "fail", "na"],
    })
      .notNull()
      .default("pending"),
    observation: text("observation").notNull().default(""),
    critical: integer("critical", { mode: "boolean" })
      .notNull()
      .default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("production_acceptance_checks_acceptance_category_uidx").on(
      table.productionAcceptanceId,
      table.category,
    ),
    index("production_acceptance_checks_acceptance_sort_idx").on(
      table.productionAcceptanceId,
      table.sortOrder,
    ),
    index("production_acceptance_checks_result_idx").on(table.result),
  ],
);

export const productionAcceptanceImages = sqliteTable(
  "production_acceptance_images",
  {
    id: text("id").primaryKey(),
    productionAcceptanceId: text("production_acceptance_id")
      .notNull()
      .references(() => productionAcceptances.id, { onDelete: "cascade" }),
    imageKey: text("image_key").notNull().unique(),
    imageType: text("image_type").notNull(),
    imageSize: integer("image_size").notNull(),
    angle: text("angle", {
      enum: ["front", "back", "detail", "label", "packaging", "group", "other"],
    })
      .notNull()
      .default("front"),
    caption: text("caption").notNull().default(""),
    altText: text("alt_text").notNull(),
    status: text("status", { enum: ["active", "removed"] })
      .notNull()
      .default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("production_acceptance_images_acceptance_sort_idx").on(
      table.productionAcceptanceId,
      table.sortOrder,
    ),
    index("production_acceptance_images_acceptance_status_idx").on(
      table.productionAcceptanceId,
      table.status,
    ),
  ],
);

export const provenanceDossiers = sqliteTable(
  "provenance_dossiers",
  {
    id: text("id").primaryKey(),
    dossierCode: text("dossier_code").notNull().unique(),
    slug: text("slug").notNull().unique(),
    productionAcceptanceId: text("production_acceptance_id")
      .notNull()
      .references(() => productionAcceptances.id, { onDelete: "restrict" }),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull().default(1),
    status: text("status", {
      enum: ["draft", "in_review", "published", "retired", "void"],
    })
      .notNull()
      .default("draft"),
    decision: text("decision", {
      enum: ["pending", "publish", "revise", "hold"],
    })
      .notNull()
      .default("pending"),
    title: text("title").notNull().default(""),
    subtitle: text("subtitle").notNull().default(""),
    designStory: text("design_story").notNull().default(""),
    materialDisclosure: text("material_disclosure").notNull().default(""),
    makerDisclosure: text("maker_disclosure").notNull().default(""),
    placeOfMaking: text("place_of_making").notNull().default(""),
    madeAt: text("made_at"),
    careGuidance: text("care_guidance").notNull().default(""),
    repairGuidance: text("repair_guidance").notNull().default(""),
    provenanceNote: text("provenance_note").notNull().default(""),
    publicSummary: text("public_summary").notNull().default(""),
    reviewedBy: text("reviewed_by").notNull().default(""),
    reviewedAt: text("reviewed_at"),
    publishedBy: text("published_by").notNull().default(""),
    publishedAt: text("published_at"),
    retiredAt: text("retired_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("provenance_dossiers_acceptance_revision_uidx").on(
      table.productionAcceptanceId,
      table.revision,
    ),
    index("provenance_dossiers_work_status_idx").on(table.workId, table.status),
    index("provenance_dossiers_status_published_idx").on(
      table.status,
      table.publishedAt,
    ),
  ],
);

export const provenanceDossierChecks = sqliteTable(
  "provenance_dossier_checks",
  {
    id: text("id").primaryKey(),
    provenanceDossierId: text("provenance_dossier_id")
      .notNull()
      .references(() => provenanceDossiers.id, { onDelete: "cascade" }),
    category: text("category", {
      enum: ["identity", "source", "materials", "maker", "care", "public_copy"],
    }).notNull(),
    title: text("title").notNull(),
    requirement: text("requirement").notNull().default(""),
    result: text("result", { enum: ["pending", "pass", "fail", "na"] })
      .notNull()
      .default("pending"),
    observation: text("observation").notNull().default(""),
    critical: integer("critical", { mode: "boolean" })
      .notNull()
      .default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("provenance_dossier_checks_dossier_category_uidx").on(
      table.provenanceDossierId,
      table.category,
    ),
    index("provenance_dossier_checks_dossier_sort_idx").on(
      table.provenanceDossierId,
      table.sortOrder,
    ),
    index("provenance_dossier_checks_result_idx").on(table.result),
  ],
);

export const conservationReports = sqliteTable(
  "conservation_reports",
  {
    id: text("id").primaryKey(),
    reportCode: text("report_code").notNull().unique(),
    sampleAssetId: text("sample_asset_id")
      .notNull()
      .references(() => sampleAssets.id, { onDelete: "restrict" }),
    workId: text("work_id").references(() => works.id, {
      onDelete: "set null",
    }),
    sequence: integer("sequence").notNull().default(1),
    status: text("status", {
      enum: ["draft", "in_review", "approved", "closed", "void"],
    })
      .notNull()
      .default("draft"),
    decision: text("decision", {
      enum: ["pending", "monitor", "treat", "ready_for_use", "archive"],
    })
      .notNull()
      .default("pending"),
    assessedAt: text("assessed_at"),
    assessmentLocation: text("assessment_location").notNull().default(""),
    overallCondition: text("overall_condition", {
      enum: ["not_checked", "excellent", "good", "worn", "damaged", "critical"],
    })
      .notNull()
      .default("not_checked"),
    conditionSummary: text("condition_summary").notNull().default(""),
    proposedTreatment: text("proposed_treatment").notNull().default(""),
    handlingRestriction: text("handling_restriction").notNull().default(""),
    storageGuidance: text("storage_guidance").notNull().default(""),
    environmentalNotes: text("environmental_notes").notNull().default(""),
    nextReviewAt: text("next_review_at"),
    treatmentCompletedAt: text("treatment_completed_at"),
    approvalNote: text("approval_note").notNull().default(""),
    approvedBy: text("approved_by").notNull().default(""),
    approvedAt: text("approved_at"),
    closedBy: text("closed_by").notNull().default(""),
    closedAt: text("closed_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("conservation_reports_asset_sequence_uidx").on(
      table.sampleAssetId,
      table.sequence,
    ),
    index("conservation_reports_asset_status_idx").on(
      table.sampleAssetId,
      table.status,
    ),
    index("conservation_reports_review_status_idx").on(
      table.nextReviewAt,
      table.status,
    ),
  ],
);

export const conservationReportChecks = sqliteTable(
  "conservation_report_checks",
  {
    id: text("id").primaryKey(),
    conservationReportId: text("conservation_report_id")
      .notNull()
      .references(() => conservationReports.id, { onDelete: "cascade" }),
    category: text("category", {
      enum: ["structure", "surface", "seams", "fastenings", "trim", "labels"],
    }).notNull(),
    title: text("title").notNull(),
    requirement: text("requirement").notNull().default(""),
    result: text("result", {
      enum: ["pending", "stable", "attention", "treatment", "resolved", "na"],
    })
      .notNull()
      .default("pending"),
    severity: text("severity", {
      enum: ["none", "low", "medium", "high", "critical"],
    })
      .notNull()
      .default("none"),
    observation: text("observation").notNull().default(""),
    treatmentNote: text("treatment_note").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("conservation_report_checks_report_category_uidx").on(
      table.conservationReportId,
      table.category,
    ),
    index("conservation_report_checks_report_sort_idx").on(
      table.conservationReportId,
      table.sortOrder,
    ),
    index("conservation_report_checks_result_severity_idx").on(
      table.result,
      table.severity,
    ),
  ],
);

export const conservationReportImages = sqliteTable(
  "conservation_report_images",
  {
    id: text("id").primaryKey(),
    conservationReportId: text("conservation_report_id")
      .notNull()
      .references(() => conservationReports.id, { onDelete: "cascade" }),
    imageKey: text("image_key").notNull().unique(),
    imageType: text("image_type").notNull(),
    imageSize: integer("image_size").notNull(),
    angle: text("angle", {
      enum: ["overall", "front", "back", "interior", "detail", "label", "damage", "other"],
    })
      .notNull()
      .default("overall"),
    caption: text("caption").notNull().default(""),
    altText: text("alt_text").notNull(),
    status: text("status", { enum: ["active", "removed"] })
      .notNull()
      .default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("conservation_report_images_report_sort_idx").on(
      table.conservationReportId,
      table.sortOrder,
    ),
    index("conservation_report_images_report_status_idx").on(
      table.conservationReportId,
      table.status,
    ),
  ],
);

export const curatorialProjects = sqliteTable(
  "curatorial_projects",
  {
    id: text("id").primaryKey(),
    projectCode: text("project_code").notNull().unique(),
    title: text("title").notNull(),
    status: text("status", { enum: ["draft", "in_review", "approved", "closed", "void"] }).notNull().default("draft"),
    decision: text("decision", { enum: ["pending", "approve", "revise", "hold"] }).notNull().default("pending"),
    curator: text("curator").notNull().default(""),
    venueContext: text("venue_context").notNull().default(""),
    audience: text("audience").notNull().default(""),
    openingAt: text("opening_at"),
    closingAt: text("closing_at"),
    thesis: text("thesis").notNull().default(""),
    narrative: text("narrative").notNull().default(""),
    spatialNote: text("spatial_note").notNull().default(""),
    selectionNote: text("selection_note").notNull().default(""),
    approvalNote: text("approval_note").notNull().default(""),
    approvedBy: text("approved_by").notNull().default(""),
    approvedAt: text("approved_at"),
    closedAt: text("closed_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("curatorial_projects_status_opening_idx").on(table.status, table.openingAt),
    index("curatorial_projects_updated_at_idx").on(table.updatedAt),
  ],
);

export const curatorialSelections = sqliteTable(
  "curatorial_selections",
  {
    id: text("id").primaryKey(),
    curatorialProjectId: text("curatorial_project_id").notNull().references(() => curatorialProjects.id, { onDelete: "cascade" }),
    sampleAssetId: text("sample_asset_id").notNull().references(() => sampleAssets.id, { onDelete: "restrict" }),
    decision: text("decision", { enum: ["proposed", "include", "alternate", "hold", "exclude"] }).notNull().default("proposed"),
    role: text("role", { enum: ["anchor", "dialogue", "context", "transition", "finale"] }).notNull().default("dialogue"),
    sequence: integer("sequence").notNull().default(0),
    rationale: text("rationale").notNull().default(""),
    displayIntent: text("display_intent").notNull().default(""),
    conservationNote: text("conservation_note").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("curatorial_selections_project_asset_uidx").on(table.curatorialProjectId, table.sampleAssetId),
    index("curatorial_selections_project_sequence_idx").on(table.curatorialProjectId, table.sequence),
    index("curatorial_selections_asset_decision_idx").on(table.sampleAssetId, table.decision),
  ],
);

export const interpretationPackages = sqliteTable(
  "interpretation_packages",
  {
    id: text("id").primaryKey(),
    packageCode: text("package_code").notNull().unique(),
    curatorialProjectId: text("curatorial_project_id")
      .notNull()
      .references(() => curatorialProjects.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull().default(1),
    status: text("status", {
      enum: ["draft", "in_review", "approved", "closed", "void"],
    })
      .notNull()
      .default("draft"),
    decision: text("decision", {
      enum: ["pending", "approve", "revise", "hold"],
    })
      .notNull()
      .default("pending"),
    editor: text("editor").notNull().default(""),
    primaryLanguage: text("primary_language").notNull().default("zh-CN"),
    secondaryLanguage: text("secondary_language").notNull().default(""),
    title: text("title").notNull().default(""),
    subtitle: text("subtitle").notNull().default(""),
    entranceText: text("entrance_text").notNull().default(""),
    curatorialCredit: text("curatorial_credit").notNull().default(""),
    acknowledgement: text("acknowledgement").notNull().default(""),
    accessibilityNote: text("accessibility_note").notNull().default(""),
    rightsNote: text("rights_note").notNull().default(""),
    approvalNote: text("approval_note").notNull().default(""),
    approvedBy: text("approved_by").notNull().default(""),
    approvedAt: text("approved_at"),
    closedAt: text("closed_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("interpretation_packages_project_revision_uidx").on(
      table.curatorialProjectId,
      table.revision,
    ),
    index("interpretation_packages_status_updated_idx").on(
      table.status,
      table.updatedAt,
    ),
  ],
);

export const interpretationSections = sqliteTable(
  "interpretation_sections",
  {
    id: text("id").primaryKey(),
    interpretationPackageId: text("interpretation_package_id")
      .notNull()
      .references(() => interpretationPackages.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull().default(0),
    titlePrimary: text("title_primary").notNull().default(""),
    titleSecondary: text("title_secondary").notNull().default(""),
    bodyPrimary: text("body_primary").notNull().default(""),
    bodySecondary: text("body_secondary").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("interpretation_sections_package_sequence_idx").on(
      table.interpretationPackageId,
      table.sequence,
    ),
  ],
);

export const interpretationLabels = sqliteTable(
  "interpretation_labels",
  {
    id: text("id").primaryKey(),
    interpretationPackageId: text("interpretation_package_id")
      .notNull()
      .references(() => interpretationPackages.id, { onDelete: "cascade" }),
    curatorialSelectionId: text("curatorial_selection_id")
      .notNull()
      .references(() => curatorialSelections.id, { onDelete: "restrict" }),
    sequence: integer("sequence").notNull().default(0),
    headline: text("headline").notNull().default(""),
    bodyPrimary: text("body_primary").notNull().default(""),
    bodySecondary: text("body_secondary").notNull().default(""),
    objectFacts: text("object_facts").notNull().default(""),
    creditLine: text("credit_line").notNull().default(""),
    accessibilityText: text("accessibility_text").notNull().default(""),
    sourceNote: text("source_note").notNull().default(""),
    rightsStatus: text("rights_status", {
      enum: ["unchecked", "cleared", "restricted", "not_required"],
    })
      .notNull()
      .default("unchecked"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("interpretation_labels_package_selection_uidx").on(
      table.interpretationPackageId,
      table.curatorialSelectionId,
    ),
    index("interpretation_labels_package_sequence_idx").on(
      table.interpretationPackageId,
      table.sequence,
    ),
  ],
);

export const exhibitionDeliveryPackages = sqliteTable(
  "exhibition_delivery_packages",
  {
    id: text("id").primaryKey(),
    deliveryCode: text("delivery_code").notNull().unique(),
    interpretationPackageId: text("interpretation_package_id")
      .notNull()
      .references(() => interpretationPackages.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull().default(1),
    status: text("status", {
      enum: ["draft", "in_review", "approved", "closed", "void"],
    })
      .notNull()
      .default("draft"),
    decision: text("decision", {
      enum: ["pending", "release", "revise", "hold"],
    })
      .notNull()
      .default("pending"),
    ownerName: text("owner_name").notNull().default(""),
    destination: text("destination").notNull().default(""),
    deliveryAt: text("delivery_at"),
    masterTitle: text("master_title").notNull().default(""),
    formatStandard: text("format_standard").notNull().default(""),
    placementStandard: text("placement_standard").notNull().default(""),
    accessibilityStandard: text("accessibility_standard").notNull().default(""),
    rightsStandard: text("rights_standard").notNull().default(""),
    handoffNote: text("handoff_note").notNull().default(""),
    approvalNote: text("approval_note").notNull().default(""),
    approvedBy: text("approved_by").notNull().default(""),
    approvedAt: text("approved_at"),
    closedAt: text("closed_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("exhibition_delivery_packages_interpretation_revision_uidx").on(
      table.interpretationPackageId,
      table.revision,
    ),
    index("exhibition_delivery_packages_status_delivery_idx").on(
      table.status,
      table.deliveryAt,
    ),
    index("exhibition_delivery_packages_updated_at_idx").on(table.updatedAt),
  ],
);

export const exhibitionDeliveryItems = sqliteTable(
  "exhibition_delivery_items",
  {
    id: text("id").primaryKey(),
    exhibitionDeliveryPackageId: text("exhibition_delivery_package_id")
      .notNull()
      .references(() => exhibitionDeliveryPackages.id, { onDelete: "cascade" }),
    sourceType: text("source_type", {
      enum: ["entrance", "section", "object_label", "credits", "accessibility", "rights"],
    })
      .notNull()
      .default("entrance"),
    sourceId: text("source_id").notNull(),
    language: text("language").notNull().default("zh-CN"),
    channel: text("channel", {
      enum: ["wall_text", "object_label", "digital_guide", "print_guide", "press_reference", "internal_master"],
    })
      .notNull()
      .default("wall_text"),
    sequence: integer("sequence").notNull().default(0),
    title: text("title").notNull().default(""),
    placement: text("placement").notNull().default(""),
    formatSpec: text("format_spec").notNull().default(""),
    proofStatus: text("proof_status", {
      enum: ["draft", "ready", "hold", "omitted"],
    })
      .notNull()
      .default("draft"),
    proofNote: text("proof_note").notNull().default(""),
    handoffNote: text("handoff_note").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("exhibition_delivery_items_source_language_uidx").on(
      table.exhibitionDeliveryPackageId,
      table.sourceType,
      table.sourceId,
      table.language,
    ),
    index("exhibition_delivery_items_package_sequence_idx").on(
      table.exhibitionDeliveryPackageId,
      table.sequence,
    ),
    index("exhibition_delivery_items_proof_status_idx").on(table.proofStatus),
  ],
);

export const exhibitionInstallationGates = sqliteTable(
  "exhibition_installation_gates",
  {
    id: text("id").primaryKey(),
    gateCode: text("gate_code").notNull().unique(),
    exhibitionDeliveryPackageId: text("exhibition_delivery_package_id")
      .notNull()
      .references(() => exhibitionDeliveryPackages.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull().default(1),
    status: text("status", {
      enum: ["draft", "in_review", "approved", "closed", "void"],
    })
      .notNull()
      .default("draft"),
    decision: text("decision", {
      enum: ["pending", "accept", "rework", "hold"],
    })
      .notNull()
      .default("pending"),
    leadName: text("lead_name").notNull().default(""),
    venue: text("venue").notNull().default(""),
    inspectionAt: text("inspection_at"),
    openingAt: text("opening_at"),
    installationScope: text("installation_scope").notNull().default(""),
    accessibilityObservation: text("accessibility_observation").notNull().default(""),
    rightsObservation: text("rights_observation").notNull().default(""),
    safetyNote: text("safety_note").notNull().default(""),
    handoverNote: text("handover_note").notNull().default(""),
    approvalNote: text("approval_note").notNull().default(""),
    approvedBy: text("approved_by").notNull().default(""),
    approvedAt: text("approved_at"),
    closedAt: text("closed_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("exhibition_installation_gates_delivery_revision_uidx").on(
      table.exhibitionDeliveryPackageId,
      table.revision,
    ),
    index("exhibition_installation_gates_status_inspection_idx").on(
      table.status,
      table.inspectionAt,
    ),
    index("exhibition_installation_gates_updated_at_idx").on(table.updatedAt),
  ],
);

export const exhibitionInstallationChecks = sqliteTable(
  "exhibition_installation_checks",
  {
    id: text("id").primaryKey(),
    exhibitionInstallationGateId: text("exhibition_installation_gate_id")
      .notNull()
      .references(() => exhibitionInstallationGates.id, { onDelete: "cascade" }),
    exhibitionDeliveryItemId: text("exhibition_delivery_item_id")
      .notNull()
      .references(() => exhibitionDeliveryItems.id, { onDelete: "restrict" }),
    sequence: integer("sequence").notNull().default(0),
    result: text("result", {
      enum: ["pending", "pass", "attention", "blocked", "not_installed"],
    })
      .notNull()
      .default("pending"),
    observedPlacement: text("observed_placement").notNull().default(""),
    observedFormat: text("observed_format").notNull().default(""),
    observation: text("observation").notNull().default(""),
    correctiveAction: text("corrective_action").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("exhibition_installation_checks_gate_item_uidx").on(
      table.exhibitionInstallationGateId,
      table.exhibitionDeliveryItemId,
    ),
    index("exhibition_installation_checks_gate_sequence_idx").on(
      table.exhibitionInstallationGateId,
      table.sequence,
    ),
    index("exhibition_installation_checks_result_idx").on(table.result),
  ],
);

export const exhibitionInstallationImages = sqliteTable(
  "exhibition_installation_images",
  {
    id: text("id").primaryKey(),
    exhibitionInstallationGateId: text("exhibition_installation_gate_id")
      .notNull()
      .references(() => exhibitionInstallationGates.id, { onDelete: "cascade" }),
    imageKey: text("image_key").notNull().unique(),
    imageType: text("image_type").notNull(),
    imageSize: integer("image_size").notNull(),
    angle: text("angle", {
      enum: ["overview", "wall_text", "object_label", "digital_guide", "accessibility", "rights", "detail"],
    })
      .notNull()
      .default("overview"),
    caption: text("caption").notNull().default(""),
    altText: text("alt_text").notNull(),
    status: text("status", { enum: ["active", "removed"] })
      .notNull()
      .default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("exhibition_installation_images_gate_sort_idx").on(
      table.exhibitionInstallationGateId,
      table.sortOrder,
    ),
    index("exhibition_installation_images_gate_status_idx").on(
      table.exhibitionInstallationGateId,
      table.status,
    ),
  ],
);

export const exhibitionReadinessPlans = sqliteTable(
  "exhibition_readiness_plans",
  {
    id: text("id").primaryKey(),
    planCode: text("plan_code").notNull().unique(),
    sampleAssetId: text("sample_asset_id")
      .notNull()
      .references(() => sampleAssets.id, { onDelete: "restrict" }),
    conservationReportId: text("conservation_report_id")
      .notNull()
      .references(() => conservationReports.id, { onDelete: "restrict" }),
    workId: text("work_id").references(() => works.id, {
      onDelete: "set null",
    }),
    sequence: integer("sequence").notNull().default(1),
    title: text("title").notNull().default(""),
    venue: text("venue").notNull().default(""),
    purpose: text("purpose", {
      enum: ["exhibition", "editorial", "press", "presentation", "archive_view"],
    })
      .notNull()
      .default("exhibition"),
    status: text("status", {
      enum: ["draft", "in_review", "approved", "closed", "void"],
    })
      .notNull()
      .default("draft"),
    decision: text("decision", {
      enum: ["pending", "ready", "ready_with_limits", "hold", "not_for_display"],
    })
      .notNull()
      .default("pending"),
    installAt: text("install_at"),
    deinstallAt: text("deinstall_at"),
    displayMode: text("display_mode", {
      enum: ["mannequin", "flat", "hanging", "case", "custom"],
    })
      .notNull()
      .default("mannequin"),
    mountingMethod: text("mounting_method").notNull().default(""),
    supportRequirements: text("support_requirements").notNull().default(""),
    dressingInstructions: text("dressing_instructions").notNull().default(""),
    maxLux: integer("max_lux").notNull().default(50),
    uvLimit: integer("uv_limit").notNull().default(75),
    rhMin: integer("rh_min").notNull().default(45),
    rhMax: integer("rh_max").notNull().default(55),
    tempMin: integer("temp_min").notNull().default(18),
    tempMax: integer("temp_max").notNull().default(21),
    maxDisplayDays: integer("max_display_days").notNull().default(90),
    handlingTeam: text("handling_team").notNull().default(""),
    securityBarrier: text("security_barrier").notNull().default(""),
    emergencyInstructions: text("emergency_instructions").notNull().default(""),
    installationNotes: text("installation_notes").notNull().default(""),
    approvalNote: text("approval_note").notNull().default(""),
    approvedBy: text("approved_by").notNull().default(""),
    approvedAt: text("approved_at"),
    closedBy: text("closed_by").notNull().default(""),
    closedAt: text("closed_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("exhibition_readiness_plans_asset_sequence_uidx").on(
      table.sampleAssetId,
      table.sequence,
    ),
    index("exhibition_readiness_plans_status_install_idx").on(
      table.status,
      table.installAt,
    ),
    index("exhibition_readiness_plans_deinstall_status_idx").on(
      table.deinstallAt,
      table.status,
    ),
    index("exhibition_readiness_plans_conservation_idx").on(
      table.conservationReportId,
    ),
  ],
);

export const exhibitionReadinessChecks = sqliteTable(
  "exhibition_readiness_checks",
  {
    id: text("id").primaryKey(),
    exhibitionReadinessPlanId: text("exhibition_readiness_plan_id")
      .notNull()
      .references(() => exhibitionReadinessPlans.id, { onDelete: "cascade" }),
    category: text("category", {
      enum: ["condition", "support", "light", "climate", "handling", "security", "deinstallation"],
    }).notNull(),
    title: text("title").notNull(),
    requirement: text("requirement").notNull().default(""),
    result: text("result", {
      enum: ["pending", "pass", "attention", "blocked", "na"],
    })
      .notNull()
      .default("pending"),
    observation: text("observation").notNull().default(""),
    critical: integer("critical", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("exhibition_readiness_checks_plan_category_uidx").on(
      table.exhibitionReadinessPlanId,
      table.category,
    ),
    index("exhibition_readiness_checks_plan_sort_idx").on(
      table.exhibitionReadinessPlanId,
      table.sortOrder,
    ),
    index("exhibition_readiness_checks_result_idx").on(table.result),
  ],
);

export const exhibitionReadinessImages = sqliteTable(
  "exhibition_readiness_images",
  {
    id: text("id").primaryKey(),
    exhibitionReadinessPlanId: text("exhibition_readiness_plan_id")
      .notNull()
      .references(() => exhibitionReadinessPlans.id, { onDelete: "cascade" }),
    imageKey: text("image_key").notNull().unique(),
    imageType: text("image_type").notNull(),
    imageSize: integer("image_size").notNull(),
    angle: text("angle", {
      enum: ["overall", "mount", "front", "back", "detail", "installation", "environment", "other"],
    })
      .notNull()
      .default("overall"),
    caption: text("caption").notNull().default(""),
    altText: text("alt_text").notNull(),
    status: text("status", { enum: ["active", "removed"] })
      .notNull()
      .default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("exhibition_readiness_images_plan_sort_idx").on(
      table.exhibitionReadinessPlanId,
      table.sortOrder,
    ),
    index("exhibition_readiness_images_plan_status_idx").on(
      table.exhibitionReadinessPlanId,
      table.status,
    ),
  ],
);

export const exhibitionOpeningGates = sqliteTable(
  "exhibition_opening_gates",
  {
    id: text("id").primaryKey(),
    openingCode: text("opening_code").notNull().unique(),
    curatorialProjectId: text("curatorial_project_id").notNull().references(() => curatorialProjects.id, { onDelete: "restrict" }),
    exhibitionInstallationGateId: text("exhibition_installation_gate_id").notNull().references(() => exhibitionInstallationGates.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull().default(1),
    status: text("status", { enum: ["draft", "in_review", "approved", "closed", "void"] }).notNull().default("draft"),
    decision: text("decision", { enum: ["pending", "open", "rework", "hold"] }).notNull().default("pending"),
    openingLead: text("opening_lead").notNull().default(""),
    venue: text("venue").notNull().default(""),
    plannedOpeningAt: text("planned_opening_at"),
    plannedClosingAt: text("planned_closing_at"),
    operatingBrief: text("operating_brief").notNull().default(""),
    dailyCheckCadence: text("daily_check_cadence").notNull().default(""),
    staffHandover: text("staff_handover").notNull().default(""),
    visitorAccessibilityPlan: text("visitor_accessibility_plan").notNull().default(""),
    incidentEscalation: text("incident_escalation").notNull().default(""),
    emergencyPauseRule: text("emergency_pause_rule").notNull().default(""),
    approvalNote: text("approval_note").notNull().default(""),
    approvedBy: text("approved_by").notNull().default(""),
    approvedAt: text("approved_at"),
    closedAt: text("closed_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("exhibition_opening_gates_project_revision_uidx").on(table.curatorialProjectId, table.revision),
    index("exhibition_opening_gates_status_opening_idx").on(table.status, table.plannedOpeningAt),
    index("exhibition_opening_gates_updated_at_idx").on(table.updatedAt),
  ],
);

export const exhibitionOpeningItems = sqliteTable(
  "exhibition_opening_items",
  {
    id: text("id").primaryKey(),
    exhibitionOpeningGateId: text("exhibition_opening_gate_id").notNull().references(() => exhibitionOpeningGates.id, { onDelete: "cascade" }),
    curatorialSelectionId: text("curatorial_selection_id").notNull().references(() => curatorialSelections.id, { onDelete: "restrict" }),
    exhibitionReadinessPlanId: text("exhibition_readiness_plan_id").references(() => exhibitionReadinessPlans.id, { onDelete: "restrict" }),
    sequence: integer("sequence").notNull().default(0),
    result: text("result", { enum: ["pending", "ready", "attention", "blocked"] }).notNull().default("pending"),
    displayLocation: text("display_location").notNull().default(""),
    readinessNote: text("readiness_note").notNull().default(""),
    handoverNote: text("handover_note").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("exhibition_opening_items_gate_selection_uidx").on(table.exhibitionOpeningGateId, table.curatorialSelectionId),
    index("exhibition_opening_items_gate_sequence_idx").on(table.exhibitionOpeningGateId, table.sequence),
    index("exhibition_opening_items_result_idx").on(table.result),
  ],
);

export const exhibitionWatches = sqliteTable(
  "exhibition_watches",
  {
    id: text("id").primaryKey(),
    watchCode: text("watch_code").notNull().unique(),
    exhibitionReadinessPlanId: text("exhibition_readiness_plan_id")
      .notNull()
      .unique()
      .references(() => exhibitionReadinessPlans.id, { onDelete: "restrict" }),
    sampleAssetId: text("sample_asset_id")
      .notNull()
      .references(() => sampleAssets.id, { onDelete: "restrict" }),
    status: text("status", {
      enum: ["active", "paused", "deinstalled", "closed"],
    })
      .notNull()
      .default("active"),
    decision: text("decision", {
      enum: ["pending", "continue", "continue_with_limits", "pause", "deinstall_now"],
    })
      .notNull()
      .default("pending"),
    monitoringIntervalHours: integer("monitoring_interval_hours")
      .notNull()
      .default(24),
    steward: text("steward").notNull().default(""),
    openingCondition: text("opening_condition").notNull().default(""),
    decisionNote: text("decision_note").notNull().default(""),
    deinstallationCondition: text("deinstallation_condition").notNull().default(""),
    returnLocation: text("return_location").notNull().default(""),
    openedAt: text("opened_at").notNull(),
    lastObservedAt: text("last_observed_at"),
    deinstalledAt: text("deinstalled_at"),
    closedBy: text("closed_by").notNull().default(""),
    closedAt: text("closed_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("exhibition_watches_status_observed_idx").on(
      table.status,
      table.lastObservedAt,
    ),
    index("exhibition_watches_asset_idx").on(table.sampleAssetId),
  ],
);

export const exhibitionWatchObservations = sqliteTable(
  "exhibition_watch_observations",
  {
    id: text("id").primaryKey(),
    exhibitionWatchId: text("exhibition_watch_id")
      .notNull()
      .references(() => exhibitionWatches.id, { onDelete: "cascade" }),
    observedAt: text("observed_at").notNull(),
    lux: integer("lux"),
    uv: integer("uv"),
    rh: integer("rh"),
    temperatureTenth: integer("temperature_tenth"),
    conditionResult: text("condition_result", {
      enum: ["stable", "attention", "critical"],
    })
      .notNull()
      .default("stable"),
    supportResult: text("support_result", {
      enum: ["stable", "attention", "critical"],
    })
      .notNull()
      .default("stable"),
    pestResult: text("pest_result", {
      enum: ["none", "signs", "confirmed"],
    })
      .notNull()
      .default("none"),
    incidentType: text("incident_type", {
      enum: ["none", "physical", "climate", "light", "security", "pest", "handling", "other"],
    })
      .notNull()
      .default("none"),
    observation: text("observation").notNull().default(""),
    actionTaken: text("action_taken").notNull().default(""),
    disposition: text("disposition", {
      enum: ["continue", "limit", "pause", "deinstall", "conservator_review"],
    })
      .notNull()
      .default("continue"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("exhibition_watch_observations_watch_time_idx").on(
      table.exhibitionWatchId,
      table.observedAt,
    ),
    index("exhibition_watch_observations_incident_idx").on(
      table.incidentType,
      table.conditionResult,
    ),
  ],
);

export const exhibitionWatchImages = sqliteTable(
  "exhibition_watch_images",
  {
    id: text("id").primaryKey(),
    exhibitionWatchId: text("exhibition_watch_id")
      .notNull()
      .references(() => exhibitionWatches.id, { onDelete: "cascade" }),
    observationId: text("observation_id").references(
      () => exhibitionWatchObservations.id,
      { onDelete: "set null" },
    ),
    imageKey: text("image_key").notNull().unique(),
    imageType: text("image_type").notNull(),
    imageSize: integer("image_size").notNull(),
    angle: text("angle", {
      enum: ["overall", "condition", "support", "environment", "incident", "deinstallation", "other"],
    })
      .notNull()
      .default("overall"),
    caption: text("caption").notNull().default(""),
    altText: text("alt_text").notNull(),
    status: text("status", { enum: ["active", "removed"] })
      .notNull()
      .default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("exhibition_watch_images_watch_sort_idx").on(
      table.exhibitionWatchId,
      table.sortOrder,
    ),
    index("exhibition_watch_images_observation_idx").on(table.observationId),
  ],
);

export const exhibitionRecoveries = sqliteTable(
  "exhibition_recoveries",
  {
    id: text("id").primaryKey(),
    recoveryCode: text("recovery_code").notNull().unique(),
    exhibitionWatchId: text("exhibition_watch_id")
      .notNull()
      .unique()
      .references(() => exhibitionWatches.id, { onDelete: "restrict" }),
    sampleAssetId: text("sample_asset_id")
      .notNull()
      .references(() => sampleAssets.id, { onDelete: "restrict" }),
    status: text("status", {
      enum: ["intake", "stabilizing", "in_review", "released", "referred", "void"],
    })
      .notNull()
      .default("intake"),
    decision: text("decision", {
      enum: ["pending", "return_to_storage", "rest_then_store", "conservation_review", "quarantine"],
    })
      .notNull()
      .default("pending"),
    receivedAt: text("received_at"),
    handler: text("handler").notNull().default(""),
    intakeLocation: text("intake_location").notNull().default(""),
    packingCondition: text("packing_condition").notNull().default(""),
    transitCondition: text("transit_condition").notNull().default(""),
    unpackingObservation: text("unpacking_observation").notNull().default(""),
    supportRemovalNote: text("support_removal_note").notNull().default(""),
    postDisplayCondition: text("post_display_condition").notNull().default(""),
    acclimatizationUntil: text("acclimatization_until"),
    treatmentRequired: integer("treatment_required", { mode: "boolean" })
      .notNull()
      .default(false),
    treatmentNote: text("treatment_note").notNull().default(""),
    storageLocation: text("storage_location").notNull().default(""),
    recoveryNote: text("recovery_note").notNull().default(""),
    releasedBy: text("released_by").notNull().default(""),
    releasedAt: text("released_at"),
    referredAt: text("referred_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("exhibition_recoveries_status_received_idx").on(table.status, table.receivedAt),
    index("exhibition_recoveries_asset_idx").on(table.sampleAssetId),
    index("exhibition_recoveries_stabilization_idx").on(table.status, table.acclimatizationUntil),
  ],
);

export const exhibitionRecoveryChecks = sqliteTable(
  "exhibition_recovery_checks",
  {
    id: text("id").primaryKey(),
    exhibitionRecoveryId: text("exhibition_recovery_id")
      .notNull()
      .references(() => exhibitionRecoveries.id, { onDelete: "cascade" }),
    category: text("category", {
      enum: ["custody", "packing", "condition", "support", "stabilization", "storage"],
    }).notNull(),
    title: text("title").notNull(),
    requirement: text("requirement").notNull().default(""),
    result: text("result", {
      enum: ["pending", "pass", "attention", "blocked", "na"],
    })
      .notNull()
      .default("pending"),
    observation: text("observation").notNull().default(""),
    critical: integer("critical", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("exhibition_recovery_checks_recovery_category_uidx").on(
      table.exhibitionRecoveryId,
      table.category,
    ),
    index("exhibition_recovery_checks_recovery_sort_idx").on(
      table.exhibitionRecoveryId,
      table.sortOrder,
    ),
    index("exhibition_recovery_checks_result_idx").on(table.result),
  ],
);

export const exhibitionRecoveryImages = sqliteTable(
  "exhibition_recovery_images",
  {
    id: text("id").primaryKey(),
    exhibitionRecoveryId: text("exhibition_recovery_id")
      .notNull()
      .references(() => exhibitionRecoveries.id, { onDelete: "cascade" }),
    imageKey: text("image_key").notNull().unique(),
    imageType: text("image_type").notNull(),
    imageSize: integer("image_size").notNull(),
    angle: text("angle", {
      enum: ["intake", "unpacking", "condition", "support", "packing", "storage", "other"],
    })
      .notNull()
      .default("intake"),
    caption: text("caption").notNull().default(""),
    altText: text("alt_text").notNull(),
    status: text("status", { enum: ["active", "removed"] })
      .notNull()
      .default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("exhibition_recovery_images_recovery_sort_idx").on(
      table.exhibitionRecoveryId,
      table.sortOrder,
    ),
    index("exhibition_recovery_images_recovery_status_idx").on(
      table.exhibitionRecoveryId,
      table.status,
    ),
  ],
);

export const designReviews = sqliteTable(
  "design_reviews",
  {
    id: text("id").primaryKey(),
    reviewCode: text("review_code").notNull().unique(),
    title: text("title").notNull(),
    reviewType: text("review_type", {
      enum: [
        "concept",
        "silhouette",
        "material",
        "fitting",
        "construction",
        "styling",
        "final_edit",
        "other",
      ],
    })
      .notNull()
      .default("concept"),
    status: text("status", {
      enum: ["planned", "in_review", "decided", "closed", "cancelled"],
    })
      .notNull()
      .default("planned"),
    decision: text("decision", {
      enum: ["pending", "approved", "revise", "hold", "drop"],
    })
      .notNull()
      .default("pending"),
    collectionId: text("collection_id").references(() => collections.id, {
      onDelete: "set null",
    }),
    workId: text("work_id").references(() => works.id, {
      onDelete: "set null",
    }),
    brief: text("brief").notNull().default(""),
    observations: text("observations").notNull().default(""),
    conclusion: text("conclusion").notNull().default(""),
    reviewerName: text("reviewer_name").notNull().default(""),
    scheduledAt: text("scheduled_at"),
    decidedAt: text("decided_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("design_reviews_status_schedule_idx").on(
      table.status,
      table.scheduledAt,
    ),
    index("design_reviews_collection_idx").on(
      table.collectionId,
      table.createdAt,
    ),
    index("design_reviews_work_idx").on(table.workId, table.createdAt),
  ],
);

export const designReviewActions = sqliteTable(
  "design_review_actions",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => designReviews.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    priority: text("priority", {
      enum: ["low", "normal", "high", "critical"],
    })
      .notNull()
      .default("normal"),
    status: text("status", {
      enum: ["open", "in_progress", "done", "cancelled"],
    })
      .notNull()
      .default("open"),
    ownerName: text("owner_name").notNull().default(""),
    dueAt: text("due_at"),
    notes: text("notes").notNull().default(""),
    resolvedAt: text("resolved_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("design_review_actions_review_status_idx").on(
      table.reviewId,
      table.status,
    ),
    index("design_review_actions_status_due_idx").on(
      table.status,
      table.dueAt,
    ),
  ],
);

export const archiveSnapshots = sqliteTable(
  "archive_snapshots",
  {
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    notes: text("notes").notNull().default(""),
    schemaVersion: integer("schema_version").notNull().default(1),
    manifestHash: text("manifest_hash").notNull(),
    dataJson: text("data_json").notNull(),
    workCount: integer("work_count").notNull().default(0),
    collectionCount: integer("collection_count").notNull().default(0),
    processCount: integer("process_count").notNull().default(0),
    publicationCount: integer("publication_count").notNull().default(0),
    calendarEventCount: integer("calendar_event_count").notNull().default(0),
    showroomCount: integer("showroom_count").notNull().default(0),
    showroomAssignmentCount: integer("showroom_assignment_count")
      .notNull()
      .default(0),
    showroomRequestCount: integer("showroom_request_count")
      .notNull()
      .default(0),
    showroomRequestItemCount: integer("showroom_request_item_count")
      .notNull()
      .default(0),
    sampleLoanCount: integer("sample_loan_count").notNull().default(0),
    sampleLoanItemCount: integer("sample_loan_item_count")
      .notNull()
      .default(0),
    sampleCommunicationCount: integer("sample_communication_count")
      .notNull()
      .default(0),
    sampleAssetCount: integer("sample_asset_count").notNull().default(0),
    sampleAuditCount: integer("sample_audit_count").notNull().default(0),
    sampleAuditItemCount: integer("sample_audit_item_count")
      .notNull()
      .default(0),
    samplePlacementCount: integer("sample_placement_count")
      .notNull()
      .default(0),
    samplePlacementItemCount: integer("sample_placement_item_count")
      .notNull()
      .default(0),
    relationshipContactCount: integer("relationship_contact_count")
      .notNull()
      .default(0),
    relationshipOpportunityCount: integer("relationship_opportunity_count")
      .notNull()
      .default(0),
    relationshipActivityCount: integer("relationship_activity_count")
      .notNull()
      .default(0),
    outreachCampaignCount: integer("outreach_campaign_count")
      .notNull()
      .default(0),
    outreachRecipientCount: integer("outreach_recipient_count")
      .notNull()
      .default(0),
    designReviewCount: integer("design_review_count").notNull().default(0),
    designReviewActionCount: integer("design_review_action_count")
      .notNull()
      .default(0),
    materialCount: integer("material_count").notNull().default(0),
    workMaterialCount: integer("work_material_count").notNull().default(0),
    technicalPackCount: integer("technical_pack_count").notNull().default(0),
    techPackMeasurementCount: integer("tech_pack_measurement_count")
      .notNull()
      .default(0),
    techPackConstructionNoteCount: integer(
      "tech_pack_construction_note_count",
    )
      .notNull()
      .default(0),
    fittingSessionCount: integer("fitting_session_count")
      .notNull()
      .default(0),
    fittingIssueCount: integer("fitting_issue_count")
      .notNull()
      .default(0),
    fittingImageCount: integer("fitting_image_count")
      .notNull()
      .default(0),
    sampleSignoffCount: integer("sample_signoff_count")
      .notNull()
      .default(0),
    sampleSignoffCheckCount: integer("sample_signoff_check_count")
      .notNull()
      .default(0),
    sampleSignoffImageCount: integer("sample_signoff_image_count")
      .notNull()
      .default(0),
    productionReleaseCount: integer("production_release_count")
      .notNull()
      .default(0),
    productionReleaseCheckCount: integer("production_release_check_count")
      .notNull()
      .default(0),
    productionExceptionCount: integer("production_exception_count")
      .notNull()
      .default(0),
    productionExceptionActionCount: integer(
      "production_exception_action_count",
    )
      .notNull()
      .default(0),
    productionAcceptanceCount: integer("production_acceptance_count")
      .notNull()
      .default(0),
    productionAcceptanceCheckCount: integer(
      "production_acceptance_check_count",
    )
      .notNull()
      .default(0),
    productionAcceptanceImageCount: integer(
      "production_acceptance_image_count",
    )
      .notNull()
      .default(0),
    provenanceDossierCount: integer("provenance_dossier_count")
      .notNull()
      .default(0),
    provenanceDossierCheckCount: integer("provenance_dossier_check_count")
      .notNull()
      .default(0),
    conservationReportCount: integer("conservation_report_count")
      .notNull()
      .default(0),
    conservationReportCheckCount: integer("conservation_report_check_count")
      .notNull()
      .default(0),
    conservationReportImageCount: integer("conservation_report_image_count")
      .notNull()
      .default(0),
    exhibitionReadinessPlanCount: integer("exhibition_readiness_plan_count")
      .notNull()
      .default(0),
    exhibitionReadinessCheckCount: integer("exhibition_readiness_check_count")
      .notNull()
      .default(0),
    exhibitionReadinessImageCount: integer("exhibition_readiness_image_count")
      .notNull()
      .default(0),
    exhibitionWatchCount: integer("exhibition_watch_count")
      .notNull()
      .default(0),
    exhibitionWatchObservationCount: integer("exhibition_watch_observation_count")
      .notNull()
      .default(0),
    exhibitionWatchImageCount: integer("exhibition_watch_image_count")
      .notNull()
      .default(0),
    exhibitionRecoveryCount: integer("exhibition_recovery_count")
      .notNull()
      .default(0),
    exhibitionRecoveryCheckCount: integer("exhibition_recovery_check_count")
      .notNull()
      .default(0),
    exhibitionRecoveryImageCount: integer("exhibition_recovery_image_count")
      .notNull()
      .default(0),
    curatorialProjectCount: integer("curatorial_project_count")
      .notNull()
      .default(0),
    curatorialSelectionCount: integer("curatorial_selection_count")
      .notNull()
      .default(0),
    interpretationPackageCount: integer("interpretation_package_count")
      .notNull()
      .default(0),
    interpretationSectionCount: integer("interpretation_section_count")
      .notNull()
      .default(0),
    interpretationLabelCount: integer("interpretation_label_count")
      .notNull()
      .default(0),
    exhibitionDeliveryPackageCount: integer("exhibition_delivery_package_count")
      .notNull()
      .default(0),
    exhibitionDeliveryItemCount: integer("exhibition_delivery_item_count")
      .notNull()
      .default(0),
    exhibitionInstallationGateCount: integer("exhibition_installation_gate_count")
      .notNull()
      .default(0),
    exhibitionInstallationCheckCount: integer("exhibition_installation_check_count")
      .notNull()
      .default(0),
    exhibitionInstallationImageCount: integer("exhibition_installation_image_count")
      .notNull()
      .default(0),
    exhibitionOpeningGateCount: integer("exhibition_opening_gate_count")
      .notNull()
      .default(0),
    exhibitionOpeningItemCount: integer("exhibition_opening_item_count")
      .notNull()
      .default(0),
    mediaCount: integer("media_count").notNull().default(0),
    mediaBytes: integer("media_bytes").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("archive_snapshots_created_at_idx").on(table.createdAt),
    index("archive_snapshots_manifest_hash_idx").on(table.manifestHash),
  ],
);

export type Work = typeof works.$inferSelect;
export type NewWork = typeof works.$inferInsert;
export type WorkImage = typeof workImages.$inferSelect;
export type NewWorkImage = typeof workImages.$inferInsert;
export type WorkProcessEntry = typeof workProcessEntries.$inferSelect;
export type NewWorkProcessEntry = typeof workProcessEntries.$inferInsert;
export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
export type CollectionWork = typeof collectionWorks.$inferSelect;
export type NewCollectionWork = typeof collectionWorks.$inferInsert;
export type Publication = typeof publications.$inferSelect;
export type NewPublication = typeof publications.$inferInsert;
export type EditorialEvent = typeof editorialEvents.$inferSelect;
export type NewEditorialEvent = typeof editorialEvents.$inferInsert;
export type Showroom = typeof showrooms.$inferSelect;
export type NewShowroom = typeof showrooms.$inferInsert;
export type ShowroomWork = typeof showroomWorks.$inferSelect;
export type NewShowroomWork = typeof showroomWorks.$inferInsert;
export type ShowroomRequest = typeof showroomRequests.$inferSelect;
export type NewShowroomRequest = typeof showroomRequests.$inferInsert;
export type ShowroomRequestItem = typeof showroomRequestItems.$inferSelect;
export type NewShowroomRequestItem = typeof showroomRequestItems.$inferInsert;
export type SampleLoan = typeof sampleLoans.$inferSelect;
export type NewSampleLoan = typeof sampleLoans.$inferInsert;
export type SampleAsset = typeof sampleAssets.$inferSelect;
export type NewSampleAsset = typeof sampleAssets.$inferInsert;
export type SampleLoanItem = typeof sampleLoanItems.$inferSelect;
export type NewSampleLoanItem = typeof sampleLoanItems.$inferInsert;
export type SamplePlacement = typeof samplePlacements.$inferSelect;
export type NewSamplePlacement = typeof samplePlacements.$inferInsert;
export type SamplePlacementItem = typeof samplePlacementItems.$inferSelect;
export type NewSamplePlacementItem = typeof samplePlacementItems.$inferInsert;
export type SampleCommunication = typeof sampleCommunications.$inferSelect;
export type NewSampleCommunication = typeof sampleCommunications.$inferInsert;
export type SampleAudit = typeof sampleAudits.$inferSelect;
export type NewSampleAudit = typeof sampleAudits.$inferInsert;
export type SampleAuditItem = typeof sampleAuditItems.$inferSelect;
export type NewSampleAuditItem = typeof sampleAuditItems.$inferInsert;
export type RelationshipContact = typeof relationshipContacts.$inferSelect;
export type NewRelationshipContact = typeof relationshipContacts.$inferInsert;
export type RelationshipOpportunity =
  typeof relationshipOpportunities.$inferSelect;
export type NewRelationshipOpportunity =
  typeof relationshipOpportunities.$inferInsert;
export type RelationshipActivity = typeof relationshipActivities.$inferSelect;
export type NewRelationshipActivity =
  typeof relationshipActivities.$inferInsert;
export type OutreachCampaign = typeof outreachCampaigns.$inferSelect;
export type NewOutreachCampaign = typeof outreachCampaigns.$inferInsert;
export type OutreachRecipient = typeof outreachRecipients.$inferSelect;
export type NewOutreachRecipient = typeof outreachRecipients.$inferInsert;
export type DesignReview = typeof designReviews.$inferSelect;
export type NewDesignReview = typeof designReviews.$inferInsert;
export type DesignReviewAction = typeof designReviewActions.$inferSelect;
export type NewDesignReviewAction = typeof designReviewActions.$inferInsert;
export type Material = typeof materials.$inferSelect;
export type NewMaterial = typeof materials.$inferInsert;
export type WorkMaterial = typeof workMaterials.$inferSelect;
export type NewWorkMaterial = typeof workMaterials.$inferInsert;
export type TechnicalPack = typeof technicalPacks.$inferSelect;
export type NewTechnicalPack = typeof technicalPacks.$inferInsert;
export type TechPackMeasurement = typeof techPackMeasurements.$inferSelect;
export type NewTechPackMeasurement =
  typeof techPackMeasurements.$inferInsert;
export type TechPackConstructionNote =
  typeof techPackConstructionNotes.$inferSelect;
export type NewTechPackConstructionNote =
  typeof techPackConstructionNotes.$inferInsert;
export type FittingSession = typeof fittingSessions.$inferSelect;
export type NewFittingSession = typeof fittingSessions.$inferInsert;
export type FittingIssue = typeof fittingIssues.$inferSelect;
export type NewFittingIssue = typeof fittingIssues.$inferInsert;
export type FittingImage = typeof fittingImages.$inferSelect;
export type NewFittingImage = typeof fittingImages.$inferInsert;
export type SampleSignoff = typeof sampleSignoffs.$inferSelect;
export type NewSampleSignoff = typeof sampleSignoffs.$inferInsert;
export type SampleSignoffCheck = typeof sampleSignoffChecks.$inferSelect;
export type NewSampleSignoffCheck = typeof sampleSignoffChecks.$inferInsert;
export type SampleSignoffImage = typeof sampleSignoffImages.$inferSelect;
export type NewSampleSignoffImage = typeof sampleSignoffImages.$inferInsert;
export type ProductionRelease = typeof productionReleases.$inferSelect;
export type NewProductionRelease = typeof productionReleases.$inferInsert;
export type ProductionReleaseCheck =
  typeof productionReleaseChecks.$inferSelect;
export type NewProductionReleaseCheck =
  typeof productionReleaseChecks.$inferInsert;
export type ProductionException = typeof productionExceptions.$inferSelect;
export type NewProductionException =
  typeof productionExceptions.$inferInsert;
export type ProductionExceptionAction =
  typeof productionExceptionActions.$inferSelect;
export type NewProductionExceptionAction =
  typeof productionExceptionActions.$inferInsert;
export type ProductionAcceptance = typeof productionAcceptances.$inferSelect;
export type NewProductionAcceptance =
  typeof productionAcceptances.$inferInsert;
export type ProductionAcceptanceCheck =
  typeof productionAcceptanceChecks.$inferSelect;
export type NewProductionAcceptanceCheck =
  typeof productionAcceptanceChecks.$inferInsert;
export type ProductionAcceptanceImage =
  typeof productionAcceptanceImages.$inferSelect;
export type NewProductionAcceptanceImage =
  typeof productionAcceptanceImages.$inferInsert;
export type ProvenanceDossier = typeof provenanceDossiers.$inferSelect;
export type NewProvenanceDossier = typeof provenanceDossiers.$inferInsert;
export type ProvenanceDossierCheck =
  typeof provenanceDossierChecks.$inferSelect;
export type NewProvenanceDossierCheck =
  typeof provenanceDossierChecks.$inferInsert;
export type ConservationReport = typeof conservationReports.$inferSelect;
export type NewConservationReport = typeof conservationReports.$inferInsert;
export type ConservationReportCheck =
  typeof conservationReportChecks.$inferSelect;
export type NewConservationReportCheck =
  typeof conservationReportChecks.$inferInsert;
export type ConservationReportImage =
  typeof conservationReportImages.$inferSelect;
export type NewConservationReportImage =
  typeof conservationReportImages.$inferInsert;
export type CuratorialProject = typeof curatorialProjects.$inferSelect;
export type NewCuratorialProject = typeof curatorialProjects.$inferInsert;
export type CuratorialSelection = typeof curatorialSelections.$inferSelect;
export type NewCuratorialSelection = typeof curatorialSelections.$inferInsert;
export type InterpretationPackage = typeof interpretationPackages.$inferSelect;
export type NewInterpretationPackage = typeof interpretationPackages.$inferInsert;
export type InterpretationSection = typeof interpretationSections.$inferSelect;
export type NewInterpretationSection = typeof interpretationSections.$inferInsert;
export type InterpretationLabel = typeof interpretationLabels.$inferSelect;
export type NewInterpretationLabel = typeof interpretationLabels.$inferInsert;
export type ExhibitionDeliveryPackage = typeof exhibitionDeliveryPackages.$inferSelect;
export type NewExhibitionDeliveryPackage = typeof exhibitionDeliveryPackages.$inferInsert;
export type ExhibitionDeliveryItem = typeof exhibitionDeliveryItems.$inferSelect;
export type NewExhibitionDeliveryItem = typeof exhibitionDeliveryItems.$inferInsert;
export type ExhibitionInstallationGate = typeof exhibitionInstallationGates.$inferSelect;
export type NewExhibitionInstallationGate = typeof exhibitionInstallationGates.$inferInsert;
export type ExhibitionInstallationCheck = typeof exhibitionInstallationChecks.$inferSelect;
export type NewExhibitionInstallationCheck = typeof exhibitionInstallationChecks.$inferInsert;
export type ExhibitionInstallationImage = typeof exhibitionInstallationImages.$inferSelect;
export type NewExhibitionInstallationImage = typeof exhibitionInstallationImages.$inferInsert;
export type ExhibitionOpeningGate = typeof exhibitionOpeningGates.$inferSelect;
export type NewExhibitionOpeningGate = typeof exhibitionOpeningGates.$inferInsert;
export type ExhibitionOpeningItem = typeof exhibitionOpeningItems.$inferSelect;
export type NewExhibitionOpeningItem = typeof exhibitionOpeningItems.$inferInsert;
export type ExhibitionReadinessPlan = typeof exhibitionReadinessPlans.$inferSelect;
export type NewExhibitionReadinessPlan = typeof exhibitionReadinessPlans.$inferInsert;
export type ExhibitionReadinessCheck = typeof exhibitionReadinessChecks.$inferSelect;
export type NewExhibitionReadinessCheck = typeof exhibitionReadinessChecks.$inferInsert;
export type ExhibitionReadinessImage = typeof exhibitionReadinessImages.$inferSelect;
export type NewExhibitionReadinessImage = typeof exhibitionReadinessImages.$inferInsert;
export type ExhibitionWatch = typeof exhibitionWatches.$inferSelect;
export type NewExhibitionWatch = typeof exhibitionWatches.$inferInsert;
export type ExhibitionWatchObservation = typeof exhibitionWatchObservations.$inferSelect;
export type NewExhibitionWatchObservation = typeof exhibitionWatchObservations.$inferInsert;
export type ExhibitionWatchImage = typeof exhibitionWatchImages.$inferSelect;
export type NewExhibitionWatchImage = typeof exhibitionWatchImages.$inferInsert;
export type ExhibitionRecovery = typeof exhibitionRecoveries.$inferSelect;
export type NewExhibitionRecovery = typeof exhibitionRecoveries.$inferInsert;
export type ExhibitionRecoveryCheck = typeof exhibitionRecoveryChecks.$inferSelect;
export type NewExhibitionRecoveryCheck = typeof exhibitionRecoveryChecks.$inferInsert;
export type ExhibitionRecoveryImage = typeof exhibitionRecoveryImages.$inferSelect;
export type NewExhibitionRecoveryImage = typeof exhibitionRecoveryImages.$inferInsert;
export type ArchiveSnapshot = typeof archiveSnapshots.$inferSelect;
export type NewArchiveSnapshot = typeof archiveSnapshots.$inferInsert;
