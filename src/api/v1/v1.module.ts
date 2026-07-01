import { Module } from '@nestjs/common';
import { V1Service } from './v1.service';
import { V1Controller } from './v1.controller';
import { RegisterModule } from './register/register.module';
import { KeysModule } from './keys/keys.module';

@Module({
  controllers: [V1Controller],
  providers: [V1Service],
  imports: [RegisterModule, KeysModule],
})
export class V1Module {}
