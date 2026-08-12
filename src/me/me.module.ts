import { Module } from '@nestjs/common';
import { MeService } from './me.service';
import { MeController } from './me.controller';
import { UsersModule } from 'src/users/users.module';
import { FileUploadModule } from 'src/file-upload/file-upload.module';
import { StorageModule } from 'src/storage/storage.module';
import { ApiKeyModule } from 'src/api-key/api-key.module';

@Module({
  imports: [UsersModule, FileUploadModule, StorageModule, ApiKeyModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
