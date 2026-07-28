import { FileUploadService } from './file-upload.service';

export const fileUploadServiceMock = {
  provide: FileUploadService,
  useValue: {},
};
