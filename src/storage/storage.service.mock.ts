import { StorageService } from './storage.service';

export const storageServiceMock = {
  provide: StorageService,
  useValue: {},
};
