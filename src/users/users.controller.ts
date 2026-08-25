import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import { type Response } from 'express';
import { UsersService } from './users.service';
import { UserId } from 'src/common/decorators/user-id.decorator';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import {
  type UserUpdateDTO,
  UserUpdateSchema,
} from 'Pollpear_shared/src/schemas/users.schema';
import {
  type FriendshipStatusUpdateDTO,
  FriendshipStatusUpdateSchema,
} from 'Pollpear_shared/src/schemas/friendship.schema';
import { CheckAbilities } from 'src/common/decorators/check-ability.decorator';
import { FriendshipService } from 'src/friendship/friendship.service';
import { BlockService } from 'src/block/block.service';
import { BanService } from 'src/ban/ban.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly friendshipService: FriendshipService,
    private readonly blockService: BlockService,
    private readonly banService: BanService,
  ) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @UserId() userId: number) {
    return this.usersService.findOne(id, userId);
  }

  @Post(':id/report')
  @HttpCode(503)
  report(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.report(+id);
  }

  @Get(':id/block')
  @CheckAbilities(['read', 'Block'])
  getBlockStatus(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.blockService.getBlockStatus(userId, id);
  }

  @Get(':id/blocks')
  @CheckAbilities(['read', 'Block'])
  getBlockedUsers(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.blockService.getBlockedUsers(userId, id);
  }

  @Post(':id/block')
  @HttpCode(201)
  @CheckAbilities(['create', 'Block'])
  blockUser(@UserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.blockService.blockUser(userId, id);
  }

  @Delete(':id/block')
  @HttpCode(204)
  @CheckAbilities(['delete', 'Block'])
  unblockUser(@UserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.blockService.unblockUser(userId, id);
  }

  @Get(':id/friendship')
  @CheckAbilities(['read', 'Friendship'])
  async getFriendship(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const friendship = await this.friendshipService.getFriendshipWith(
      userId,
      id,
    );
    if (!friendship) {
      res.status(204);
      return;
    }
    return friendship;
  }

  @Get(':id/friends')
  @CheckAbilities(['read', 'Friendship'])
  getFriends(@UserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.friendshipService.getFriends(userId, id);
  }

  @Get(':id/friend-requests')
  @CheckAbilities(['read', 'Friendship'])
  getFriendRequests(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.friendshipService.getFriendRequests(userId, id);
  }

  @Post(':id/friendship')
  @HttpCode(201)
  @CheckAbilities(['create', 'Friendship'])
  createFriendRequest(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.friendshipService.createFriendRequest(userId, id);
  }

  // respond to friend request to update the result of the friendship
  @Patch(':id/friendship')
  @HttpCode(202)
  @CheckAbilities(['update', 'Friendship'])
  updateFriendRequest(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(FriendshipStatusUpdateSchema))
    body: FriendshipStatusUpdateDTO,
  ) {
    return this.friendshipService.updateFriendRequest(userId, id, body.status);
  }

  @Delete(':id/friendship')
  @HttpCode(204)
  @CheckAbilities(['delete', 'Friendship'])
  removeFriendship(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.friendshipService.removeFriendship(userId, id);
  }

  // add Guard for moderator from here on (green arrows on sequence diagram)
  @Post(':id/ban')
  @HttpCode(503)
  ban(@Param('id', ParseIntPipe) id: number) {
    return this.banService.ban(+id);
  }

  @Patch(':id/ban')
  @HttpCode(503)
  @CheckAbilities(['ban', 'User'])
  updateBan(@Param('id', ParseIntPipe) id: number) {
    return this.banService.updateBan(+id);
  }

  // add Guard for admin from here on (red arrows on sequence diagram)
  @Patch(':id')
  @CheckAbilities(['update', 'User'])
  update(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UserUpdateSchema))
    body: UserUpdateDTO,
  ) {
    return this.usersService.update(id, userId, body);
  }

  @Delete(':id')
  @HttpCode(503)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(+id);
  }
}
