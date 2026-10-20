import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { FriendshipModule } from 'src/friendship/friendship.module';
import { BlockModule } from 'src/block/block.module';
import { BanModule } from 'src/ban/ban.module';

@Module({
  imports: [FriendshipModule, BlockModule, BanModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
