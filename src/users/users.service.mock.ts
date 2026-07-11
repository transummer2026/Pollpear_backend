import { UsersService } from './users.service';

export const usersServiceMock = {
  provide: UsersService,
  useValue: {},
};
