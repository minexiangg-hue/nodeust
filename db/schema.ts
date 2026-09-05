import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    identityId: text('identity_id').notNull(),
    email: text('email').notNull(),
    affiliation: text('affiliation', {
      enum: ['student', 'staff', 'faculty'],
    }).notNull(),
    fullName: text('full_name').notNull(),
    nickname: text('nickname').notNull(),
    anonymousAlias: text('anonymous_alias').notNull(),
    department: text('department'),
    programme: text('programme'),
    yearOfStudy: text('year_of_study'),
    bio: text('bio'),
    avatarSeed: text('avatar_seed'),
    contactMethod: text('contact_method'),
    contactValue: text('contact_value'),
    currentLocationId: text('current_location_id'),
    locationUpdatedAt: integer('location_updated_at', {
      mode: 'timestamp_ms',
    }),
    profileVisibility: text('profile_visibility', {
      enum: ['private', 'mutual'],
    })
      .notNull()
      .default('private'),
    preferredLanguage: text('preferred_language').notNull().default('zh-CN'),
    role: text('role', { enum: ['member', 'moderator', 'admin', 'owner'] })
      .notNull()
      .default('member'),
    status: text('status', { enum: ['active', 'suspended', 'banned'] })
      .notNull()
      .default('active'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('idx_users_identity_id').on(table.identityId),
    uniqueIndex('idx_users_email').on(table.email),
    index('idx_users_status_role').on(table.status, table.role),
  ],
);

export const posts = sqliteTable(
  'posts',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id),
    category: text('category', {
      enum: ['hall', 'goods', 'study', 'other'],
    }).notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    locationId: text('location_id'),
    currentHall: text('current_hall'),
    targetHall: text('target_hall'),
    roomType: text('room_type'),
    genderEligibility: text('gender_eligibility'),
    availableFrom: text('available_from'),
    status: text('status', { enum: ['active', 'matched', 'closed', 'removed'] })
      .notNull()
      .default('active'),
    replyCount: integer('reply_count').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_posts_status_category_created').on(
      table.status,
      table.category,
      table.createdAt,
    ),
    index('idx_posts_swap_route').on(
      table.category,
      table.currentHall,
      table.targetHall,
      table.status,
    ),
    index('idx_posts_owner_status').on(table.ownerId, table.status),
    index('idx_posts_location_status_created').on(
      table.locationId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const announcements = sqliteTable(
  'announcements',
  {
    id: text('id').primaryKey(),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    body: text('body').notNull(),
    kind: text('kind', { enum: ['info', 'maintenance', 'upgrade'] })
      .notNull()
      .default('info'),
    status: text('status', { enum: ['draft', 'published', 'archived'] })
      .notNull()
      .default('published'),
    startsAt: integer('starts_at', { mode: 'timestamp_ms' }),
    endsAt: integer('ends_at', { mode: 'timestamp_ms' }),
    publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_announcements_status_window').on(
      table.status,
      table.startsAt,
      table.endsAt,
    ),
    index('idx_announcements_published').on(table.status, table.publishedAt),
  ],
);

export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    postId: text('post_id').references(() => posts.id),
    status: text('status', { enum: ['active', 'closed', 'blocked'] })
      .notNull()
      .default('active'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_conversations_post_status').on(table.postId, table.status),
  ],
);

export const conversationParticipants = sqliteTable(
  'conversation_participants',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    isBlocked: integer('is_blocked', { mode: 'boolean' })
      .notNull()
      .default(false),
    joinedAt: integer('joined_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('idx_participants_conversation_user').on(
      table.conversationId,
      table.userId,
    ),
    index('idx_participants_user').on(table.userId, table.conversationId),
  ],
);

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id),
    senderId: text('sender_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    kind: text('kind', {
      enum: ['message', 'system', 'contact_request', 'contact_reveal'],
    })
      .notNull()
      .default('message'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_messages_conversation_created').on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export const contactExchangeRequests = sqliteTable(
  'contact_exchange_requests',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id),
    requesterId: text('requester_id')
      .notNull()
      .references(() => users.id),
    recipientId: text('recipient_id')
      .notNull()
      .references(() => users.id),
    requesterConsent: integer('requester_consent', { mode: 'boolean' })
      .notNull()
      .default(true),
    recipientConsent: integer('recipient_consent', { mode: 'boolean' })
      .notNull()
      .default(false),
    status: text('status', {
      enum: ['pending', 'accepted', 'declined', 'cancelled'],
    })
      .notNull()
      .default('pending'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('idx_contact_exchange_conversation_pair').on(
      table.conversationId,
      table.requesterId,
      table.recipientId,
    ),
    index('idx_contact_exchange_recipient_status').on(
      table.recipientId,
      table.status,
    ),
  ],
);

export const reports = sqliteTable(
  'reports',
  {
    id: text('id').primaryKey(),
    reporterId: text('reporter_id')
      .notNull()
      .references(() => users.id),
    targetType: text('target_type', {
      enum: ['post', 'message', 'user'],
    }).notNull(),
    targetId: text('target_id').notNull(),
    reason: text('reason', {
      enum: [
        'illegal',
        'hall_trade',
        'fraud',
        'harassment',
        'hate',
        'sexual',
        'privacy',
        'spam',
        'other',
      ],
    }).notNull(),
    details: text('details'),
    status: text('status', {
      enum: ['open', 'reviewing', 'resolved', 'dismissed'],
    })
      .notNull()
      .default('open'),
    assignedTo: text('assigned_to').references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    resolvedAt: integer('resolved_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('idx_reports_status_created').on(table.status, table.createdAt),
    index('idx_reports_target').on(table.targetType, table.targetId),
  ],
);

export const moderationActions = sqliteTable(
  'moderation_actions',
  {
    id: text('id').primaryKey(),
    moderatorId: text('moderator_id')
      .notNull()
      .references(() => users.id),
    targetType: text('target_type', {
      enum: ['post', 'message', 'user', 'report'],
    }).notNull(),
    targetId: text('target_id').notNull(),
    action: text('action', {
      enum: ['warn', 'remove', 'restore', 'suspend', 'ban', 'dismiss'],
    }).notNull(),
    reason: text('reason').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_moderation_target_created').on(
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
  ],
);
