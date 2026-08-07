import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PresenceGateway } from './presence.gateway';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PresenceGateway],
  exports: [UsersService],
})
export class UsersModule {}
