CREATE TABLE "subjects" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "subjects_name_key" ON "subjects"("name");
ALTER TABLE "question_banks" ADD COLUMN "subject_id" TEXT;
ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exams" ADD COLUMN "subject_id" TEXT, ADD COLUMN "subject_name" TEXT, ADD COLUMN "class_name" TEXT, ADD COLUMN "academic_year" TEXT, ADD COLUMN "semester" TEXT, ADD COLUMN "category" TEXT, ADD COLUMN "category_number" INTEGER, ADD COLUMN "scheduled_start_at" TIMESTAMPTZ, ADD COLUMN "passing_score" INTEGER, ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "exams" ADD CONSTRAINT "exams_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
