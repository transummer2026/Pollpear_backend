import {
  Get,
  Controller,
  Post,
  Patch,
  Put,
  HttpCode,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { MeService } from './me.service';
import { UserId } from 'src/users/user-id.decorator';
import { AuthGuard } from 'src/auth/auth.guard';

@UseGuards(AuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  myProfile(@UserId() userId: string) {
    return this.meService.myProfile(userId);
  }

  @Post('avatar')
  @HttpCode(503)
  uploadAvatar() {
    return this.meService.uploadAvatar();
  }

  @Patch()
  @HttpCode(503)
  editProfile() {
    return this.meService.editProfile();
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
  @HttpCode(503)
  remove() {
    return this.meService.remove();
  }
}
