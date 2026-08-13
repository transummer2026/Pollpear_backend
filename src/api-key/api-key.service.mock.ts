import { ApiKeyService } from './api-key.service';

export const apiKeyServiceMock = {
  provide: ApiKeyService,
  useValue: {},
};
