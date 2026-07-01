import { Controller, Param, Delete, HttpCode, ParseIntPipe } from '@nestjs/common';
import { KeysService } from './keys.service';

@Controller('api/v1/keys')
export class KeysController {
  constructor(private readonly keysService: KeysService) {}

  @Delete(':id')
  @HttpCode(503)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.keysService.remove(id);
  }
}
