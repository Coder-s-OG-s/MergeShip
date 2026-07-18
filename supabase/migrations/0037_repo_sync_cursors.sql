CREATE TABLE IF NOT EXISTS "repo_sync_cursors" (
	"installation_id" bigint NOT NULL,
	"repo_full_name" text NOT NULL,
	"sync_type" text NOT NULL,
	"page" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repo_sync_cursors_installation_id_repo_full_name_sync_type_pk" PRIMARY KEY("installation_id","repo_full_name","sync_type")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "repo_sync_cursors" ADD CONSTRAINT "repo_sync_cursors_installation_id_github_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."github_installations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
