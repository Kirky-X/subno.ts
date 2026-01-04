CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"action" varchar(50) NOT NULL,
	"channel_id" varchar(255),
	"ip_address" varchar(45),
	"user_agent" text,
	"status" varchar(20),
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"description" text,
	"type" varchar(20) NOT NULL,
	"creator" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"channel" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"encrypted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_keys" (
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
CREATE INDEX "idx_audit_logs_timestamp" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_channel_id" ON "audit_logs" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_channels_type" ON "channels" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_messages_channel" ON "messages" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "idx_messages_created_at" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_public_keys_expires_at" ON "public_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_public_keys_channel_id" ON "public_keys" USING btree ("channel_id");