CREATE TABLE "calendar" (
	"service_id" text PRIMARY KEY NOT NULL,
	"monday" boolean NOT NULL,
	"tuesday" boolean NOT NULL,
	"wednesday" boolean NOT NULL,
	"thursday" boolean NOT NULL,
	"friday" boolean NOT NULL,
	"saturday" boolean NOT NULL,
	"sunday" boolean NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_dates" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"date" text NOT NULL,
	"exception_type" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"route_id" text PRIMARY KEY NOT NULL,
	"agency_id" text,
	"route_short_name" text NOT NULL,
	"route_long_name" text,
	"route_type" integer NOT NULL,
	"route_color" text,
	"route_text_color" text,
	"route_desc" text
);
--> statement-breakpoint
CREATE TABLE "shapes" (
	"id" text PRIMARY KEY NOT NULL,
	"shape_id" text NOT NULL,
	"shape_pt_lat" real NOT NULL,
	"shape_pt_lon" real NOT NULL,
	"shape_pt_sequence" integer NOT NULL,
	"shape_dist_traveled" real
);
--> statement-breakpoint
CREATE TABLE "stop_times" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"arrival_time" text NOT NULL,
	"departure_time" text NOT NULL,
	"stop_id" text NOT NULL,
	"stop_sequence" integer NOT NULL,
	"stop_headsign" text,
	"pickup_type" integer DEFAULT 0,
	"drop_off_type" integer DEFAULT 0,
	"shape_dist_traveled" text,
	"timepoint" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "stops" (
	"stop_id" text PRIMARY KEY NOT NULL,
	"stop_name" text NOT NULL,
	"stop_lat" real NOT NULL,
	"stop_lon" real NOT NULL,
	"location_type" integer DEFAULT 0,
	"parent_station" text,
	"wheelchair_boarding" integer DEFAULT 0,
	"platform_code" text
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"trip_id" text PRIMARY KEY NOT NULL,
	"route_id" text NOT NULL,
	"service_id" text NOT NULL,
	"shape_id" text,
	"trip_headsign" text,
	"direction_id" integer,
	"block_id" text,
	"wheelchair_accessible" integer DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX "shapes_shape_id_idx" ON "shapes" USING btree ("shape_id");--> statement-breakpoint
CREATE INDEX "stop_times_trip_id_idx" ON "stop_times" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "stop_times_stop_id_idx" ON "stop_times" USING btree ("stop_id");--> statement-breakpoint
CREATE INDEX "stops_lat_idx" ON "stops" USING btree ("stop_lat");--> statement-breakpoint
CREATE INDEX "stops_lon_idx" ON "stops" USING btree ("stop_lon");--> statement-breakpoint
CREATE INDEX "stops_name_idx" ON "stops" USING btree ("stop_name");--> statement-breakpoint
CREATE INDEX "trips_route_id_idx" ON "trips" USING btree ("route_id");--> statement-breakpoint
CREATE INDEX "trips_service_id_idx" ON "trips" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "trips_shape_id_idx" ON "trips" USING btree ("shape_id");