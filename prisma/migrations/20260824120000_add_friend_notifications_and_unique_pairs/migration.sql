-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'friend_accepted';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "actor_id" INTEGER;

BEGIN;

-- Collapse mutual pending requests into an accepted friendship
UPDATE "friendships" AS f
SET "status" = 'accepted',
    "updated_at" = CURRENT_TIMESTAMP
WHERE f."deleted_at" IS NULL
  AND f."status" = 'pending'
  AND EXISTS (
    SELECT 1
    FROM "friendships" r
    WHERE r."deleted_at" IS NULL
      AND r."status" = 'pending'
      AND r."requester_id" = f."addressee_id"
      AND r."addressee_id" = f."requester_id"
  );

-- SoftDelete duplicate unordered pairs
UPDATE "friendships" AS f
SET "deleted_at" = CURRENT_TIMESTAMP,
    "updated_at" = CURRENT_TIMESTAMP
WHERE f."deleted_at" IS NULL
  AND f."id" NOT IN (
    SELECT DISTINCT ON (
        LEAST("requester_id", "addressee_id"),
        GREATEST("requester_id", "addressee_id")
      ) "id"
    FROM "friendships"
    WHERE "deleted_at" IS NULL
    ORDER BY LEAST("requester_id", "addressee_id"),
             GREATEST("requester_id", "addressee_id"),
             ("status" = 'accepted') DESC,
             ("status" = 'pending') DESC,
             "updated_at" DESC,
             "id" DESC
  );

-- CreateIndex
CREATE UNIQUE INDEX "friendships_unordered_pair_key"
  ON "friendships" (
    LEAST("requester_id", "addressee_id"),
    GREATEST("requester_id", "addressee_id")
  )
  WHERE "deleted_at" IS NULL;

COMMIT;
