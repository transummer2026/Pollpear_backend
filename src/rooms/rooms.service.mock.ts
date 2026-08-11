import { RoomsService } from './rooms.service';

export const roomsServiceMock = {
  provide: RoomsService,
  useValue: {},
};
