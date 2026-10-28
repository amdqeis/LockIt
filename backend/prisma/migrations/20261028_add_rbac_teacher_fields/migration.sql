-- CreateEnum
CREATE TYPE "TeacherRole" AS ENUM ('TEACHER', 'ADMIN');

-- AlterTable: additive only — safe for existing data
ALTER TABLE "teachers"
  ADD COLUMN "role" "TeacherRole" NOT NULL DEFAULT 'TEACHER',
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "phone" VARCHAR(20),
  ADD COLUMN "last_login_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "teachers_role_idx" ON "teachers"("role");
CREATE INDEX "teachers_is_active_idx" ON "teachers"("is_active");
