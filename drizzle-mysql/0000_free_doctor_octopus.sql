CREATE TABLE `announcements` (
	`id` varchar(36) NOT NULL,
	`author_id` varchar(36) NOT NULL,
	`title` varchar(160) NOT NULL,
	`body` text NOT NULL,
	`kind` enum('info','maintenance','upgrade') NOT NULL DEFAULT 'info',
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'published',
	`starts_at` datetime(3),
	`ends_at` datetime(3),
	`published_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contact_exchange_requests` (
	`id` varchar(36) NOT NULL,
	`conversation_id` varchar(36) NOT NULL,
	`requester_id` varchar(36) NOT NULL,
	`recipient_id` varchar(36) NOT NULL,
	`requester_consent` boolean NOT NULL DEFAULT true,
	`recipient_consent` boolean NOT NULL DEFAULT false,
	`status` enum('pending','accepted','declined','cancelled') NOT NULL DEFAULT 'pending',
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `contact_exchange_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_contact_exchange_conversation_pair` UNIQUE(`conversation_id`,`requester_id`,`recipient_id`)
);
--> statement-breakpoint
CREATE TABLE `conversation_participants` (
	`id` varchar(36) NOT NULL,
	`conversation_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`is_blocked` boolean NOT NULL DEFAULT false,
	`joined_at` datetime(3) NOT NULL,
	CONSTRAINT `conversation_participants_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_participants_conversation_user` UNIQUE(`conversation_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` varchar(36) NOT NULL,
	`post_id` varchar(36),
	`status` enum('active','closed','blocked') NOT NULL DEFAULT 'active',
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` varchar(36) NOT NULL,
	`conversation_id` varchar(36) NOT NULL,
	`sender_id` varchar(36) NOT NULL,
	`body` text NOT NULL,
	`kind` enum('message','system','contact_request','contact_reveal') NOT NULL DEFAULT 'message',
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `moderation_actions` (
	`id` varchar(36) NOT NULL,
	`moderator_id` varchar(36) NOT NULL,
	`target_type` enum('post','message','user','report') NOT NULL,
	`target_id` varchar(80) NOT NULL,
	`action` enum('warn','remove','restore','suspend','ban','dismiss') NOT NULL,
	`reason` varchar(500) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `moderation_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` varchar(36) NOT NULL,
	`owner_id` varchar(36) NOT NULL,
	`category` enum('hall','goods','study','other') NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`location_id` varchar(80),
	`current_hall` varchar(80),
	`target_hall` varchar(80),
	`room_type` varchar(80),
	`gender_eligibility` varchar(80),
	`available_from` varchar(80),
	`status` enum('active','matched','closed','removed') NOT NULL DEFAULT 'active',
	`reply_count` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` varchar(36) NOT NULL,
	`reporter_id` varchar(36) NOT NULL,
	`target_type` enum('post','message','user') NOT NULL,
	`target_id` varchar(80) NOT NULL,
	`reason` enum('illegal','hall_trade','fraud','harassment','hate','sexual','privacy','spam','other') NOT NULL,
	`details` text,
	`status` enum('open','reviewing','resolved','dismissed') NOT NULL DEFAULT 'open',
	`assigned_to` varchar(36),
	`created_at` datetime(3) NOT NULL,
	`resolved_at` datetime(3),
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`identity_id` varchar(191) NOT NULL,
	`email` varchar(320) NOT NULL,
	`affiliation` enum('student','staff','faculty') NOT NULL,
	`full_name` varchar(160) NOT NULL,
	`nickname` varchar(80) NOT NULL,
	`anonymous_alias` varchar(80) NOT NULL,
	`department` varchar(160),
	`programme` varchar(160),
	`year_of_study` varchar(40),
	`bio` text,
	`avatar_seed` varchar(100),
	`contact_method` varchar(40),
	`contact_value` varchar(255),
	`current_location_id` varchar(80),
	`location_updated_at` datetime(3),
	`profile_visibility` enum('private','mutual') NOT NULL DEFAULT 'private',
	`preferred_language` enum('en','zh-CN','zh-HK') NOT NULL DEFAULT 'en',
	`role` enum('member','moderator','admin','owner') NOT NULL DEFAULT 'member',
	`status` enum('active','suspended','banned') NOT NULL DEFAULT 'active',
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_users_identity_id` UNIQUE(`identity_id`),
	CONSTRAINT `idx_users_email` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contact_exchange_requests` ADD CONSTRAINT `contact_exchange_requests_conversation_id_conversations_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contact_exchange_requests` ADD CONSTRAINT `contact_exchange_requests_requester_id_users_id_fk` FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contact_exchange_requests` ADD CONSTRAINT `contact_exchange_requests_recipient_id_users_id_fk` FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversation_participants` ADD CONSTRAINT `conversation_participants_conversation_id_conversations_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversation_participants` ADD CONSTRAINT `conversation_participants_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversation_id_conversations_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_sender_id_users_id_fk` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `moderation_actions` ADD CONSTRAINT `moderation_actions_moderator_id_users_id_fk` FOREIGN KEY (`moderator_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_reporter_id_users_id_fk` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_assigned_to_users_id_fk` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_announcements_status_window` ON `announcements` (`status`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `idx_announcements_published` ON `announcements` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_contact_exchange_recipient_status` ON `contact_exchange_requests` (`recipient_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_participants_user` ON `conversation_participants` (`user_id`,`conversation_id`);--> statement-breakpoint
CREATE INDEX `idx_conversations_post_status` ON `conversations` (`post_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_messages_conversation_created` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_moderation_target_created` ON `moderation_actions` (`target_type`,`target_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_posts_status_category_created` ON `posts` (`status`,`category`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_posts_swap_route` ON `posts` (`category`,`current_hall`,`target_hall`,`status`);--> statement-breakpoint
CREATE INDEX `idx_posts_owner_status` ON `posts` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_posts_location_status_created` ON `posts` (`location_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_reports_status_created` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_reports_target` ON `reports` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `idx_users_status_role` ON `users` (`status`,`role`);