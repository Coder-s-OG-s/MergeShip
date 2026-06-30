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

ALTER TABLE "announcements" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read-only for announcements" ON "announcements" FOR SELECT USING (true);

ALTER TABLE "mentor_sessions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own mentor sessions" ON "mentor_sessions" FOR SELECT USING (auth.uid() = user_id);

GRANT ALL ON TABLE public.announcements TO postgres, service_role;
GRANT SELECT ON TABLE public.announcements TO authenticated, anon;

GRANT ALL ON TABLE public.mentor_sessions TO postgres, service_role;
GRANT SELECT ON TABLE public.mentor_sessions TO authenticated;
