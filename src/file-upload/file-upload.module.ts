import { Module } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 12 * 1024 * 1024 },
    }),
  ],
  providers: [FileUploadService],
  exports: [MulterModule, FileUploadService],
})
export class FileUploadModule {}
