CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`kind` text DEFAULT 'info' NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`published_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_announcements_status_window` ON `announcements` (`status`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `idx_announcements_published` ON `announcements` (`status`,`published_at`);