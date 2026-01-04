ALTER TABLE "channels" ADD COLUMN "expires_at" timestamp with time zone;
ALTER TABLE "channels" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_channels_expires_at" ON "channels" USING btree ("expires_at");
CREATE INDEX IF NOT EXISTS "idx_channels_is_active" ON "channels" USING btree ("is_active");
