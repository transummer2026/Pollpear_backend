import { VotesService } from './votes.service';

export const votesServiceMock = {
  provide: VotesService,
  useValue: {},
};
