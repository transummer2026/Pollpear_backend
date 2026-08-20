import { Module } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { AvatarService } from './avatar.service';
import { StorageModule } from 'src/storage/storage.module';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
@Module({
  imports: [
    StorageModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 12 * 1024 * 1024 },
    }),
  ],
  providers: [FileUploadService, AvatarService],
  exports: [MulterModule, FileUploadService, AvatarService],
})
export class FileUploadModule {}
