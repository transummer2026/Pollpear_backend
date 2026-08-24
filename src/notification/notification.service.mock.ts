import { NotificationService } from './notification.service';

export const notificationServiceMock = {
  provide: NotificationService,
  useValue: {},
};
