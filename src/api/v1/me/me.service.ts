// src/api/v1/me/me.service.ts
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MeService } from 'src/me/me.service';
import type { User } from 'src/generated/prisma/client';
import {
  ApiMeSchema,
  type ApiMeDTO,
  type ApiMeUpdateDTO,
} from '../common/schemas/api-me.schema';

const ME_SELECT = Object.fromEntries(
  Object.keys(ApiMeSchema.shape).map((field) => [field, true]),
) as Record<keyof ApiMeDTO, true>;

/**
 * The cast above hides a renamed or dropped column from the compiler, and
 * the query would only fail once a request hits it. This turns that into a
 * build error naming the offending field.
 */
type UnknownColumns = Exclude<keyof ApiMeDTO, keyof User>;
export const CONTRACT_MATCHES_MODEL: UnknownColumns extends never
  ? true
  : UnknownColumns = true;

const ABSOLUTE_URL = /^https?:\/\//;

/**
 * A media column holds an absolute url once something was uploaded, and the
 * relative path of a built-in placeholder until then. That path resolves
 * against the front origin, which a third party client does not have, so it
 * is reported as no image at all rather than as a link nobody can follow.
 */
function publicMedia(value: string): string | null {
  return ABSOLUTE_URL.test(value) ? value : null;
}

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
      this.logger.warn(`api key of deleted or unknown user ${ownerId} used`);
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.toPublicProfile(user);
  }

  async updateMe(ownerId: number, body: ApiMeUpdateDTO): Promise<ApiMeDTO> {
    const user = await this.prisma.user.update({
      where: { id: ownerId, deletedAt: null },
      data: body,
      select: ME_SELECT,
    });

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
