// src/api/v1/me/me.module.ts
import { Module } from '@nestjs/common';
import { ApiMeService } from './me.service';
import { ApiMeController } from './me.controller';
import { ApiMeAvatarService } from './avatar/avatar.service';
import { ApiMeAvatarController } from './avatar/avatar.controller';
import { MeModule } from 'src/me/me.module';
import { FileUploadModule } from 'src/file-upload/file-upload.module';

@Module({
  imports: [MeModule, FileUploadModule],
  controllers: [ApiMeController, ApiMeAvatarController],
  providers: [ApiMeService, ApiMeAvatarService],
})
export class ApiMeModule {}
