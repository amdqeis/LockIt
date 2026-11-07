-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "content" JSONB,
ADD COLUMN     "hint" TEXT,
ADD COLUMN     "hint_content" JSONB,
ADD COLUMN     "image_alt" TEXT;

-- CreateTable
CREATE TABLE "question_banks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "difficulty" TEXT NOT NULL DEFAULT 'mixed',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "import_key" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "question_banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_questions" (
    "id" TEXT NOT NULL,
    "bank_id" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "content" JSONB,
    "image_url" TEXT,
    "image_alt" TEXT,
    "options" JSONB NOT NULL,
    "correct_answer" TEXT,
    "correct_answers" JSONB,
    "points" INTEGER NOT NULL DEFAULT 10,
    "hint" TEXT,
    "hint_content" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bank_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_bank_drafts" (
    "id" TEXT NOT NULL,
    "bank_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "content" JSONB NOT NULL,
    "committed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "question_bank_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_bank_media" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_bank_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "question_banks_import_key_key" ON "question_banks"("import_key");

-- CreateIndex
CREATE INDEX "question_banks_subject_status_idx" ON "question_banks"("subject", "status");

-- CreateIndex
CREATE INDEX "bank_questions_bank_id_order_index_idx" ON "bank_questions"("bank_id", "order_index");

-- CreateIndex
CREATE INDEX "question_bank_drafts_bank_id_updated_at_idx" ON "question_bank_drafts"("bank_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "question_bank_media_filename_key" ON "question_bank_media"("filename");

-- AddForeignKey
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "question_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_bank_drafts" ADD CONSTRAINT "question_bank_drafts_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "question_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

