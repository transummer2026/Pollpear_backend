import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PollsController } from './polls.controller';
import { PollsService } from './polls.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';
import { caslAbilityFactoryMock } from 'src/casl/casl-ability.factory.mock';
import { optionsServiceMock } from 'src/options/options.service.mock';
import { hashtagsServiceMock } from 'src/hashtags/hashtags.service.mock';
import { votesServiceMock } from 'src/votes/votes.service.mock';
import { VotedFilterSchema } from './polls.query';

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

describe('VotedFilterSchema', () => {
  it('reads an absent param as not filtering', () => {
    expect(VotedFilterSchema.parse(undefined)).toBe(false);
  });

  it('maps "true" / "false" to a boolean', () => {
    expect(VotedFilterSchema.parse('true')).toBe(true);
    expect(VotedFilterSchema.parse('false')).toBe(false);
  });

  it('rejects any other value instead of ignoring it', () => {
    for (const value of ['1', 'TRUE', 'oui', '']) {
      expect(VotedFilterSchema.safeParse(value).success).toBe(false);
    }
  });
});
