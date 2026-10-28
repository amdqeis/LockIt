-- Migration: LOW-04 — Rename session_token to session_token_hash
-- Reason: Store SHA-256 hash of student JWT instead of raw JWT in DB
-- Consistent with teacher refresh_tokens which already stores tokenHash
--
-- This migration:
-- 1. Renames column session_token → session_token_hash (preserves existing data)
-- 2. NOTE: Existing values are raw JWTs, not hashes. They will fail the new
--    hash-based lookup, effectively invalidating all existing student sessions.
--    Students will need to re-join their exams. This is acceptable behavior
--    since it should be deployed outside of active exam windows.

ALTER TABLE students
  RENAME COLUMN session_token TO session_token_hash;

-- Update the index name to reflect new column name
DROP INDEX IF EXISTS students_session_token_idx;
CREATE INDEX students_session_token_hash_idx ON students(session_token_hash);
