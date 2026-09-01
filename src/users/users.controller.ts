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
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { User } from 'src/generated/prisma/client';
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

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly friendshipService: FriendshipService,
    private readonly blockService: BlockService,
  ) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() viewer: User) {
    return this.usersService.findOne(id, viewer);
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
    @CurrentUser() viewer: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.blockService.getBlockedUsers(viewer, id);
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
  unblockUser(
    @CurrentUser() viewer: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.blockService.unblockUser(viewer, id);
  }

  @Get(':id/friendship')
  @CheckAbilities(['read', 'Friendship'])
  async getFriendship(
    @CurrentUser() viewer: User,
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const friendship = await this.friendshipService.getFriendshipWith(
      viewer,
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
  getFriends(
    @CurrentUser() viewer: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.friendshipService.getFriends(viewer, id);
  }

  @Get(':id/friend-requests')
  @CheckAbilities(['read', 'Friendship'])
  getFriendRequests(
    @CurrentUser() viewer: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.friendshipService.getFriendRequests(viewer, id);
  }

  @Post(':id/friendship')
  @HttpCode(201)
  @CheckAbilities(['create', 'Friendship'])
  createFriendRequest(
    @CurrentUser() viewer: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.friendshipService.createFriendRequest(viewer, id);
  }

  @Patch(':id/friendship')
  @HttpCode(202)
  @CheckAbilities(['update', 'Friendship'])
  updateFriendRequest(
    @CurrentUser() viewer: User,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(FriendshipStatusUpdateSchema))
    body: FriendshipStatusUpdateDTO,
  ) {
    return this.friendshipService.updateFriendRequest(viewer, id, body.status);
  }

  @Delete(':id/friendship')
  @HttpCode(204)
  @CheckAbilities(['delete', 'Friendship'])
  removeFriendship(
    @CurrentUser() viewer: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.friendshipService.removeFriendship(viewer, id);
  }

  @Patch(':id')
  @CheckAbilities(['update', 'User'])
  update(
    @CurrentUser() viewer: User,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UserUpdateSchema))
    body: UserUpdateDTO,
  ) {
    return this.usersService.update(id, viewer, body);
  }
}
