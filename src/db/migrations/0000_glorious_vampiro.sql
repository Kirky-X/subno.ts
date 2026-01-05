CREATE SCHEMA "subno";
--> statement-breakpoint
CREATE TABLE "subno"."api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"key_prefix" varchar(8) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"name" varchar(255),
	"permissions" jsonb DEFAULT '["read"]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "subno"."audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"action" varchar(50) NOT NULL,
	"channel_id" varchar(255),
	"key_id" varchar(255),
	"message_id" varchar(255),
	"user_id" varchar(255),
	"ip" varchar(45),
	"user_agent" text,
	"success" boolean DEFAULT true NOT NULL,
	"error" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "subno"."channels" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"description" text,
	"type" varchar(20) DEFAULT 'public' NOT NULL,
	"creator" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "subno"."messages" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"channel" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"encrypted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subno"."public_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" varchar(255) NOT NULL,
	"public_key" text NOT NULL,
	"algorithm" varchar(50) DEFAULT 'RSA-2048' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"metadata" jsonb,
	CONSTRAINT "public_keys_channel_id_unique" UNIQUE("channel_id")
);
--> statement-breakpoint
CREATE INDEX "idx_api_keys_user_id" ON "subno"."api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_api_keys_key_prefix" ON "subno"."api_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX "idx_api_keys_is_active" ON "subno"."api_keys" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "subno"."audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_channel_id" ON "subno"."audit_logs" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "subno"."audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_key_id" ON "subno"."audit_logs" USING btree ("key_id");--> statement-breakpoint
CREATE INDEX "idx_channels_type" ON "subno"."channels" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_channels_expires_at" ON "subno"."channels" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_channels_is_active" ON "subno"."channels" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_messages_channel" ON "subno"."messages" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "idx_messages_created_at" ON "subno"."messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_public_keys_expires_at" ON "subno"."public_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_public_keys_channel_id" ON "subno"."public_keys" USING btree ("channel_id");