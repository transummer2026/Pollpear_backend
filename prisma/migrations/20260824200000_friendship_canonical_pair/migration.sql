-- AlterTable
ALTER TABLE "friendships" ADD COLUMN IF NOT EXISTS "user_a_id" INTEGER;
ALTER TABLE "friendships" ADD COLUMN IF NOT EXISTS "user_b_id" INTEGER;

-- Backfill
DO $friendship_pair$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'friendships'
      AND column_name = 'requester_id'
  ) THEN
    UPDATE "friendships"
    SET "user_a_id" = LEAST("requester_id", "addressee_id"),
        "user_b_id" = GREATEST("requester_id", "addressee_id")
    WHERE "user_a_id" IS NULL
       OR "user_b_id" IS NULL;
  END IF;
END
$friendship_pair$;

-- SoftDelete legacy self-pairs
UPDATE "friendships"
SET "deleted_at" = CURRENT_TIMESTAMP,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "user_a_id" = "user_b_id"
  AND "deleted_at" IS NULL;

-- AlterTable
ALTER TABLE "friendships" ALTER COLUMN "user_a_id" SET NOT NULL;
ALTER TABLE "friendships" ALTER COLUMN "user_b_id" SET NOT NULL;

-- AddConstraint
ALTER TABLE "friendships" DROP CONSTRAINT IF EXISTS "friendships_pair_order_check";
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_pair_order_check"
  CHECK ("user_a_id" < "user_b_id" OR "deleted_at" IS NOT NULL) NOT VALID;

ALTER TABLE "friendships" DROP CONSTRAINT IF EXISTS "friendships_addressee_in_pair_check";
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_in_pair_check"
  CHECK ("addressee_id" IN ("user_a_id", "user_b_id")) NOT VALID;

-- AddForeignKey
DO $friendship_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"friendships"'::regclass
      AND conname = 'friendships_user_a_id_fkey'
  ) THEN
    ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_a_id_fkey"
      FOREIGN KEY ("user_a_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"friendships"'::regclass
      AND conname = 'friendships_user_b_id_fkey'
  ) THEN
    ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_b_id_fkey"
      FOREIGN KEY ("user_b_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$friendship_fk$;

-- ValidateConstraint
DO $friendship_validate$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "friendships"
    WHERE "user_a_id" >= "user_b_id"
      AND "deleted_at" IS NULL
  ) THEN
    ALTER TABLE "friendships" VALIDATE CONSTRAINT "friendships_pair_order_check";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "friendships"
    WHERE "addressee_id" NOT IN ("user_a_id", "user_b_id")
  ) THEN
    ALTER TABLE "friendships" VALIDATE CONSTRAINT "friendships_addressee_in_pair_check";
  END IF;
END
$friendship_validate$;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "friendships_user_a_id_user_b_id_key"
  ON "friendships" ("user_a_id", "user_b_id")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "friendships_user_b_id_idx" ON "friendships"("user_b_id");

-- DropIndex
DROP INDEX IF EXISTS "friendships_unordered_pair_key";
DROP INDEX IF EXISTS "friendships_requester_id_addressee_id_key";

-- DropForeignKey
ALTER TABLE "friendships" DROP CONSTRAINT IF EXISTS "friendships_requester_id_fkey";
ALTER TABLE "friendships" DROP CONSTRAINT IF EXISTS "friendships_addressee_id_fkey";

-- DropColumn
ALTER TABLE "friendships" DROP COLUMN IF EXISTS "requester_id";
