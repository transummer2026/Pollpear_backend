import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { FriendshipModule } from 'src/friendship/friendship.module';
import { BlockModule } from 'src/block/block.module';

@Module({
  imports: [FriendshipModule, BlockModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
