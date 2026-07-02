import { Test, TestingModule } from '@nestjs/testing';
import { ApiRegisterService } from './register.service';

describe('ApiRegisterService', () => {
  let service: ApiRegisterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiRegisterService],
    }).compile();

    service = module.get<ApiRegisterService>(ApiRegisterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
