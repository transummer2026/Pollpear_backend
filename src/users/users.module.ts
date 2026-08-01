import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PresenceWsController } from './presence.controller-ws';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PresenceWsController],
  exports: [UsersService],
})
export class UsersModule {}
