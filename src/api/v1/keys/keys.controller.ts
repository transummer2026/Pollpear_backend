import {
  Controller,
  Param,
  Delete,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiKeysService } from './keys.service';

@Controller('v1/keys')
export class ApiKeysController {
  constructor(private readonly keysService: ApiKeysService) {}

  @Delete(':id')
  @HttpCode(503)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.keysService.remove(id);
  }
}
