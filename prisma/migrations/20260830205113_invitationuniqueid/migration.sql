/*
  Warnings:

  - A unique constraint covering the columns `[invitee_id,room_id]` on the table `invitations` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "invitations_invitee_id_room_id_key" ON "invitations"("invitee_id", "room_id");
