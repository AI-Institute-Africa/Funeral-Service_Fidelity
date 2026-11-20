-- Enable phone-first OTP accounts and validated, staged policy workbook imports.
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "phone_number" TEXT;
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");
ALTER TABLE "customer_profiles" ADD COLUMN "preferred_language" TEXT NOT NULL DEFAULT 'en';

CREATE TYPE "PolicyRecordStatus" AS ENUM ('ACTIVE', 'GRACE', 'LAPSED');

CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "otp_challenges_phone_purpose_key" ON "otp_challenges"("phone", "purpose");
CREATE INDEX "otp_challenges_expires_at_idx" ON "otp_challenges"("expires_at");

CREATE TABLE "policy_import_batches" (
    "id" UUID NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "layout" TEXT NOT NULL,
    "rows_read" INTEGER NOT NULL,
    "policies_added" INTEGER NOT NULL,
    "policies_updated" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREVIEW',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "committed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "policy_import_batches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "policy_import_batches_uploaded_by_user_id_created_at_idx" ON "policy_import_batches"("uploaded_by_user_id", "created_at");
CREATE INDEX "policy_import_batches_status_expires_at_idx" ON "policy_import_batches"("status", "expires_at");
ALTER TABLE "policy_import_batches" ADD CONSTRAINT "policy_import_batches_uploaded_by_user_id_fkey"
  FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "policy_records" (
    "policy_number" TEXT NOT NULL,
    "holder_name" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "status" "PolicyRecordStatus" NOT NULL,
    "plan_name" TEXT NOT NULL,
    "cover_amount" DECIMAL(12,2) NOT NULL,
    "monthly_premium" DECIMAL(12,2) NOT NULL,
    "start_date" DATE NOT NULL,
    "months_paid" INTEGER NOT NULL,
    "waiting_period_months" INTEGER NOT NULL,
    "source_batch_id" UUID NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "policy_records_pkey" PRIMARY KEY ("policy_number")
);
CREATE INDEX "policy_records_phone_number_idx" ON "policy_records"("phone_number");
ALTER TABLE "policy_records" ADD CONSTRAINT "policy_records_source_batch_id_fkey"
  FOREIGN KEY ("source_batch_id") REFERENCES "policy_import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "policy_covered_members" (
    "id" UUID NOT NULL,
    "policy_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "share" DECIMAL(5,2),
    CONSTRAINT "policy_covered_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "policy_covered_members_policy_number_name_key" ON "policy_covered_members"("policy_number", "name");
ALTER TABLE "policy_covered_members" ADD CONSTRAINT "policy_covered_members_policy_number_fkey"
  FOREIGN KEY ("policy_number") REFERENCES "policy_records"("policy_number") ON DELETE CASCADE ON UPDATE CASCADE;
