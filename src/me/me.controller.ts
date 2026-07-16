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
import { UserId } from 'src/users/user-id.decorator';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import {
  type UserProfileUpdateDTO,
  UserProfileUpdateSchema,
} from 'Pollpear_shared/src/schemas/users.schema';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('me')
export class MeController {
  constructor(
    private readonly meService: MeService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  @Get()
  myProfile(@UserId() userId: string) {
    return this.meService.myProfile(+userId);
  }

  @Post('avatar')
  @HttpCode(503)
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
    console.log('DEBUG HERE IN CONTROLLER');
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
