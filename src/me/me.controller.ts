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
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @VisibleByBan()
  @Get()
  myProfile(@UserId() userId: string) {
    return this.meService.myProfile(+userId);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(
    @UserId() userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.meService.uploadAvatar(+userId, file);
  }

  @Patch()
  editProfile(
    @UserId() userId: string,
    @Body(new ZodValidationPipe(UserProfileUpdateSchema))
    body: UserProfileUpdateDTO,
  ) {
    return this.meService.editProfile(+userId, body);
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

  @Delete()
  @HttpCode(200)
  remove(@UserId() userId: string) {
    return this.meService.remove(+userId);
  }
}
