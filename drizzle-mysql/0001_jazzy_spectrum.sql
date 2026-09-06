CREATE TABLE `feedback` (
	`id` varchar(36) NOT NULL,
	`author_id` varchar(36) NOT NULL,
	`category` enum('bug','suggestion','other') NOT NULL,
	`body` text NOT NULL,
	`status` enum('open','resolved') NOT NULL DEFAULT 'open',
	`created_at` datetime(3) NOT NULL,
	`resolved_at` datetime(3),
	`resolved_by_id` varchar(36),
	CONSTRAINT `feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `feedback` ADD CONSTRAINT `feedback_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `feedback` ADD CONSTRAINT `feedback_resolved_by_id_users_id_fk` FOREIGN KEY (`resolved_by_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_feedback_status_created` ON `feedback` (`status`,`created_at`);