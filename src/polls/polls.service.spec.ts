import { Test, TestingModule } from '@nestjs/testing';
import { PollsService } from './polls.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';
import { caslAbilityFactoryMock } from 'src/casl/casl-ability.factory.mock';
import { optionsServiceMock } from 'src/options/options.service.mock';
import { hashtagsServiceMock } from 'src/hashtags/hashtags.service.mock';

describe('PollsService', () => {
  let service: PollsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PollsService,
        prismaMock,
        caslAbilityFactoryMock,
        optionsServiceMock,
        hashtagsServiceMock,
      ],
    }).compile();

    service = module.get<PollsService>(PollsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
