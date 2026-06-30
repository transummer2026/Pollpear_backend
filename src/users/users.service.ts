import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  report(id: number) {
    return `report user #${id} worked`;
  }

  block(id: number) {
    return `block user #${id} worked`;
  }

  sendFriendRequest(id: number) {
    return `send friendship request to user #${id} worked`;
  }

  updateFriendRequestStatus(id: number) {
    return `update friendship with user #${id} worked`;
  }

  deleteFriendship(id: number) {
    return `delete friendship with user #${id} worked`;
  }

  banUser(id: number) {
    return `ban user #${id} worked`;
  }

  updateBan(id: number) {
    return `updated ban for user #${id} worked`;
  }

  update(id: number) {
    return `update user #${id} worked`;
  }

  remove(id: number) {
    return `remove user #${id} worked`;
  }
}
