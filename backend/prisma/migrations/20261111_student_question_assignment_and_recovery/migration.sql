-- Additive migration for student question assignment and violation recovery
ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "assigned_questions" JSONB,
  ADD COLUMN IF NOT EXISTS "recovery_required" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "recovered_cycle_count" INTEGER NOT NULL DEFAULT 0;

