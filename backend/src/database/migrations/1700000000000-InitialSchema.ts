import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── ENUM Types ───────────────────────────────────────────────────────────

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "user_category_enum" AS ENUM ('farmer','fpo','student','volunteer','ngo');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "verification_status_enum" AS ENUM ('pending','manual_review','verified','suspended','banned');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "user_role_enum" AS ENUM ('user','admin','super_admin');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "question_status_enum" AS ENUM ('pending','ai_review','human_review','approved','rejected');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "media_type_enum" AS ENUM ('none','image','video','audio');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "season_enum" AS ENUM ('kharif','rabi','zaid','year_round');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "transaction_type_enum" AS ENUM ('credit','debit');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "transaction_source_enum" AS ENUM ('reward','withdrawal','refund','adjustment');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "transaction_status_enum" AS ENUM ('pending','completed','failed','reversed');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payout_method_enum" AS ENUM ('upi','bank_transfer');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "withdrawal_status_enum" AS ENUM ('pending','processing','completed','failed');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "violation_type_enum" AS ENUM ('duplicate','spam','abuse');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "penalty_type_enum" AS ENUM ('warning','suspension','ban');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "actor_type_enum" AS ENUM ('user','admin','system');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // ─── Users Table ──────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "mobile_number" varchar(15) NOT NULL,
        "name" varchar(255) NOT NULL,
        "role" varchar(20) NOT NULL DEFAULT 'user',
        "category" varchar(20) NOT NULL,
        "state" varchar(100) NOT NULL,
        "district" varchar(100) NOT NULL,
        "block" varchar(100),
        "language_preference" varchar(50) NOT NULL DEFAULT 'en',
        "otp_hash" varchar(255),
        "otp_expires_at" TIMESTAMP,
        "verification_status" varchar(30) NOT NULL DEFAULT 'pending',
        "profile_data" jsonb,
        "consent_given" boolean NOT NULL DEFAULT false,
        "consent_timestamp" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "last_login_at" TIMESTAMP,
        CONSTRAINT "UQ_users_mobile_number" UNIQUE ("mobile_number"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_users_mobile" ON "users" ("mobile_number");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_users_state" ON "users" ("state");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_users_category" ON "users" ("category");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_users_verification_status" ON "users" ("verification_status");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users" ("role");`);

    // ─── User Crop Details ────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_crop_details" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "crop_name" varchar(255) NOT NULL,
        "season" varchar(50),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_crop_details" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_crop_details_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_user_crops_user_id" ON "user_crop_details" ("user_id");`);

    // ─── Wallets ──────────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wallets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "balance" decimal(12,2) NOT NULL DEFAULT 0,
        "currency" varchar(10) NOT NULL DEFAULT 'INR',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_wallets_user_id" UNIQUE ("user_id"),
        CONSTRAINT "PK_wallets" PRIMARY KEY ("id"),
        CONSTRAINT "FK_wallets_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_wallets_user_id" ON "wallets" ("user_id");`);

    // ─── Questions ────────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "questions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "language" varchar(50) NOT NULL,
        "domain_category" varchar(100) NOT NULL,
        "season" varchar(50) NOT NULL,
        "crop_type" varchar(255) NOT NULL,
        "agro_climatic_zone" varchar(255),
        "state" varchar(100) NOT NULL,
        "district" varchar(100) NOT NULL,
        "block" varchar(100),
        "question_text" text NOT NULL,
        "media_type" varchar(10) NOT NULL DEFAULT 'none',
        "media_urls" jsonb,
        "device_info" jsonb,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "ai_confidence_score" decimal(5,2),
        "duplicate_flag" boolean NOT NULL DEFAULT false,
        "duplicate_of_id" uuid,
        "edit_window_closes_at" TIMESTAMP,
        "submitted_at" TIMESTAMP NOT NULL,
        "reviewed_at" TIMESTAMP,
        "reviewer_id" uuid,
        "rejection_reason" varchar(500),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_questions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_questions_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_questions_user_id" ON "questions" ("user_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_questions_status" ON "questions" ("status");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_questions_state" ON "questions" ("state");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_questions_crop_type" ON "questions" ("crop_type");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_questions_language" ON "questions" ("language");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_questions_domain_category" ON "questions" ("domain_category");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_questions_submitted_at" ON "questions" ("submitted_at");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_questions_duplicate_of" ON "questions" ("duplicate_of_id");`);

    // ─── Transactions ─────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "transactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "wallet_id" uuid NOT NULL,
        "type" varchar(10) NOT NULL,
        "source" varchar(20) NOT NULL,
        "amount" decimal(12,2) NOT NULL,
        "balance_after" decimal(12,2) NOT NULL,
        "reference_id" uuid,
        "description" varchar(500),
        "status" varchar(20) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transactions_wallet" FOREIGN KEY ("wallet_id")
          REFERENCES "wallets"("id") ON DELETE RESTRICT
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_transactions_wallet_id" ON "transactions" ("wallet_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_transactions_created_at" ON "transactions" ("created_at");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_transactions_reference_id" ON "transactions" ("reference_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_transactions_status" ON "transactions" ("status");`);

    // ─── Withdrawal Requests ──────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "withdrawal_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "wallet_id" uuid NOT NULL,
        "amount" decimal(12,2) NOT NULL,
        "payout_method" varchar(20) NOT NULL,
        "payout_details" jsonb NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "processed_at" TIMESTAMP,
        "failure_reason" varchar(500),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_withdrawal_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_withdrawal_requests_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_withdrawal_requests_wallet" FOREIGN KEY ("wallet_id")
          REFERENCES "wallets"("id") ON DELETE RESTRICT
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_withdrawals_user_id" ON "withdrawal_requests" ("user_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_withdrawals_status" ON "withdrawal_requests" ("status");`);

    // ─── Audit Logs ───────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "actor_type" varchar(10) NOT NULL,
        "actor_id" uuid,
        "action" varchar(100) NOT NULL,
        "entity_type" varchar(100),
        "entity_id" uuid,
        "old_value" jsonb,
        "new_value" jsonb,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_actor" ON "audit_logs" ("actor_type", "actor_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_entity" ON "audit_logs" ("entity_type", "entity_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_action" ON "audit_logs" ("action");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_created_at" ON "audit_logs" ("created_at");`);

    // ─── Admin Config ─────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_config" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" varchar(255) NOT NULL,
        "value" jsonb NOT NULL,
        "description" varchar(500),
        "updated_by" uuid,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_admin_config_key" UNIQUE ("key"),
        CONSTRAINT "PK_admin_config" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_admin_config_key" ON "admin_config" ("key");`);

    // ─── Trigger: auto-update updated_at ──────────────────────────────────────

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TRIGGER update_users_updated_at
          BEFORE UPDATE ON "users"
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TRIGGER update_wallets_updated_at
          BEFORE UPDATE ON "wallets"
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_users_updated_at ON "users";`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_wallets_updated_at ON "wallets";`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column();`);
    await queryRunner.query(`DROP TABLE IF EXISTS "withdrawal_requests";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transactions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "questions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wallets";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_crop_details";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_config";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_category_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "verification_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "question_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "media_type_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "season_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "transaction_type_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "transaction_source_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "transaction_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payout_method_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "withdrawal_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "violation_type_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "penalty_type_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "actor_type_enum";`);
  }
}