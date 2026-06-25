CREATE TABLE IF NOT EXISTS "daily_challenges" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"goal" integer NOT NULL,
	"xp_reward" integer NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_challenge_progress" (
	"user_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE cascade,
	"date" date NOT NULL,
	"challenge_id" bigint NOT NULL REFERENCES "public"."daily_challenges"("id") ON DELETE cascade,
	"current" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_challenge_progress_user_id_date_pk" PRIMARY KEY("user_id","date")
);
