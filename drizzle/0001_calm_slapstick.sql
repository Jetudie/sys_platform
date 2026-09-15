CREATE TABLE `access_members` (
	`email` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`display_name` text,
	`role` text DEFAULT 'viewer' NOT NULL,
	`view_details` integer DEFAULT 1 NOT NULL,
	`view_topics` integer DEFAULT 0 NOT NULL,
	`view_spaces` integer DEFAULT 0 NOT NULL,
	`view_flows` integer DEFAULT 1 NOT NULL,
	`can_edit` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
