CREATE TABLE `albums` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`cover_media_id` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `albums_tree_idx` ON `albums` (`tree_id`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`user_id` text,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`changes` text,
	`summary` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_tree_created_idx` ON `audit_log` (`tree_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `clans` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name_mn` text NOT NULL,
	`name_en` text NOT NULL,
	`summary_mn` text,
	`summary_en` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clans_slug_unique` ON `clans` (`slug`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`person_id` text,
	`partnership_id` text,
	`type` text NOT NULL,
	`title` text,
	`description` text,
	`date_year` integer,
	`date_month` integer,
	`date_day` integer,
	`date_qualifier` text,
	`place` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`partnership_id`) REFERENCES `partnerships`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `events_tree_idx` ON `events` (`tree_id`,`date_year`);--> statement-breakpoint
CREATE INDEX `events_person_idx` ON `events` (`person_id`);--> statement-breakpoint
CREATE TABLE `friend_access` (
	`tree_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_at` integer NOT NULL,
	`decided_by` text,
	`decided_at` integer,
	PRIMARY KEY(`tree_id`, `user_id`),
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `friend_access_user_idx` ON `friend_access` (`user_id`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`kind` text NOT NULL,
	`token` text NOT NULL,
	`email` text,
	`role` text DEFAULT 'viewer' NOT NULL,
	`person_id` text,
	`message` text,
	`created_by` text NOT NULL,
	`expires_at` integer NOT NULL,
	`max_uses` integer,
	`use_count` integer DEFAULT 0 NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_token_unique` ON `invitations` (`token`);--> statement-breakpoint
CREATE INDEX `invitations_tree_idx` ON `invitations` (`tree_id`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`album_id` text,
	`kind` text NOT NULL,
	`r2_key` text NOT NULL,
	`thumb_key` text,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`original_name` text NOT NULL,
	`title` text,
	`description` text,
	`category` text DEFAULT 'other' NOT NULL,
	`date_year` integer,
	`date_month` integer,
	`date_day` integer,
	`date_qualifier` text,
	`place` text,
	`width` integer,
	`height` integer,
	`duration_sec` real,
	`status` text DEFAULT 'pending' NOT NULL,
	`upload_id` text,
	`uploaded_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `media_tree_created_idx` ON `media` (`tree_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `media_album_idx` ON `media` (`album_id`);--> statement-breakpoint
CREATE TABLE `media_persons` (
	`media_id` text NOT NULL,
	`person_id` text NOT NULL,
	PRIMARY KEY(`media_id`, `person_id`),
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `media_persons_person_idx` ON `media_persons` (`person_id`);--> statement-breakpoint
CREATE TABLE `notification_prefs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email_enabled` integer DEFAULT true NOT NULL,
	`push_enabled` integer DEFAULT false NOT NULL,
	`days_before` integer DEFAULT 1 NOT NULL,
	`kinds` text DEFAULT '["birthday","death_anniversary","wedding_anniversary"]' NOT NULL,
	`timezone` text DEFAULT 'Asia/Ulaanbaatar' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `parent_child` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`parent_id` text NOT NULL,
	`child_id` text NOT NULL,
	`type` text DEFAULT 'biological' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `parent_child_uq` ON `parent_child` (`parent_id`,`child_id`);--> statement-breakpoint
CREATE INDEX `parent_child_child_idx` ON `parent_child` (`child_id`);--> statement-breakpoint
CREATE INDEX `parent_child_tree_idx` ON `parent_child` (`tree_id`);--> statement-breakpoint
CREATE TABLE `partnerships` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`person1_id` text NOT NULL,
	`person2_id` text NOT NULL,
	`status` text DEFAULT 'married' NOT NULL,
	`start_year` integer,
	`start_month` integer,
	`start_day` integer,
	`start_qualifier` text,
	`end_year` integer,
	`end_month` integer,
	`end_day` integer,
	`end_qualifier` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person1_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person2_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `partnerships_tree_idx` ON `partnerships` (`tree_id`);--> statement-breakpoint
CREATE INDEX `partnerships_p1_idx` ON `partnerships` (`person1_id`);--> statement-breakpoint
CREATE INDEX `partnerships_p2_idx` ON `partnerships` (`person2_id`);--> statement-breakpoint
CREATE TABLE `person_custom_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`person_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `custom_fields_person_idx` ON `person_custom_fields` (`person_id`);--> statement-breakpoint
CREATE TABLE `persons` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`given_name` text NOT NULL,
	`patronymic` text,
	`clan_name` text,
	`clan_id` text,
	`maiden_name` text,
	`previous_names` text,
	`nicknames` text,
	`name_mongol_script` text,
	`gender` text DEFAULT 'unknown' NOT NULL,
	`ethnicity` text,
	`birth_year` integer,
	`birth_month` integer,
	`birth_day` integer,
	`birth_qualifier` text,
	`birth_place` text,
	`is_living` integer DEFAULT true NOT NULL,
	`death_year` integer,
	`death_month` integer,
	`death_day` integer,
	`death_qualifier` text,
	`death_place` text,
	`burial_place` text,
	`cause_of_death` text,
	`memorial` text,
	`residence` text,
	`education` text,
	`occupation` text,
	`workplaces` text,
	`military_service` text,
	`awards` text,
	`achievements` text,
	`hobbies` text,
	`favorites` text,
	`biography` text,
	`favorite_quote` text,
	`message_to_descendants` text,
	`contacts` text,
	`contacts_visibility` text DEFAULT 'private' NOT NULL,
	`profile_media_id` text,
	`user_id` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`clan_id`) REFERENCES `clans`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `persons_tree_idx` ON `persons` (`tree_id`);--> statement-breakpoint
CREATE INDEX `persons_user_idx` ON `persons` (`user_id`);--> statement-breakpoint
CREATE INDEX `persons_tree_name_idx` ON `persons` (`tree_id`,`given_name`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `push_user_idx` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `reminders_sent` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`ref_id` text NOT NULL,
	`occurrence` text NOT NULL,
	`days_before` integer NOT NULL,
	`channel` text NOT NULL,
	`sent_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reminders_sent_uq` ON `reminders_sent` (`user_id`,`kind`,`ref_id`,`occurrence`,`days_before`,`channel`);--> statement-breakpoint
CREATE TABLE `stories` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`person_id` text,
	`title` text NOT NULL,
	`description` text,
	`body` text,
	`media_id` text,
	`date_year` integer,
	`date_month` integer,
	`date_day` integer,
	`date_qualifier` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `stories_tree_idx` ON `stories` (`tree_id`);--> statement-breakpoint
CREATE INDEX `stories_person_idx` ON `stories` (`person_id`);--> statement-breakpoint
CREATE TABLE `tree_members` (
	`tree_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`person_id` text,
	`invited_by` text,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`tree_id`, `user_id`),
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tree_members_person_uq` ON `tree_members` (`tree_id`,`person_id`);--> statement-breakpoint
CREATE INDEX `tree_members_user_idx` ON `tree_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `trees` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`privacy` text DEFAULT 'family' NOT NULL,
	`owner_id` text NOT NULL,
	`root_person_id` text,
	`clan_id` text,
	`cover_media_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`clan_id`) REFERENCES `clans`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `trees_owner_idx` ON `trees` (`owner_id`);--> statement-breakpoint
CREATE INDEX `trees_privacy_idx` ON `trees` (`privacy`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`display_name` text,
	`image_url` text,
	`locale` text DEFAULT 'mn' NOT NULL,
	`timezone` text DEFAULT 'Asia/Ulaanbaatar' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);