import { Controller, Post, Patch, Body, Header, HttpCode} from '@nestjs/common';
import { MeService } from './me.service';
import { LoggerMiddleware } from 'src/common/middleware/logger.middleware';
import { UpdateUserDto } from '../users/dto/update-user.dto';

@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}
  @Post('avatar')
  @HttpCode(503)

  @Patch()

  @Patch('settings')

  @Delete()
}
