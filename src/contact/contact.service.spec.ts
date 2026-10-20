import { Test, TestingModule } from '@nestjs/testing';
import { ContactService } from './contact.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('ContactService', () => {
  let service: ContactService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContactService, prismaMock],
    }).compile();

    service = module.get<ContactService>(ContactService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
