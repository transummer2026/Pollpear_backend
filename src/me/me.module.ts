import { Module } from '@nestjs/common';
import { MeService } from './me.service';
import { MeController } from './me.controller';
import { UsersModule } from 'src/users/users.module';
import { FileUploadModule } from 'src/file-upload/file-upload.module';
import { ApiKeyModule } from 'src/api-key/api-key.module';
import { RevocationModule } from 'src/revocation/revocation.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    FileUploadModule,
    ApiKeyModule,
    RevocationModule,
  ],
  controllers: [MeController],
  providers: [MeService],
  exports: [MeService],
})
export class MeModule {}
