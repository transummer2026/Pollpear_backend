import { Module } from '@nestjs/common';
import { MeService } from './me.service';
import { MeController } from './me.controller';
import { UsersModule } from 'src/users/users.module';
import { FileUploadModule } from 'src/file-upload/file-upload.module';
import { StorageModule } from 'src/storage/storage.module';
import { ApiKeySyncService } from './api-key-sync.service';

@Module({
  imports: [UsersModule, FileUploadModule, StorageModule],
  controllers: [MeController],
  providers: [MeService, ApiKeySyncService],
})
export class MeModule {}
