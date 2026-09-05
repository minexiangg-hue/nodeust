import {
  boolean,
  datetime,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

const id = (name: string) => varchar(name, { length: 36 });
const instant = (name: string) => datetime(name, { mode: 'date', fsp: 3 });

export const users = mysqlTable(
  'users',
  {
    id: id('id').primaryKey(),
    identityId: varchar('identity_id', { length: 191 }).notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    affiliation: mysqlEnum('affiliation', [
      'student',
      'staff',
      'faculty',
    ]).notNull(),
    fullName: varchar('full_name', { length: 160 }).notNull(),
    nickname: varchar('nickname', { length: 80 }).notNull(),
    anonymousAlias: varchar('anonymous_alias', { length: 80 }).notNull(),
    department: varchar('department', { length: 160 }),
    programme: varchar('programme', { length: 160 }),
    yearOfStudy: varchar('year_of_study', { length: 40 }),
    bio: text('bio'),
    avatarSeed: varchar('avatar_seed', { length: 100 }),
    contactMethod: varchar('contact_method', { length: 40 }),
    contactValue: varchar('contact_value', { length: 255 }),
    currentLocationId: varchar('current_location_id', { length: 80 }),
    locationUpdatedAt: instant('location_updated_at'),
    profileVisibility: mysqlEnum('profile_visibility', ['private', 'mutual'])
      .notNull()
      .default('private'),
    preferredLanguage: mysqlEnum('preferred_language', ['en', 'zh-CN', 'zh-HK'])
      .notNull()
      .default('en'),
    role: mysqlEnum('role', ['member', 'moderator', 'admin', 'owner'])
      .notNull()
      .default('member'),
    status: mysqlEnum('status', ['active', 'suspended', 'banned'])
      .notNull()
      .default('active'),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_users_identity_id').on(table.identityId),
    uniqueIndex('idx_users_email').on(table.email),
    index('idx_users_status_role').on(table.status, table.role),
  ],
);

export const posts = mysqlTable(
  'posts',
  {
    id: id('id').primaryKey(),
    ownerId: id('owner_id')
      .notNull()
      .references(() => users.id),
    category: mysqlEnum('category', [
      'hall',
      'goods',
      'study',
      'other',
    ]).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body').notNull(),
    locationId: varchar('location_id', { length: 80 }),
    currentHall: varchar('current_hall', { length: 80 }),
    targetHall: varchar('target_hall', { length: 80 }),
    roomType: varchar('room_type', { length: 80 }),
    genderEligibility: varchar('gender_eligibility', { length: 80 }),
    availableFrom: varchar('available_from', { length: 80 }),
    status: mysqlEnum('status', ['active', 'matched', 'closed', 'removed'])
      .notNull()
      .default('active'),
    replyCount: int('reply_count').notNull().default(0),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
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

export const announcements = mysqlTable(
  'announcements',
  {
    id: id('id').primaryKey(),
    authorId: id('author_id')
      .notNull()
      .references(() => users.id),
    title: varchar('title', { length: 160 }).notNull(),
    body: text('body').notNull(),
    kind: mysqlEnum('kind', ['info', 'maintenance', 'upgrade'])
      .notNull()
      .default('info'),
    status: mysqlEnum('status', ['draft', 'published', 'archived'])
      .notNull()
      .default('published'),
    startsAt: instant('starts_at'),
    endsAt: instant('ends_at'),
    publishedAt: instant('published_at'),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
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

export const conversations = mysqlTable(
  'conversations',
  {
    id: id('id').primaryKey(),
    postId: id('post_id').references(() => posts.id),
    status: mysqlEnum('status', ['active', 'closed', 'blocked'])
      .notNull()
      .default('active'),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
  },
  (table) => [
    index('idx_conversations_post_status').on(table.postId, table.status),
  ],
);

export const conversationParticipants = mysqlTable(
  'conversation_participants',
  {
    id: id('id').primaryKey(),
    conversationId: id('conversation_id')
      .notNull()
      .references(() => conversations.id),
    userId: id('user_id')
      .notNull()
      .references(() => users.id),
    isBlocked: boolean('is_blocked').notNull().default(false),
    joinedAt: instant('joined_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_participants_conversation_user').on(
      table.conversationId,
      table.userId,
    ),
    index('idx_participants_user').on(table.userId, table.conversationId),
  ],
);

export const messages = mysqlTable(
  'messages',
  {
    id: id('id').primaryKey(),
    conversationId: id('conversation_id')
      .notNull()
      .references(() => conversations.id),
    senderId: id('sender_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    kind: mysqlEnum('kind', [
      'message',
      'system',
      'contact_request',
      'contact_reveal',
    ])
      .notNull()
      .default('message'),
    createdAt: instant('created_at').notNull(),
  },
  (table) => [
    index('idx_messages_conversation_created').on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export const contactExchangeRequests = mysqlTable(
  'contact_exchange_requests',
  {
    id: id('id').primaryKey(),
    conversationId: id('conversation_id')
      .notNull()
      .references(() => conversations.id),
    requesterId: id('requester_id')
      .notNull()
      .references(() => users.id),
    recipientId: id('recipient_id')
      .notNull()
      .references(() => users.id),
    requesterConsent: boolean('requester_consent').notNull().default(true),
    recipientConsent: boolean('recipient_consent').notNull().default(false),
    status: mysqlEnum('status', [
      'pending',
      'accepted',
      'declined',
      'cancelled',
    ])
      .notNull()
      .default('pending'),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
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

export const reports = mysqlTable(
  'reports',
  {
    id: id('id').primaryKey(),
    reporterId: id('reporter_id')
      .notNull()
      .references(() => users.id),
    targetType: mysqlEnum('target_type', ['post', 'message', 'user']).notNull(),
    targetId: varchar('target_id', { length: 80 }).notNull(),
    reason: mysqlEnum('reason', [
      'illegal',
      'hall_trade',
      'fraud',
      'harassment',
      'hate',
      'sexual',
      'privacy',
      'spam',
      'other',
    ]).notNull(),
    details: text('details'),
    status: mysqlEnum('status', ['open', 'reviewing', 'resolved', 'dismissed'])
      .notNull()
      .default('open'),
    assignedTo: id('assigned_to').references(() => users.id),
    createdAt: instant('created_at').notNull(),
    resolvedAt: instant('resolved_at'),
  },
  (table) => [
    index('idx_reports_status_created').on(table.status, table.createdAt),
    index('idx_reports_target').on(table.targetType, table.targetId),
  ],
);

export const moderationActions = mysqlTable(
  'moderation_actions',
  {
    id: id('id').primaryKey(),
    moderatorId: id('moderator_id')
      .notNull()
      .references(() => users.id),
    targetType: mysqlEnum('target_type', [
      'post',
      'message',
      'user',
      'report',
    ]).notNull(),
    targetId: varchar('target_id', { length: 80 }).notNull(),
    action: mysqlEnum('action', [
      'warn',
      'remove',
      'restore',
      'suspend',
      'ban',
      'dismiss',
    ]).notNull(),
    reason: varchar('reason', { length: 500 }).notNull(),
    createdAt: instant('created_at').notNull(),
  },
  (table) => [
    index('idx_moderation_target_created').on(
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
  ],
);
