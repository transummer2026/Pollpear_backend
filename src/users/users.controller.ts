import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UserId } from 'src/common/decorators/user-id.decorator';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import {
  type UserUpdateDTO,
  UserUpdateSchema,
} from 'Pollpear_shared/src/schemas/users.schema';
import { CheckAbilities } from 'src/common/decorators/check-ability.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post(':id/report')
  @HttpCode(503)
  report(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.report(+id);
  }

  @Post(':id/block')
  @HttpCode(503)
  block(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.block(+id);
  }

  @Post(':id/friendship')
  @HttpCode(503)
  createFriendRequest(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.createFriendRequest(+id);
  }

  // respond to friend request to update the result of the friendship
  @Patch(':id/friendship')
  @HttpCode(503)
  updateFriendRequest(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.updateFriendRequest(+id);
  }

  @Delete(':id/friendship')
  @HttpCode(503)
  removeFriendship(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.removeFriendship(+id);
  }

  // add Guard for moderator from here on (green arrows on sequence diagram)
  @Post(':id/ban')
  @HttpCode(503)
  ban(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.ban(+id);
  }

  @Patch(':id/ban')
  @HttpCode(503)
  @CheckAbilities(['ban', 'User'])
  updateBan(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.updateBan(+id);
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
