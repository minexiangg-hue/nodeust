ALTER TABLE `posts` ADD `location_id` text;--> statement-breakpoint
CREATE INDEX `idx_posts_location_status_created` ON `posts` (`location_id`,`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `current_location_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `location_updated_at` integer;