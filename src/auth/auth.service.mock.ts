import { AuthService } from './auth.service';

export const authServiceMock = {
  provide: AuthService,
  useValue: {},
};
