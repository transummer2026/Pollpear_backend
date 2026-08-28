// src/api/v1/me/me.service.ts
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ForbiddenError, subject } from '@casl/ability';
import { PrismaService } from 'src/prisma/prisma.service';
import { MeService } from 'src/me/me.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { accessibleBy, type AppAbility } from 'src/casl/casl-prisma';
import type { User } from 'src/generated/prisma/client';
import { publicMedia } from '../common/media';
import { selectOf, type AssertColumns } from '../common/select';
import {
  ApiMeSchema,
  type ApiMeDTO,
  type ApiMeUpdateDTO,
} from '../common/schemas/api-me.schema';

const ME_SELECT = selectOf(ApiMeSchema);

/**
 * The cast above hides a renamed or dropped column from the compiler, and
 * the query would only fail once a request hits it. This turns that into a
 * build error naming the offending field.
 */
export const CONTRACT_MATCHES_MODEL: AssertColumns<ApiMeDTO, User> = true;

@Injectable()
export class ApiMeService {
  private readonly logger = new Logger(ApiMeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly meService: MeService,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  async findMe(viewer: User): Promise<ApiMeDTO> {
    const ability = this.abilityFactory.createForUser(viewer);
    const user = await this.prisma.user.findFirst({
      where: {
        AND: [accessibleBy(ability, 'read').ofType('User'), { id: viewer.id }],
      },
      select: ME_SELECT,
    });

    if (!user) {
      this.logger.warn(`user ${viewer.id} may no longer read their account`);
      throw new ForbiddenException('Access denied');
    }

    return this.toPublicProfile(user);
  }

  async updateMe(viewer: User, body: ApiMeUpdateDTO): Promise<ApiMeDTO> {
    const ability = this.abilityFactory.createForUser(viewer);
    this.assertMayWrite(ability, viewer, Object.keys(body));

    const user = await this.prisma.user.update({
      where: {
        id: viewer.id,
        AND: [accessibleBy(ability, 'update').ofType('User')],
      },
      data: body,
      select: ME_SELECT,
    });

    return this.toPublicProfile(user);
  }

  async deleteMe(viewer: User): Promise<void> {
    const ability = this.abilityFactory.createForUser(viewer);
    ForbiddenError.from(ability).throwUnlessCan(
      'delete',
      subject('User', viewer),
    );

    await this.meService.remove(viewer.id);
    this.logger.log(`user ${viewer.id} deleted their account through the api`);
  }

  private assertMayWrite(
    ability: AppAbility,
    viewer: User,
    fields: string[],
  ): void {
    const guard = ForbiddenError.from(ability);
    const target = subject('User', viewer);

    guard.throwUnlessCan('update', target);
    for (const field of fields) {
      guard.throwUnlessCan('update', target, field);
    }
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
