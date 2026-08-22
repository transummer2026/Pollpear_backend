import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MeService } from 'src/me/me.service';
import type { User } from 'src/generated/prisma/client';
import { publicMedia } from '../common/media';
import { selectOf, type AssertColumns } from '../common/select';
import { ownerIsGone, rejectWhenOwnerIsGone } from './owner';
import {
  ApiMeSchema,
  type ApiMeDTO,
  type ApiMeUpdateDTO,
} from '../common/schemas/api-me.schema';

const ME_SELECT = selectOf(ApiMeSchema);

export const ME_MATCHES_MODEL: AssertColumns<ApiMeDTO, User> = true;

@Injectable()
export class ApiMeService {
  private readonly logger = new Logger(ApiMeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly meService: MeService,
  ) {}

  async findMe(ownerId: number): Promise<ApiMeDTO> {
    const user = await this.prisma.user.findFirst({
      where: { id: ownerId, deletedAt: null },
      select: ME_SELECT,
    });

    if (!user) {
      throw ownerIsGone(this.logger, ownerId);
    }

    return this.toPublicProfile(user);
  }

  async updateMe(ownerId: number, body: ApiMeUpdateDTO): Promise<ApiMeDTO> {
    const user = await this.prisma.user
      .update({
        where: { id: ownerId, deletedAt: null },
        data: body,
        select: ME_SELECT,
      })
      .catch(rejectWhenOwnerIsGone(this.logger, ownerId));

    return this.toPublicProfile(user);
  }

  async deleteMe(ownerId: number): Promise<void> {
    await this.meService.remove(ownerId);
    this.logger.log(`user ${ownerId} deleted their account through the api`);
  }

  private toPublicProfile(user: {
    avatarUrl: string;
    bannerUrl: string;
  }): ApiMeDTO {
    return ApiMeSchema.parse({
      ...user,
      avatarUrl: publicMedia(user.avatarUrl),
      bannerUrl: publicMedia(user.bannerUrl),
    });
  }
}
