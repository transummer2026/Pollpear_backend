import { BanService } from './ban.service';

export const banServiceMock = {
  provide: BanService,
  useValue: {},
};
