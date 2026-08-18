CREATE TABLE "disruptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"line_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stop_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"fcm_token" text NOT NULL,
	"platform" text NOT NULL,
	"favorite_line_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "disruptions_starts_at_idx" ON "disruptions" USING btree ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_fcm_token_idx" ON "devices" USING btree ("fcm_token");