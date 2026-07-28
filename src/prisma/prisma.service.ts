import { Injectable } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { VaultService } from 'src/vault/vault.service';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(vault: VaultService) {
    const adapter = new PrismaPg({
      connectionString: vault.db.database_url,
    });
    super({ adapter });
  }
}
