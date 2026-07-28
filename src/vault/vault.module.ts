import { Global, Module } from '@nestjs/common';
import { VaultService } from './vault.service';

@Global()
@Module({
  providers: [
    {
      provide: VaultService,
      useFactory: async () => {
        const svc = new VaultService();
        await svc.init();
        return svc;
      },
    },
  ],
  exports: [VaultService],
})
export class VaultModule {}
