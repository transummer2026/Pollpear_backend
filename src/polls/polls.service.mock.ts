import { PollsService } from './polls.service';

export const pollsServiceMock = {
  provide: PollsService,
  useValue: {},
};
