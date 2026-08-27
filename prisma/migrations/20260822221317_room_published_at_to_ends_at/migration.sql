/*
  Warnings:

  - You are about to drop the column `published_at` on the `rooms` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "rooms" DROP COLUMN "published_at",
ADD COLUMN     "ends_at" TIMESTAMP(3);
