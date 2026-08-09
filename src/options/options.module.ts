import { Module } from '@nestjs/common';
import { OptionsService } from './options.service';

@Module({
  providers: [OptionsService],
  exports: [OptionsService],
})
export class OptionsModule {}
