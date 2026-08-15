CREATE TABLE "blog_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"category" text NOT NULL,
	"icon" text DEFAULT 'mdi-post-outline' NOT NULL,
	"published_at" text NOT NULL,
	"reading_minutes" integer DEFAULT 3 NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"nearest_stop" text NOT NULL,
	"image_url" text NOT NULL,
	"outro_title" text NOT NULL,
	"outro_text" text NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"type" text NOT NULL,
	"src" text NOT NULL,
	"alt" text
);
--> statement-breakpoint
CREATE TABLE "blog_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stops" ADD COLUMN "stop_code" text;--> statement-breakpoint
ALTER TABLE "blog_media" ADD CONSTRAINT "blog_media_article_id_blog_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."blog_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_sections" ADD CONSTRAINT "blog_sections_article_id_blog_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."blog_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blog_articles_slug_idx" ON "blog_articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "blog_articles_category_idx" ON "blog_articles" USING btree ("category");--> statement-breakpoint
CREATE INDEX "blog_articles_published_at_idx" ON "blog_articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "blog_media_article_idx" ON "blog_media" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "blog_sections_article_idx" ON "blog_sections" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "stops_code_idx" ON "stops" USING btree ("stop_code");