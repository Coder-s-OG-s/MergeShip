CREATE TABLE "announcements" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "mentor_sessions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"mentor_login" text NOT NULL,
	"scheduled_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "mentor_sessions" ADD CONSTRAINT "mentor_sessions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
