import { PrismaService } from './prisma.service';

export const prismaMock = {
  provide: PrismaService,
  useValue: {},
};
