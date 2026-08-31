import { Module } from '@nestjs/common';
import { NotificationModule } from 'src/notification/notification.module';
import { ApiFriendshipsService } from './friendships.service';
import { ApiFriendshipsController } from './friendships.controller';

@Module({
  imports: [NotificationModule],
  controllers: [ApiFriendshipsController],
  providers: [ApiFriendshipsService],
})
export class ApiFriendshipsModule {}
