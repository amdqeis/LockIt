-- CreateTable
CREATE TABLE "grade_levels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grade_levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "grade_levels_normalized_name_key" ON "grade_levels"("normalized_name");
CREATE INDEX "grade_levels_is_archived_idx" ON "grade_levels"("is_archived");

-- CreateTable
CREATE TABLE "classrooms" (
    "id" TEXT NOT NULL,
    "grade_level_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "classrooms_grade_level_id_normalized_name_key" ON "classrooms"("grade_level_id", "normalized_name");
CREATE INDEX "classrooms_is_archived_idx" ON "classrooms"("is_archived");

-- AddForeignKey
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_grade_level_id_fkey" FOREIGN KEY ("grade_level_id") REFERENCES "grade_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropIndex on subjects
DROP INDEX IF EXISTS "subjects_name_key";

-- AlterTable subjects
ALTER TABLE "subjects" ADD COLUMN "grade_level_id" TEXT,
ADD COLUMN "normalized_name" TEXT,
ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill normalized_name on subjects
UPDATE "subjects" SET "normalized_name" = LOWER(REGEXP_REPLACE(TRIM("name"), '\s+', ' ', 'g')) WHERE "normalized_name" IS NULL;

-- CreateIndex on subjects
CREATE UNIQUE INDEX "subjects_grade_level_id_normalized_name_key" ON "subjects"("grade_level_id", "normalized_name");
CREATE INDEX "subjects_is_archived_idx" ON "subjects"("is_archived");

-- AddForeignKey on subjects
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_grade_level_id_fkey" FOREIGN KEY ("grade_level_id") REFERENCES "grade_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable exams
ALTER TABLE "exams" ADD COLUMN "classroom_id" TEXT,
ADD COLUMN "updated_by" TEXT;

-- CreateIndex on exams
CREATE INDEX "exams_classroom_id_idx" ON "exams"("classroom_id");

-- AddForeignKey on exams
ALTER TABLE "exams" ADD CONSTRAINT "exams_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable teachers
ALTER TABLE "teachers" ADD COLUMN "session_version" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT;

-- AlterTable browser_identities
ALTER TABLE "browser_identities" ADD COLUMN "last_student_name" TEXT,
ADD COLUMN "last_student_nisn" TEXT;
