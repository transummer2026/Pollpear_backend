import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  ParseIntPipe,
  HttpCode,
} from '@nestjs/common';
import { UserId } from 'src/common/decorators/user-id.decorator';
import { NotificationService } from './notification.service';

@Controller('me/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  getMine(@UserId() userId: number) {
    return this.notificationService.getMine(userId);
  }

  @Patch('read')
  @HttpCode(204)
  markAllRead(@UserId() userId: number) {
    return this.notificationService.markAllRead(userId);
  }

  @Delete(':id')
  @HttpCode(204)
  dismiss(@UserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.notificationService.dismiss(userId, id);
  }
}
