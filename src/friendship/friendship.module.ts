import { Module } from '@nestjs/common';
import { FriendshipService } from './friendship.service';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [NotificationModule],
  providers: [FriendshipService],
  exports: [FriendshipService],
})
export class FriendshipModule {}
