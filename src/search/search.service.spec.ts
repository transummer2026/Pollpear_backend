import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { usersServiceMock } from 'src/users/users.service.mock';
import { pollsServiceMock } from 'src/polls/polls.service.mock';
import { roomsServiceMock } from 'src/rooms/rooms.service.mock';

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        usersServiceMock,
        pollsServiceMock,
        roomsServiceMock,
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
