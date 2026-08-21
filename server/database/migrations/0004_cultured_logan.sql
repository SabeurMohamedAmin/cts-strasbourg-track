CREATE TABLE "admin_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_password_resets" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "admin_credentials_username_idx" ON "admin_credentials" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_password_resets_token_hash_idx" ON "admin_password_resets" USING btree ("token_hash");