import { Test, TestingModule } from '@nestjs/testing';
import { ApiPollsController } from './polls.controller';
import { ApiPollsService } from './polls.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('ApiPollsController', () => {
  let controller: ApiPollsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiPollsController],
      providers: [ApiPollsService, prismaMock],
    }).compile();

    controller = module.get<ApiPollsController>(ApiPollsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
