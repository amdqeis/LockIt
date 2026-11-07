CREATE TABLE "browser_identities" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "browser_identities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "browser_students" (
    "browser_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "linked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "browser_students_pkey" PRIMARY KEY ("browser_id", "student_id")
);

CREATE UNIQUE INDEX "browser_identities_token_hash_key" ON "browser_identities"("token_hash");
CREATE INDEX "browser_students_browser_id_linked_at_idx" ON "browser_students"("browser_id", "linked_at");
CREATE INDEX "browser_students_student_id_idx" ON "browser_students"("student_id");

ALTER TABLE "browser_students"
  ADD CONSTRAINT "browser_students_browser_id_fkey"
  FOREIGN KEY ("browser_id") REFERENCES "browser_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "browser_students"
  ADD CONSTRAINT "browser_students_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
