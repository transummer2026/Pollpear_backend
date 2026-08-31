import {
  Get,
  Controller,
  Post,
  Patch,
  Put,
  HttpCode,
  Delete,
  Body,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { MeService } from './me.service';
import { UserId } from 'src/common/decorators/user-id.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { User } from 'src/generated/prisma/client';
import { VisibleByBan } from 'src/common/decorators/ban.decorator';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import {
  type UserUpdateDTO,
  UserUpdateSchema,
} from 'Pollpear_shared/src/schemas/users.schema';
import {
  ApiKeyCreateSchema,
  type ApiKeyCreateDTO,
  ApiKeyUpdateSchema,
  type ApiKeyUpdateDTO,
} from 'Pollpear_shared/src/schemas/api-key.schema';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiKeyService } from 'src/api-key/api-key.service';
import {
  type UserChangePasswordDTO,
  UserChangePasswordSchema,
  type UserDeleteDTO,
  UserDeleteSchema,
} from 'Pollpear_shared/src/schemas/auth.schema';
import { CheckAbilities } from 'src/common/decorators/check-ability.decorator';
import { InvitationService } from 'src/invitation/invitation.service';

@Controller('me')
export class MeController {
  constructor(
    private readonly meService: MeService,
    private readonly apiKeyService: ApiKeyService,
    private readonly invitationService: InvitationService,
  ) {}

  @VisibleByBan()
  @Get()
  myProfile(@UserId() userId: number) {
    return this.meService.myProfile(userId);
  }

  @Get('invitations')
  @CheckAbilities(['read', 'Invitation'])
  getMyRoomInvitations(@CurrentUser() viewer: User) {
    return this.invitationService.getMyInvitations(viewer);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(
    @UserId() userId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.meService.uploadAvatar(userId, file);
  }

  @Patch()
  editProfile(
    @UserId() userId: number,
    @Body(new ZodValidationPipe(UserUpdateSchema))
    body: UserUpdateDTO,
  ) {
    return this.meService.editProfile(userId, body);
  }

  @Patch('settings')
  @HttpCode(503)
  settings() {
    return this.meService.settings();
  }

  @Put('settings/security')
  @HttpCode(204)
  changePassword(
    @UserId() userId: number,
    @Body(new ZodValidationPipe(UserChangePasswordSchema))
    body: UserChangePasswordDTO,
  ) {
    return this.meService.changePassword(userId, body);
  }

  @Get('settings/security/apikey')
  getApiKey(@UserId() userId: number) {
    return this.apiKeyService.findActive(userId);
  }

  @Post('settings/security/apikey')
  createApiKey(
    @UserId() userId: number,
    @Body(new ZodValidationPipe(ApiKeyCreateSchema)) body: ApiKeyCreateDTO,
  ) {
    return this.apiKeyService.create(userId, body.appName);
  }

  @Patch('settings/security/apikey')
  updateApiKey(
    @UserId() userId: number,
    @Body(new ZodValidationPipe(ApiKeyUpdateSchema)) body: ApiKeyUpdateDTO,
  ) {
    return this.apiKeyService.update(userId, body.appName);
  }

  @Delete('settings/security/apikey')
  @HttpCode(204)
  revokeApiKey(@UserId() userId: number) {
    return this.apiKeyService.revoke(userId);
  }

  @Delete()
  @HttpCode(200)
  remove(
    @UserId() userId: number,
    @Body(new ZodValidationPipe(UserDeleteSchema))
    body: UserDeleteDTO,
  ) {
    void body;
    return this.meService.remove(userId);
  }
}
