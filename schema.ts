import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ---- Organizations (Multi-Tenant) -----------------------------------------
  // Each row = one tenant/company using the platform.
  // All other tables reference organizationId to scope their data.
  organizations: defineTable({
    name: v.string(),
    // URL-safe slug, unique across all orgs (e.g. "pt-maju-jaya")
    slug: v.string(),
    logoUrl: v.optional(v.string()),
    // "free" | "pro" | "enterprise"
    plan: v.optional(v.string()),
    // Reference to the membershipPlans row currently active for this org
    membershipPlanId: v.optional(v.id("membershipPlans")),
    isActive: v.boolean(),
    // ISO timestamp
    createdAt: v.string(),
    updatedAt: v.optional(v.string()),
    // Contact info
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    // Number of licensed seats (optional)
    maxSeats: v.optional(v.number()),
    // Extra employee seats purchased on top of the plan limit (add-on). Each
    // verified seat purchase increases this. The effective employee limit is
    // plan.maxEmployees + extraSeats (only when the plan has a finite limit).
    extraSeats: v.optional(v.number()),
    // Marks the built-in demo/sample organization (seeded via testData). Only one
    // should exist; the switcher pins it to the top as the default demo target.
    isSampleOrg: v.optional(v.boolean()),
    // Who registered this organization (user id)
    createdBy: v.optional(v.id("users")),
    // Ordered list of directory column tokens (built-in keys like "no"/"nama"
    // and custom field ids). Controls column order in the directory table and
    // the Kelola Field dialog. Empty/undefined = default order.
    directoryColumnOrder: v.optional(v.array(v.string())),
    // Unique, shareable invite code employees enter during onboarding to join
    // this organization (e.g. "MAJU7K"). Stored uppercase. Optional for
    // backward-compat; generated on demand for older orgs.
    inviteCode: v.optional(v.string()),
    // ---- Self-service registration & approval ----
    // Registration approval status for self-service org creation.
    // "pending" = awaiting super admin review, "approved" = active,
    // "rejected" = declined. Undefined for legacy/super-admin-created orgs.
    approvalStatus: v.optional(v.string()),
    // True while this organisation is in its free self-service trial period.
    // Trial orgs are instantly active (no approval) and use the trial limits
    // (max employees + active features) from the global trialSettings. The
    // trial "ends" at subscriptionPaidUntil; once past that the standard
    // subscription read-only lock applies until a payment is verified, which
    // also clears this flag.
    isTrial: v.optional(v.boolean()),
    // How the org intends to pay for the selected plan: "free" | "transfer".
    paymentMethod: v.optional(v.string()),
    // Manual bank transfer reference / proof text supplied by the registrant.
    paymentReference: v.optional(v.string()),
    // Snapshot of the plan price at submission time (display text, e.g. "Rp 25rb/user/bulan").
    paymentAmountLabel: v.optional(v.string()),
    // When the registration request was submitted (ISO timestamp).
    submittedAt: v.optional(v.string()),
    // Super admin review metadata.
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    // ---- Recurring subscription billing ----
    // When the current paid subscription started (ISO timestamp). Undefined for
    // orgs that never had a billing period set (treated as not-yet-billed).
    subscriptionStartedAt: v.optional(v.string()),
    // Billing cycle length in months for the most recent payment (1/3/6/12).
    subscriptionCycleMonths: v.optional(v.number()),
    // The org is paid up THROUGH this instant (ISO timestamp, UTC). Access stays
    // full until this date + grace period passes. Undefined = no active period.
    subscriptionPaidUntil: v.optional(v.string()),
    // Last subscription status ("due_soon"/"overdue"/"expired") a reminder was
    // sent for, so the daily reminder cron only notifies once per status change.
    subscriptionLastReminderStatus: v.optional(v.string()),
    // When that last reminder was sent (ISO timestamp, UTC).
    subscriptionLastReminderAt: v.optional(v.string()),
    // ---- Audio/Video call quota ----
    // Monthly limit for total audio/video call minutes across the whole org.
    // undefined = unlimited (no enforcement). Set by an org admin or super admin.
    callQuotaMinutesPerMonth: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_active", ["isActive"])
    .index("by_invite_code", ["inviteCode"])
    .index("by_approval_status", ["approvalStatus"]),

  // ---- Membership Plans ---------------------------------------------------
  // Admin-editable plan tiers that define feature limits, pricing, and
  // which modules are available to organisations on that plan.
  membershipPlans: defineTable({
    // "free" | "starter" | "professional" | "enterprise"
    slug: v.string(),
    name: v.string(),
    description: v.string(),
    // Display price text (e.g. "Rp 0", "Rp 25rb", "Custom")
    price: v.string(),
    // Display unit (e.g. "selamanya", "/user/bulan", "hubungi kami")
    priceUnit: v.string(),
    // Numeric price per user per month in IDR for programmatic comparison (0 = free, -1 = custom)
    pricePerUserMonth: v.number(),
    // Hard limits
    maxEmployees: v.number(), // 0 = unlimited
    maxStorageMb: v.number(), // 0 = unlimited
    // "community" | "email" | "priority" | "dedicated"
    supportLevel: v.string(),
    // List of included feature/module labels
    coreFeatures: v.array(v.string()),
    // List of feature labels NOT available on this plan
    disabledFeatures: v.array(v.string()),
    // Display order (1 = first shown)
    order: v.number(),
    // Whether to show the "Paling Populer" badge
    isPopular: v.boolean(),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    updatedAt: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_order", ["order"])
    .index("by_active", ["isActive"]),

  // ---- Promos / Promotions ---------------------------------------------------
  // Admin-created promotional offers that can discount plan upgrades,
  // add extra users, or add extra storage for a limited time.
  promos: defineTable({
    // Unique code customers enter (e.g. "HEMAT2026")
    code: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    // "plan_upgrade" | "extra_users" | "extra_storage" | "discount"
    type: v.string(),
    // ---- Discount fields (type = "discount" or "plan_upgrade") ----
    // Percentage discount 0..100 (0 = no percentage discount)
    discountPercent: v.number(),
    // Flat discount in IDR (0 = no flat discount)
    discountFlat: v.number(),
    // ---- Add-on fields (type = "extra_users" or "extra_storage") ----
    // Extra users granted by this promo
    extraUsers: v.number(),
    // Extra storage in MB granted by this promo
    extraStorageMb: v.number(),
    // ---- Scope ----
    // Which plan slugs this promo applies to (empty = all plans)
    applicablePlanSlugs: v.array(v.string()),
    // ---- Validity ----
    // ISO timestamps for promo validity window
    validFrom: v.string(),
    validUntil: v.string(),
    // Max total redemptions (0 = unlimited)
    maxRedemptions: v.number(),
    // Current redemption count (denormalized)
    redemptionCount: v.number(),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    updatedAt: v.string(),
  })
    .index("by_code", ["code"])
    .index("by_type", ["type"])
    .index("by_active", ["isActive"]),

  // ---- Promo Redemptions ----------------------------------------------------
  // Tracks each time a promo code is used by an organization.
  promoRedemptions: defineTable({
    promoId: v.id("promos"),
    organizationId: v.id("organizations"),
    redeemedBy: v.id("users"),
    redeemedAt: v.string(),
    // Snapshot of what was granted
    grantedType: v.string(),
    grantedDiscountPercent: v.number(),
    grantedDiscountFlat: v.number(),
    grantedExtraUsers: v.number(),
    grantedExtraStorageMb: v.number(),
    // "active" | "expired" | "revoked"
    status: v.string(),
    expiresAt: v.optional(v.string()),
  })
    .index("by_promo", ["promoId"])
    .index("by_organization", ["organizationId"])
    .index("by_promo_and_org", ["promoId", "organizationId"]),

  // ---- Upgrade Requests -----------------------------------------------------
  // Tracks organization upgrade requests (plan, users, or storage).
  upgradeRequests: defineTable({
    organizationId: v.id("organizations"),
    requestedBy: v.id("users"),
    // "plan" | "users" | "storage"
    upgradeType: v.string(),
    // For plan upgrade: target plan id
    targetPlanId: v.optional(v.id("membershipPlans")),
    // For users upgrade: how many additional users requested
    additionalUsers: v.optional(v.number()),
    // For storage upgrade: how many additional MB requested
    additionalStorageMb: v.optional(v.number()),
    // Optional promo code applied
    promoId: v.optional(v.id("promos")),
    // "pending" | "approved" | "rejected" | "completed"
    status: v.string(),
    note: v.optional(v.string()),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.string()),
    reviewNote: v.optional(v.string()),
    requestedAt: v.string(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_status", ["status"])
    .index("by_requested_at", ["requestedAt"]),

  // Track calculator: saved calculation results for history & analytics
  trackCalculations: defineTable({
    userId: v.id("users"),
    segmentName: v.string(),
    staStart: v.string(),
    staEnd: v.string(),
    // Snapshot of all input data
    input: v.object({
      operation: v.object({
        axleLoad: v.number(),
        designSpeed: v.number(),
        trainFrequency: v.number(),
        passengerTonnageDaily: v.number(),
        freightTonnageDaily: v.number(),
        locomotiveTonnageDaily: v.number(),
      }),
      infrastructure: v.object({
        gauge: v.string(), // "1067" | "1435"
        railType: v.string(),
        sleeperType: v.string(),
        ballastThickness: v.number(),
        subgrade: v.string(),
      }),
      geometry: v.object({
        sdAlignment: v.number(),
        sdLevel: v.number(),
        sdGauge: v.number(),
        sdTwist: v.number(),
      }),
    }),
    // Key result fields stored flat for indexing and charting
    trackClassId: v.string(), // "I" | "II" | "III" | "IV" | "V"
    trackClassLabel: v.string(),
    mgt: v.number(),
    annualTonnage: v.number(),
    tqi: v.number(),
    tqiCategory: v.string(),
    effectiveMaxSpeed: v.number(),
    designSpeed: v.number(),
    overallStatus: v.string(), // "aman" | "mendekati_batas" | "overload"
    statusLabel: v.string(),
    issueCount: v.number(),
    // Full result JSON for detail view
    fullResult: v.string(), // JSON-stringified CalculatorResult
    // ISO timestamp when calculated
    calculatedAt: v.string(),
    // Optional note from user
    note: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_segment", ["segmentName"])
    .index("by_user_and_segment", ["userId", "segmentName"])
    .index("by_calculated_at", ["calculatedAt"])
    .index("by_organization", ["organizationId"]),

  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    // Employee identification number (Nomor Induk Pegawai)
    nip: v.optional(v.string()),
    email: v.optional(v.string()),
    department: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    phone: v.optional(v.string()),
    location: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    role: v.optional(v.string()),
    // "active" | "pending_approval" | "suspended" | "rejected"
    accountStatus: v.optional(v.string()),
    // ISO timestamp of last login
    lastLoginAt: v.optional(v.string()),
    // Soft-delete marker for abandoned onboarding stubs. Set when a user logged
    // in but never completed onboarding (no role/status/org) for a grace period.
    // Cleared automatically if the user returns and logs in again. Rows kept for
    // a further grace period, then permanently removed by the cleanup cron.
    onboardingAbandonedAt: v.optional(v.string()),
    // MM-DD (year-agnostic) for birthday matching across years
    birthday: v.optional(v.string()),
    // Full date of birth as ISO YYYY-MM-DD (includes year, for administration)
    dateOfBirth: v.optional(v.string()),
    // ISO date YYYY-MM-DD for first day at the company (used for anniversary years)
    startDate: v.optional(v.string()),
    // Reporting line: references another user as direct manager
    managerId: v.optional(v.id("users")),
    // Formal position level (jenjang jabatan) from positionLevels table
    positionLevelId: v.optional(v.id("positionLevels")),
    // Personalized quick access shortcut paths chosen by the user
    quickAccessShortcuts: v.optional(v.array(v.string())),
    // Multi-tenant: which organization this user belongs to.
    // optional so super_admin can exist without an org, and for backward compat.
    organizationId: v.optional(v.id("organizations")),
    // Super-admin only: the organization they are currently "viewing". When set,
    // the whole app scopes to this org instead of their own. Persists across
    // sessions so a super admin returns to the same org after logging back in.
    viewingOrganizationId: v.optional(v.id("organizations")),
    // Custom field values keyed by directoryFields._id
    customFields: v.optional(v.record(v.string(), v.string())),
    // ISO timestamp of the last time the user opened the "Kelola Surat" page.
    // Used to badge the sidebar with the count of new incoming letters (surat
    // masuk) recorded after this moment. Cleared/advanced each visit.
    lettersLastSeenAt: v.optional(v.string()),
    // Test/simulation account marker. When true this account is EXCLUDED from
    // every employee count and listing (directory, dashboards, HR analytics,
    // plan/seat usage, and billing) so real headcount stays accurate. Managed
    // by super admins only. Undefined/false = a real employee.
    isTestAccount: v.optional(v.boolean()),
    // Default digital signature (base64 image data URL). Used to auto-stamp the
    // signature block on official letters where this user is the SENDER
    // (pengirim), without needing to sign each letter manually.
    defaultSignature: v.optional(v.string()),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_manager", ["managerId"])
    .index("by_organization", ["organizationId"])
    .index("by_email", ["email"])
    .index("by_organization_and_nip", ["organizationId", "nip"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["department"],
    }),

  // Custom manual positions for org chart cards. When a card has a saved
  // position here, the "free layout" mode places it at these canvas coordinates
  // instead of the automatic tree layout. Command lines still connect
  // automatically based on managerId. One row per user (per organization).
  orgChartPositions: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    // Canvas coordinates (top-left of the card) in CSS pixels at 100% zoom.
    x: v.number(),
    y: v.number(),
    updatedAt: v.string(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_user", ["organizationId", "userId"]),

  // Profile change requests pending HR Manager verification
  profileChangeRequests: defineTable({
    // The user who requested the profile change
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    // JSON snapshot of the proposed changes (field -> new value)
    changes: v.string(),
    // "pending" | "approved" | "rejected"
    status: v.string(),
    // Optional reason when rejected
    rejectionReason: v.optional(v.string()),
    // Who reviewed this request (hr_manager or admin)
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.string()),
    // ISO timestamps
    createdAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_status", ["status"]),

  // History change requests pending HR verification. When an employee edits
  // their OWN riwayat (education/training/organization/award), the change is
  // queued here instead of applied directly. Admins/HR apply changes directly
  // and never create a row here. Riwayat Jabatan is HR-only and never queued.
  historyChangeRequests: defineTable({
    // The employee whose history the change targets (== requester).
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    // Which history category: "education" | "training" | "organization" | "award"
    kind: v.string(),
    // "create" | "update" | "delete"
    action: v.string(),
    // For update/delete: the id of the existing history row (as a string).
    targetId: v.optional(v.string()),
    // JSON of the proposed fields for create/update ("{}" for delete).
    payload: v.string(),
    // Short human-readable label shown in the review list.
    summary: v.string(),
    // Staged attachment uploaded with the request (for cleanup if rejected).
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentName: v.optional(v.string()),
    // "pending" | "approved" | "rejected" | "cancelled"
    status: v.string(),
    rejectionReason: v.optional(v.string()),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_status", ["status"]),

  // Custom field definitions for employee directory (per organization)
  directoryFields: defineTable({
    organizationId: v.id("organizations"),
    // Unique machine-readable key within the org (e.g. "employee_id", "blood_type")
    key: v.string(),
    // Human-readable label shown in the UI
    label: v.string(),
    // "text" | "number" | "date" | "select"
    type: v.string(),
    // For "select" type: comma-separated options
    options: v.optional(v.string()),
    // Whether field is required when editing employee
    required: v.optional(v.boolean()),
    // Display order (lower = shown first)
    order: v.number(),
    // Whether to show in directory list/grid view
    showInList: v.optional(v.boolean()),
    // Whether employees may edit this field themselves via profile self-service
    // (still goes through HR verification). Default/undefined = HR-managed only.
    employeeEditable: v.optional(v.boolean()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_org_and_key", ["organizationId", "key"]),

  announcements: defineTable({
    title: v.string(),
    content: v.string(),
    summary: v.optional(v.string()),
    priority: v.string(),
    category: v.optional(v.string()),
    coverImageStorageId: v.optional(v.id("_storage")),
    isPinned: v.optional(v.boolean()),
    status: v.optional(v.string()),
    likeCount: v.optional(v.number()),
    commentCount: v.optional(v.number()),
    viewCount: v.optional(v.number()),
    authorId: v.id("users"),
    publishedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_priority", ["priority"])
    .index("by_status", ["status"])
    .index("by_category", ["category"])
    .index("by_organization", ["organizationId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["category", "status"],
    }),

  announcementLikes: defineTable({
    announcementId: v.id("announcements"),
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_announcement", ["announcementId"])
    .index("by_user_and_announcement", ["userId", "announcementId"])
    .index("by_organization", ["organizationId"]),

  announcementComments: defineTable({
    announcementId: v.id("announcements"),
    authorId: v.id("users"),
    content: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_announcement", ["announcementId"])
    .index("by_organization", ["organizationId"]),

  leaveRequests: defineTable({
    userId: v.id("users"),
    type: v.string(), // "annual" | "sick" | "personal" | "maternity" | "other"
    startDate: v.string(), // ISO date string (YYYY-MM-DD)
    endDate: v.string(),
    dayCount: v.number(),
    reason: v.string(),
    status: v.string(), // "pending" | "approved" | "rejected"
    reviewerId: v.optional(v.id("users")),
    reviewedAt: v.optional(v.string()),
    reviewNote: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_start_date", ["startDate"])
    .index("by_status_and_start", ["status", "startDate"])
    .index("by_organization", ["organizationId"]),

  // Annual leave quota per user per year. Admins edit this; defaults to 12 days
  // if no row exists for a user in the current year.
  leaveBalances: defineTable({
    userId: v.id("users"),
    year: v.number(), // e.g. 2026
    annualQuota: v.number(), // days granted for the year
    updatedBy: v.id("users"),
    updatedAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_year", ["userId", "year"])
    .index("by_organization", ["organizationId"]),

  events: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    location: v.optional(v.string()),
    allDay: v.boolean(),
    goingCount: v.optional(v.number()),
    maybeCount: v.optional(v.number()),
    notGoingCount: v.optional(v.number()),
    authorId: v.id("users"),
    bannerStorageId: v.optional(v.id("_storage")),
    capacity: v.optional(v.number()),
    rsvpDeadline: v.optional(v.string()),
    eventType: v.optional(v.string()),
    isFeatured: v.optional(v.boolean()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_start_date", ["startDate"])
    .index("by_organization", ["organizationId"]),

  eventRsvps: defineTable({
    eventId: v.id("events"),
    userId: v.id("users"),
    status: v.string(),
    note: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_event", ["eventId"])
    .index("by_user", ["userId"])
    .index("by_event_and_user", ["eventId", "userId"])
    .index("by_organization", ["organizationId"]),

  documents: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    fileType: v.string(),
    storageId: v.id("_storage"),
    uploaderId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_category", ["category"])
    .index("by_organization", ["organizationId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["category"],
    }),

  employeeDocuments: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    fileType: v.string(),
    storageId: v.id("_storage"),
    uploaderId: v.id("users"),
    issueDate: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_category", ["userId", "category"])
    .index("by_organization", ["organizationId"]),

  forumThreads: defineTable({
    title: v.string(),
    content: v.string(),
    category: v.string(),
    authorId: v.id("users"),
    replyCount: v.number(),
    lastActivityAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_category", ["category"])
    .index("by_last_activity", ["lastActivityAt"])
    .index("by_organization", ["organizationId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["category"],
    }),

  forumReplies: defineTable({
    threadId: v.id("forumThreads"),
    authorId: v.id("users"),
    content: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_thread", ["threadId"])
    .index("by_organization", ["organizationId"]),

  suggestions: defineTable({
    title: v.string(),
    content: v.string(),
    category: v.string(),
    authorId: v.id("users"),
    isAnonymous: v.boolean(),
    status: v.string(),
    adminResponse: v.optional(v.string()),
    respondedAt: v.optional(v.string()),
    respondedBy: v.optional(v.id("users")),
    upvoteCount: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_status", ["status"])
    .index("by_category", ["category"])
    .index("by_author", ["authorId"])
    .index("by_organization", ["organizationId"]),

  suggestionVotes: defineTable({
    suggestionId: v.id("suggestions"),
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_suggestion", ["suggestionId"])
    .index("by_user_and_suggestion", ["userId", "suggestionId"])
    .index("by_organization", ["organizationId"]),

  tickets: defineTable({
    title: v.string(),
    description: v.string(),
    category: v.string(),
    priority: v.string(),
    status: v.string(),
    authorId: v.id("users"),
    assigneeId: v.optional(v.id("users")),
    resolvedAt: v.optional(v.string()),
    lastActivityAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_author", ["authorId"])
    .index("by_status", ["status"])
    .index("by_last_activity", ["lastActivityAt"])
    .index("by_organization", ["organizationId"]),

  ticketComments: defineTable({
    ticketId: v.id("tickets"),
    authorId: v.id("users"),
    content: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_ticket", ["ticketId"])
    .index("by_organization", ["organizationId"]),

  galleryAlbums: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    eventDate: v.string(),
    authorId: v.id("users"),
    coverPhotoId: v.optional(v.id("galleryPhotos")),
    photoCount: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_event_date", ["eventDate"])
    .index("by_author", ["authorId"])
    .index("by_organization", ["organizationId"]),

  galleryPhotos: defineTable({
    albumId: v.id("galleryAlbums"),
    storageId: v.id("_storage"),
    caption: v.optional(v.string()),
    uploaderId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_album", ["albumId"])
    .index("by_organization", ["organizationId"]),

  recognitions: defineTable({
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    // "teamwork" | "innovation" | "leadership" | "excellence" | "helpfulness"
    category: v.string(),
    message: v.string(),
    reactionCount: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_to_user", ["toUserId"])
    .index("by_from_user", ["fromUserId"])
    .index("by_organization", ["organizationId"]),

  // Formal company awards: "Employee of the Month", service anniversaries,
  // excellence awards, etc. Admins create awards and pick recipients. Unlike
  // peer recognitions these are official and shown in the Hall of Fame.
  awards: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    // "employee_of_month" | "employee_of_quarter" | "employee_of_year"
    // | "excellence" | "innovation" | "leadership" | "teamwork"
    // | "long_service" | "rookie" | "custom"
    category: v.string(),
    recipientId: v.id("users"),
    // Opaque period key that sorts lexically, e.g. "2026-01", "2026-Q1",
    // "2026". Optional for one-off awards.
    period: v.optional(v.string()),
    periodLabel: v.optional(v.string()), // "Januari 2026", "Q1 2026"
    // Date the award was officially given. ISO date YYYY-MM-DD.
    awardedOn: v.string(),
    // Optional monetary bonus in IDR for the recipient.
    bonusAmount: v.optional(v.number()),
    // Optional certificate or photo stored in Convex File Storage.
    certificateStorageId: v.optional(v.id("_storage")),
    awardedById: v.id("users"),
    // Is this the "headline" award of its period (shown prominently).
    isFeatured: v.optional(v.boolean()),
    congratulationCount: v.optional(v.number()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_recipient", ["recipientId"])
    .index("by_category", ["category"])
    .index("by_period", ["period"])
    .index("by_awarded_on", ["awardedOn"])
    .index("by_organization", ["organizationId"]),

  // "Congratulations" reactions on an award, similar to recognitionReactions.
  awardCongratulations: defineTable({
    awardId: v.id("awards"),
    userId: v.id("users"),
    message: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_award", ["awardId"])
    .index("by_user_and_award", ["userId", "awardId"])
    .index("by_organization", ["organizationId"]),

  recognitionReactions: defineTable({
    recognitionId: v.id("recognitions"),
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_recognition", ["recognitionId"])
    .index("by_user_and_recognition", ["userId", "recognitionId"])
    .index("by_organization", ["organizationId"]),

  polls: defineTable({
    question: v.string(),
    description: v.optional(v.string()),
    options: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
      }),
    ),
    allowMultiple: v.boolean(),
    isAnonymous: v.boolean(),
    status: v.string(),
    closesAt: v.optional(v.string()),
    authorId: v.id("users"),
    voteCount: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_status", ["status"])
    .index("by_organization", ["organizationId"]),

  pollVotes: defineTable({
    pollId: v.id("polls"),
    userId: v.id("users"),
    optionIds: v.array(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_poll", ["pollId"])
    .index("by_poll_and_user", ["pollId", "userId"])
    .index("by_organization", ["organizationId"]),

  rooms: defineTable({
    name: v.string(),
    location: v.optional(v.string()),
    capacity: v.number(),
    description: v.optional(v.string()),
    amenities: v.array(v.string()),
    isActive: v.boolean(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_active", ["isActive"])
    .index("by_organization", ["organizationId"]),

  roomBookings: defineTable({
    roomId: v.id("rooms"),
    userId: v.id("users"),
    title: v.string(),
    purpose: v.optional(v.string()),
    attendeeCount: v.optional(v.number()),
    startTime: v.string(),
    endTime: v.string(),
    date: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_room_and_date", ["roomId", "date"])
    .index("by_user", ["userId"])
    .index("by_date", ["date"])
    .index("by_organization", ["organizationId"]),

  // ---- Audio / Video Calls (Daily.co) ------------------------------------
  // A live call session created by a user within their organization. Others in
  // the same org can join via the shared invite link. Default mode is
  // "audio" (cheapest); "video" enables camera. Sessions are recorded so we can
  // later compute per-organization usage (minutes) for quota enforcement.
  callSessions: defineTable({
    organizationId: v.optional(v.id("organizations")),
    createdBy: v.id("users"),
    title: v.string(),
    // "audio" | "video" — the default media mode when joining
    mode: v.string(),
    // "active" | "ended"
    status: v.string(),
    // Daily.co room identifiers
    dailyRoomName: v.string(),
    dailyRoomUrl: v.string(),
    startedAt: v.string(), // ISO timestamp
    endedAt: v.optional(v.string()), // ISO timestamp when the call was ended
    // Optional link to a room booking (used by the Rooms integration milestone)
    roomBookingId: v.optional(v.id("roomBookings")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_room_name", ["dailyRoomName"])
    .index("by_org_and_status", ["organizationId", "status"])
    .index("by_booking", ["roomBookingId"]),

  // Denormalized monthly usage counter per organization. Incremented when a call
  // ends so the quota check reads a single small document instead of scanning
  // every call session. `month` is a UTC "YYYY-MM" bucket, so usage resets each
  // calendar month automatically (a new month simply has no row yet = 0 used).
  callQuotaUsage: defineTable({
    organizationId: v.id("organizations"),
    month: v.string(), // UTC "YYYY-MM"
    minutesUsed: v.number(),
    updatedAt: v.string(), // ISO timestamp
  }).index("by_org_and_month", ["organizationId", "month"]),

  // ---- Zoom Meetings (external link) --------------------------------------
  // A Zoom meeting scheduled by a user and shared with their organization.
  // Unlike Daily.co calls, we do not host the media; we simply store the Zoom
  // join link (and optional details) so members can see upcoming meetings and
  // open them in Zoom. Status is derived from scheduledAt on the client.
  zoomMeetings: defineTable({
    organizationId: v.optional(v.id("organizations")),
    createdBy: v.id("users"),
    title: v.string(),
    joinUrl: v.string(), // the Zoom join link
    meetingId: v.optional(v.string()), // optional Zoom meeting ID
    passcode: v.optional(v.string()), // optional passcode
    scheduledAt: v.optional(v.string()), // ISO timestamp of when it starts
    notes: v.optional(v.string()),
    // "scheduled" | "cancelled"
    status: v.string(),
    createdAt: v.string(), // ISO timestamp
  })
    .index("by_organization", ["organizationId"])
    .index("by_org_and_status", ["organizationId", "status"]),

  attendanceRecords: defineTable({
    userId: v.id("users"),
    date: v.string(), // YYYY-MM-DD (local day)
    clockInAt: v.string(), // ISO timestamp
    clockOutAt: v.optional(v.string()), // ISO timestamp
    workMinutes: v.optional(v.number()), // computed when clocked out
    clockInNote: v.optional(v.string()),
    clockOutNote: v.optional(v.string()),
    location: v.optional(v.string()),
    isLate: v.boolean(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user_and_date", ["userId", "date"])
    .index("by_date", ["date"])
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"]),

  notifications: defineTable({
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    link: v.optional(v.string()),
    actorId: v.optional(v.id("users")),
    readAt: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_read", ["userId", "readAt"])
    .index("by_organization", ["organizationId"]),

  // Per-user notification preferences. One row per user.
  // Categories control which notification types the user wants to receive.
  notificationPreferences: defineTable({
    userId: v.id("users"),
    // Category toggles — true = enabled (default is all enabled)
    catLeave: v.boolean(),
    catAttendance: v.boolean(),
    catExpenses: v.boolean(),
    catTasks: v.boolean(),
    catForum: v.boolean(),
    catAnnouncements: v.boolean(),
    catPolicies: v.boolean(),
    catEvents: v.boolean(),
    catRecognitions: v.boolean(),
    catAwards: v.boolean(),
    catTraining: v.boolean(),
    catPayroll: v.boolean(),
    catOkr: v.boolean(),
    catTickets: v.boolean(),
    catMessages: v.boolean(),
    catSystem: v.boolean(),
    // Quiet hours (optional) — suppress non-critical notifications
    quietHoursEnabled: v.boolean(),
    quietHoursStart: v.optional(v.string()), // "22:00"
    quietHoursEnd: v.optional(v.string()),   // "07:00"
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"]),

  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    status: v.string(), // "active" | "on_hold" | "completed" | "archived"
    ownerId: v.id("users"),
    memberIds: v.array(v.id("users")),
    color: v.string(), // tailwind color token, e.g. "blue", "green"
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_owner", ["ownerId"])
    .index("by_status", ["status"])
    .index("by_organization", ["organizationId"]),

  // One-on-one direct message conversations between two users.
  // `key` is the two participant ids sorted & joined to enforce a single
  // conversation per pair regardless of who initiates it.
  conversations: defineTable({
    key: v.string(),
    userAId: v.id("users"),
    userBId: v.id("users"),
    lastMessageAt: v.string(), // ISO timestamp (updated on every message)
    lastMessagePreview: v.optional(v.string()),
    lastMessageSenderId: v.optional(v.id("users")),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_key", ["key"])
    .index("by_userA_and_last", ["userAId", "lastMessageAt"])
    .index("by_userB_and_last", ["userBId", "lastMessageAt"])
    .index("by_organization", ["organizationId"]),

  directMessages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    recipientId: v.id("users"),
    content: v.string(),
    readAt: v.optional(v.string()), // ISO timestamp when recipient read it
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_recipient_and_read", ["recipientId", "readAt"])
    .index("by_organization", ["organizationId"]),

  tasks: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    description: v.optional(v.string()),
    assigneeId: v.optional(v.id("users")),
    status: v.string(), // "todo" | "in_progress" | "review" | "done"
    priority: v.string(), // "low" | "medium" | "high" | "urgent"
    dueDate: v.optional(v.string()), // YYYY-MM-DD
    authorId: v.id("users"),
    completedAt: v.optional(v.string()),
    order: v.number(), // for ordering within a status column
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_status", ["projectId", "status"])
    .index("by_assignee", ["assigneeId"])
    .index("by_assignee_and_status", ["assigneeId", "status"])
    .index("by_organization", ["organizationId"]),

  // Per-organization task stages (kanban columns / statuses). Each client org
  // can define its own workflow stages. When an org has no rows here, the app
  // falls back to a built-in default set (todo, in_progress, review, done).
  taskStatuses: defineTable({
    organizationId: v.id("organizations"),
    // Machine-readable key unique within the org (e.g. "todo", "blocked").
    key: v.string(),
    // Human-readable label shown in the UI.
    label: v.string(),
    // Color key from the frontend whitelist (e.g. "blue", "green").
    color: v.string(),
    // Display order (lower = shown first / left-most column).
    order: v.number(),
    // Inactive stages are hidden from pickers but kept for history.
    isActive: v.boolean(),
    // Terminal stage: tasks in a completed stage count as "done".
    isCompleted: v.boolean(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_org_and_key", ["organizationId", "key"]),

  // Per-organization task priorities. Each client org can define its own
  // priority levels. Falls back to defaults (low, medium, high, urgent).
  taskPriorities: defineTable({
    organizationId: v.id("organizations"),
    key: v.string(),
    label: v.string(),
    color: v.string(),
    // Display + severity order (higher = more urgent, sorted first in lists).
    order: v.number(),
    isActive: v.boolean(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_org_and_key", ["organizationId", "key"]),

  wikiSpaces: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.string(),
    color: v.string(),
    authorId: v.id("users"),
    articleCount: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_name", ["name"])
    .index("by_organization", ["organizationId"]),

  expenseReports: defineTable({
    userId: v.id("users"),
    title: v.string(),
    category: v.string(), // "travel" | "meal" | "supplies" | "training" | "transport" | "other"
    amount: v.number(), // in IDR (integer)
    expenseDate: v.string(), // YYYY-MM-DD
    description: v.string(),
    receiptStorageId: v.optional(v.id("_storage")),
    receiptFileName: v.optional(v.string()),
    status: v.string(), // "pending" | "approved" | "rejected" | "paid"
    reviewerId: v.optional(v.id("users")),
    reviewedAt: v.optional(v.string()),
    reviewNote: v.optional(v.string()),
    paidAt: v.optional(v.string()),
    // Optional payment method chosen when marking as paid
    paymentMethod: v.optional(v.string()), // "transfer" | "cash" | "petty_cash" | "other"
    paymentReference: v.optional(v.string()), // bank ref / voucher id
    // If expense settles a cash advance, link to it
    cashAdvanceId: v.optional(v.id("cashAdvances")),
    // Snapshot of department at submission for reporting
    userDepartment: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_expense_date", ["expenseDate"])
    .index("by_category", ["category"])
    .index("by_cash_advance", ["cashAdvanceId"])
    .index("by_organization", ["organizationId"]),

  // Expense policy per category: max amount per single request and whether a
  // receipt is mandatory above a certain threshold. Admins define; employees
  // see the rules when submitting.
  expensePolicies: defineTable({
    category: v.string(), // "travel" | "meal" | ... matches expense category keys
    maxAmountPerRequest: v.optional(v.number()), // IDR, undefined = unlimited
    monthlyLimitPerUser: v.optional(v.number()), // IDR cap per user per month
    receiptRequiredAbove: v.optional(v.number()), // IDR threshold
    requireDescription: v.boolean(),
    isActive: v.boolean(),
    note: v.optional(v.string()),
    updatedBy: v.id("users"),
    updatedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_category", ["category"])
    .index("by_organization", ["organizationId"]),

  // Per-organization expense categories. Each client org can define its own
  // set of reimbursement categories (label, icon, color). When an org has no
  // rows here, the app falls back to a built-in default set so nothing breaks.
  expenseCategories: defineTable({
    organizationId: v.id("organizations"),
    // Machine-readable key unique within the org (e.g. "travel", "marketing").
    key: v.string(),
    // Human-readable label shown in the UI.
    label: v.string(),
    // Icon name from the frontend whitelist (e.g. "Plane", "Receipt").
    icon: v.string(),
    // Color key from the frontend whitelist (e.g. "sky", "orange").
    color: v.string(),
    // Display order (lower = shown first).
    order: v.number(),
    // Inactive categories are hidden from new submissions but kept for history.
    isActive: v.boolean(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_org_and_key", ["organizationId", "key"]),

  // Cash advance / uang muka: employee requests money upfront, then later
  // settles it with actual receipts/expenses.
  cashAdvances: defineTable({
    userId: v.id("users"),
    title: v.string(),
    purpose: v.string(), // description of intended use
    amount: v.number(), // requested amount IDR
    neededBy: v.string(), // YYYY-MM-DD
    // "pending" | "approved" | "rejected" | "disbursed" | "settled" | "cancelled"
    status: v.string(),
    reviewerId: v.optional(v.id("users")),
    reviewedAt: v.optional(v.string()),
    reviewNote: v.optional(v.string()),
    disbursedAt: v.optional(v.string()),
    disbursedById: v.optional(v.id("users")),
    // Settlement: sum of actual expenses linked to this advance
    settledAmount: v.optional(v.number()),
    settledAt: v.optional(v.string()),
    // Excess to return / shortfall to reimburse
    settlementNote: v.optional(v.string()),
    userDepartment: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_organization", ["organizationId"]),

  wikiArticles: defineTable({
    spaceId: v.id("wikiSpaces"),
    title: v.string(),
    content: v.string(),
    summary: v.optional(v.string()),
    tags: v.array(v.string()),
    authorId: v.id("users"),
    lastEditorId: v.optional(v.id("users")),
    lastEditedAt: v.string(),
    viewCount: v.number(),
    status: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_space", ["spaceId"])
    .index("by_space_and_status", ["spaceId", "status"])
    .index("by_last_edited", ["lastEditedAt"])
    .index("by_organization", ["organizationId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["spaceId", "status"],
    }),

  // Reusable master template of onboarding tasks. Admins edit these; when a
  // new employee is added to onboarding, a per-user checklist is created from
  // the current set of active templates.
  onboardingTemplates: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    // "paperwork" | "equipment" | "training" | "meeting" | "access" | "other"
    category: v.string(),
    // Days after the employee start date this task is due (can be negative for
    // pre-boarding tasks).
    dueOffsetDays: v.number(),
    // Who is responsible by default. "hr" | "it" | "manager" | "employee" | "other"
    ownerRole: v.string(),
    // Journey phase: "preboarding" | "day_one" | "first_week" | "first_month" | "first_quarter"
    phase: v.optional(v.string()),
    // Order for display and creation ordering
    order: v.number(),
    isActive: v.boolean(),
    authorId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_order", ["order"])
    .index("by_organization", ["organizationId"]),

  // Onboarding journey for a specific employee.
  onboardingEmployees: defineTable({
    userId: v.id("users"),
    startDate: v.string(), // YYYY-MM-DD
    buddyId: v.optional(v.id("users")), // assigned buddy/mentor
    managerId: v.optional(v.id("users")),
    // "active" | "completed" | "paused"
    status: v.string(),
    completedAt: v.optional(v.string()),
    notes: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_organization", ["organizationId"]),

  onboardingTasks: defineTable({
    onboardingId: v.id("onboardingEmployees"),
    userId: v.id("users"), // the new employee
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    ownerRole: v.string(),
    phase: v.optional(v.string()),
    dueDate: v.optional(v.string()), // YYYY-MM-DD
    // "todo" | "done"
    status: v.string(),
    completedAt: v.optional(v.string()),
    completedBy: v.optional(v.id("users")),
    order: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_onboarding", ["onboardingId"])
    .index("by_user", ["userId"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_organization", ["organizationId"]),

  // Welcome resources library: curated links, documents, and videos for new
  // hires. Visible to all users on their onboarding page, managed by admins.
  onboardingResources: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    // "link" | "document" | "video" | "contact"
    kind: v.string(),
    // "welcome" | "culture" | "policy" | "tool" | "people" | "benefits" | "other"
    category: v.string(),
    // Present for link/video
    url: v.optional(v.string()),
    // Present for document (uploaded into Convex Storage)
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    // For contact kind: link to a user in the directory
    contactUserId: v.optional(v.id("users")),
    // Emoji for quick visual marker
    icon: v.optional(v.string()),
    isPinned: v.optional(v.boolean()),
    order: v.number(),
    authorId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_order", ["order"])
    .index("by_category", ["category"])
    .index("by_organization", ["organizationId"]),

  // Scheduled check-ins during onboarding: 30/60/90 day or custom milestones.
  // The employee fills in a mood score + free-form answers, then HR can review.
  onboardingCheckins: defineTable({
    onboardingId: v.id("onboardingEmployees"),
    userId: v.id("users"),
    // "day_30" | "day_60" | "day_90" | "custom"
    kind: v.string(),
    // Display label like "30 Hari", "60 Hari", ...
    label: v.string(),
    // ISO date YYYY-MM-DD when the check-in becomes available / is scheduled
    scheduledDate: v.string(),
    // "pending" | "submitted" | "reviewed"
    status: v.string(),
    // Mood score 1..5 (1 = very unhappy, 5 = very happy) filled by employee
    moodScore: v.optional(v.number()),
    // Free-form employee responses
    highlights: v.optional(v.string()), // what's going well
    challenges: v.optional(v.string()), // what's hard
    supportNeeded: v.optional(v.string()), // what help is needed
    // Admin/HR feedback after review
    reviewerId: v.optional(v.id("users")),
    reviewNote: v.optional(v.string()),
    submittedAt: v.optional(v.string()),
    reviewedAt: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_onboarding", ["onboardingId"])
    .index("by_user", ["userId"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_status", ["status"])
    .index("by_organization", ["organizationId"]),

  // Training / e-learning: admins publish courses with ordered lessons,
  // employees enroll and track per-lesson progress.
  courses: defineTable({
    title: v.string(),
    description: v.string(),
    // "onboarding" | "leadership" | "technical" | "soft_skills" | "compliance" | "product" | "other"
    category: v.string(),
    // "beginner" | "intermediate" | "advanced"
    level: v.string(),
    durationMinutes: v.number(), // estimated total duration
    coverColor: v.string(), // tailwind color token for cover card
    instructorName: v.optional(v.string()), // free-text (external trainer ok)
    authorId: v.id("users"),
    isPublished: v.boolean(),
    lessonCount: v.number(), // denormalized
    enrollmentCount: v.number(), // denormalized
    // Denormalized average rating 0..5 (rounded to 1 decimal) & review count.
    averageRating: v.optional(v.number()),
    reviewCount: v.optional(v.number()),
    // Completion requires passing the quiz when true (set automatically
    // whenever a quiz with >=1 question exists for the course).
    hasQuiz: v.optional(v.boolean()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_published", ["isPublished"])
    .index("by_category", ["category"])
    .index("by_organization", ["organizationId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["category", "isPublished"],
    }),

  // Single quiz per course (optional). Passing score is required for the
  // course to be marked complete when a quiz exists.
  courseQuizzes: defineTable({
    courseId: v.id("courses"),
    title: v.string(),
    description: v.optional(v.string()),
    passingScore: v.number(), // percentage 0..100
    maxAttempts: v.optional(v.number()), // undefined = unlimited
    questions: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        options: v.array(
          v.object({
            id: v.string(),
            text: v.string(),
          }),
        ),
        correctOptionId: v.string(),
        explanation: v.optional(v.string()),
      }),
    ),
    authorId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_course", ["courseId"])
    .index("by_organization", ["organizationId"]),

  courseQuizAttempts: defineTable({
    quizId: v.id("courseQuizzes"),
    courseId: v.id("courses"),
    userId: v.id("users"),
    // Answers chosen per question: { questionId -> optionId }
    answers: v.array(
      v.object({
        questionId: v.string(),
        optionId: v.string(),
      }),
    ),
    score: v.number(), // percentage 0..100
    passed: v.boolean(),
    submittedAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user_and_course", ["userId", "courseId"])
    .index("by_quiz", ["quizId"])
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"]),

  // Issued when a user completes a course (all lessons done + quiz passed if
  // applicable). Serial is an opaque short string used on the certificate.
  courseCertificates: defineTable({
    courseId: v.id("courses"),
    userId: v.id("users"),
    issuedAt: v.string(), // ISO timestamp
    serial: v.string(), // unique display serial, e.g. "HR-2026-XYZ9AB"
    // Denormalized snapshots so certificates survive edits/deletion
    courseTitle: v.string(),
    userName: v.string(),
    instructorName: v.optional(v.string()),
    durationMinutes: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_course", ["courseId"])
    .index("by_user_and_course", ["userId", "courseId"])
    .index("by_serial", ["serial"])
    .index("by_organization", ["organizationId"]),

  // Mandatory assignments. Admins can assign a course to an individual user,
  // a whole department, or all employees, with an optional due date.
  courseAssignments: defineTable({
    courseId: v.id("courses"),
    // "user" | "department" | "all"
    targetType: v.string(),
    // user id (when targetType == "user") or department name (when "department").
    // empty for "all".
    targetValue: v.optional(v.string()),
    dueDate: v.optional(v.string()), // YYYY-MM-DD
    note: v.optional(v.string()),
    assignedById: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_course", ["courseId"])
    .index("by_target", ["targetType", "targetValue"])
    .index("by_organization", ["organizationId"]),

  // Course reviews & ratings. One review per (user, course).
  courseReviews: defineTable({
    courseId: v.id("courses"),
    userId: v.id("users"),
    rating: v.number(), // 1..5
    comment: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_course", ["courseId"])
    .index("by_course_and_user", ["courseId", "userId"])
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"]),

  // Per-lesson discussion comments.
  lessonComments: defineTable({
    lessonId: v.id("courseLessons"),
    courseId: v.id("courses"),
    authorId: v.id("users"),
    content: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_lesson", ["lessonId"])
    .index("by_course", ["courseId"])
    .index("by_organization", ["organizationId"]),

  // Curated learning path / track bundling multiple courses in order.
  learningPaths: defineTable({
    title: v.string(),
    description: v.string(),
    coverColor: v.string(),
    icon: v.optional(v.string()), // emoji
    // "onboarding" | "leadership" | "technical" | "soft_skills" | "compliance" | "product" | "other"
    category: v.string(),
    isPublished: v.boolean(),
    authorId: v.id("users"),
    courseCount: v.number(), // denormalized
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_published", ["isPublished"])
    .index("by_category", ["category"])
    .index("by_organization", ["organizationId"]),

  learningPathCourses: defineTable({
    pathId: v.id("learningPaths"),
    courseId: v.id("courses"),
    order: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_path", ["pathId"])
    .index("by_path_and_course", ["pathId", "courseId"])
    .index("by_organization", ["organizationId"]),

  courseLessons: defineTable({
    courseId: v.id("courses"),
    title: v.string(),
    content: v.string(), // markdown body
    videoUrl: v.optional(v.string()), // optional embedded video (YouTube etc.)
    durationMinutes: v.number(),
    order: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_course", ["courseId"])
    .index("by_organization", ["organizationId"]),

  courseEnrollments: defineTable({
    courseId: v.id("courses"),
    userId: v.id("users"),
    enrolledAt: v.string(), // ISO timestamp
    // IDs of lessons the user has marked complete
    completedLessonIds: v.array(v.id("courseLessons")),
    progress: v.number(), // 0..100 percent
    completedAt: v.optional(v.string()), // set when progress reaches 100
    lastAccessedAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_course", ["courseId"])
    .index("by_course_and_user", ["courseId", "userId"])
    .index("by_organization", ["organizationId"]),

  // Internal job postings. Employees can browse open positions and apply
  // with a cover letter. Admins / supervisors post jobs and review applicants.
  jobPostings: defineTable({
    title: v.string(),
    department: v.string(),
    location: v.string(),
    // "fulltime" | "parttime" | "contract" | "internship" | "temporary"
    employmentType: v.string(),
    // "entry" | "mid" | "senior" | "lead" | "manager"
    level: v.string(),
    description: v.string(), // markdown overview
    responsibilities: v.string(), // markdown bullet list
    requirements: v.string(), // markdown bullet list
    // Optional salary display range in IDR
    salaryMin: v.optional(v.number()),
    salaryMax: v.optional(v.number()),
    // ISO date (YYYY-MM-DD) - applications accepted up to & including this day
    closingDate: v.optional(v.string()),
    // "open" | "closed"
    status: v.string(),
    postedById: v.id("users"),
    // Optional hiring manager contact (user in the directory)
    hiringManagerId: v.optional(v.id("users")),
    applicationCount: v.number(), // denormalized for list screens
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_status", ["status"])
    .index("by_department", ["department"])
    .index("by_organization", ["organizationId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["status", "department"],
    }),

  jobApplications: defineTable({
    jobId: v.id("jobPostings"),
    applicantId: v.id("users"),
    coverLetter: v.string(),
    // Optional resume attachment stored in Convex File Storage
    resumeStorageId: v.optional(v.id("_storage")),
    resumeFileName: v.optional(v.string()),
    // "submitted" | "reviewing" | "interview" | "accepted" | "rejected" | "withdrawn"
    status: v.string(),
    reviewerId: v.optional(v.id("users")),
    reviewedAt: v.optional(v.string()),
    reviewNote: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_job", ["jobId"])
    .index("by_applicant", ["applicantId"])
    .index("by_job_and_applicant", ["jobId", "applicantId"])
    .index("by_job_and_status", ["jobId", "status"])
    .index("by_organization", ["organizationId"]),

  // Performance reviews: one row per (employee, period). The reviewer (usually
  // the employee's manager) drafts ratings + comments, submits it so the
  // employee can see it, and the employee can then acknowledge / respond.
  performanceReviews: defineTable({
    revieweeId: v.id("users"),
    reviewerId: v.id("users"),
    // e.g. "2026-Q1", "2026-H1", "2026-annual" - opaque key, ordered lexically
    period: v.string(),
    // Human-readable label for display, e.g. "Q1 2026"
    periodLabel: v.string(),
    // "draft" | "submitted" | "acknowledged"
    status: v.string(),
    // 1..5 ratings; undefined until the reviewer rates each dimension
    overallRating: v.optional(v.number()),
    qualityRating: v.optional(v.number()),
    productivityRating: v.optional(v.number()),
    communicationRating: v.optional(v.number()),
    teamworkRating: v.optional(v.number()),
    initiativeRating: v.optional(v.number()),
    // Free-form text fields
    strengths: v.optional(v.string()),
    improvements: v.optional(v.string()),
    goals: v.optional(v.string()),
    reviewerComments: v.optional(v.string()),
    employeeComments: v.optional(v.string()),
    submittedAt: v.optional(v.string()),
    acknowledgedAt: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_reviewee", ["revieweeId"])
    .index("by_reviewer", ["reviewerId"])
    .index("by_period", ["period"])
    .index("by_reviewee_and_period", ["revieweeId", "period"])
    .index("by_reviewer_and_status", ["reviewerId", "status"])
    .index("by_organization", ["organizationId"]),

  // Company assets & inventory: laptops, monitors, phones, furniture, etc.
  // Admins create assets, assign them to employees, and track their status.
  assets: defineTable({
    name: v.string(),
    // Short unique tag like "LP-001" (not enforced unique - soft-unique in app)
    assetTag: v.string(),
    // "laptop" | "monitor" | "phone" | "peripheral" | "furniture" | "vehicle" | "software" | "other"
    category: v.string(),
    // "available" | "assigned" | "in_repair" | "retired"
    status: v.string(),
    serialNumber: v.optional(v.string()),
    brand: v.optional(v.string()),
    model: v.optional(v.string()),
    // ISO date YYYY-MM-DD
    purchaseDate: v.optional(v.string()),
    // IDR integer
    purchasePrice: v.optional(v.number()),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    // Optional image (cover) for the asset
    imageStorageId: v.optional(v.id("_storage")),
    // When assigned, reference the latest assignment row for quick lookup
    currentAssignmentId: v.optional(v.id("assetAssignments")),
    // Denormalized current holder id for indexing/filtering
    currentHolderId: v.optional(v.id("users")),
    authorId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_status", ["status"])
    .index("by_category", ["category"])
    .index("by_holder", ["currentHolderId"])
    .index("by_tag", ["assetTag"])
    .index("by_organization", ["organizationId"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["category", "status"],
    }),

  // History of every assignment of an asset to a user. One row per check-out.
  // When returned, returnedAt is set. The latest unreturned row represents the
  // current holder.
  assetAssignments: defineTable({
    assetId: v.id("assets"),
    userId: v.id("users"),
    assignedAt: v.string(), // ISO timestamp
    assignedBy: v.id("users"),
    note: v.optional(v.string()),
    returnedAt: v.optional(v.string()),
    returnedBy: v.optional(v.id("users")),
    returnNote: v.optional(v.string()),
    // "good" | "damaged" | "lost" - captured at return time
    returnCondition: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_asset", ["assetId"])
    .index("by_user", ["userId"])
    .index("by_asset_and_returned", ["assetId", "returnedAt"])
    .index("by_user_and_returned", ["userId", "returnedAt"])
    .index("by_organization", ["organizationId"]),

  // Company policies library: HR/admin publishes formal company policies.
  // Employees can browse, search, and acknowledge them. Unlike generic documents
  // these have versioning, acknowledgment tracking, and rich content.
  policies: defineTable({
    title: v.string(),
    summary: v.string(),
    content: v.string(),
    category: v.string(),
    version: v.string(),
    status: v.string(),
    requiresAcknowledgment: v.boolean(),
    effectiveDate: v.string(),
    expiresAt: v.optional(v.string()),
    tags: v.array(v.string()),
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentFileName: v.optional(v.string()),
    authorId: v.id("users"),
    lastEditorId: v.optional(v.id("users")),
    lastEditedAt: v.string(),
    publishedAt: v.optional(v.string()),
    viewCount: v.number(),
    acknowledgmentCount: v.number(),
    isPinned: v.optional(v.boolean()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_status", ["status"])
    .index("by_category", ["category"])
    .index("by_published_at", ["publishedAt"])
    .index("by_organization", ["organizationId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["category", "status"],
    }),

  policyAcknowledgments: defineTable({
    policyId: v.id("policies"),
    userId: v.id("users"),
    version: v.string(),
    acknowledgedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_policy", ["policyId"])
    .index("by_user", ["userId"])
    .index("by_policy_and_user", ["policyId", "userId"])
    .index("by_organization", ["organizationId"]),

  // Formal department record. Employees have a free-form `department` field
  // on their profile; this table adds metadata (head, color, description) for
  // departments that the company wants to make "official" and visible in the
  // org structure. The department name is the source of truth used to match
  // against users.department.
  departments: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    // Optional department head (senior person leading the department)
    headId: v.optional(v.id("users")),
    // tailwind color token like "blue" | "emerald" | "violet"
    color: v.string(),
    // Emoji or single character shown as a visual marker
    icon: v.optional(v.string()),
    // Parent department for hierarchical departments (e.g. Engineering > Frontend)
    parentId: v.optional(v.id("departments")),
    order: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_name", ["name"])
    .index("by_parent", ["parentId"])
    .index("by_organization", ["organizationId"]),

  // Master list of job titles / positions within an organization
  jobTitles: defineTable({
    name: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_name", ["name"])
    .index("by_organization", ["organizationId"]),

  // Cross-functional teams. Unlike departments, teams can span multiple
  // departments and have explicit membership (independent of reporting line).
  teams: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
    icon: v.optional(v.string()),
    leadId: v.optional(v.id("users")), // team lead
    authorId: v.id("users"),
    memberCount: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_name", ["name"])
    .index("by_organization", ["organizationId"]),

  teamMembers: defineTable({
    teamId: v.id("teams"),
    userId: v.id("users"),
    // "lead" | "member"
    role: v.string(),
    joinedAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_team", ["teamId"])
    .index("by_user", ["userId"])
    .index("by_team_and_user", ["teamId", "userId"])
    .index("by_organization", ["organizationId"]),

  // Secondary / matrix reporting lines. Unlike the primary `users.managerId`,
  // these represent dotted-line, project-based, or mentorship relationships.
  dottedLineReports: defineTable({
    userId: v.id("users"), // the employee being reported
    managerId: v.id("users"), // the secondary manager
    // "dotted" | "project" | "mentor" | "functional"
    relationshipType: v.string(),
    note: v.optional(v.string()),
    createdBy: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_manager", ["managerId"])
    .index("by_user_and_manager", ["userId", "managerId"])
    .index("by_organization", ["organizationId"]),

  // Succession candidates per incumbent. Admins pick who is next in line for
  // each position (tied to the incumbent user).
  successionPlans: defineTable({
    incumbentId: v.id("users"),
    candidateId: v.id("users"),
    // "ready_now" | "1_year" | "2_3_years" | "emergency"
    readiness: v.string(),
    strengths: v.optional(v.string()),
    development: v.optional(v.string()),
    priority: v.number(), // 1..10 (1 = highest)
    createdBy: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_incumbent", ["incumbentId"])
    .index("by_candidate", ["candidateId"])
    .index("by_incumbent_and_candidate", ["incumbentId", "candidateId"])
    .index("by_organization", ["organizationId"]),

  // Skills matrix: per-user skill/competency with a 1..5 level.
  employeeSkills: defineTable({
    userId: v.id("users"),
    skill: v.string(),
    // "technical" | "soft" | "language" | "certification" | "tool"
    category: v.string(),
    level: v.number(), // 1..5
    yearsExperience: v.optional(v.number()),
    note: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_skill", ["skill"])
    .index("by_user_and_skill", ["userId", "skill"])
    .index("by_organization", ["organizationId"]),

  // Timeline of changes to the organization structure.
  orgHistory: defineTable({
    eventType: v.string(),
    actorId: v.id("users"),
    // "user" | "department" | "team" | "position" | "dotted_line"
    subjectType: v.string(),
    subjectName: v.string(),
    summary: v.string(),
    timestamp: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_organization", ["organizationId"]),

  // Headcount planning: open/future positions before they become job postings.
  headcountPositions: defineTable({
    title: v.string(),
    department: v.string(),
    description: v.optional(v.string()),
    reportsToId: v.optional(v.id("users")),
    // "junior" | "mid" | "senior" | "lead" | "manager"
    level: v.string(),
    // "planned" | "approved" | "posted" | "filled" | "cancelled"
    status: v.string(),
    targetStartDate: v.optional(v.string()), // YYYY-MM-DD
    budgetMin: v.optional(v.number()),
    budgetMax: v.optional(v.number()),
    filledByUserId: v.optional(v.id("users")),
    filledAt: v.optional(v.string()),
    note: v.optional(v.string()),
    createdBy: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_department", ["department"])
    .index("by_status", ["status"])
    .index("by_reports_to", ["reportsToId"])
    .index("by_organization", ["organizationId"]),

  // ---- Advanced training features -------------------------------------

  // Scheduled / live training sessions associated with a course.
  // Attendees register ahead; trainer marks attendance after.
  trainingSessions: defineTable({
    courseId: v.id("courses"),
    title: v.string(),
    description: v.optional(v.string()),
    // ISO timestamp when session starts / ends
    startAt: v.string(),
    endAt: v.string(),
    // "online" | "offline" | "hybrid"
    format: v.string(),
    location: v.optional(v.string()), // physical location or room
    meetingUrl: v.optional(v.string()), // for online/hybrid
    capacity: v.optional(v.number()),
    trainerName: v.optional(v.string()),
    // "scheduled" | "ongoing" | "completed" | "cancelled"
    status: v.string(),
    authorId: v.id("users"),
    registeredCount: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_course", ["courseId"])
    .index("by_start", ["startAt"])
    .index("by_status", ["status"])
    .index("by_organization", ["organizationId"]),

  trainingSessionRegistrations: defineTable({
    sessionId: v.id("trainingSessions"),
    userId: v.id("users"),
    // "registered" | "attended" | "absent" | "cancelled"
    status: v.string(),
    registeredAt: v.string(),
    attendedAt: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"])
    .index("by_session_and_user", ["sessionId", "userId"])
    .index("by_organization", ["organizationId"]),

  // Gamification: per-user XP, badges earned from training activities.
  learnerStats: defineTable({
    userId: v.id("users"),
    totalXp: v.number(),
    coursesCompleted: v.number(),
    certificatesEarned: v.number(),
    quizzesPassed: v.number(),
    badges: v.array(v.string()), // badge keys, see training-utils
    streakDays: v.optional(v.number()),
    lastActivityDate: v.optional(v.string()), // YYYY-MM-DD
    updatedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"]),

  // Course prerequisites: course A requires user to have completed course B.
  coursePrerequisites: defineTable({
    courseId: v.id("courses"),
    prerequisiteId: v.id("courses"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_course", ["courseId"])
    .index("by_prerequisite", ["prerequisiteId"])
    .index("by_course_and_prereq", ["courseId", "prerequisiteId"])
    .index("by_organization", ["organizationId"]),

  // External training certificates uploaded by employees (from external
  // providers, seminars, etc.).
  externalTrainings: defineTable({
    userId: v.id("users"),
    title: v.string(),
    provider: v.string(), // training provider / institution name
    description: v.optional(v.string()),
    category: v.string(), // same taxonomy as courses
    durationHours: v.optional(v.number()),
    // ISO date YYYY-MM-DD when training was attended / certificate issued
    completedDate: v.string(),
    expiryDate: v.optional(v.string()),
    certificateStorageId: v.optional(v.id("_storage")),
    certificateFileName: v.optional(v.string()),
    certificateUrl: v.optional(v.string()), // external URL (badge, LinkedIn, etc.)
    // "pending" | "approved" | "rejected"
    status: v.string(),
    reviewerId: v.optional(v.id("users")),
    reviewedAt: v.optional(v.string()),
    reviewNote: v.optional(v.string()),
    cost: v.optional(v.number()), // IDR
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_organization", ["organizationId"]),

  // Required skills per course: when user completes course, they "earn"
  // the skill. Also used by skill-gap analytics.
  courseSkills: defineTable({
    courseId: v.id("courses"),
    skill: v.string(),
    category: v.string(),
    level: v.number(), // the skill level granted on completion (1..5)
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_course", ["courseId"])
    .index("by_skill", ["skill"])
    .index("by_organization", ["organizationId"]),

  // Course bookmarks / wishlist.
  courseBookmarks: defineTable({
    userId: v.id("users"),
    courseId: v.id("courses"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_course", ["userId", "courseId"])
    .index("by_organization", ["organizationId"]),

  // Feedback survey (post-course questions, separate from star review).
  courseSurveys: defineTable({
    courseId: v.id("courses"),
    title: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    questions: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        // "rating" (1..5) | "text" | "choice"
        type: v.string(),
        options: v.optional(v.array(v.string())),
        required: v.boolean(),
      }),
    ),
    authorId: v.id("users"),
    responseCount: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_course", ["courseId"])
    .index("by_organization", ["organizationId"]),

  courseSurveyResponses: defineTable({
    surveyId: v.id("courseSurveys"),
    courseId: v.id("courses"),
    userId: v.id("users"),
    answers: v.array(
      v.object({
        questionId: v.string(),
        value: v.string(), // rating is stringified number
      }),
    ),
    submittedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_survey", ["surveyId"])
    .index("by_survey_and_user", ["surveyId", "userId"])
    .index("by_course", ["courseId"])
    .index("by_organization", ["organizationId"]),

  // Training budget tracking: cost per course (planned) and per external
  // training (actual). Admins manage budgets.
  trainingBudgets: defineTable({
    // e.g. "2026", "2026-Q1"
    period: v.string(),
    periodLabel: v.string(),
    department: v.optional(v.string()), // undefined = company wide
    plannedAmount: v.number(), // IDR
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_period", ["period"])
    .index("by_department", ["department"])
    .index("by_organization", ["organizationId"]),

  // Course planned cost (per course). Used to roll up training spend.
  courseCosts: defineTable({
    courseId: v.id("courses"),
    amount: v.number(), // IDR per enrollment or flat
    // "per_enrollment" | "flat"
    model: v.string(),
    note: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_course", ["courseId"])
    .index("by_organization", ["organizationId"]),

  // ---- Talent Management: review cycles (Nine Box) --------------------
  // A formal talent review cycle. Managers draft placements during the cycle,
  // committee calibrates, then the cycle is finalized and closed.
  talentCycles: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    // Opaque period key, e.g. "2026-H1", sorted lexically
    period: v.string(),
    periodLabel: v.string(),
    // "draft" | "active" | "calibration" | "finalized" | "closed"
    status: v.string(),
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(), // YYYY-MM-DD
    calibrationDate: v.optional(v.string()), // YYYY-MM-DD
    // Source of performance score: "manual" | "kpi" | "hybrid"
    performanceSource: v.string(),
    // Calibration committee member user ids (can review/override placements)
    committeeIds: v.array(v.id("users")),
    // Scope: empty array = all employees; otherwise specific departments
    departments: v.array(v.string()),
    // Note displayed to managers when they start the review
    instructions: v.optional(v.string()),
    createdById: v.id("users"),
    finalizedAt: v.optional(v.string()),
    closedAt: v.optional(v.string()),
    // Denormalized for list screens
    placementCount: v.number(),
    finalizedCount: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_status", ["status"])
    .index("by_period", ["period"])
    .index("by_organization", ["organizationId"]),

  // Per-employee Nine Box placement for a given cycle. One row per (cycle,
  // user). Managers draft; committee calibrates & finalizes.
  talentPlacements: defineTable({
    cycleId: v.id("talentCycles"),
    userId: v.id("users"),
    // Snapshot of the employee's manager at draft time.
    managerId: v.optional(v.id("users")),
    // 1 (low) | 2 (medium) | 3 (high) - set by manager then possibly adjusted
    // by committee. Undefined until manager drafts.
    performance: v.optional(v.number()),
    potential: v.optional(v.number()),
    // Category code derived from performance+potential (see talent-utils).
    boxCode: v.optional(v.string()),
    // "pending" | "draft" | "submitted" | "calibrated" | "finalized"
    status: v.string(),
    // Free-form justifications
    managerNotes: v.optional(v.string()),
    committeeNotes: v.optional(v.string()),
    strengths: v.optional(v.string()),
    developmentAreas: v.optional(v.string()),
    // Optional performance score auto-pulled from KPI module for context.
    kpiScore: v.optional(v.number()),
    // Snapshots so reports survive profile edits / role changes.
    userName: v.string(),
    userDepartment: v.optional(v.string()),
    userJobTitle: v.optional(v.string()),
    // Position the employee *previously* occupied (for movement arrow).
    previousBoxCode: v.optional(v.string()),
    submittedAt: v.optional(v.string()),
    calibratedAt: v.optional(v.string()),
    calibratedById: v.optional(v.id("users")),
    finalizedAt: v.optional(v.string()),
    finalizedById: v.optional(v.id("users")),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_cycle", ["cycleId"])
    .index("by_cycle_and_user", ["cycleId", "userId"])
    .index("by_cycle_and_status", ["cycleId", "status"])
    .index("by_user", ["userId"])
    .index("by_manager", ["managerId"])
    .index("by_organization", ["organizationId"]),

  // Individual Development Plan tied to a talent placement. One row per
  // (cycle, user). Populated by manager & HR; visible to employee summary.
  talentIdps: defineTable({
    cycleId: v.id("talentCycles"),
    userId: v.id("users"),
    placementId: v.optional(v.id("talentPlacements")),
    // Short summary of focus for this cycle
    summary: v.optional(v.string()),
    // Career goal discussion
    careerAspiration: v.optional(v.string()),
    // "draft" | "published"
    status: v.string(),
    lastEditorId: v.id("users"),
    lastEditedAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_cycle", ["cycleId"])
    .index("by_cycle_and_user", ["cycleId", "userId"])
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"]),

  // Action item inside an IDP.
  talentIdpItems: defineTable({
    idpId: v.id("talentIdps"),
    cycleId: v.id("talentCycles"),
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    // "training" | "mentoring" | "stretch" | "certification" | "coaching" | "rotation" | "other"
    category: v.string(),
    // "short_term" | "medium_term" | "long_term"
    horizon: v.string(),
    targetDate: v.optional(v.string()), // YYYY-MM-DD
    // "planned" | "in_progress" | "done" | "cancelled"
    status: v.string(),
    progress: v.optional(v.number()), // 0..100
    note: v.optional(v.string()),
    order: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_idp", ["idpId"])
    .index("by_user", ["userId"])
    .index("by_cycle_and_user", ["cycleId", "userId"])
    .index("by_organization", ["organizationId"]),

  // ---- 9-box talent grid ----------------------------------------------
  // Assessment of a user's performance & potential on a 3-point scale used
  // to place them in the 9-box matrix (classic talent management tool).
  nineBoxAssessments: defineTable({
    userId: v.id("users"),
    // 1 (low) | 2 (medium) | 3 (high)
    performance: v.number(),
    potential: v.number(),
    // Optional derived period, e.g. "2026-H1"
    period: v.optional(v.string()),
    periodLabel: v.optional(v.string()),
    notes: v.optional(v.string()),
    assessedById: v.id("users"),
    assessedAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_period", ["period"])
    .index("by_user_and_period", ["userId", "period"])
    .index("by_organization", ["organizationId"]),

  // ---- Org reorganization scenarios & approval ------------------------

  // A draft "what if" reorganization plan. Admins bundle multiple proposed
  // changes (change manager, change department, change job title) into a
  // single scenario, submit it for approval, and apply it once approved.
  orgScenarios: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    // "draft" | "pending" | "approved" | "rejected" | "applied" | "cancelled"
    status: v.string(),
    createdById: v.id("users"),
    submittedAt: v.optional(v.string()),
    decidedAt: v.optional(v.string()),
    appliedAt: v.optional(v.string()),
    effectiveDate: v.optional(v.string()), // YYYY-MM-DD target
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_status", ["status"])
    .index("by_creator", ["createdById"])
    .index("by_organization", ["organizationId"]),

  // An individual proposed change inside a scenario.
  orgScenarioChanges: defineTable({
    scenarioId: v.id("orgScenarios"),
    // "set_manager" | "set_department" | "set_job_title"
    changeType: v.string(),
    userId: v.id("users"),
    // Text snapshots for display
    beforeValue: v.optional(v.string()),
    afterValue: v.optional(v.string()),
    // For set_manager change: the target manager user id (null clears)
    afterManagerId: v.optional(v.union(v.id("users"), v.null())),
    note: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_scenario", ["scenarioId"])
    .index("by_organization", ["organizationId"]),

  // Sequential approval chain for a scenario. Lower order approves first.
  orgScenarioApprovals: defineTable({
    scenarioId: v.id("orgScenarios"),
    approverId: v.id("users"),
    order: v.number(), // 1,2,3..
    // "pending" | "approved" | "rejected"
    decision: v.string(),
    note: v.optional(v.string()),
    decidedAt: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_scenario", ["scenarioId"])
    .index("by_approver", ["approverId"])
    .index("by_approver_and_decision", ["approverId", "decision"])
    .index("by_organization", ["organizationId"]),

  // ---- Job description, SOP, KPI --------------------------------------

  // Formal job role definition. Scoped by (title, department) so two
  // departments can have a role with the same title. Describes the position's
  // purpose and requirements; used as the parent of SOP steps & KPI metrics.
  jobRoles: defineTable({
    title: v.string(),
    // "" when department-agnostic (company-wide role).
    department: v.string(),
    // "entry" | "mid" | "senior" | "lead" | "manager"
    level: v.string(),
    purpose: v.string(), // one-paragraph mission / role summary
    responsibilities: v.string(), // markdown bullet list
    requirements: v.string(), // markdown bullet list
    // Additional markdown content (competencies, success metrics narrative)
    extraNotes: v.optional(v.string()),
    // tailwind color token for visual marker
    color: v.string(),
    // If true, this role is the active version. Older versions may be kept as
    // drafts for history purposes.
    isActive: v.boolean(),
    version: v.string(), // "1.0", "2.0" etc.
    authorId: v.id("users"),
    lastEditorId: v.optional(v.id("users")),
    lastEditedAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_title", ["title"])
    .index("by_title_and_department", ["title", "department"])
    .index("by_department", ["department"])
    .index("by_organization", ["organizationId"]),

  // Ordered step in a Standard Operating Procedure belonging to a job role.
  // Multiple SOP groups can be bundled by grouping on `procedureName`.
  jobRoleSops: defineTable({
    roleId: v.id("jobRoles"),
    // Name of the procedure (multiple steps grouped by the same name).
    procedureName: v.string(),
    // Order within the procedure.
    order: v.number(),
    title: v.string(),
    description: v.optional(v.string()), // markdown body
    // "daily" | "weekly" | "monthly" | "quarterly" | "adhoc"
    frequency: v.optional(v.string()),
    ownerRole: v.optional(v.string()), // free-form role responsible
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_role", ["roleId"])
    .index("by_role_and_procedure", ["roleId", "procedureName"])
    .index("by_organization", ["organizationId"]),

  // Key Performance Indicator definition attached to a job role. Each KPI has
  // a target, unit, and measurement frequency.
  jobRoleKpis: defineTable({
    roleId: v.id("jobRoles"),
    name: v.string(),
    description: v.optional(v.string()),
    // "number" | "percent" | "currency" | "duration" | "rating"
    unit: v.string(),
    // Target numeric value; interpretation depends on unit. Optional for
    // qualitative KPIs.
    target: v.optional(v.number()),
    // "higher_is_better" | "lower_is_better" | "range"
    direction: v.string(),
    // "monthly" | "quarterly" | "yearly"
    frequency: v.string(),
    // "low" | "medium" | "high" - priority / weight
    priority: v.string(),
    // 0..100 weight used for aggregated score. Sum of weights within a role
    // should equal 100 but not enforced.
    weight: v.optional(v.number()),
    order: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_role", ["roleId"])
    .index("by_organization", ["organizationId"]),

  // Actual KPI measurement for a user in a period. Admins or the employee's
  // supervisor record the actual value, with an automatic status.
  kpiMeasurements: defineTable({
    kpiId: v.id("jobRoleKpis"),
    userId: v.id("users"),
    // Period key, e.g. "2026-01", "2026-Q1", "2026".
    period: v.string(),
    periodLabel: v.string(),
    actualValue: v.number(),
    // "on_track" | "at_risk" | "off_track"
    status: v.string(),
    note: v.optional(v.string()),
    recordedById: v.id("users"),
    recordedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_kpi", ["kpiId"])
    .index("by_user", ["userId"])
    .index("by_user_and_period", ["userId", "period"])
    .index("by_kpi_and_user_and_period", ["kpiId", "userId", "period"])
    .index("by_organization", ["organizationId"]),

  // ---- Microlearning & Flashcards -------------------------------------

  // Bite-size microlessons: 1-5 minute content blocks for quick learning.
  // Standalone or can link to an optional flashcard deck for practice.
  microlessons: defineTable({
    title: v.string(),
    summary: v.string(),
    content: v.string(), // markdown body
    // same taxonomy as courses
    category: v.string(),
    durationMinutes: v.number(), // 1..10
    coverColor: v.string(),
    icon: v.optional(v.string()), // emoji marker
    isPublished: v.boolean(),
    authorId: v.id("users"),
    // Optional link to a flashcard deck for practice after reading
    deckId: v.optional(v.id("flashcardDecks")),
    viewCount: v.number(),
    completionCount: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_published", ["isPublished"])
    .index("by_category", ["category"])
    .index("by_organization", ["organizationId"]),

  // Per-user completion marker for a microlesson.
  microlessonCompletions: defineTable({
    microlessonId: v.id("microlessons"),
    userId: v.id("users"),
    completedAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_microlesson", ["microlessonId"])
    .index("by_user_and_microlesson", ["userId", "microlessonId"])
    .index("by_organization", ["organizationId"]),

  // A flashcard deck groups related flashcards. Optionally tied to a course.
  flashcardDecks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(), // same taxonomy as courses
    coverColor: v.string(),
    icon: v.optional(v.string()),
    // Optional course this deck belongs to
    courseId: v.optional(v.id("courses")),
    isPublished: v.boolean(),
    authorId: v.id("users"),
    cardCount: v.number(), // denormalized
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_published", ["isPublished"])
    .index("by_category", ["category"])
    .index("by_course", ["courseId"])
    .index("by_organization", ["organizationId"]),

  // Individual flashcard (front/back) inside a deck.
  flashcards: defineTable({
    deckId: v.id("flashcardDecks"),
    front: v.string(),
    back: v.string(),
    hint: v.optional(v.string()),
    order: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_deck", ["deckId"])
    .index("by_organization", ["organizationId"]),

  // Per-user SRS review state for a flashcard (simplified SM-2).
  // dueAt is an ISO timestamp; cards with dueAt <= now are "due".
  flashcardReviews: defineTable({
    userId: v.id("users"),
    cardId: v.id("flashcards"),
    deckId: v.id("flashcardDecks"),
    // SM-2: easiness factor (>= 1.3)
    ease: v.number(),
    // current interval in days
    intervalDays: v.number(),
    // number of successful consecutive reviews
    repetitions: v.number(),
    dueAt: v.string(), // ISO timestamp
    lastReviewedAt: v.optional(v.string()),
    // last quality rating 0..5 (0=again, 3=good, 5=easy)
    lastQuality: v.optional(v.number()),
    // total times the user answered correctly
    correctCount: v.number(),
    // total times the user answered incorrectly
    wrongCount: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_deck", ["userId", "deckId"])
    .index("by_user_and_card", ["userId", "cardId"])
    .index("by_user_and_due", ["userId", "dueAt"])
    .index("by_organization", ["organizationId"]),

  // ---- Mentorship & Peer Learning ------------------------------------

  // A user who opts-in to be a mentor. One row per user.
  mentorProfiles: defineTable({
    userId: v.id("users"),
    headline: v.string(), // short pitch, e.g. "Frontend & React Mentor"
    bio: v.string(), // longer markdown bio
    expertise: v.array(v.string()), // tags / skills offered
    // Same taxonomy as courses for visual categorization
    categories: v.array(v.string()),
    // "beginner" | "intermediate" | "advanced" | "any"
    preferredMentee: v.string(),
    // Preferred communication channel, free-form, e.g. "Zoom, WA"
    preferredChannel: v.optional(v.string()),
    // Max active mentees this mentor is willing to take at one time
    capacity: v.number(),
    // Whether the mentor is currently accepting new mentees
    isAcceptingRequests: v.boolean(),
    // Whether the profile is visible in the mentor directory
    isPublished: v.boolean(),
    // Optional weekly availability note
    availability: v.optional(v.string()),
    // Denormalized stats
    activeMentees: v.number(),
    totalMentees: v.number(),
    sessionCount: v.number(),
    averageRating: v.optional(v.number()),
    ratingCount: v.number(),
    updatedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_published", ["isPublished"])
    .index("by_organization", ["organizationId"]),

  // A mentoring relationship between a mentor and mentee. Starts as a request
  // from the mentee and becomes active once the mentor accepts.
  mentorships: defineTable({
    mentorId: v.id("users"),
    menteeId: v.id("users"),
    mentorProfileId: v.id("mentorProfiles"),
    goal: v.string(), // what the mentee wants to achieve
    topics: v.array(v.string()), // focus areas
    // "pending" | "active" | "completed" | "rejected" | "cancelled"
    status: v.string(),
    cadence: v.optional(v.string()), // e.g. "Biweekly"
    startDate: v.optional(v.string()), // YYYY-MM-DD - when activated
    targetEndDate: v.optional(v.string()), // YYYY-MM-DD
    endedAt: v.optional(v.string()), // ISO timestamp when completed/cancelled
    declineReason: v.optional(v.string()),
    // Optional post-mentorship feedback from the mentee.
    menteeRating: v.optional(v.number()), // 1..5
    menteeFeedback: v.optional(v.string()),
    mentorNote: v.optional(v.string()),
    requestedAt: v.string(), // ISO timestamp
    decidedAt: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_mentor", ["mentorId"])
    .index("by_mentee", ["menteeId"])
    .index("by_mentor_and_status", ["mentorId", "status"])
    .index("by_mentee_and_status", ["menteeId", "status"])
    .index("by_status", ["status"])
    .index("by_organization", ["organizationId"]),

  // Scheduled 1:1 mentorship session. Created by either party.
  mentorshipSessions: defineTable({
    mentorshipId: v.id("mentorships"),
    mentorId: v.id("users"),
    menteeId: v.id("users"),
    title: v.string(),
    agenda: v.optional(v.string()),
    scheduledAt: v.string(), // ISO timestamp
    durationMinutes: v.number(),
    meetingUrl: v.optional(v.string()),
    location: v.optional(v.string()),
    // "scheduled" | "completed" | "cancelled"
    status: v.string(),
    // Notes logged after the session
    mentorNotes: v.optional(v.string()),
    menteeNotes: v.optional(v.string()),
    // Action items captured during the session
    actionItems: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    createdById: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_mentorship", ["mentorshipId"])
    .index("by_mentor_and_scheduled", ["mentorId", "scheduledAt"])
    .index("by_mentee_and_scheduled", ["menteeId", "scheduledAt"])
    .index("by_organization", ["organizationId"]),

  // Peer study groups: collaborative groups of employees learning together.
  peerGroups: defineTable({
    name: v.string(),
    description: v.string(),
    // Same taxonomy as courses
    category: v.string(),
    coverColor: v.string(),
    icon: v.optional(v.string()),
    // Optional linked course the group is studying
    courseId: v.optional(v.id("courses")),
    // "open" | "invite" - open means anyone can join, invite means owner adds
    joinPolicy: v.string(),
    // Maximum number of members (0 = unlimited)
    capacity: v.number(),
    // Optional scheduled meeting cadence note, e.g. "Senin 19:00 WIB"
    cadence: v.optional(v.string()),
    meetingUrl: v.optional(v.string()),
    // "active" | "archived"
    status: v.string(),
    ownerId: v.id("users"),
    memberCount: v.number(),
    postCount: v.number(),
    updatedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_status", ["status"])
    .index("by_owner", ["ownerId"])
    .index("by_category", ["category"])
    .index("by_course", ["courseId"])
    .index("by_organization", ["organizationId"]),

  peerGroupMembers: defineTable({
    groupId: v.id("peerGroups"),
    userId: v.id("users"),
    // "owner" | "member"
    role: v.string(),
    joinedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_group", ["groupId"])
    .index("by_user", ["userId"])
    .index("by_group_and_user", ["groupId", "userId"])
    .index("by_organization", ["organizationId"]),

  // Discussion post inside a peer group. Supports replies via parentId.
  peerGroupPosts: defineTable({
    groupId: v.id("peerGroups"),
    authorId: v.id("users"),
    // Top-level if undefined
    parentId: v.optional(v.id("peerGroupPosts")),
    content: v.string(), // markdown
    // "question" | "insight" | "resource" | "update"
    kind: v.string(),
    likeCount: v.number(),
    replyCount: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_group", ["groupId"])
    .index("by_organization", ["organizationId"]),

  peerGroupPostLikes: defineTable({
    postId: v.id("peerGroupPosts"),
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_post", ["postId"])
    .index("by_user_and_post", ["userId", "postId"])
    .index("by_organization", ["organizationId"]),

  // ---- Training ROI & Prediction -------------------------------------

  // Expected benefit of completing a course. Used to compute ROI vs the
  // training spend recorded in trainingBudgets / courseCosts / externalTrainings.
  courseBenefits: defineTable({
    courseId: v.id("courses"),
    // IDR estimated benefit per learner who completes this course
    // (productivity gain, revenue, cost saving, etc.).
    benefitPerLearner: v.number(),
    // "productivity" | "revenue" | "cost_saving" | "retention" | "quality" | "compliance"
    benefitType: v.string(),
    // "low" | "medium" | "high"
    confidence: v.string(),
    // How long (in months) the benefit is expected to last after completion.
    benefitDurationMonths: v.optional(v.number()),
    // Free-form assumptions / note.
    assumptions: v.optional(v.string()),
    updatedBy: v.id("users"),
    updatedAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_course", ["courseId"])
    .index("by_organization", ["organizationId"]),

  // Per-user outcome recorded after training, captured by supervisor/admin.
  // Used for impact analysis (before/after metric improvement).
  trainingOutcomes: defineTable({
    userId: v.id("users"),
    courseId: v.id("courses"),
    // "kpi" | "performance_rating" | "certification" | "productivity" | "other"
    metricType: v.string(),
    metricName: v.string(),
    // Baseline numeric value before training
    baselineValue: v.optional(v.number()),
    // Actual numeric value after training
    postValue: v.optional(v.number()),
    unit: v.optional(v.string()), // "%", "unit", "hours", "IDR"
    // Optional realized monetary benefit attached to this outcome (IDR)
    realizedBenefit: v.optional(v.number()),
    recordedAt: v.string(), // ISO timestamp
    recordedById: v.id("users"),
    note: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_course", ["courseId"])
    .index("by_user_and_course", ["userId", "courseId"])
    .index("by_organization", ["organizationId"]),

  // ---- Competency framework & career ladder --------------------------

  // Master competency definition. Describes what "good" looks like at each
  // of the five levels (novice -> expert).
  competencies: defineTable({
    name: v.string(),
    description: v.string(),
    // Same taxonomy as courses + "leadership" etc.
    // "technical" | "leadership" | "soft_skills" | "product" | "compliance" | "domain" | "other"
    category: v.string(),
    // Five descriptors, index 0 = level 1 (novice) .. index 4 = level 5 (expert)
    levelDescriptors: v.array(v.string()),
    color: v.string(), // tailwind color token
    icon: v.optional(v.string()), // emoji marker
    isActive: v.boolean(),
    authorId: v.id("users"),
    lastEditorId: v.optional(v.id("users")),
    lastEditedAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_active", ["isActive"])
    .index("by_category", ["category"])
    .index("by_organization", ["organizationId"]),

  // A career track (e.g. "Software Engineering", "HR Operations"). Levels
  // inside a track define the ladder from junior to lead.
  careerTracks: defineTable({
    name: v.string(),
    description: v.string(),
    // "" when company-wide.
    department: v.string(),
    color: v.string(),
    icon: v.optional(v.string()),
    isActive: v.boolean(),
    authorId: v.id("users"),
    levelCount: v.number(), // denormalized
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_active", ["isActive"])
    .index("by_department", ["department"])
    .index("by_organization", ["organizationId"]),

  // An individual rung / level in a career track.
  careerLevels: defineTable({
    trackId: v.id("careerTracks"),
    order: v.number(), // 1..n
    title: v.string(), // e.g. "Junior Engineer", "Senior Engineer"
    // "entry" | "mid" | "senior" | "lead" | "manager" | "director"
    levelGrade: v.string(),
    description: v.optional(v.string()),
    // Expected years at this level before promotion (optional).
    minYearsInLevel: v.optional(v.number()),
    // Optional salary band in IDR.
    salaryMin: v.optional(v.number()),
    salaryMax: v.optional(v.number()),
    // Promotion criteria / expectations (markdown)
    expectations: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_track", ["trackId"])
    .index("by_track_and_order", ["trackId", "order"])
    .index("by_organization", ["organizationId"]),

  // Expected competency level for a given career level.
  careerLevelCompetencies: defineTable({
    levelId: v.id("careerLevels"),
    trackId: v.id("careerTracks"),
    competencyId: v.id("competencies"),
    expectedLevel: v.number(), // 1..5
    weight: v.optional(v.number()), // priority weight, default 1
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_level", ["levelId"])
    .index("by_track", ["trackId"])
    .index("by_competency", ["competencyId"])
    .index("by_level_and_competency", ["levelId", "competencyId"])
    .index("by_organization", ["organizationId"]),

  // Employee's current position on a career track.
  careerAssignments: defineTable({
    userId: v.id("users"),
    trackId: v.id("careerTracks"),
    currentLevelId: v.id("careerLevels"),
    // Aspired next level (optional, may be same-or-next)
    targetLevelId: v.optional(v.id("careerLevels")),
    startedAt: v.string(), // ISO date
    promotedAt: v.optional(v.string()), // ISO timestamp of last promotion
    note: v.optional(v.string()),
    assignedById: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_track", ["trackId"])
    .index("by_user_and_track", ["userId", "trackId"])
    .index("by_organization", ["organizationId"]),

  // An assessment of a user on a given competency. One record per
  // (user, competency, kind, period).
  competencyAssessments: defineTable({
    userId: v.id("users"),
    competencyId: v.id("competencies"),
    // "self" | "manager" | "peer" | "admin"
    kind: v.string(),
    level: v.number(), // 1..5
    period: v.optional(v.string()), // e.g. "2026-H1"
    periodLabel: v.optional(v.string()),
    notes: v.optional(v.string()),
    assessedById: v.id("users"),
    assessedAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_competency", ["competencyId"])
    .index("by_user_and_competency", ["userId", "competencyId"])
    .index("by_user_and_kind", ["userId", "kind"])
    .index("by_organization", ["organizationId"]),

  // Link a course to a competency it develops. When a user completes the
  // course, the competency gap for this link narrows.
  competencyCourses: defineTable({
    competencyId: v.id("competencies"),
    courseId: v.id("courses"),
    // Level gained upon course completion (1..5)
    levelImpact: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_competency", ["competencyId"])
    .index("by_course", ["courseId"])
    .index("by_competency_and_course", ["competencyId", "courseId"])
    .index("by_organization", ["organizationId"]),

  // ---- Payroll & Kompensasi -------------------------------------------

  // Master catalog of salary components (earnings & deductions). Admins
  // define these once, then assign per-employee amounts in salary structures.
  payrollComponents: defineTable({
    name: v.string(), // e.g. "Gaji Pokok", "Tunjangan Transport"
    code: v.string(), // short unique-ish code, e.g. "BASIC", "TRANS"
    // "earning" | "deduction"
    type: v.string(),
    // "fixed" | "percent_of_basic" - how defaultAmount is interpreted
    calculation: v.string(),
    // IDR amount (when fixed) or % value (when percent_of_basic)
    defaultAmount: v.number(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    // Taxable earnings are included in PPh21 calculation base.
    isTaxable: v.optional(v.boolean()),
    order: v.number(),
    authorId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_type", ["type"])
    .index("by_active", ["isActive"])
    .index("by_order", ["order"])
    .index("by_organization", ["organizationId"]),

  // Per-employee override of a salary component. If no row exists for a user
  // and component, the component's defaultAmount is used.
  employeeSalaryComponents: defineTable({
    userId: v.id("users"),
    componentId: v.id("payrollComponents"),
    // IDR amount (when fixed) or % (when percent_of_basic) - overrides default
    amount: v.number(),
    note: v.optional(v.string()),
    updatedBy: v.id("users"),
    updatedAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_component", ["componentId"])
    .index("by_user_and_component", ["userId", "componentId"])
    .index("by_organization", ["organizationId"]),

  // A monthly payroll run. Admin creates a period, generates payslips for all
  // active employees, publishes to share slips with employees.
  payrollPeriods: defineTable({
    period: v.string(), // "2026-04" (YYYY-MM) - sorts lexically
    periodLabel: v.string(), // "April 2026"
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(), // YYYY-MM-DD
    payDate: v.string(), // YYYY-MM-DD salary disbursement date
    // "draft" | "processing" | "published" | "closed"
    status: v.string(),
    totalGross: v.number(),
    totalDeductions: v.number(),
    totalNet: v.number(),
    employeeCount: v.number(),
    note: v.optional(v.string()),
    createdBy: v.id("users"),
    publishedAt: v.optional(v.string()),
    closedAt: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_period", ["period"])
    .index("by_status", ["status"])
    .index("by_organization", ["organizationId"]),

  // Individual employee's payslip for a payroll period. Contains aggregated
  // totals. Detailed line items are stored in payslipLines.
  payslips: defineTable({
    periodId: v.id("payrollPeriods"),
    userId: v.id("users"),
    period: v.string(), // denormalized period key for quick filter
    basicSalary: v.number(),
    totalEarnings: v.number(),
    totalDeductions: v.number(),
    grossSalary: v.number(),
    netSalary: v.number(),
    // Optional attendance-related figures captured at generation time
    workingDays: v.optional(v.number()),
    presentDays: v.optional(v.number()),
    absentDays: v.optional(v.number()),
    leaveDays: v.optional(v.number()),
    lateDays: v.optional(v.number()),
    overtimeHours: v.optional(v.number()),
    overtimeAmount: v.optional(v.number()),
    // "draft" | "published"
    status: v.string(),
    publishedAt: v.optional(v.string()),
    acknowledgedAt: v.optional(v.string()),
    note: v.optional(v.string()),
    // Snapshots so payslip history survives profile edits / deletions
    userName: v.string(),
    userJobTitle: v.optional(v.string()),
    userDepartment: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_period", ["periodId"])
    .index("by_user", ["userId"])
    .index("by_user_and_period", ["userId", "periodId"])
    .index("by_period_key", ["period"])
    .index("by_user_and_period_key", ["userId", "period"])
    .index("by_organization", ["organizationId"]),

  // Individual line item on a payslip (one row per salary component).
  payslipLines: defineTable({
    payslipId: v.id("payslips"),
    componentId: v.optional(v.id("payrollComponents")),
    name: v.string(),
    code: v.string(),
    // "earning" | "deduction"
    type: v.string(),
    amount: v.number(),
    order: v.number(),
    note: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_payslip", ["payslipId"])
    .index("by_organization", ["organizationId"]),

  // ---- Rekrutmen & ATS ------------------------------------------------

  // External job postings used by the recruitment team to hire from outside
  // the company. Distinct from internal `jobPostings` (which are for employees).
  recruitmentJobs: defineTable({
    title: v.string(),
    department: v.string(),
    location: v.string(),
    // "fulltime" | "parttime" | "contract" | "internship" | "temporary"
    employmentType: v.string(),
    // "entry" | "mid" | "senior" | "lead" | "manager"
    level: v.string(),
    description: v.string(), // markdown overview
    responsibilities: v.string(), // markdown bullet list
    requirements: v.string(), // markdown bullet list
    // Optional salary display range in IDR
    salaryMin: v.optional(v.number()),
    salaryMax: v.optional(v.number()),
    // ISO date YYYY-MM-DD
    openingDate: v.string(),
    closingDate: v.optional(v.string()),
    // "draft" | "open" | "on_hold" | "closed"
    status: v.string(),
    // Target headcount to hire for this opening (default 1).
    headcount: v.number(),
    hiredCount: v.number(),
    // Hiring manager (user in the directory) who owns requisition
    hiringManagerId: v.optional(v.id("users")),
    // Recruiter (user) who drives the process
    recruiterId: v.optional(v.id("users")),
    // Optional markdown notes for the recruitment team
    internalNote: v.optional(v.string()),
    // Denormalized counts for list screens
    candidateCount: v.number(),
    postedById: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_status", ["status"])
    .index("by_department", ["department"])
    .index("by_recruiter", ["recruiterId"])
    .index("by_organization", ["organizationId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["status", "department"],
    }),

  // External candidate. One row per person, reusable across multiple jobs.
  candidates: defineTable({
    firstName: v.string(),
    lastName: v.optional(v.string()),
    email: v.string(), // unique-ish (soft enforced)
    phone: v.optional(v.string()),
    location: v.optional(v.string()),
    // Current job title & company (for screening)
    currentTitle: v.optional(v.string()),
    currentCompany: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    portfolioUrl: v.optional(v.string()),
    // Years of relevant experience
    yearsExperience: v.optional(v.number()),
    // Expected salary in IDR
    expectedSalary: v.optional(v.number()),
    // Notice period in days
    noticeDays: v.optional(v.number()),
    // "referral" | "linkedin" | "jobsite" | "event" | "agency" | "website" | "other"
    source: v.string(),
    // Extra context for the source, e.g. referrer name or job board name.
    sourceDetail: v.optional(v.string()),
    // Overall tags applied by the recruiter
    tags: v.array(v.string()),
    // Resume file attached in Convex File Storage
    resumeStorageId: v.optional(v.id("_storage")),
    resumeFileName: v.optional(v.string()),
    // Markdown profile summary
    summary: v.optional(v.string()),
    // Skills list (reused in skill matching)
    skills: v.array(v.string()),
    // Optional recruiter owner; admin can hand off candidates
    ownerId: v.optional(v.id("users")),
    // "active" | "hired" | "archived" | "blacklisted"
    status: v.string(),
    // Denormalized count of applications
    applicationCount: v.number(),
    createdById: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_owner", ["ownerId"])
    .index("by_organization", ["organizationId"])
    .searchIndex("search_name", {
      searchField: "firstName",
      filterFields: ["status"],
    }),

  // Candidate applied to a specific job. Also represents the pipeline card
  // that moves through recruitment stages.
  candidateApplications: defineTable({
    candidateId: v.id("candidates"),
    jobId: v.id("recruitmentJobs"),
    // "sourced" | "applied" | "screening" | "interview" | "offer" | "hired" | "rejected" | "withdrawn"
    stage: v.string(),
    // 1..5 fit rating averaged from evaluations (optional)
    rating: v.optional(v.number()),
    appliedAt: v.string(), // ISO timestamp
    // Optional cover letter / intro supplied on application
    coverLetter: v.optional(v.string()),
    // Optional source override (if different from candidate default)
    source: v.optional(v.string()),
    // Reason the application was closed (only set when stage becomes
    // "rejected" | "withdrawn").
    closedReason: v.optional(v.string()),
    // Offered salary when moved to "offer"/"hired".
    offeredSalary: v.optional(v.number()),
    offerSentAt: v.optional(v.string()),
    hiredAt: v.optional(v.string()),
    rejectedAt: v.optional(v.string()),
    withdrawnAt: v.optional(v.string()),
    // Last action timestamp, used for ordering in pipeline columns
    lastActivityAt: v.string(), // ISO timestamp
    addedById: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_job", ["jobId"])
    .index("by_candidate", ["candidateId"])
    .index("by_job_and_stage", ["jobId", "stage"])
    .index("by_candidate_and_job", ["candidateId", "jobId"])
    .index("by_stage", ["stage"])
    .index("by_organization", ["organizationId"]),

  // Free-form notes / feedback / evaluation attached to an application. Used
  // by interviewers to leave their impressions.
  recruitmentNotes: defineTable({
    applicationId: v.id("candidateApplications"),
    candidateId: v.id("candidates"),
    authorId: v.id("users"),
    // "note" | "feedback" | "screening" | "reference"
    kind: v.string(),
    content: v.string(),
    // Optional 1..5 overall rating left by interviewer
    rating: v.optional(v.number()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_application", ["applicationId"])
    .index("by_candidate", ["candidateId"])
    .index("by_organization", ["organizationId"]),

  // Scheduled interview event tied to an application.
  recruitmentInterviews: defineTable({
    applicationId: v.id("candidateApplications"),
    candidateId: v.id("candidates"),
    jobId: v.id("recruitmentJobs"),
    title: v.string(),
    // "screening" | "technical" | "behavioral" | "culture_fit" | "final" | "other"
    interviewType: v.string(),
    // "online" | "onsite" | "phone"
    format: v.string(),
    scheduledAt: v.string(), // ISO timestamp
    durationMinutes: v.number(),
    // Optional link or address
    meetingUrl: v.optional(v.string()),
    location: v.optional(v.string()),
    // Assigned interviewers (users)
    interviewerIds: v.array(v.id("users")),
    // "scheduled" | "completed" | "cancelled" | "no_show"
    status: v.string(),
    // Post-interview notes
    outcomeNote: v.optional(v.string()),
    // 1..5 overall score recorded at completion
    overallScore: v.optional(v.number()),
    // "advance" | "hold" | "reject" | "hire" (recommendation)
    recommendation: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    createdById: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_application", ["applicationId"])
    .index("by_job", ["jobId"])
    .index("by_scheduled", ["scheduledAt"])
    .index("by_status", ["status"])
    .index("by_organization", ["organizationId"]),

  // ---- OKR & Goals Tracking -------------------------------------------

  // Objective: a qualitative aspirational goal scoped to company, department,
  // team, or an individual employee. One objective has many key results.
  objectives: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    // Period key that sorts lexically: "2026", "2026-Q2", "2026-H1".
    period: v.string(),
    periodLabel: v.string(), // human readable "Q2 2026"
    // "company" | "department" | "team" | "individual"
    scope: v.string(),
    // Owner user (always set; the person accountable for updates).
    ownerId: v.id("users"),
    // When scope = "department"
    department: v.optional(v.string()),
    // When scope = "team"
    teamId: v.optional(v.id("teams")),
    // Parent objective for cascading / alignment (optional)
    parentObjectiveId: v.optional(v.id("objectives")),
    // "draft" | "active" | "completed" | "archived"
    status: v.string(),
    // Derived weighted progress 0..100 (average from key results)
    progress: v.number(),
    // "on_track" | "at_risk" | "off_track" | "achieved"
    health: v.string(),
    // Optional color token for visual marker
    color: v.string(),
    icon: v.optional(v.string()),
    // "strategic" | "growth" | "product" | "customer" | "people" | "ops" | "finance" | "other"
    category: v.string(),
    // Timestamps
    startDate: v.optional(v.string()), // YYYY-MM-DD
    endDate: v.optional(v.string()), // YYYY-MM-DD
    completedAt: v.optional(v.string()),
    archivedAt: v.optional(v.string()),
    keyResultCount: v.number(),
    authorId: v.id("users"),
    lastUpdatedAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_period", ["period"])
    .index("by_owner", ["ownerId"])
    .index("by_scope", ["scope"])
    .index("by_scope_and_period", ["scope", "period"])
    .index("by_owner_and_period", ["ownerId", "period"])
    .index("by_department_and_period", ["department", "period"])
    .index("by_team_and_period", ["teamId", "period"])
    .index("by_status", ["status"])
    .index("by_parent", ["parentObjectiveId"])
    .index("by_organization", ["organizationId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["period", "scope", "status"],
    }),

  // Key result: measurable outcome that indicates progress on an objective.
  keyResults: defineTable({
    objectiveId: v.id("objectives"),
    title: v.string(),
    description: v.optional(v.string()),
    // "number" | "percent" | "currency" | "boolean" | "milestone"
    metricType: v.string(),
    // Starting value (baseline)
    startValue: v.number(),
    // Target to achieve (for boolean: 1 means "done")
    targetValue: v.number(),
    // Current value (updated through check-ins)
    currentValue: v.number(),
    // "higher_is_better" | "lower_is_better"
    direction: v.string(),
    // Free-form unit label e.g. "customers", "IDR", "%"
    unit: v.optional(v.string()),
    // Weight for weighted-average progress (default 1.0)
    weight: v.number(),
    // Optional owner (defaults to objective owner)
    ownerId: v.id("users"),
    dueDate: v.optional(v.string()), // YYYY-MM-DD
    // "on_track" | "at_risk" | "off_track" | "achieved"
    status: v.string(),
    // Confidence 0..100 set by owner
    confidence: v.number(),
    // Derived percentage 0..100 based on current/target/start
    progress: v.number(),
    order: v.number(),
    lastUpdatedAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_objective", ["objectiveId"])
    .index("by_owner", ["ownerId"])
    .index("by_status", ["status"])
    .index("by_organization", ["organizationId"]),

  // Check-in: progress update for a key result with the new value & note.
  okrCheckins: defineTable({
    keyResultId: v.id("keyResults"),
    objectiveId: v.id("objectives"),
    userId: v.id("users"),
    previousValue: v.number(),
    newValue: v.number(),
    note: v.optional(v.string()),
    // Status after check-in
    status: v.string(),
    confidence: v.number(),
    // ISO timestamp
    checkedInAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_key_result", ["keyResultId"])
    .index("by_objective", ["objectiveId"])
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"]),

  // ---- Engagement & Wellness Survey -----------------------------------
  // Anonymous or named surveys to measure employee engagement, mood, and
  // wellness. Admins create surveys with a set of structured questions;
  // employees respond; admins see aggregated results.
  engagementSurveys: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    // "engagement" | "wellness" | "pulse" | "onboarding" | "exit" | "custom"
    kind: v.string(),
    // "draft" | "active" | "closed"
    status: v.string(),
    // When true, respondents are not linked to responses (no userId stored).
    isAnonymous: v.boolean(),
    // ISO dates YYYY-MM-DD controlling visibility window
    startDate: v.string(),
    endDate: v.optional(v.string()),
    // Ordered list of questions
    questions: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        // "rating" (1..5 Likert) | "mood" (1..5 emojis) | "nps" (0..10)
        // | "single_choice" | "multi_choice" | "text"
        type: v.string(),
        options: v.optional(v.array(v.string())), // for choice-type
        required: v.boolean(),
        // For rating/mood/nps: optional labels for min & max
        minLabel: v.optional(v.string()),
        maxLabel: v.optional(v.string()),
        // Optional short category for grouping in results
        category: v.optional(v.string()),
      }),
    ),
    // Optional target filter: limit to specific department or "all"
    targetDepartment: v.optional(v.string()),
    color: v.string(),
    icon: v.optional(v.string()),
    coverColor: v.optional(v.string()),
    // Denormalized counters
    responseCount: v.number(),
    // Average sentiment score 0..100 (computed when responses come in)
    averageScore: v.optional(v.number()),
    authorId: v.id("users"),
    publishedAt: v.optional(v.string()),
    closedAt: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_status", ["status"])
    .index("by_kind", ["kind"])
    .index("by_author", ["authorId"])
    .index("by_organization", ["organizationId"]),

  // An individual respondent's submission for a survey.
  engagementResponses: defineTable({
    surveyId: v.id("engagementSurveys"),
    // userId is stored even for anonymous surveys but NOT returned to admins
    // when survey.isAnonymous = true. Used only to prevent double-submission.
    userId: v.id("users"),
    // Snapshot so non-anonymous surveys survive user deletion
    userName: v.optional(v.string()),
    userDepartment: v.optional(v.string()),
    // Overall mood/engagement (1..5) summary computed from rating/mood/nps.
    overallScore: v.optional(v.number()),
    answers: v.array(
      v.object({
        questionId: v.string(),
        // For rating/mood/nps: numeric as string. For choices: selected option ids/values.
        value: v.string(),
        // For multi_choice: additional chosen values
        values: v.optional(v.array(v.string())),
      }),
    ),
    comment: v.optional(v.string()), // optional free-form comment at the end
    submittedAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_survey", ["surveyId"])
    .index("by_survey_and_user", ["surveyId", "userId"])
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"]),

  // Private 1:1 wellness check-in between an employee and themselves. These
  // are always private to the employee (manager/HR can't read), used as a
  // personal mood journal.
  wellnessCheckins: defineTable({
    userId: v.id("users"),
    // Mood score 1..5
    moodScore: v.number(),
    // Energy 1..5, Stress 1..5, Workload 1..5 (higher = more)
    energyScore: v.optional(v.number()),
    stressScore: v.optional(v.number()),
    workloadScore: v.optional(v.number()),
    // Free-form note (private)
    note: v.optional(v.string()),
    // Optional tags describing current feelings
    tags: v.array(v.string()),
    // Date (YYYY-MM-DD) for daily grouping
    date: v.string(),
    checkedInAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "date"])
    .index("by_organization", ["organizationId"]),

  // ---- AI Chatbot -----------------------------------------------------
  // Conversational AI assistant. Each user has many chat sessions (like a
  // chat history sidebar). Each session contains ordered messages.
  aiChatSessions: defineTable({
    userId: v.id("users"),
    title: v.string(),
    // Denormalized preview of the last message for the session list
    lastMessagePreview: v.optional(v.string()),
    lastMessageAt: v.string(), // ISO timestamp
    messageCount: v.number(),
    // Whether the user pinned this session
    isPinned: v.optional(v.boolean()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_last", ["userId", "lastMessageAt"])
    .index("by_organization", ["organizationId"]),

  aiChatMessages: defineTable({
    sessionId: v.id("aiChatSessions"),
    userId: v.id("users"),
    // "user" | "assistant" | "system"
    role: v.string(),
    content: v.string(),
    // "ok" | "pending" | "error"
    status: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    // Optional suggested follow-up actions as JSON
    suggestions: v.optional(v.array(v.string())),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"]),

  // ---- Feedback 360° --------------------------------------------------
  // Multi-rater performance feedback cycle. A cycle defines the period,
  // questions, and deadline. Admins select reviewees (employees being
  // assessed) and invite reviewers (self, manager, peers, direct reports).
  feedback360Cycles: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    // Opaque period key that sorts lexically: "2026", "2026-Q2", "2026-H1"
    period: v.string(),
    periodLabel: v.string(),
    // "draft" | "active" | "closed"
    status: v.string(),
    // ISO date YYYY-MM-DD when cycle becomes fillable
    startDate: v.string(),
    // ISO date YYYY-MM-DD deadline for reviewers to submit
    endDate: v.string(),
    // Ordered list of questions filled by all reviewers
    questions: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        // "rating" (1..5) | "text"
        type: v.string(),
        required: v.boolean(),
        // Optional short category for grouping results (e.g. "Kepemimpinan")
        category: v.optional(v.string()),
      }),
    ),
    color: v.string(),
    icon: v.optional(v.string()),
    // Denormalized counters
    reviewCount: v.number(), // number of reviewees in this cycle
    completedReviewerCount: v.number(), // total reviewer submissions
    totalReviewerCount: v.number(), // total reviewer invites
    authorId: v.id("users"),
    publishedAt: v.optional(v.string()),
    closedAt: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_status", ["status"])
    .index("by_period", ["period"])
    .index("by_author", ["authorId"])
    .index("by_organization", ["organizationId"]),

  // One row per employee being assessed in a cycle. Aggregates responses
  // from their reviewers. The report is only visible to the reviewee after
  // an admin "shares" it (status becomes "shared").
  feedback360Reviews: defineTable({
    cycleId: v.id("feedback360Cycles"),
    revieweeId: v.id("users"),
    // "pending" | "in_progress" | "completed" | "shared"
    status: v.string(),
    // Denormalized aggregate scores (0..100 scale from rating avg)
    overallScore: v.optional(v.number()),
    selfScore: v.optional(v.number()),
    managerScore: v.optional(v.number()),
    peerScore: v.optional(v.number()),
    reportScore: v.optional(v.number()),
    // Counts for quick progress display
    totalReviewers: v.number(),
    completedReviewers: v.number(),
    sharedAt: v.optional(v.string()),
    sharedNote: v.optional(v.string()),
    // Snapshot of reviewee info in case profile changes
    revieweeName: v.string(),
    revieweeDepartment: v.optional(v.string()),
    revieweeJobTitle: v.optional(v.string()),
    createdById: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_cycle", ["cycleId"])
    .index("by_reviewee", ["revieweeId"])
    .index("by_cycle_and_reviewee", ["cycleId", "revieweeId"])
    .index("by_status", ["status"])
    .index("by_organization", ["organizationId"]),

  // A reviewer's invitation + response for a specific review. Answers are
  // stored inline when submitted. Peer/report identities are hidden from the
  // reviewee; only aggregate counts & comments are shown.
  feedback360Reviewers: defineTable({
    reviewId: v.id("feedback360Reviews"),
    cycleId: v.id("feedback360Cycles"),
    revieweeId: v.id("users"),
    reviewerId: v.id("users"),
    // "self" | "manager" | "peer" | "report"
    relationship: v.string(),
    // "pending" | "submitted" | "declined"
    status: v.string(),
    // Numeric average of rating answers (0..100)
    overallScore: v.optional(v.number()),
    answers: v.optional(
      v.array(
        v.object({
          questionId: v.string(),
          // number-as-string for ratings, raw text otherwise
          value: v.string(),
        }),
      ),
    ),
    strengths: v.optional(v.string()),
    improvements: v.optional(v.string()),
    declineReason: v.optional(v.string()),
    invitedAt: v.string(),
    submittedAt: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_review", ["reviewId"])
    .index("by_reviewer", ["reviewerId"])
    .index("by_reviewer_and_status", ["reviewerId", "status"])
    .index("by_review_and_reviewer", ["reviewId", "reviewerId"])
    .index("by_cycle", ["cycleId"])
    .index("by_organization", ["organizationId"]),

  // ---- Travel (Perjalanan Dinas) --------------------------------------
  // Business trip requests with itinerary, approval flow, and post-trip report.
  travelRequests: defineTable({
    userId: v.id("users"),
    title: v.string(),
    destination: v.string(),
    purpose: v.string(),
    // ISO dates YYYY-MM-DD
    startDate: v.string(),
    endDate: v.string(),
    dayCount: v.number(),
    // "flight" | "train" | "bus" | "car" | "ship" | "other"
    transportMode: v.string(),
    // Optional accommodation description (hotel, home, etc.)
    accommodation: v.optional(v.string()),
    estimatedCost: v.number(),
    currency: v.optional(v.string()),
    // "draft" | "pending" | "approved" | "rejected" | "in_progress" | "completed" | "cancelled"
    status: v.string(),
    // Snapshot of user's department at submission for reporting.
    userDepartment: v.optional(v.string()),
    userJobTitle: v.optional(v.string()),
    approverId: v.optional(v.id("users")),
    approvedAt: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    approvalNote: v.optional(v.string()),
    // Optional link to expense report after trip.
    actualCost: v.optional(v.number()),
    reportSummary: v.optional(v.string()),
    reportSubmittedAt: v.optional(v.string()),
    submittedAt: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    cancelledAt: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_status", ["status"])
    .index("by_approver", ["approverId"])
    .index("by_start_date", ["startDate"])
    .index("by_organization", ["organizationId"]),

  // Ordered itinerary items for each travel request.
  travelItineraryItems: defineTable({
    travelRequestId: v.id("travelRequests"),
    userId: v.id("users"),
    // ISO date YYYY-MM-DD (must fall within the request's date range)
    date: v.string(),
    // Optional times HH:MM (24h)
    timeStart: v.optional(v.string()),
    timeEnd: v.optional(v.string()),
    location: v.string(),
    activity: v.string(),
    notes: v.optional(v.string()),
    // Manual ordering within a day
    order: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_request", ["travelRequestId"])
    .index("by_request_and_date", ["travelRequestId", "date"])
    .index("by_organization", ["organizationId"]),

  // ---- WTW Global Grading System (GGS) -------------------------------
  // Company size bucket per business unit / department. WTW GGS uses the
  // organization's "career map size band" as a multiplier to the weighted
  // factor score. Admin sets one default + optional per-department overrides.
  ggsCompanySizes: defineTable({
    // "" = company-wide default. Otherwise: department name.
    scope: v.string(),
    // A = Small (<$200M revenue), B = Medium, C = Large, D = Very Large,
    // E = Global Enterprise. Stored as single letter.
    sizeBand: v.string(), // "A" | "B" | "C" | "D" | "E"
    // Free-text note (headcount/revenue/complexity description)
    note: v.optional(v.string()),
    updatedBy: v.id("users"),
    updatedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_scope", ["scope"])
    .index("by_organization", ["organizationId"]),

  // A jabatan (job/position) that will be evaluated with GGS. Separate from
  // `jobRoles` which is a richer role definition. A position belongs to a
  // department and has an optional job description (JD) attached.
  ggsPositions: defineTable({
    title: v.string(),
    department: v.string(),
    // Family / job family ("Engineering", "Finance", "Sales", etc.)
    jobFamily: v.optional(v.string()),
    // Short summary (1-2 lines)
    summary: v.string(),
    // Full job description in markdown
    jobDescription: v.string(),
    // Optional attached JD file
    jdStorageId: v.optional(v.id("_storage")),
    jdFileName: v.optional(v.string()),
    // Current approved evaluation (null until first approval)
    currentEvaluationId: v.optional(v.id("ggsEvaluations")),
    // Derived from current evaluation: global grade (1-25) and salary band id
    currentGrade: v.optional(v.number()),
    currentSalaryBandId: v.optional(v.id("ggsSalaryBands")),
    // "active" | "archived"
    status: v.string(),
    authorId: v.id("users"),
    lastEditorId: v.optional(v.id("users")),
    lastEditedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_department", ["department"])
    .index("by_status", ["status"])
    .index("by_title", ["title"])
    .index("by_organization", ["organizationId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["department", "status"],
    }),

  // One job evaluation for a position. Each factor gets a level (1..7) scored
  // by multiple evaluators in a committee. When status = "approved" the
  // position's currentGrade is set from finalGrade.
  ggsEvaluations: defineTable({
    positionId: v.id("ggsPositions"),
    // Period / context label, e.g. "2026 Review"
    periodLabel: v.string(),
    // "draft" | "in_review" | "approved" | "rejected" | "archived"
    status: v.string(),
    // Reason for re-grading / justification (shown in history panel)
    reason: v.optional(v.string()),
    // Final averaged factor levels (average across evaluators). 1..7 decimals OK.
    finalFunctionalKnowledge: v.optional(v.number()),
    finalBusinessExpertise: v.optional(v.number()),
    finalLeadership: v.optional(v.number()),
    finalProblemSolving: v.optional(v.number()),
    finalNatureOfImpact: v.optional(v.number()),
    finalAreaOfImpact: v.optional(v.number()),
    finalInterpersonalSkills: v.optional(v.number()),
    // Weighted total score (0..100). Mapped to a global grade 1..25.
    finalScore: v.optional(v.number()),
    // Global Grade 1..25 (after applying company size band adjustment)
    finalGrade: v.optional(v.number()),
    // Human-readable career band label, e.g. "Professional", "Manager"
    finalBandLabel: v.optional(v.string()),
    // Size band snapshot at time of evaluation (A..E)
    sizeBandUsed: v.optional(v.string()),
    // Approver info
    approvedById: v.optional(v.id("users")),
    approvedAt: v.optional(v.string()),
    rejectedReason: v.optional(v.string()),
    // Snapshot: previous grade before this evaluation (for history diff)
    previousGrade: v.optional(v.number()),
    createdById: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_position", ["positionId"])
    .index("by_position_and_status", ["positionId", "status"])
    .index("by_status", ["status"])
    .index("by_organization", ["organizationId"]),

  // Individual score from one committee member for one factor.
  // Each row: (evaluation, evaluator, factor) -> level + justification.
  ggsFactorScores: defineTable({
    evaluationId: v.id("ggsEvaluations"),
    evaluatorId: v.id("users"),
    // "functional_knowledge" | "business_expertise" | "leadership"
    // | "problem_solving" | "nature_of_impact" | "area_of_impact"
    // | "interpersonal_skills"
    factor: v.string(),
    level: v.number(), // 1..7
    justification: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_evaluation", ["evaluationId"])
    .index("by_evaluation_and_evaluator", ["evaluationId", "evaluatorId"])
    .index("by_evaluation_and_factor", ["evaluationId", "factor"])
    .index("by_organization", ["organizationId"]),

  // Committee member assigned to an evaluation. Tracks submission state.
  ggsEvaluators: defineTable({
    evaluationId: v.id("ggsEvaluations"),
    userId: v.id("users"),
    // "pending" | "submitted"
    status: v.string(),
    submittedAt: v.optional(v.string()),
    overallNote: v.optional(v.string()),
    invitedById: v.id("users"),
    invitedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_evaluation", ["evaluationId"])
    .index("by_user", ["userId"])
    .index("by_evaluation_and_user", ["evaluationId", "userId"])
    .index("by_organization", ["organizationId"]),

  // Salary band table. Admin defines one row per global grade (or ranges).
  // When a position's grade changes, its salary band is looked up from here.
  ggsSalaryBands: defineTable({
    // Global grade this band covers, 1..25
    grade: v.number(),
    // Career band label (e.g., "Support", "Professional", "Manager", "Director")
    bandLabel: v.string(),
    // IDR salary range for this grade
    minSalary: v.number(),
    midSalary: v.number(),
    maxSalary: v.number(),
    // Currency code, default "IDR"
    currency: v.string(),
    // Optional allowance or description
    note: v.optional(v.string()),
    isActive: v.boolean(),
    updatedBy: v.id("users"),
    updatedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_grade", ["grade"])
    .index("by_active", ["isActive"])
    .index("by_organization", ["organizationId"]),

  // Employee <-> Position mapping. One row per active assignment. When the
  // position's grade changes, all mapped employees are automatically re-graded.
  ggsEmployeeAssignments: defineTable({
    userId: v.id("users"),
    positionId: v.id("ggsPositions"),
    // Current monthly salary (IDR) used for compa-ratio calculation
    currentSalary: v.optional(v.number()),
    // "active" | "archived"
    status: v.string(),
    assignedAt: v.string(),
    assignedById: v.id("users"),
    note: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_position", ["positionId"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_position_and_status", ["positionId", "status"])
    .index("by_organization", ["organizationId"]),

  // History log of grade changes on a position (re-grading trail).
  ggsGradeHistory: defineTable({
    positionId: v.id("ggsPositions"),
    evaluationId: v.optional(v.id("ggsEvaluations")),
    previousGrade: v.optional(v.number()),
    newGrade: v.number(),
    previousScore: v.optional(v.number()),
    newScore: v.number(),
    reason: v.optional(v.string()),
    changedById: v.id("users"),
    changedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_position", ["positionId"])
    .index("by_changed_at", ["changedAt"])
    .index("by_organization", ["organizationId"]),

  // ---- Pulse Survey & Employee Sentiment -----------------------------
  // Short recurring surveys (usually 1-3 questions) designed to quickly
  // measure the pulse of the organization. Unlike full engagement surveys
  // these are small, cadenced, and focus on sentiment tracking over time.
  pulseSurveys: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    // Single primary question text displayed on the pulse card.
    question: v.string(),
    // "mood" (1-5 emoji) | "rating" (1-5 stars) | "nps" (0-10) | "yes_no"
    questionType: v.string(),
    // Optional follow up open text prompt
    commentPrompt: v.optional(v.string()),
    // Dimension tag for grouping: "workload" | "leadership" | "culture"
    //  | "wellbeing" | "growth" | "recognition" | "communication" | "custom"
    category: v.string(),
    // Cadence for reporting (descriptive only; recurrence handled manually)
    // "one_off" | "weekly" | "biweekly" | "monthly" | "quarterly"
    frequency: v.string(),
    // "draft" | "active" | "closed"
    status: v.string(),
    // When true responses are not linked to user ids.
    isAnonymous: v.boolean(),
    // Scope: empty or "all" = everyone; otherwise a specific department name.
    targetDepartment: v.optional(v.string()),
    // Visibility window. startDate is required for published pulses.
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.optional(v.string()),
    // Series key used to link recurring pulses together for trend charts.
    // Auto-generated when a pulse is duplicated; stable for the whole series.
    seriesKey: v.optional(v.string()),
    color: v.string(),
    icon: v.optional(v.string()),
    // Denormalized metrics for fast list rendering.
    responseCount: v.number(),
    // Normalized sentiment score 0..100; undefined until 1+ response collected.
    averageSentiment: v.optional(v.number()),
    // Numeric distribution of primary question answers for quick display
    distribution: v.optional(v.record(v.string(), v.number())),
    publishedAt: v.optional(v.string()),
    closedAt: v.optional(v.string()),
    authorId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_status", ["status"])
    .index("by_series", ["seriesKey"])
    .index("by_status_and_start", ["status", "startDate"])
    .index("by_organization", ["organizationId"]),

  pulseResponses: defineTable({
    pulseId: v.id("pulseSurveys"),
    // When the pulse is anonymous we still record department & role snapshot
    // for aggregation, but omit userId.
    userId: v.optional(v.id("users")),
    userDepartment: v.optional(v.string()),
    // Raw primary answer (stored as string for flexibility)
    answer: v.string(),
    // Normalized sentiment contribution 0..100 derived from the answer.
    sentimentScore: v.number(),
    // Optional free-form comment
    comment: v.optional(v.string()),
    submittedAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_pulse", ["pulseId"])
    .index("by_pulse_and_user", ["pulseId", "userId"])
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"]),

  // ---- Offboarding & Exit Management ---------------------------------
  // Resignation / termination request submitted by employees or HR.
  resignationRequests: defineTable({
    userId: v.id("users"),
    // "resignation" | "termination" | "retirement" | "contract_end" | "mutual"
    exitType: v.string(),
    // ISO date YYYY-MM-DD of the employee's last working day.
    lastWorkingDay: v.string(),
    // ISO date (YYYY-MM-DD) when the notice is effective / submitted.
    noticeDate: v.string(),
    // "voluntary" | "involuntary" | "retirement" | "contract_end" | "other"
    reasonCategory: v.string(),
    reason: v.string(),
    // Optional additional context / plans
    futureEmployer: v.optional(v.string()),
    // "pending" | "approved" | "rejected" | "withdrawn" | "completed"
    status: v.string(),
    reviewerId: v.optional(v.id("users")),
    reviewedAt: v.optional(v.string()),
    reviewNote: v.optional(v.string()),
    // Once approved, link to the offboarding case created.
    caseId: v.optional(v.id("offboardingCases")),
    // Snapshot for reporting
    userName: v.string(),
    userDepartment: v.optional(v.string()),
    userJobTitle: v.optional(v.string()),
    // Years of service at time of resignation (rounded 1 decimal)
    tenureYears: v.optional(v.number()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_last_working_day", ["lastWorkingDay"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_organization", ["organizationId"]),

  // Master checklist template used to generate tasks for each offboarding case.
  offboardingChecklistTemplates: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    // "asset_return" | "access_revoke" | "handover" | "payroll" | "exit_interview"
    // | "it" | "hr" | "finance" | "legal" | "other"
    category: v.string(),
    // "hr" | "it" | "manager" | "employee" | "finance" | "legal" | "other"
    ownerRole: v.string(),
    // Days relative to last working day. Negative = before last day,
    // 0 = on last day, positive = after last day.
    dueOffsetDays: v.number(),
    order: v.number(),
    isActive: v.boolean(),
    authorId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_order", ["order"])
    .index("by_organization", ["organizationId"]),

  // One offboarding journey for a departing employee.
  offboardingCases: defineTable({
    userId: v.id("users"),
    resignationRequestId: v.optional(v.id("resignationRequests")),
    exitType: v.string(),
    lastWorkingDay: v.string(),
    startDate: v.string(), // YYYY-MM-DD when case was opened
    managerId: v.optional(v.id("users")),
    // "in_progress" | "completed" | "cancelled"
    status: v.string(),
    // Denormalized task counts
    totalTasks: v.number(),
    completedTasks: v.number(),
    completedAt: v.optional(v.string()),
    closeNote: v.optional(v.string()),
    // Snapshots for reporting after user deletion
    userName: v.string(),
    userDepartment: v.optional(v.string()),
    userJobTitle: v.optional(v.string()),
    tenureYears: v.optional(v.number()),
    // Whether the exit interview has been submitted & reviewed
    exitInterviewStatus: v.optional(v.string()), // "pending" | "submitted" | "reviewed"
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_manager", ["managerId"])
    .index("by_last_working_day", ["lastWorkingDay"])
    .index("by_organization", ["organizationId"]),

  offboardingTasks: defineTable({
    caseId: v.id("offboardingCases"),
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    ownerRole: v.string(),
    dueDate: v.optional(v.string()), // YYYY-MM-DD
    // "todo" | "in_progress" | "done" | "skipped"
    status: v.string(),
    completedAt: v.optional(v.string()),
    completedBy: v.optional(v.id("users")),
    note: v.optional(v.string()),
    order: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_case", ["caseId"])
    .index("by_case_and_status", ["caseId", "status"])
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"]),

  // Knowledge / project handover items the departing employee owns.
  offboardingHandovers: defineTable({
    caseId: v.id("offboardingCases"),
    userId: v.id("users"),
    topic: v.string(),
    description: v.optional(v.string()),
    successorId: v.optional(v.id("users")),
    // "pending" | "in_progress" | "completed"
    status: v.string(),
    dueDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    order: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_case", ["caseId"])
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"]),

  // Structured exit interview (one per case).
  exitInterviews: defineTable({
    caseId: v.id("offboardingCases"),
    userId: v.id("users"),
    // "pending" | "submitted" | "reviewed"
    status: v.string(),
    // Whether employee opted for anonymous submission (manager sees aggregated)
    isAnonymous: v.boolean(),
    // Overall satisfaction 1..5
    overallSatisfaction: v.optional(v.number()),
    // Likelihood to recommend as employer 0..10 (eNPS-style)
    recommendScore: v.optional(v.number()),
    // Likelihood to return in future 1..5
    wouldReturnScore: v.optional(v.number()),
    // Dimension ratings 1..5 (null = not answered)
    compensationRating: v.optional(v.number()),
    managementRating: v.optional(v.number()),
    workLifeBalanceRating: v.optional(v.number()),
    growthRating: v.optional(v.number()),
    cultureRating: v.optional(v.number()),
    // Primary reason for leaving (category key)
    primaryReason: v.optional(v.string()),
    // Free-form responses
    likedMost: v.optional(v.string()),
    areasForImprovement: v.optional(v.string()),
    whyLeaving: v.optional(v.string()),
    suggestions: v.optional(v.string()),
    submittedAt: v.optional(v.string()),
    reviewerId: v.optional(v.id("users")),
    reviewedAt: v.optional(v.string()),
    reviewNote: v.optional(v.string()),
    // Snapshots for reporting
    userDepartment: v.optional(v.string()),
    tenureYears: v.optional(v.number()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_case", ["caseId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_organization", ["organizationId"]),

  // Riwayat pendidikan formal karyawan (SMA, D3, S1, S2, S3, dll.)
  employeeEducation: defineTable({
    userId: v.id("users"),
    // "sma" | "smk" | "d1" | "d2" | "d3" | "d4" | "s1" | "s2" | "s3" | "other"
    level: v.string(),
    institution: v.string(), // Nama sekolah / kampus
    fieldOfStudy: v.optional(v.string()), // Jurusan / program studi
    startYear: v.optional(v.number()),
    endYear: v.optional(v.number()), // kosong jika masih berjalan
    gpa: v.optional(v.number()), // IPK (0..4) atau nilai akhir
    description: v.optional(v.string()),
    isCurrent: v.optional(v.boolean()),
    // Optional single supporting document (ijazah/transkrip) stored in Convex.
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentName: v.optional(v.string()),
    attachmentSize: v.optional(v.number()),
    attachmentType: v.optional(v.string()),
    createdBy: v.id("users"),
    updatedAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_endYear", ["userId", "endYear"])
    .index("by_organization", ["organizationId"]),

  // Riwayat training / pelatihan yang pernah diikuti karyawan.
  employeeTrainingHistory: defineTable({
    userId: v.id("users"),
    title: v.string(), // Nama pelatihan / workshop / seminar
    provider: v.optional(v.string()), // Lembaga / penyelenggara
    // "internal" | "external" | "certification" | "workshop" | "seminar" | "online" | "other"
    category: v.string(),
    location: v.optional(v.string()),
    startDate: v.optional(v.string()), // YYYY-MM-DD
    endDate: v.optional(v.string()), // YYYY-MM-DD
    durationHours: v.optional(v.number()),
    // Nilai akhir atau skor (bebas), misal "A", "85", "Lulus"
    result: v.optional(v.string()),
    hasCertificate: v.optional(v.boolean()),
    certificateNumber: v.optional(v.string()),
    description: v.optional(v.string()),
    // Optional single supporting document (sertifikat) stored in Convex.
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentName: v.optional(v.string()),
    attachmentSize: v.optional(v.number()),
    attachmentType: v.optional(v.string()),
    createdBy: v.id("users"),
    updatedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_startDate", ["userId", "startDate"])
    .index("by_organization", ["organizationId"]),

  // Riwayat keikutsertaan karyawan di organisasi/komunitas (internal maupun
  // eksternal), misal OSIS, BEM, himpunan profesi, organisasi masyarakat, dsb.
  employeeOrganizationHistory: defineTable({
    userId: v.id("users"),
    organizationName: v.string(),
    // Jabatan / peran di organisasi tersebut
    role: v.string(),
    // "internal" | "external" | "community" | "professional" | "academic"
    // | "religious" | "social" | "political" | "other"
    category: v.optional(v.string()),
    location: v.optional(v.string()),
    startDate: v.optional(v.string()), // YYYY-MM-DD
    endDate: v.optional(v.string()),
    isCurrent: v.optional(v.boolean()),
    description: v.optional(v.string()),
    achievements: v.optional(v.string()),
    // Optional single supporting document (SK/sertifikat) stored in Convex.
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentName: v.optional(v.string()),
    attachmentSize: v.optional(v.number()),
    attachmentType: v.optional(v.string()),
    createdBy: v.id("users"),
    updatedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_startDate", ["userId", "startDate"])
    .index("by_organization", ["organizationId"]),

  // Riwayat jabatan / posisi karyawan (promosi, mutasi, rotasi, dll.)
  employeePositionHistory: defineTable({
    userId: v.id("users"),
    jobTitle: v.string(),
    department: v.optional(v.string()),
    location: v.optional(v.string()),
    // "promotion" | "lateral" | "demotion" | "initial" | "rotation" | "other"
    changeType: v.optional(v.string()),
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.optional(v.string()), // kosong jika jabatan saat ini
    isCurrent: v.optional(v.boolean()),
    // Nomor Surat Keputusan / referensi dokumen
    referenceNumber: v.optional(v.string()),
    description: v.optional(v.string()),
    managerName: v.optional(v.string()),
    createdBy: v.id("users"),
    updatedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_startDate", ["userId", "startDate"])
    .index("by_organization", ["organizationId"]),

  // Riwayat penghargaan yang pernah diterima karyawan (baik dari perusahaan
  // maupun pihak eksternal). Berbeda dengan tabel `awards` yang digunakan
  // untuk penghargaan formal perusahaan, tabel ini menyimpan riwayat lengkap
  // termasuk penghargaan dari luar perusahaan, kompetisi, atau pencapaian
  // pribadi karyawan.
  employeeAwardHistory: defineTable({
    userId: v.id("users"),
    title: v.string(), // Nama penghargaan
    issuer: v.string(), // Pemberi penghargaan (perusahaan, lembaga, komunitas, dsb.)
    // "company" | "external" | "government" | "community" | "academic"
    // | "professional" | "competition" | "recognition" | "other"
    category: v.optional(v.string()),
    // "international" | "national" | "regional" | "local" | "internal"
    level: v.optional(v.string()),
    awardDate: v.optional(v.string()), // YYYY-MM-DD
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    certificateNumber: v.optional(v.string()),
    hasCertificate: v.optional(v.boolean()),
    // Optional single supporting document (sertifikat/piagam) stored in Convex.
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentName: v.optional(v.string()),
    attachmentSize: v.optional(v.number()),
    attachmentType: v.optional(v.string()),
    createdBy: v.id("users"),
    updatedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_awardDate", ["userId", "awardDate"])
    .index("by_organization", ["organizationId"]),

  // ---- Career Path System ---------------------------------------------
  // A career path is a curated progression ladder that links training,
  // performance (KPI) expectations, and target job positions. Each path has
  // ordered levels; employees are assigned to a path and automatically see
  // requirements for the next level.
  careerPaths: defineTable({
    title: v.string(),
    description: v.string(),
    // "technical" | "management" | "specialist" | "functional"
    //  | "leadership" | "operations" | "support" | "other"
    track: v.string(),
    // Optional department scope ("" = company-wide)
    department: v.string(),
    // Visual marker
    coverColor: v.string(),
    icon: v.optional(v.string()),
    isPublished: v.boolean(),
    authorId: v.id("users"),
    // Denormalized counts
    levelCount: v.number(),
    assigneeCount: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_published", ["isPublished"])
    .index("by_track", ["track"])
    .index("by_department", ["department"])
    .index("by_organization", ["organizationId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["track", "isPublished"],
    }),

  // Ordered level within a career path (e.g. Junior -> Senior -> Lead).
  careerPathLevels: defineTable({
    pathId: v.id("careerPaths"),
    order: v.number(),
    title: v.string(),
    // Short summary of the level (what the employee is expected to do)
    summary: v.string(),
    // Markdown detail: responsibilities, competencies
    description: v.optional(v.string()),
    // Job title that matches this level (free text, e.g. "Software Engineer II")
    targetJobTitle: v.optional(v.string()),
    // Optional WTW grade band (e.g. "G10") or level code
    targetGrade: v.optional(v.string()),
    // Estimated time to achieve this level from the previous one (months)
    estimatedMonths: v.optional(v.number()),
    // Optional salary band (in IDR) for display
    salaryMin: v.optional(v.number()),
    salaryMax: v.optional(v.number()),
    // Required list of course ids the employee must complete
    requiredCourseIds: v.array(v.id("courses")),
    // Minimum average performance rating required (0..5). 0 = no requirement
    minPerformanceRating: v.optional(v.number()),
    // Minimum number of completed performance review periods with a rating
    // at or above `minPerformanceRating`.
    minReviewPeriods: v.optional(v.number()),
    // Optional list of skills with target level (1..5)
    requiredSkills: v.array(
      v.object({
        skill: v.string(),
        level: v.number(),
      }),
    ),
    // Free-form list of other requirements (experience, certifications)
    extraRequirements: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_path", ["pathId"])
    .index("by_path_and_order", ["pathId", "order"])
    .index("by_organization", ["organizationId"]),

  // Assignment of an employee to a career path. One row per (user, path) -
  // the employee can be on multiple paths simultaneously.
  careerPathAssignments: defineTable({
    pathId: v.id("careerPaths"),
    userId: v.id("users"),
    // Reference to the current level the employee is on
    currentLevelId: v.optional(v.id("careerPathLevels")),
    // Snapshot of the level order index (for sorting without joins)
    currentLevelOrder: v.optional(v.number()),
    // Target level the employee is working towards next
    targetLevelId: v.optional(v.id("careerPathLevels")),
    // "in_progress" | "achieved_target" | "paused" | "completed"
    status: v.string(),
    // Notes / goals captured during 1:1s
    mentorNote: v.optional(v.string()),
    mentorId: v.optional(v.id("users")),
    startedAt: v.string(), // ISO timestamp
    lastProgressAt: v.optional(v.string()),
    assignedById: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_path", ["pathId"])
    .index("by_path_and_user", ["pathId", "userId"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_organization", ["organizationId"]),

  // Menu access overrides per role. If no row exists for a role, the default
  // menu list (defined in code) is used. Super admin can customize these.
  rolePermissions: defineTable({
    // "super_admin"|"admin"|"it_support"|"hr_manager"|"hr_staff"|"ld_specialist"|
    // "payroll_officer"|"finance_manager"|"finance_staff"|"approver"|
    // "director"|"department_head"|"team_lead"|"employee"|"contractor"
    role: v.string(),
    // list of menu keys the role is allowed to see (see roles.ts MENU_KEYS)
    allowedMenus: v.array(v.string()),
    updatedBy: v.id("users"),
    updatedAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_role", ["role"])
    .index("by_organization", ["organizationId"]),

  // ── Pengajuan Dana (Fund Requests) ─────────────────────────────────────────
  // Multi-level approval: employee submits → each approver in the chain reviews
  // in sequence. Status advances only when the current-level approver acts.
  fundRequests: defineTable({
    // Submitter
    submitterId: v.id("users"),
    userDepartment: v.optional(v.string()),

    // Request details
    title: v.string(),
    purpose: v.string(), // description / justification
    // "operational" | "procurement" | "travel" | "training" | "event" | "other"
    category: v.string(),
    // Finance request type (maps to approval chains)
    // "operational" | "procurement" | "reimbursement" | "petty_cash" | "capital" | "travel" | "custom"
    requestType: v.optional(v.string()),
    amount: v.number(), // IDR integer
    neededBy: v.string(), // YYYY-MM-DD target disbursement date
    // Type-specific fields stored as JSON string
    typeSpecificData: v.optional(v.string()),

    // Optional supporting document stored in Convex File Storage
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentFileName: v.optional(v.string()),

    // Multiple supporting documents (RAB, kwitansi, struk, dll.)
    attachments: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          fileName: v.string(),
          label: v.optional(v.string()), // Mis. "RAB", "Kwitansi", "Struk"
          mimeType: v.optional(v.string()),
          size: v.optional(v.number()),
        }),
      ),
    ),

    // Status lifecycle:
    // "draft" → "pending" → "in_review" → "approved" → "rejected" | "cancelled" | "disbursed"
    status: v.string(),

    // Which approval level is currently pending (1-based index into approvals array)
    currentApprovalLevel: v.number(),

    // Total number of approval levels required (snapshot at submission)
    totalApprovalLevels: v.number(),

    // Finance disbursement
    disbursedAt: v.optional(v.string()),
    disbursedById: v.optional(v.id("users")),
    disbursementNote: v.optional(v.string()),
    paymentMethod: v.optional(v.string()), // "transfer" | "cash" | "check"
    paymentReference: v.optional(v.string()),

    // Rejection / cancellation
    rejectedAt: v.optional(v.string()),
    rejectedBy: v.optional(v.id("users")),
    rejectionReason: v.optional(v.string()),

    // Revision flow: approver requests changes, submitter edits and re-submits
    revisionNote: v.optional(v.string()),
    revisionRequestedBy: v.optional(v.id("users")),
    revisionRequestedAt: v.optional(v.string()),

    // Auto-routing: which approval chain was matched
    approvalChainId: v.optional(v.id("financeApprovalChains")),
    approvalChainName: v.optional(v.string()),

    submittedAt: v.optional(v.string()), // ISO timestamp when sent for approval
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_submitter", ["submitterId"])
    .index("by_status", ["status"])
    .index("by_submitter_and_status", ["submitterId", "status"])
    .index("by_needed_by", ["neededBy"])
    .index("by_organization", ["organizationId"]),

  // One row per approval level per request.
  // level=1 is the first approver (usually direct manager / supervisor),
  // level=2 is the next (head of department / treasurer), etc.
  fundRequestApprovals: defineTable({
    fundRequestId: v.id("fundRequests"),
    level: v.number(), // 1-based
    approverId: v.id("users"), // who is assigned to approve this level
    approverRole: v.optional(v.string()), // snapshot of approver's role label
    approverName: v.optional(v.string()), // snapshot name for display
    approverJobTitle: v.optional(v.string()),
    // "pending" | "approved" | "rejected" | "skipped" | "revision"
    status: v.string(),
    note: v.optional(v.string()), // reviewer comment
    actedAt: v.optional(v.string()), // ISO timestamp
    // SLA deadline for this level (ISO timestamp)
    slaDeadline: v.optional(v.string()),
    // Delegation info: if this approver is acting on behalf of someone else
    delegatedFromId: v.optional(v.id("users")),
    delegatedFromName: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_fund_request", ["fundRequestId"])
    .index("by_approver", ["approverId"])
    .index("by_approver_and_status", ["approverId", "status"])
    .index("by_organization", ["organizationId"]),

  // Custom fund-request categories added by admins. Keys must be unique. Built-in
  // categories (operational, procurement, …) are defined on the client; this table
  // only stores extra categories so the list stays flexible.
  fundCategories: defineTable({
    // Stable key used as the dropdown value (slug-like, lowercase, no spaces)
    key: v.string(),
    label: v.string(), // display label shown to users
    description: v.optional(v.string()),
    // Tailwind color token family used for the badge, e.g. "blue", "emerald", "violet"
    color: v.string(),
    // If false, the category is hidden from new dropdowns but kept for history
    isActive: v.boolean(),
    order: v.number(),
    createdById: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_key", ["key"])
    .index("by_active", ["isActive"])
    .index("by_order", ["order"])
    .index("by_organization", ["organizationId"]),

  // ---- Finance Audit Log ------------------------------------------------
  // Immutable event log for every action in the finance approval lifecycle.
  // Each row represents a single event: who did what, when, on which request.
  financeAuditLog: defineTable({
    fundRequestId: v.id("fundRequests"),
    // "created" | "submitted" | "approved" | "rejected" | "revision_requested"
    // | "resubmitted" | "disbursed" | "cancelled" | "delegated"
    action: v.string(),
    // Who performed the action
    actorId: v.id("users"),
    actorName: v.string(),
    actorRole: v.optional(v.string()),
    // Approval level (if applicable)
    approvalLevel: v.optional(v.number()),
    // Note/comment attached to the action
    note: v.optional(v.string()),
    // Snapshot of request state at the time of this event
    requestTitle: v.string(),
    requestAmount: v.number(),
    requestStatus: v.string(),
    requestCategory: v.string(),
    requestType: v.optional(v.string()),
    // Submitter info snapshot
    submitterId: v.id("users"),
    submitterName: v.optional(v.string()),
    submitterDepartment: v.optional(v.string()),
    // Additional metadata
    metadata: v.optional(v.string()), // JSON for extra details (payment ref, chain name, etc.)
    // ISO timestamp
    timestamp: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_fund_request", ["fundRequestId"])
    .index("by_actor", ["actorId"])
    .index("by_action", ["action"])
    .index("by_timestamp", ["timestamp"])
    .index("by_organization", ["organizationId"]),

  // ---- Role requests (new user onboarding approval flow) ----------------
  roleRequests: defineTable({
    userId: v.id("users"),
    requestedRole: v.string(),
    reason: v.optional(v.string()),
    // "pending" | "approved" | "rejected"
    status: v.string(),
    // ISO timestamps
    requestedAt: v.string(),
    reviewedAt: v.optional(v.string()),
    reviewedById: v.optional(v.id("users")),
    reviewNote: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_status_and_requested", ["status", "requestedAt"])
    .index("by_organization", ["organizationId"]),

  // =====================================================================
  // MANAJEMEN SURAT (Letter Management)
  // =====================================================================

  letterheads: defineTable({
    name: v.string(),
    organizationName: v.string(),
    organizationAddress: v.string(),
    organizationPhone: v.optional(v.string()),
    organizationEmail: v.optional(v.string()),
    organizationWebsite: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    logoFileName: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    showTopLine: v.optional(v.boolean()),
    showBottomLine: v.optional(v.boolean()),
    isDefault: v.boolean(),
    authorId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_default", ["isDefault"])
    .index("by_organization", ["organizationId"]),

  letters: defineTable({
    type: v.string(),
    status: v.string(),
    subject: v.string(),
    letterNumber: v.optional(v.string()),
    agendaNumber: v.optional(v.string()),
    letterDate: v.string(),
    // Tempat (kota) tempat surat dibuat — tampil sebelum tanggal pada surat resmi.
    place: v.optional(v.string()),
    processedAt: v.optional(v.string()),
    classification: v.string(),
    fromName: v.string(),
    fromUserId: v.optional(v.id("users")),
    fromOrganization: v.optional(v.string()),
    fromAddress: v.optional(v.string()),
    toName: v.string(),
    toUserId: v.optional(v.id("users")),
    toJobTitle: v.optional(v.string()),
    toOrganization: v.optional(v.string()),
    toAddress: v.optional(v.string()),
    content: v.string(),
    category: v.string(),
    letterheadId: v.optional(v.id("letterheads")),
    authorId: v.id("users"),
    picId: v.optional(v.id("users")),
    replyToId: v.optional(v.id("letters")),
    retentionDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    attachmentCount: v.optional(v.number()),
    dispositionCount: v.optional(v.number()),
    // Tembusan (CC) – array of user IDs
    ccUserIds: v.optional(v.array(v.id("users"))),
    // Tembusan eksternal (manual entry)
    ccExternal: v.optional(v.array(v.string())),
    // Surat fisik: storageId of scanned document
    physicalDocStorageId: v.optional(v.id("_storage")),
    physicalDocFileName: v.optional(v.string()),
    isPhysical: v.optional(v.boolean()),
    receivedAt: v.optional(v.string()),
    // Template used for hierarchical approval flow
    approvalTemplateId: v.optional(v.id("letterApprovalTemplates")),
    organizationId: v.optional(v.id("organizations")),
    // Unique public code used for QR-based authenticity verification
    verificationCode: v.optional(v.string()),
    // Metode tanda tangan: "digital" (default, tampilkan gambar TTD) atau
    // "basah" (kosongkan gambar TTD untuk ditandatangani manual; QR tetap tampil).
    signatureMethod: v.optional(v.string()),
    // Urgency level set saat pengajuan: "normal" | "segera" | "sangat_segera"
    urgency: v.optional(v.string()),
    // Batas waktu persetujuan (ISO timestamp)
    approvalDeadline: v.optional(v.string()),
    // Catatan pengajuan dari konseptor ke pemeriksa pertama
    submissionNote: v.optional(v.string()),
    // Arsip PDF permanen — dibekukan saat surat dikirim/difinalkan.
    archivePdfStorageId: v.optional(v.id("_storage")),
    archivePdfName: v.optional(v.string()),
    archivePdfGeneratedAt: v.optional(v.string()),
    // Pengiriman massal: cara penerima dipilih. Kosong = penerima tunggal biasa.
    // "individual" | "department" | "all"
    recipientMode: v.optional(v.string()),
    // Nama departemen tujuan bila recipientMode === "department".
    recipientDepartment: v.optional(v.string()),
    // Teks gabungan untuk pencarian: perihal + nomor surat + nomor agenda.
    // Dipelihara di setiap penulisan surat agar bisa dicari lewat search index.
    searchText: v.optional(v.string()),
  })
    .index("by_type", ["type"])
    .index("by_status", ["status"])
    .index("by_type_and_status", ["type", "status"])
    .index("by_author", ["authorId"])
    .index("by_recipient", ["toUserId"])
    .index("by_letter_date", ["letterDate"])
    .index("by_letter_number", ["letterNumber"])
    .index("by_pic", ["picId"])
    .index("by_organization", ["organizationId"])
    .index("by_verification_code", ["verificationCode"])
    .searchIndex("search_subject", {
      searchField: "subject",
      filterFields: ["type", "status", "category"],
    })
    .searchIndex("search_text", {
      searchField: "searchText",
      filterFields: ["type", "status", "category"],
    }),

  // Tracks which letters each user has opened, so the list can show unread
  // (bold) vs read (normal) styling per user.
  letterReads: defineTable({
    letterId: v.id("letters"),
    userId: v.id("users"),
    readAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_letter", ["userId", "letterId"])
    .index("by_letter", ["letterId"]),

  // Daftar penerima untuk surat yang dikirim ke banyak orang sekaligus
  // (perorangan banyak, per departemen, atau seluruh karyawan). Satu surat
  // "induk" punya banyak baris di sini — satu per penerima — sehingga setiap
  // orang melihat surat di kotak masuknya dengan status baca sendiri.
  // Tidak diisi untuk surat penerima tunggal biasa (yang tetap memakai toUserId).
  letterRecipients: defineTable({
    letterId: v.id("letters"),
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
    // Cara penerima ini terpilih: "individual" | "department" | "all"
    source: v.string(),
    // Label grup asal (mis. nama departemen) untuk ditampilkan, opsional.
    groupLabel: v.optional(v.string()),
    deliveredAt: v.string(),
    readAt: v.optional(v.string()),
  })
    .index("by_letter", ["letterId"])
    .index("by_user", ["userId"])
    .index("by_user_and_letter", ["userId", "letterId"])
    .index("by_letter_and_user", ["letterId", "userId"]),

  // Pekerjaan pengiriman email surat ke banyak penerima. Memungkinkan
  // pengiriman bertahap di latar belakang dengan indikator progres, sehingga
  // mengirim ke puluhan/ratusan alamat tidak membebani satu permintaan.
  letterEmailJobs: defineTable({
    letterId: v.id("letters"),
    organizationId: v.optional(v.id("organizations")),
    createdBy: v.id("users"),
    // Pesan pengantar yang sama untuk semua penerima.
    message: v.string(),
    total: v.number(),
    sentCount: v.number(),
    failedCount: v.number(),
    // "processing" | "completed" | "failed"
    status: v.string(),
    // Contoh alamat yang gagal (maks. beberapa) untuk ditampilkan ke pengirim.
    failedSample: v.optional(v.array(v.string())),
    // Parameter kirim yang dibangun sekali lalu dipakai ulang tiap batch.
    pdfStorageId: v.id("_storage"),
    fromLine: v.string(),
    replyTo: v.optional(v.string()),
    emailSubject: v.string(),
    emailHtml: v.string(),
    fileName: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_letter", ["letterId"])
    .index("by_creator", ["createdBy"]),

  // Antrian alamat email per pekerjaan. Satu baris per penerima sehingga
  // pengiriman dapat diproses bertahap dan setiap alamat punya status sendiri.
  letterEmailQueue: defineTable({
    jobId: v.id("letterEmailJobs"),
    email: v.string(),
    // "pending" | "sent" | "failed"
    status: v.string(),
  })
    .index("by_job", ["jobId"])
    .index("by_job_and_status", ["jobId", "status"]),

  letterAttachments: defineTable({
    letterId: v.id("letters"),
    fileName: v.string(),
    fileSize: v.number(),
    fileType: v.string(),
    storageId: v.id("_storage"),
    uploaderId: v.id("users"),
    description: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_letter", ["letterId"])
    .index("by_organization", ["organizationId"]),

  letterDispositions: defineTable({
    letterId: v.id("letters"),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    instructions: v.string(),
    status: v.string(),
    dueDate: v.optional(v.string()),
    readAt: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    completionNote: v.optional(v.string()),
    parentDispositionId: v.optional(v.id("letterDispositions")),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_letter", ["letterId"])
    .index("by_to_user", ["toUserId"])
    .index("by_from_user", ["fromUserId"])
    .index("by_to_user_and_status", ["toUserId", "status"])
    .index("by_organization", ["organizationId"]),

  letterApprovals: defineTable({
    letterId: v.id("letters"),
    approverId: v.id("users"),
    order: v.number(),
    status: v.string(),
    comment: v.optional(v.string()),
    actedAt: v.optional(v.string()),
    signatureData: v.optional(v.string()), // base64 signature image stamped on approval
    // Approval hierarchy role: "konseptor" | "pemeriksa_1" | "pemeriksa_2" | "penyetuju"
    approvalRole: v.optional(v.string()),
    // Label for this step, e.g. "Konseptor", "Pemeriksa I", "Pemeriksa II", "Penyetuju"
    approvalLabel: v.optional(v.string()),
    // Which template generated this approval step
    templateId: v.optional(v.id("letterApprovalTemplates")),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_letter", ["letterId"])
    .index("by_approver", ["approverId"])
    .index("by_letter_and_order", ["letterId", "order"])
    .index("by_approver_and_status", ["approverId", "status"])
    .index("by_status", ["status"])
    .index("by_organization", ["organizationId"]),

  letterHistory: defineTable({
    letterId: v.id("letters"),
    actorId: v.id("users"),
    action: v.string(),
    detail: v.optional(v.string()),
    occurredAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_letter", ["letterId"])
    .index("by_organization", ["organizationId"]),

  // Jejak audit akses arsip dokumen (GCG): mencatat siapa membuka/mengunduh
  // arsip PDF surat final, kapan, dan surat mana. Terpisah dari letterHistory
  // agar akses baca (view/download) tidak bercampur dengan riwayat aksi surat.
  letterArchiveAudit: defineTable({
    letterId: v.id("letters"),
    actorId: v.id("users"),
    // "view" (buka detail arsip) atau "download" (unduh PDF arsip).
    action: v.string(),
    // Cuplikan info surat saat diakses agar tetap terbaca meski surat berubah.
    letterSubject: v.optional(v.string()),
    letterNumber: v.optional(v.string()),
    occurredAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_letter", ["letterId"])
    .index("by_organization", ["organizationId"])
    .index("by_actor", ["actorId"]),

  // ─── Jaminan Kerahasiaan Data: consent-first vendor access ────────────────
  // A grant is the ONLY way a platform super_admin (the app vendor/owner) may
  // enter a company's data. The company must approve a time-boxed request; no
  // silent access is possible. Enforced in setViewingOrganization + requireTenant.
  dataAccessGrants: defineTable({
    // The platform super admin (vendor) who requested access
    superAdminId: v.id("users"),
    superAdminName: v.optional(v.string()),
    // The company (tenant) whose data access is being requested
    organizationId: v.id("organizations"),
    // Justification the vendor must provide when requesting
    reason: v.string(),
    // Data scope categories the vendor requested access to (ids from
    // convex/dataScopes.ts). Optional for backward compatibility with older
    // grants created before scoping existed (treated as "full access").
    scopes: v.optional(v.array(v.string())),
    // "pending" | "approved" | "denied" | "revoked" | "expired"
    status: v.string(),
    requestedAt: v.string(),
    // How long access lasts once approved (hours). Chosen by the approving company.
    durationHours: v.optional(v.number()),
    // When a company admin decided (approve/deny) and who
    decidedAt: v.optional(v.string()),
    decidedByUserId: v.optional(v.id("users")),
    decidedByName: v.optional(v.string()),
    // Approval expiry (ISO). After this, the grant is no longer active.
    expiresAt: v.optional(v.string()),
    // Revocation (company can cut access early)
    revokedAt: v.optional(v.string()),
    revokedByUserId: v.optional(v.id("users")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_superadmin_and_org", ["superAdminId", "organizationId"])
    .index("by_org_and_status", ["organizationId", "status"]),

  // Immutable, customer-visible audit trail of the entire vendor-access
  // lifecycle. Company admins can see exactly who from the vendor did what,
  // and when. Never edited or deleted.
  dataAccessAudit: defineTable({
    organizationId: v.id("organizations"),
    // Who performed the event (vendor super admin OR company admin deciding)
    actorId: v.id("users"),
    actorName: v.optional(v.string()),
    actorRole: v.optional(v.string()),
    // "requested" | "approved" | "denied" | "revoked" | "expired"
    //   | "access_started" | "access_ended"
    action: v.string(),
    // Related grant, when applicable
    grantId: v.optional(v.id("dataAccessGrants")),
    // Human-readable detail (reason, duration, etc.)
    detail: v.optional(v.string()),
    occurredAt: v.string(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_org_and_time", ["organizationId", "occurredAt"])
    .index("by_grant", ["grantId"]),

  letterPrefixSequences: defineTable({
    letterType: v.string(),
    prefix: v.string(),
    lastSequence: v.number(),
    lastResetAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_type_and_prefix", ["letterType", "prefix"])
    .index("by_organization", ["organizationId"]),

  // Penghitung Nomor Agenda (registrasi internal). Terpisah per jenis surat
  // (mis. surat masuk & surat keluar punya buku agenda sendiri). Reset tahunan.
  letterAgendaSequences: defineTable({
    letterType: v.string(),
    lastSequence: v.number(),
    lastResetAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_type", ["letterType"])
    .index("by_organization", ["organizationId"]),

  letterCompanyPrefixes: defineTable({
    code: v.string(),
    label: v.optional(v.string()),
    isBuiltIn: v.optional(v.boolean()),
    createdBy: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_code", ["code"])
    .index("by_organization", ["organizationId"]),

  // Prefix kategori surat (PREFIX2): UND, PMH, PBT, dst.
  letterCategoryPrefixes: defineTable({
    code: v.string(),
    label: v.optional(v.string()),
    isBuiltIn: v.optional(v.boolean()),
    createdBy: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_code", ["code"])
    .index("by_organization", ["organizationId"]),

  letterNumberConfigs: defineTable({
    letterType: v.string(),
    category: v.optional(v.string()),
    format: v.string(),
    lastSequence: v.number(),
    prefix: v.optional(v.string()),
    prefix2: v.optional(v.string()), // Prefix kategori surat (PREFIX2)
    resetPeriod: v.string(), // "monthly" | "yearly" | "never"
    lastResetAt: v.string(),
    updatedBy: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_type", ["letterType"])
    .index("by_organization", ["organizationId"]),

  // Pengaturan tampilan area kop untuk NOTA (memo), satu baris per tenant.
  // Nota tidak memakai kop surat; area kop hanya menampilkan sebuah label
  // judul yang bisa diatur tiap tenant (mis. "NOTA", "NOTA DINAS", "MEMO").
  letterMemoSettings: defineTable({
    // Judul yang ditampilkan di area kop nota. Kosong = pakai default "NOTA".
    headerTitle: v.string(),
    // Gaya garis atas & bawah area kop nota. Semua opsional agar baris lama tetap
    // valid; nilai default diterapkan di query bila kosong.
    topLineShow: v.optional(v.boolean()),
    topLineColor: v.optional(v.string()),
    topLineWidth: v.optional(v.number()), // ketebalan dalam piksel
    bottomLineShow: v.optional(v.boolean()),
    bottomLineColor: v.optional(v.string()),
    bottomLineWidth: v.optional(v.number()), // ketebalan dalam piksel
    // Logo opsional untuk kop nota. Bila diisi, ditampilkan di area kop nota di
    // sebelah judul. Kosong = kop nota tanpa logo (perilaku lama).
    logoStorageId: v.optional(v.id("_storage")),
    logoFileName: v.optional(v.string()),
    updatedBy: v.id("users"),
    updatedAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  }).index("by_organization", ["organizationId"]),

  letterSignatures: defineTable({
    letterId: v.id("letters"),
    userId: v.id("users"),
    signatureData: v.string(), // base64 image data URL
    signatureType: v.string(), // "drawn" | "typed"
    role: v.optional(v.string()), // "penandatangan" | "saksi" | "mengetahui" etc.
    signedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_letter", ["letterId"])
    .index("by_user", ["userId"])
    .index("by_letter_and_user", ["letterId", "userId"])
    .index("by_organization", ["organizationId"]),

  // ---- User audit log (security trail) ----------------------------------
  userAuditLog: defineTable({
    // Who performed the action (admin/super_admin user id, or null for system)
    actorId: v.optional(v.id("users")),
    // Target user
    targetUserId: v.id("users"),
    // "role_changed" | "account_suspended" | "account_activated" | "account_rejected"
    // | "role_request_approved" | "role_request_rejected" | "login"
    action: v.string(),
    detail: v.optional(v.string()),
    // ISO timestamp
    occurredAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_target", ["targetUserId"])
    .index("by_actor", ["actorId"])
    .index("by_occurred", ["occurredAt"])
    .index("by_organization", ["organizationId"]),

  // ---- Payment settings (manual bank transfer destination) ----------------
  // Singleton table: one document with key="bank_transfer". Super admin edits
  // the destination bank account shown to organisations paying for a plan.
  // DEPRECATED in favour of `bankAccounts` (which supports multiple accounts).
  // Kept for backward compatibility; no longer written to.
  paymentSettings: defineTable({
    key: v.string(), // "bank_transfer"
    bankName: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    accountHolder: v.optional(v.string()),
    instructions: v.optional(v.string()),
    updatedBy: v.id("users"),
    updatedAt: v.string(), // ISO timestamp
  }).index("by_key", ["key"]),

  // ---- Bank accounts (manual transfer destinations) ------------------------
  // One row per bank account shown to organisations paying for a plan via
  // manual bank transfer. Super admin can add, edit, and delete accounts.
  bankAccounts: defineTable({
    bankName: v.string(),
    accountNumber: v.string(),
    accountHolder: v.string(),
    instructions: v.optional(v.string()),
    isActive: v.boolean(), // inactive accounts are hidden from registrants
    updatedBy: v.id("users"),
    updatedAt: v.string(), // ISO timestamp
  }).index("by_active", ["isActive"]),

  // ---- Organization limit alerts (graduated plan-usage warnings) ----------
  // One row per organization + metric ("employees" | "storage"). Remembers the
  // highest usage threshold (80/90/95/100) we have already alerted about so
  // each threshold notifies only once. Resets automatically when usage drops
  // below a threshold or the org's plan changes (larger limits).
  orgLimitAlerts: defineTable({
    organizationId: v.id("organizations"),
    metric: v.string(), // "employees" | "storage"
    // Highest threshold percent already notified (0 = none, up to 100)
    lastThreshold: v.number(),
    // The plan active when the alert last fired; used to reset on plan change
    membershipPlanId: v.optional(v.id("membershipPlans")),
    updatedAt: v.string(), // ISO timestamp
  }).index("by_org_and_metric", ["organizationId", "metric"]),

  // ---- Per-organization storage usage counter ------------------------------
  // Denormalized running total of bytes stored in Convex File Storage by an
  // organization. Maintained at write time (every file add/remove) so the
  // dashboard banner can read a single O(1) row instead of scanning every
  // file-bearing table. Can be recomputed authoritatively via a backstop
  // mutation if it ever drifts.
  orgStorageUsage: defineTable({
    organizationId: v.id("organizations"),
    // Total bytes currently attributed to this organization.
    bytes: v.number(),
    updatedAt: v.string(), // ISO timestamp
  }).index("by_organization", ["organizationId"]),

  // ---- Subscription payments (recurring billing ledger) --------------------
  // One row per recorded payment for an organization's subscription. A payment
  // extends the org's `subscriptionPaidUntil` by `cycleMonths` once it is in
  // the "verified" state. Payments can be created by a super admin directly
  // (status="verified") or submitted by an org admin as proof of transfer
  // (status="pending") awaiting super-admin verification.
  subscriptionPayments: defineTable({
    organizationId: v.id("organizations"),
    // Plan the payment was for (snapshot; plan may change later).
    membershipPlanId: v.optional(v.id("membershipPlans")),
    planName: v.optional(v.string()),
    // When set, this payment is an upgrade request: verifying it switches the
    // org to this target plan (in addition to extending the paid period). The
    // org's plan is NOT changed until a super admin verifies the payment.
    targetPlanId: v.optional(v.id("membershipPlans")),
    // Billing cycle covered by this payment, in months (1/3/6/12).
    cycleMonths: v.number(),
    // Amount paid in IDR (numeric) plus a human display label.
    amount: v.number(),
    amountLabel: v.optional(v.string()),
    // Manual transfer reference / proof note supplied by the payer.
    reference: v.optional(v.string()),
    // Optional uploaded proof (Convex storage id) — e.g. transfer receipt image.
    proofStorageId: v.optional(v.id("_storage")),
    // Date the payment was made (ISO timestamp).
    paidAt: v.string(),
    // The period this payment covers: computed at verification time.
    periodStart: v.optional(v.string()), // ISO
    periodEnd: v.optional(v.string()), // ISO
    // "pending" (submitted, awaiting review) | "verified" | "rejected".
    status: v.string(),
    // Who submitted (org admin) and who reviewed (super admin).
    submittedBy: v.optional(v.id("users")),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    // When set, this payment was submitted to settle a specific invoice
    // (faktur). Verifying such a payment marks the invoice paid.
    invoiceId: v.optional(v.id("invoices")),
    // Snapshot of the chosen destination account + payer (sender) bank details
    // and terms acceptance, captured at submission time for the reviewer.
    destinationBankLabel: v.optional(v.string()),
    senderBankName: v.optional(v.string()),
    senderAccountNumber: v.optional(v.string()),
    senderAccountHolder: v.optional(v.string()),
    termsAccepted: v.optional(v.boolean()),
    createdAt: v.string(), // ISO timestamp
  })
    .index("by_organization", ["organizationId"])
    .index("by_org_and_status", ["organizationId", "status"])
    .index("by_status", ["status"]),

  // ---- Subscription invoices (faktur) --------------------------------------
  // Formal, numbered invoices issued by the super admin to an organization for
  // a subscription period (renewal or upgrade). An invoice starts as "issued"
  // (Belum Dibayar), becomes "paid" (Lunas) once a payment proof is verified or
  // the super admin marks it paid manually, and can be "cancelled" (Dibatalkan).
  // "Jatuh Tempo" (overdue) is derived at read time from `dueDate` vs now, so it
  // is never stored/stale.
  invoices: defineTable({
    organizationId: v.id("organizations"),
    // Human-facing unique invoice number, e.g. "INV-2026-0001".
    number: v.string(),
    // Year + sequence used to generate the number (per-year counter).
    year: v.number(),
    seq: v.number(),
    // Plan snapshot the invoice is billed for.
    membershipPlanId: v.optional(v.id("membershipPlans")),
    planName: v.optional(v.string()),
    // Billing cycle covered by this invoice, in months (1/3/6/12).
    cycleMonths: v.number(),
    // Amount due in IDR (numeric) plus a human display label.
    amount: v.number(),
    amountLabel: v.optional(v.string()),
    // Optional free-text note/description shown on the invoice.
    description: v.optional(v.string()),
    // Issue date + due date (ISO instants).
    issuedAt: v.string(),
    dueDate: v.string(),
    // "issued" | "paid" | "cancelled" (overdue is derived from dueDate).
    status: v.string(),
    // The verified payment that settled this invoice (when paid via proof).
    paymentId: v.optional(v.id("subscriptionPayments")),
    paidAt: v.optional(v.string()),
    // Receipt (bukti pelunasan) number issued when the invoice is paid.
    receiptNumber: v.optional(v.string()),
    // Audit trail.
    issuedBy: v.id("users"),
    markedPaidBy: v.optional(v.id("users")),
    cancelledBy: v.optional(v.id("users")),
    cancelledAt: v.optional(v.string()),
    createdAt: v.string(), // ISO timestamp
    updatedAt: v.string(), // ISO timestamp
  })
    .index("by_organization", ["organizationId"])
    .index("by_org_and_status", ["organizationId", "status"])
    .index("by_status", ["status"])
    .index("by_number", ["number"])
    .index("by_year_and_seq", ["year", "seq"]),

  // ---- Feature add-on catalog ----------------------------------------------
  // Super-admin-managed catalog of paid feature add-ons. Each add-on unlocks a
  // set of sidebar menu keys for an organization even when its membership plan
  // would otherwise block them. Price is set by the super admin.
  featureAddons: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    // Sidebar menu keys this add-on unlocks (validated against MENU_KEYS).
    menuKeys: v.array(v.string()),
    // Price in IDR (numeric) + human display label.
    price: v.number(),
    priceLabel: v.optional(v.string()),
    // Display order (lower shown first) + active toggle.
    order: v.number(),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    updatedAt: v.string(), // ISO timestamp
  })
    .index("by_order", ["order"])
    .index("by_active", ["isActive"]),

  // ---- Organization add-on grants ------------------------------------------
  // One row per (organization, add-on) that is currently granted. The presence
  // of an "active" row unlocks the add-on's menu keys for the org. Rows are
  // created when a super admin grants manually or verifies a purchase.
  orgAddons: defineTable({
    organizationId: v.id("organizations"),
    addonId: v.id("featureAddons"),
    // "active" | "revoked"
    status: v.string(),
    // How it was granted: "manual" (super admin) | "purchase" (verified payment)
    source: v.string(),
    grantedBy: v.optional(v.id("users")),
    grantedAt: v.string(), // ISO timestamp
    revokedBy: v.optional(v.id("users")),
    revokedAt: v.optional(v.string()),
    note: v.optional(v.string()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_org_and_addon", ["organizationId", "addonId"])
    .index("by_org_and_status", ["organizationId", "status"]),

  // ---- Add-on purchases (payment proof ledger) -----------------------------
  // One row per add-on purchase submission. Mirrors subscriptionPayments: an
  // org admin submits proof (status="pending"); a super admin verifies (which
  // activates an orgAddons grant) or rejects.
  addonPurchases: defineTable({
    organizationId: v.id("organizations"),
    addonId: v.id("featureAddons"),
    // Snapshots taken at submission (add-on may change/deactivate later).
    addonName: v.optional(v.string()),
    menuKeys: v.optional(v.array(v.string())),
    amount: v.number(),
    amountLabel: v.optional(v.string()),
    reference: v.optional(v.string()),
    proofStorageId: v.optional(v.id("_storage")),
    // "pending" | "verified" | "rejected"
    status: v.string(),
    submittedBy: v.optional(v.id("users")),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    createdAt: v.string(), // ISO timestamp
  })
    .index("by_organization", ["organizationId"])
    .index("by_org_and_status", ["organizationId", "status"])
    .index("by_status", ["status"]),

  // ---- Seat add-on purchases (extra user seats, payment proof ledger) -------
  // One row per extra-seat purchase submission. Mirrors addonPurchases: an org
  // admin submits proof (status="pending") to buy N extra employee seats on top
  // of their current plan limit; a super admin verifies (which increases the
  // org's extraSeats by `seats`) or rejects. Seats are permanent capacity.
  seatPurchases: defineTable({
    organizationId: v.id("organizations"),
    // How many extra seats this purchase adds when verified.
    seats: v.number(),
    // Snapshots taken at submission (price may change later).
    pricePerSeat: v.optional(v.number()),
    amount: v.number(),
    amountLabel: v.optional(v.string()),
    reference: v.optional(v.string()),
    proofStorageId: v.optional(v.id("_storage")),
    // Destination account the org transferred to (snapshot for the reviewer).
    destinationBankLabel: v.optional(v.string()),
    // Sender (payer) account details, entered by the org admin.
    senderBankName: v.optional(v.string()),
    senderAccountNumber: v.optional(v.string()),
    senderAccountHolder: v.optional(v.string()),
    // Whether the org admin accepted the payment terms at submission time.
    termsAccepted: v.optional(v.boolean()),
    // "pending" | "verified" | "rejected"
    status: v.string(),
    submittedBy: v.optional(v.id("users")),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    createdAt: v.string(), // ISO timestamp
  })
    .index("by_organization", ["organizationId"])
    .index("by_org_and_status", ["organizationId", "status"])
    .index("by_status", ["status"]),

  // ---- Seat add-on settings (super admin configurable) ---------------------
  // Singleton table with key="seat_addon". Super admin sets the price per extra
  // seat and toggles whether organizations can self-serve buy extra seats.
  seatAddonSettings: defineTable({
    key: v.string(), // "seat_addon"
    // Price in IDR for one extra employee seat (one-time, permanent).
    pricePerSeat: v.number(),
    // When false, the seat add-on is hidden from org billing pages.
    isActive: v.boolean(),
    updatedBy: v.id("users"),
    updatedAt: v.string(), // ISO timestamp
  }).index("by_key", ["key"]),

  // ---- Per-tenant menu overrides -------------------------------------------
  // Super-admin controlled overrides that force a specific sidebar menu ON or
  // OFF for a single organization, regardless of the org's plan or add-ons.
  // This is the final gate applied after role + plan + add-on resolution, so a
  // tenant can request menus tailored just for them without changing plans or
  // writing per-tenant code. One row per (organization, menuKey).
  //   forced = "on"  → menu is always shown for this org (bypasses plan block)
  //   forced = "off" → menu is always hidden for this org (even if plan allows)
  orgMenuOverrides: defineTable({
    organizationId: v.id("organizations"),
    // A sidebar menu key from roles.ts MENU_KEYS.
    menuKey: v.string(),
    // "on" | "off"
    forced: v.string(),
    updatedBy: v.id("users"),
    updatedAt: v.string(), // ISO timestamp
    note: v.optional(v.string()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_org_and_menu", ["organizationId", "menuKey"]),

  // ---- Alert email settings (sender + toggle for plan-limit emails) --------
  // Singleton table with key="plan_alerts". Super admin sets the verified
  // sender address used for plan-limit warning emails and can toggle emails.
  alertEmailSettings: defineTable({
    key: v.string(), // "plan_alerts"
    // Verified sender email (must be verified in Hercules Email). Empty = emails off.
    senderEmail: v.optional(v.string()),
    // Friendly sender display name shown in the recipient's inbox (e.g. the
    // company name). Empty/undefined = fall back to "Star e-Office".
    senderName: v.optional(v.string()),
    // Master toggle for sending plan-limit emails
    emailEnabled: v.boolean(),
    updatedBy: v.id("users"),
    updatedAt: v.string(), // ISO timestamp
  }).index("by_key", ["key"]),

  // ---- Trial settings (self-service new-organization trial) ---------------
  // Singleton table: only one document with key="trial". Super admin controls
  // how self-service trial organisations behave and whether the "Buat
  // Organisasi Baru" option appears in onboarding at all.
  trialSettings: defineTable({
    key: v.string(), // "trial"
    // Master switch for the "Daftar organisasi baru" option in onboarding.
    // When false, unrecognised users cannot register a new organisation.
    registrationEnabled: v.boolean(),
    // How many days the free trial lasts before the org must subscribe.
    durationDays: v.number(),
    // Maximum employees allowed while on trial (0 = unlimited).
    maxEmployees: v.number(),
    // Menu keys (see roles.MENU_ITEMS) available during the trial. Menus that
    // are alwaysOn are always available regardless of this list.
    activeMenus: v.array(v.string()),
    updatedBy: v.id("users"),
    updatedAt: v.string(), // ISO timestamp
  }).index("by_key", ["key"]),

  // ---- Site settings (landing page section visibility) --------------------
  // Singleton table: only one document with key="landing_sections".
  // Super admin can toggle each landing page section on/off.
  siteSettings: defineTable({
    key: v.string(), // "landing_sections"
    // Each section id maps to a boolean (true = visible, false = hidden)
    sections: v.record(v.string(), v.boolean()),
    updatedBy: v.id("users"),
    updatedAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_key", ["key"])
    .index("by_organization", ["organizationId"]),

  // ---- Footer link management (superadmin toggle active/inactive) ---------
  // Each row = one footer link. group = "Produk" | "Perusahaan" | "Dukungan" | "Legal".
  footerLinks: defineTable({
    group: v.string(),
    label: v.string(),
    order: v.number(),
    isActive: v.boolean(),
    updatedBy: v.id("users"),
    updatedAt: v.string(), // ISO timestamp
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_group", ["group"])
    .index("by_group_and_order", ["group", "order"])
    .index("by_organization", ["organizationId"]),

  // ---- Role menu access settings (super admin configurable) ----------------
  // One row per role. Stores the list of menu keys that role can access.
  roleMenuSettings: defineTable({
    role: v.string(),
    allowedMenus: v.array(v.string()),
    updatedBy: v.id("users"),
    updatedAt: v.string(),
  }).index("by_role", ["role"]),

  // ---- Super admin data access settings -------------------------------------
  // A single-row (singleton) config controlling which operational data
  // categories a super_admin is allowed to READ across organizations.
  // Each category defaults to BLOCKED (false) for data privacy (UU PDP).
  // `category` values: "leave" | "letters" | "messages" | "documents"
  //   | "directory" | "reports".
  superAdminDataAccess: defineTable({
    category: v.string(),
    allowed: v.boolean(),
    updatedBy: v.id("users"),
    updatedAt: v.string(),
  }).index("by_category", ["category"]),


  // Tracks each user's progress through the guided product tour and checklist.
  tourProgress: defineTable({
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
    // Current tour step index (-1 = not started, >= totalSteps = finished)
    currentStep: v.number(),
    totalSteps: v.number(),
    // Whether the spotlight tour has been completed at least once
    tourCompleted: v.boolean(),
    // Checklist items completed (array of item IDs)
    completedItems: v.array(v.string()),
    totalItems: v.number(),
    // Whether the user dismissed the checklist
    checklistDismissed: v.boolean(),
    updatedAt: v.string(),
    // Legacy fields from old schema iteration (will be cleaned up)
    checklist: v.optional(v.record(v.string(), v.boolean())),
    tourStep: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"]),

  // ---- Welcome Page Content (admin-managed) ---------------------------------
  // Stores configurable content for the organisation welcome/home page.
  // One row per organisation. If none exists, defaults are shown.
  welcomePageContent: defineTable({
    organizationId: v.id("organizations"),
    // Slogan / tagline shown below the welcome header
    slogan: v.optional(v.string()),
    // Company values (displayed as visual cards)
    values: v.array(
      v.object({
        icon: v.string(),   // emoji
        title: v.string(),
        description: v.string(),
      })
    ),
    // Banner carousel images (admin-uploaded)
    bannerSlides: v.array(
      v.object({
        imageUrl: v.string(),
        storageId: v.optional(v.id("_storage")),
        caption: v.optional(v.string()),
        fileName: v.optional(v.string()),
        fileSize: v.optional(v.number()), // bytes
        width: v.optional(v.number()),    // px
        height: v.optional(v.number()),   // px
      })
    ),
    // Carousel display settings
    carouselSettings: v.optional(
      v.object({
        transitionType: v.string(),   // "slide" | "fade" | "zoom"
        duration: v.number(),         // auto-advance interval in seconds
        transitionSpeed: v.number(),  // animation speed in ms
        autoPlay: v.boolean(),
      })
    ),
    // Highlighted spotlight text (e.g. hashtag, campaign, motivational quote)
    spotlightText: v.optional(v.string()),
    updatedBy: v.id("users"),
    updatedAt: v.string(),
  })
    .index("by_organization", ["organizationId"]),

  // ---- Finance Approval Chain Configuration -----------------------------------
  // Admin-defined approval chains for financial requests. Each chain defines
  // the request type, threshold range, and ordered approval levels.
  financeApprovalChains: defineTable({
    name: v.string(), // e.g. "Operasional Rutin", "Pengadaan Barang/Jasa"
    // "operational" | "procurement" | "reimbursement" | "petty_cash" | "capital" | "travel" | "custom"
    requestType: v.string(),
    description: v.optional(v.string()),
    // Threshold range in IDR: this chain applies when amount is within [minAmount, maxAmount]
    minAmount: v.number(), // 0 = no minimum
    maxAmount: v.number(), // 0 = unlimited (no cap)
    isActive: v.boolean(),
    order: v.number(), // display & matching priority
    createdBy: v.id("users"),
    updatedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_request_type", ["requestType"])
    .index("by_active", ["isActive"])
    .index("by_organization", ["organizationId"]),

  // Ordered approval levels within a chain. Level 1 approves first, then 2, etc.
  financeApprovalLevels: defineTable({
    chainId: v.id("financeApprovalChains"),
    level: v.number(), // 1-based
    label: v.string(), // e.g. "Atasan Langsung", "Kepala Bagian", "PPK", "Bendahara"
    // How to determine the approver:
    // "role" = anyone with the specified role
    // "specific_user" = a specific named user
    // "manager" = the submitter's direct manager (from users.managerId)
    // "position_level" = user with the specified position level (jenjang jabatan)
    // "department_head" = head of the submitter's department (from departments.headId)
    approverType: v.string(),
    // When approverType = "role": the role key from roles.ts
    roleKey: v.optional(v.string()),
    // When approverType = "specific_user": the assigned user
    specificUserId: v.optional(v.id("users")),
    // When approverType = "position_level": the required position level
    positionLevelId: v.optional(v.id("positionLevels")),
    // SLA in business hours (default 48 = 2 business days)
    slaHours: v.number(),
    // Whether this level supports delegation
    canDelegate: v.boolean(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_chain", ["chainId"])
    .index("by_organization", ["organizationId"]),

  // Delegation of approval authority. When an approver is unavailable,
  // they delegate to another user for a time period.
  financeApprovalDelegations: defineTable({
    delegatorId: v.id("users"), // who is delegating
    delegateId: v.id("users"), // who receives the delegation
    // Optional: restrict to a specific chain (null = all chains)
    chainId: v.optional(v.id("financeApprovalChains")),
    startDate: v.string(), // ISO date YYYY-MM-DD
    endDate: v.string(), // ISO date YYYY-MM-DD
    reason: v.string(),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_delegator", ["delegatorId"])
    .index("by_delegate", ["delegateId"])
    .index("by_active", ["isActive"])
    .index("by_organization", ["organizationId"]),

  // Maps organizational finance function roles (PPK, PPSPM, Bendahara, KPA, etc.)
  // to specific users or system roles. Used by the approval engine to resolve
  // who should approve at each level.
  financeRoleMappings: defineTable({
    // "ppk" | "ppspm" | "bendahara" | "kpa" | "verifikator"
    functionKey: v.string(),
    functionLabel: v.string(), // Display name: "Pejabat Pembuat Komitmen"
    description: v.optional(v.string()),
    // Specific user(s) assigned to this function
    assignedUserIds: v.array(v.id("users")),
    // Fallback: system role that maps to this function
    fallbackRole: v.optional(v.string()),
    isActive: v.boolean(),
    updatedBy: v.id("users"),
    updatedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_function_key", ["functionKey"])
    .index("by_active", ["isActive"])
    .index("by_organization", ["organizationId"]),

  // ---- Position Levels (Jenjang Jabatan Standar BUMN) -------------------------
  // Hierarchical position levels used to determine approval authority,
  // letter signing authority, and organizational structure.
  // Standard BUMN levels: L1 (Direktur Utama) → L9 (Pelaksana/Staff)
  positionLevels: defineTable({
    // Unique code: "L1", "L2", ..., "L9"
    code: v.string(),
    // Display name: "Direktur Utama", "Direktur", "VP/Kepala Divisi", etc.
    name: v.string(),
    // Numeric rank: 1 = highest (Direktur Utama), 9 = lowest (Pelaksana)
    rank: v.number(),
    // Description of responsibilities at this level
    description: v.optional(v.string()),
    // Max finance approval amount in IDR (0 = unlimited)
    maxApprovalAmount: v.number(),
    // Whether this level can sign outgoing letters
    canSignLetters: v.boolean(),
    // Whether this level can approve letters (as Pemeriksa or Penyetuju)
    canApproveLetters: v.boolean(),
    // Letter signing role default: "konseptor" | "pemeriksa" | "penyetuju" | "none"
    defaultLetterRole: v.string(),
    // Color token for UI display
    color: v.string(),
    isActive: v.boolean(),
    order: v.number(), // display order
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_code", ["code"])
    .index("by_rank", ["rank"])
    .index("by_active", ["isActive"])
    .index("by_organization", ["organizationId"]),

  // ---- Position Nomenclature (Nomenklatur & Titelatur Jabatan) ──────────────
  // Each department has positions with nomenclature, titulature, and grade.
  // Positions are categorized as structural (struktural) or functional (fungsional).
  positionNomenclature: defineTable({
    departmentId: v.id("departments"),
    // Position name, e.g. "Kepala Bagian Keuangan"
    name: v.string(),
    // Nomenclature: formal naming convention/code for the position
    nomenclature: v.string(),
    // Titulature: formal title/protocol title
    titulature: v.string(),
    // Grade: pay/job grade level, e.g. "III/a", "IV/b", "G-15"
    grade: v.string(),
    // "struktural" | "fungsional"
    type: v.string(),
    // Optional description of responsibilities
    description: v.optional(v.string()),
    // Display order within department
    order: v.number(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_department", ["departmentId"])
    .index("by_type", ["type"])
    .index("by_organization", ["organizationId"]),

  // ---- Position Directory (Direktori Jabatan) ────────────────────────────────
  // Composed/crafted positions from combining titulature + bagian spesifik,
  // nomenclature, type, and grade. Used for designing org structure.
  positionDirectory: defineTable({
    // Composed position name = Titelatur + Bagian Spesifik
    // e.g. "Kepala Bagian" + "Keuangan" = "Kepala Bagian Keuangan"
    titulature: v.string(),
    specificSection: v.string(), // bagian spesifik dari departemen
    // Full composed name (auto-generated: titulature + specificSection)
    fullName: v.string(),
    // Nomenclature code assigned to this position
    nomenclature: v.string(),
    // "struktural" | "fungsional"
    type: v.string(),
    // Grade level assigned (optional)
    grade: v.optional(v.string()),
    // Tingkat jabatan
    tingkatJabatan: v.optional(v.string()),
    // Optional default role (hak akses) assigned when a user is placed in this
    // position. Stored as a role key string from ROLE_VALUES (e.g. "hr_manager").
    defaultRole: v.optional(v.string()),
    // Optional: link to department
    departmentId: v.optional(v.id("departments")),
    // Optional description
    description: v.optional(v.string()),
    // Whether this position is active/used in org structure
    isActive: v.boolean(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_type", ["type"])
    .index("by_department", ["departmentId"])
    .index("by_organization", ["organizationId"]),

  // ---- Position Master Data ─────────────────────────────────────────────────
  // Master data for titulature entries (editable list)
  positionTitulatures: defineTable({
    name: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_organization", ["organizationId"]),

  // Master data for bagian/section entries (editable list)
  positionSections: defineTable({
    name: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_organization", ["organizationId"]),

  // Master data for grade entries (editable list)
  positionGrades: defineTable({
    name: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_organization", ["organizationId"]),

  // Master data for nomenklatur entries (editable list)
  positionNomenclatures: defineTable({
    name: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_organization", ["organizationId"]),

  // Master data for tingkat jabatan struktural entries (editable list)
  positionTingkatJabatan: defineTable({
    name: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_organization", ["organizationId"]),

  // Master data for tingkat jabatan fungsional entries (editable list)
  positionTingkatJabatanFungsional: defineTable({
    name: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_organization", ["organizationId"]),

  // ---- Letter Approval Templates ─────────────────────────────────────────────
  // Defines approval flow templates for letters: Konseptor → Pemeriksa 1 → Pemeriksa 2 → Disetujui
  // Each template maps to a letter type and defines the required approval steps.
  letterApprovalTemplates: defineTable({
    name: v.string(), // e.g. "Surat Keluar Standar", "Nota Internal", "SK Direksi"
    // Which letter types this template applies to
    letterType: v.string(), // "outgoing" | "memo" | "sk" | "all"
    description: v.optional(v.string()),
    // Ordered approval steps
    steps: v.array(v.object({
      order: v.number(), // 1, 2, 3, 4
      // "konseptor" | "pemeriksa_1" | "pemeriksa_2" | "penyetuju"
      role: v.string(),
      label: v.string(), // Display: "Konseptor", "Pemeriksa I", "Pemeriksa II", "Disetujui"
      // How to resolve the person for this step:
      // "author" = letter creator (konseptor)
      // "direct_manager" = atasan langsung konseptor
      // "department_head" = kepala departemen
      // "position_level" = specific position level
      // "specific_user" = manually assigned user
      resolverType: v.string(),
      // When resolverType = "position_level": minimum position level code required
      minPositionLevelCode: v.optional(v.string()),
      // When resolverType = "specific_user": the user id
      specificUserId: v.optional(v.id("users")),
    })),
    isActive: v.boolean(),
    isDefault: v.boolean(), // default template for the letter type
    createdBy: v.id("users"),
    updatedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_letter_type", ["letterType"])
    .index("by_active", ["isActive"])
    .index("by_organization", ["organizationId"]),

  // ---- Letter Content Templates ---------------------------------------------
  // Reusable letter BODY templates (isi surat) such as Undangan, Permohonan,
  // Pemberitahuan. Distinct from letterheads (kop surat) and approval templates.
  // The rich-text `content` may contain mail-merge placeholders like
  // {nomor_surat}, {tanggal}, {nama_penerima} that are substituted with form
  // data when the template is applied in the editor.
  letterContentTemplates: defineTable({
    name: v.string(), // e.g. "Undangan Rapat", "Surat Permohonan"
    // Optional grouping/letter type this template suits ("keluar" | "masuk" |
    // "internal" | "memo" | "umum"). Free-form; "umum" = general purpose.
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    // Rich-text HTML body, may include {variabel} placeholders.
    content: v.string(),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    updatedAt: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_active", ["isActive"])
    .index("by_organization", ["organizationId"]),

  // ---- Dashboard Settings (admin-managed) ------------------------------------
  // Stores per-organisation configuration for the main dashboard page.
  // Controls which stat cards, widgets, chart types, colors and captions are shown.
  dashboardSettings: defineTable({
    organizationId: v.id("organizations"),
    // Which stat cards are enabled (keys match StatCardKey type)
    enabledStats: v.array(v.string()),
    // Layout: "default" | "compact" | "wide"
    layout: v.string(),
    // Color scheme for stat cards: "default" | "monochrome" | "vibrant" | "pastel"
    colorScheme: v.string(),
    // Chart display model: "bar" | "line" | "area" | "pie"
    chartType: v.string(),
    // Whether to show trend indicators on stat cards
    showTrends: v.boolean(),
    // Whether to show the welcome greeting banner
    showGreeting: v.boolean(),
    // Whether to show the quick access grid
    showQuickAccess: v.boolean(),
    // Whether to show recent letters section
    showRecentLetters: v.boolean(),
    // Whether to show activity timeline
    showActivityTimeline: v.boolean(),
    // Whether to show pending dispositions
    showPendingDispositions: v.boolean(),
    // Whether to show upcoming events
    showUpcomingEvents: v.boolean(),
    // Whether to show announcements
    showAnnouncements: v.boolean(),
    // Whether to show celebrations banner
    showCelebrations: v.boolean(),
    // Custom caption for the dashboard header
    dashboardCaption: v.optional(v.string()),
    // Custom caption for the stats section
    statsCaption: v.optional(v.string()),
    // Custom caption for the chart section
    chartCaption: v.optional(v.string()),
    // Per-stat custom labels (JSON: { statKey: customLabel })
    customStatLabels: v.optional(v.record(v.string(), v.string())),
    updatedBy: v.id("users"),
    updatedAt: v.string(),
  })
    .index("by_organization", ["organizationId"]),
});
