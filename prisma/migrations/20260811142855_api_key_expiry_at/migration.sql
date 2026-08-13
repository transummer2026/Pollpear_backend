/*
  Warnings:

  - Added the required column `expires_at` to the `api_keys` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "expires_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "appName" SET DEFAULT 'default';
