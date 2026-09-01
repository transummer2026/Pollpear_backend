import { Module } from '@nestjs/common';
import { RevocationService } from './revocation.service';
import { ApiKeyModule } from 'src/api-key/api-key.module';

@Module({
  imports: [ApiKeyModule],
  providers: [RevocationService],
  exports: [RevocationService],
})
export class RevocationModule {}
