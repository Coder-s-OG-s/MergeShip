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

-- Enable RLS
ALTER TABLE "daily_challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_challenge_progress" ENABLE ROW LEVEL SECURITY;

-- Security Policies
DROP POLICY IF EXISTS daily_challenges_read_all ON daily_challenges;
CREATE POLICY daily_challenges_read_all ON daily_challenges FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS user_challenge_progress_read_own ON user_challenge_progress;
CREATE POLICY user_challenge_progress_read_own ON user_challenge_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Explicit Grants
GRANT ALL ON TABLE public.daily_challenges TO postgres, service_role;
GRANT SELECT ON TABLE public.daily_challenges TO authenticated, anon;

GRANT ALL ON TABLE public.user_challenge_progress TO postgres, service_role;
GRANT SELECT ON TABLE public.user_challenge_progress TO authenticated;

