import { Module } from '@nestjs/common';
import { UsersModule } from 'src/users/users.module';
import { FriendshipModule } from 'src/friendship/friendship.module';
import { PresenceGateway } from './presence.gateway';
import { PresenceService } from './presence.service';

@Module({
  imports: [UsersModule, FriendshipModule],
  providers: [PresenceGateway, PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
