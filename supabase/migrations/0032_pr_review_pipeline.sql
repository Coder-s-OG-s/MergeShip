DO $$ BEGIN
 CREATE TYPE "public"."review_stage" AS ENUM('mentor_approval', 'l2_approval', 'l3_approval', 'maintainer_approval');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'changes_requested', 'dismissed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE "pull_request_pipeline_stages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"pr_id" bigint NOT NULL,
	"review_id" bigint,
	"stage_type" "public"."review_stage" NOT NULL,
	"status" "public"."review_status" NOT NULL,
	"reviewer_user_id" uuid,
	"reviewer_level_snapshot" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "pull_request_pipeline_stages" ADD CONSTRAINT "pull_request_pipeline_stages_pr_id_pull_requests_id_fk" FOREIGN KEY ("pr_id") REFERENCES "public"."pull_requests"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "pull_request_pipeline_stages" ADD CONSTRAINT "pull_request_pipeline_stages_review_id_pull_request_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."pull_request_reviews"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "pull_request_pipeline_stages" ADD CONSTRAINT "pull_request_pipeline_stages_reviewer_user_id_profiles_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;

CREATE UNIQUE INDEX "pull_request_pipeline_stages_pr_stage_idx" ON "pull_request_pipeline_stages" USING btree ("pr_id","stage_type");
CREATE INDEX "pull_request_pipeline_stages_pr_status_idx" ON "pull_request_pipeline_stages" USING btree ("pr_id","status");

ALTER TABLE "pull_request_pipeline_stages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read-only for pull_request_pipeline_stages" ON "pull_request_pipeline_stages" FOR SELECT USING (true);

GRANT ALL ON TABLE public.pull_request_pipeline_stages TO postgres, service_role;
GRANT SELECT ON TABLE public.pull_request_pipeline_stages TO authenticated, anon;
