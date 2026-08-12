/*
  Warnings:

  - Made the column `visibility` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user',
ALTER COLUMN "visibility" SET NOT NULL,
ALTER COLUMN "visibility" SET DEFAULT 'public';
