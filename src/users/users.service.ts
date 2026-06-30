import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  report(id: number) {
    return `report user #${id} works`;
  }

  block(id: number) {
    return `block user #${id} works`;
  }

  sendFriendRequest(id: number) {
    return `send friendship request to user #${id} works`;
  }

  updateFriendRequestStatus(id: number) {
    return `update friendship with user #${id} works`;
  }

  deleteFriendship(id: number) {
    return `delete friendship with user #${id} works`;
  }

  banUser(id: number) {
    return `ban user #${id} works`;
  }

  updateBan(id: number) {
    return `updated ban for user #${id} works`;
  }

  update(id: number) {
    return `update user #${id} works`;
  }

  remove(id: number) {
    return `remove user #${id} works`;
  }
}
