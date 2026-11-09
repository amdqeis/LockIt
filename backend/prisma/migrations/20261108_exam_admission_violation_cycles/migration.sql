ALTER TYPE "StudentStatus" ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'teacher_unlock';

ALTER TABLE "students"
  ADD COLUMN "violation_cycle_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "proctoring_events"
  ADD COLUMN "incident_id" TEXT;

CREATE UNIQUE INDEX "proctoring_events_student_id_incident_id_key"
  ON "proctoring_events"("student_id", "incident_id");

CREATE TYPE "AdmissionHistoryAction" AS ENUM ('requested', 'approved', 'rejected', 'reapplied');

CREATE TABLE "admission_history" (
  "id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "teacher_id" TEXT,
  "action" "AdmissionHistoryAction" NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admission_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admission_history_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "admission_history_teacher_id_fkey"
    FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "admission_history_student_id_created_at_idx"
  ON "admission_history"("student_id", "created_at");
