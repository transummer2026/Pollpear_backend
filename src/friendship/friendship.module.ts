import { Module } from '@nestjs/common';
import { FriendshipService } from './friendship.service';

@Module({
  providers: [FriendshipService],
  exports: [FriendshipService],
})
export class FriendshipModule {}
