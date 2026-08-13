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
import { VisibleByBan } from 'src/common/decorators/ban.decorator';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import {
  type UserProfileUpdateDTO,
  UserProfileUpdateSchema,
} from 'Pollpear_shared/src/schemas/users.schema';
import {
  ApiKeyCreateSchema,
  type ApiKeyCreateDTO,
  ApiKeySchema,
  type ApiKeyDTO,
} from 'Pollpear_shared/src/schemas/api-key.schema';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiKeyService } from 'src/api-key/api-key.service';

@Controller('me')
export class MeController {
  constructor(
    private readonly meService: MeService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  @VisibleByBan()
  @Get()
  myProfile(@UserId() userId: number) {
    return this.meService.myProfile(userId);
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
    @Body(new ZodValidationPipe(UserProfileUpdateSchema))
    body: UserProfileUpdateDTO,
  ) {
    return this.meService.editProfile(userId, body);
  }

  @Patch('settings')
  @HttpCode(503)
  settings() {
    return this.meService.settings();
  }

  // a PUT needs the whole object as it deletes the old one and creates a new one
  @Put('settings/security')
  @HttpCode(503)
  changePassword() {
    return this.meService.changePassword();
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
    @Body(new ZodValidationPipe(ApiKeySchema)) body: ApiKeyDTO,
  ) {
    return this.apiKeyService.rename(userId, body.appName);
  }

  @Delete('settings/security/apikey')
  @HttpCode(204)
  revokeApiKey(@UserId() userId: number) {
    return this.apiKeyService.revoke(userId);
  }

  @Delete()
  @HttpCode(200)
  remove(@UserId() userId: number) {
    return this.meService.remove(userId);
  }
}
