import { Test, TestingModule } from '@nestjs/testing';
import { ApiRegisterController } from './register.controller';
import { ApiRegisterService } from './register.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('ApiRegisterController', () => {
  let controller: ApiRegisterController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiRegisterController],
      providers: [ApiRegisterService, prismaMock],
    }).compile();

    controller = module.get<ApiRegisterController>(ApiRegisterController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
