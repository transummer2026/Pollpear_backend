import { Global, Module } from '@nestjs/common';
import { CaslAbilityFactory } from './casl-ability.factory';
import { AuthorizationGuard } from './authorization.guard';

@Global()
@Module({
  providers: [CaslAbilityFactory, AuthorizationGuard],
  exports: [CaslAbilityFactory, AuthorizationGuard],
})
export class CaslModule {}
