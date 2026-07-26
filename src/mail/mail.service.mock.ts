import { MailService } from './mail.service';

export const mailServiceMock = {
  provide: MailService,
  useValue: {},
};
