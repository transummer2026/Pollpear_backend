-- DeleteDuplicates
DELETE FROM "friendships" AS f
WHERE f."id" NOT IN (
  SELECT DISTINCT ON ("user_a_id", "user_b_id") "id"
  FROM "friendships"
  ORDER BY "user_a_id",
           "user_b_id",
           ("deleted_at" IS NULL) DESC,
           ("status" = 'accepted') DESC,
           ("status" = 'pending') DESC,
           "updated_at" DESC,
           "id" DESC
);

-- DropIndex
DROP INDEX IF EXISTS "friendships_user_a_id_user_b_id_key";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "friendships_user_a_id_user_b_id_key"
  ON "friendships" ("user_a_id", "user_b_id");
