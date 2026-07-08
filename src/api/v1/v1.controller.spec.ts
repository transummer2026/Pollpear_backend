import { Test, TestingModule } from '@nestjs/testing';
import { ApiV1Controller } from './v1.controller';
import { ApiV1Service } from './v1.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('ApiV1Controller', () => {
  let controller: ApiV1Controller;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiV1Controller],
      providers: [ApiV1Service, prismaMock],
    }).compile();

    controller = module.get<ApiV1Controller>(ApiV1Controller);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
