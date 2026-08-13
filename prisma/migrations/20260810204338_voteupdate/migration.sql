/*
  Warnings:

  - A unique constraint covering the columns `[pollId,created_by]` on the table `votes` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `pollId` to the `votes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "votes" ADD COLUMN     "pollId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "votes_pollId_created_by_key" ON "votes"("pollId", "created_by");

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
