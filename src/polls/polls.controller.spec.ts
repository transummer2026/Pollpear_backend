import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PollsController } from './polls.controller';
import { PollsService } from './polls.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';
import { caslAbilityFactoryMock } from 'src/casl/casl-ability.factory.mock';
import { optionsServiceMock } from 'src/options/options.service.mock';
import { hashtagsServiceMock } from 'src/hashtags/hashtags.service.mock';
import { votesServiceMock } from 'src/votes/votes.service.mock';

describe('PollsController', () => {
  let controller: PollsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PollsController],
      providers: [
        PollsService,
        prismaMock,
        caslAbilityFactoryMock,
        optionsServiceMock,
        hashtagsServiceMock,
        votesServiceMock,
        Logger,
      ],
    }).compile();

    controller = module.get<PollsController>(PollsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
