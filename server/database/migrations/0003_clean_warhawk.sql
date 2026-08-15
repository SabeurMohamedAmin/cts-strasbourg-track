CREATE TABLE "blog_article_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"type" text NOT NULL,
	"src" text NOT NULL,
	"alt" text
);
--> statement-breakpoint
CREATE TABLE "blog_article_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"locale" varchar(5) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_article_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"locale" varchar(5) NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"outro_title" text NOT NULL,
	"outro_text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"icon" text DEFAULT 'mdi-post-outline' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_category_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"locale" varchar(5) NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_media" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "blog_sections" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "blog_media" CASCADE;--> statement-breakpoint
DROP TABLE "blog_sections" CASCADE;--> statement-breakpoint
DROP INDEX "blog_articles_category_idx";--> statement-breakpoint
ALTER TABLE "blog_articles" ADD COLUMN "category_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_articles" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_articles" ADD COLUMN "hero_image_url" text NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_article_media" ADD CONSTRAINT "blog_article_media_article_id_blog_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."blog_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_article_sections" ADD CONSTRAINT "blog_article_sections_article_id_blog_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."blog_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_article_translations" ADD CONSTRAINT "blog_article_translations_article_id_blog_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."blog_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_category_translations" ADD CONSTRAINT "blog_category_translations_category_id_blog_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."blog_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blog_article_media_article_idx" ON "blog_article_media" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "blog_article_sections_article_locale_idx" ON "blog_article_sections" USING btree ("article_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_article_translations_article_locale_idx" ON "blog_article_translations" USING btree ("article_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_categories_slug_idx" ON "blog_categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_category_translations_category_locale_idx" ON "blog_category_translations" USING btree ("category_id","locale");--> statement-breakpoint
ALTER TABLE "blog_articles" ADD CONSTRAINT "blog_articles_category_id_blog_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."blog_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blog_articles_category_id_idx" ON "blog_articles" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "blog_articles_status_idx" ON "blog_articles" USING btree ("status");--> statement-breakpoint
ALTER TABLE "blog_articles" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "blog_articles" DROP COLUMN "excerpt";--> statement-breakpoint
ALTER TABLE "blog_articles" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "blog_articles" DROP COLUMN "icon";--> statement-breakpoint
ALTER TABLE "blog_articles" DROP COLUMN "image_url";--> statement-breakpoint
ALTER TABLE "blog_articles" DROP COLUMN "outro_title";--> statement-breakpoint
ALTER TABLE "blog_articles" DROP COLUMN "outro_text";--> statement-breakpoint
ALTER TABLE "blog_articles" DROP COLUMN "published";