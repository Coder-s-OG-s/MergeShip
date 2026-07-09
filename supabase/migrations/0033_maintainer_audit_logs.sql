CREATE TABLE IF NOT EXISTS "maintainer_audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_user_id" uuid,
	"actor_snapshot" jsonb,
	"installation_id" bigint,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"status" text DEFAULT 'success' NOT NULL,
	"error_message" text,
	"old_values" jsonb,
	"new_values" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "maintainer_audit_logs" ADD CONSTRAINT "maintainer_audit_logs_actor_user_id_profiles_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "maintainer_audit_logs" ADD CONSTRAINT "maintainer_audit_logs_installation_id_github_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."github_installations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "maintainer_audit_logs_installation_idx" ON "maintainer_audit_logs" USING btree ("installation_id","created_at");
CREATE INDEX IF NOT EXISTS "maintainer_audit_logs_actor_idx" ON "maintainer_audit_logs" USING btree ("actor_user_id","created_at");

ALTER TABLE "maintainer_audit_logs" ENABLE ROW LEVEL SECURITY;
-- no anon/authenticated grants - this table should only be touched via service role

