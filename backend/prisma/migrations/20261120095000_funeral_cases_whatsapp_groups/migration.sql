CREATE TYPE "FuneralCaseType" AS ENUM ('POLICY_COVERED', 'WALK_IN_COVERAGE');
CREATE TYPE "FuneralCaseStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "CoverageReviewStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'ACTIVE', 'GRACE', 'LAPSED', 'NOT_COVERED');
CREATE TYPE "WhatsAppCaseGroupStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'CREATING', 'ACTIVE', 'FAILED', 'CLOSED');
CREATE TYPE "WhatsAppCaseParticipantType" AS ENUM ('REPORTER', 'STAFF', 'RELATIVE');

CREATE TABLE "funeral_cases" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "case_type" "FuneralCaseType" NOT NULL,
    "status" "FuneralCaseStatus" NOT NULL DEFAULT 'NEW',
    "reporter_user_id" UUID NOT NULL,
    "reporter_name" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "deceased_name" TEXT,
    "date_of_death" DATE,
    "service_location" TEXT,
    "funeral_at" TIMESTAMP(3),
    "funeral_location" TEXT,
    "requested_plan" TEXT,
    "application_channel" TEXT,
    "application_location" TEXT,
    "requested_services" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "policy_number" TEXT,
    "coverage_review_status" "CoverageReviewStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "assigned_staff_user_id" UUID,
    "whatsapp_consent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "funeral_cases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "funeral_cases_reference_key" ON "funeral_cases"("reference");
CREATE INDEX "funeral_cases_reporter_user_id_created_at_idx" ON "funeral_cases"("reporter_user_id", "created_at");
CREATE INDEX "funeral_cases_status_created_at_idx" ON "funeral_cases"("status", "created_at");
CREATE INDEX "funeral_cases_assigned_staff_user_id_status_idx" ON "funeral_cases"("assigned_staff_user_id", "status");
ALTER TABLE "funeral_cases" ADD CONSTRAINT "funeral_cases_reporter_user_id_fkey"
  FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "funeral_cases" ADD CONSTRAINT "funeral_cases_assigned_staff_user_id_fkey"
  FOREIGN KEY ("assigned_staff_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "funeral_cases" ADD CONSTRAINT "funeral_cases_policy_number_fkey"
  FOREIGN KEY ("policy_number") REFERENCES "policy_records"("policy_number") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "whatsapp_case_groups" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "status" "WhatsAppCaseGroupStatus" NOT NULL DEFAULT 'PENDING',
    "group_jid" TEXT,
    "group_name" TEXT NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "whatsapp_case_groups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "whatsapp_case_groups_case_id_key" ON "whatsapp_case_groups"("case_id");
CREATE UNIQUE INDEX "whatsapp_case_groups_group_jid_key" ON "whatsapp_case_groups"("group_jid");
CREATE INDEX "whatsapp_case_groups_status_updated_at_idx" ON "whatsapp_case_groups"("status", "updated_at");
ALTER TABLE "whatsapp_case_groups" ADD CONSTRAINT "whatsapp_case_groups_case_id_fkey"
  FOREIGN KEY ("case_id") REFERENCES "funeral_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "whatsapp_case_participants" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "group_id" UUID,
    "phone_number" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "relationship" TEXT,
    "participant_type" "WhatsAppCaseParticipantType" NOT NULL,
    "consent_at" TIMESTAMP(3),
    "added_at" TIMESTAMP(3),
    "removed_at" TIMESTAMP(3),
    "added_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "whatsapp_case_participants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "whatsapp_case_participants_case_id_phone_number_key" ON "whatsapp_case_participants"("case_id", "phone_number");
CREATE INDEX "whatsapp_case_participants_group_id_idx" ON "whatsapp_case_participants"("group_id");
CREATE INDEX "whatsapp_case_participants_case_id_participant_type_idx" ON "whatsapp_case_participants"("case_id", "participant_type");
ALTER TABLE "whatsapp_case_participants" ADD CONSTRAINT "whatsapp_case_participants_case_id_fkey"
  FOREIGN KEY ("case_id") REFERENCES "funeral_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "whatsapp_case_participants" ADD CONSTRAINT "whatsapp_case_participants_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "whatsapp_case_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "whatsapp_case_participants" ADD CONSTRAINT "whatsapp_case_participants_added_by_user_id_fkey"
  FOREIGN KEY ("added_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
