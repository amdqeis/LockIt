-- AlterTable
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "type" VARCHAR(50) NOT NULL DEFAULT 'single_choice';
