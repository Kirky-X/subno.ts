CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"key_prefix" varchar(16) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"name" varchar(255) DEFAULT 'API Key' NOT NULL,
	"permissions" jsonb DEFAULT '["read","write"]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"revoked_at" timestamp,
	"revoked_by" varchar(255),
	"revocation_reason" text,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" varchar(100) NOT NULL,
	"channel_id" varchar(64),
	"key_id" uuid,
	"api_key_id" uuid,
	"message_id" varchar(128),
	"user_id" varchar(255),
	"ip" varchar(45),
	"user_agent" varchar(512),
	"success" boolean DEFAULT true NOT NULL,
	"error" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" varchar(20) DEFAULT 'public' NOT NULL,
	"creator" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"channel_id" varchar(64) NOT NULL,
	"content" text NOT NULL,
	"priority" integer DEFAULT 50 NOT NULL,
	"sender" varchar(255),
	"encrypted" boolean DEFAULT false NOT NULL,
	"cached" boolean DEFAULT true NOT NULL,
	"signature" varchar(512),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "notification_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_id" uuid NOT NULL,
	"channel_id" varchar(64),
	"notification_type" varchar(50) NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"delivery_status" varchar(20),
	"error_details" jsonb,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" varchar(64) NOT NULL,
	"public_key" text NOT NULL,
	"algorithm" varchar(50) DEFAULT 'RSA-2048' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"last_used_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"revoked_at" timestamp,
	"revoked_by" varchar(255),
	"revocation_reason" text,
	CONSTRAINT "public_keys_channel_id_unique" UNIQUE("channel_id")
);
--> statement-breakpoint
CREATE TABLE "revocation_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_id" uuid NOT NULL,
	"api_key_id" uuid,
	"confirmation_code_hash" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reason" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp,
	"confirmed_by" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "notification_history" ADD CONSTRAINT "notification_history_key_id_public_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."public_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revocation_confirmations" ADD CONSTRAINT "revocation_confirmations_key_id_public_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."public_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revocation_confirmations" ADD CONSTRAINT "revocation_confirmations_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_api_keys_user_id" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_api_keys_active" ON "api_keys" USING btree ("is_active","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_api_keys_deleted" ON "api_keys" USING btree ("is_deleted","revoked_at");--> statement-breakpoint
CREATE INDEX "idx_audit_action" ON "audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_key_id" ON "audit_logs" USING btree ("key_id");--> statement-breakpoint
CREATE INDEX "idx_audit_channel_id" ON "audit_logs" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_audit_user_id" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_channels_name" ON "channels" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_channels_type" ON "channels" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_channels_creator" ON "channels" USING btree ("creator");--> statement-breakpoint
CREATE INDEX "idx_channels_active" ON "channels" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_messages_channel_id" ON "messages" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_messages_created_at" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_priority" ON "messages" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_messages_channel_created" ON "messages" USING btree ("channel_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_key_id" ON "notification_history" USING btree ("key_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_channel_id" ON "notification_history" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_type" ON "notification_history" USING btree ("notification_type");--> statement-breakpoint
CREATE INDEX "idx_notifications_status" ON "notification_history" USING btree ("delivery_status");--> statement-breakpoint
CREATE INDEX "idx_notifications_sent_at" ON "notification_history" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_public_keys_channel" ON "public_keys" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_public_keys_deleted" ON "public_keys" USING btree ("is_deleted","revoked_at");--> statement-breakpoint
CREATE INDEX "idx_public_keys_active" ON "public_keys" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "idx_public_keys_algorithm" ON "public_keys" USING btree ("algorithm");--> statement-breakpoint
CREATE INDEX "idx_revocations_status" ON "revocation_confirmations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_revocations_expires" ON "revocation_confirmations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_revocations_key_id" ON "revocation_confirmations" USING btree ("key_id");--> statement-breakpoint
CREATE INDEX "idx_revocations_api_key_id" ON "revocation_confirmations" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "idx_revocations_status_expires" ON "revocation_confirmations" USING btree ("status","expires_at");