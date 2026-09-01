import { Injectable, Logger } from '@nestjs/common';
import { ForbiddenError, subject } from '@casl/ability';
import { AvatarService } from 'src/file-upload/avatar.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import type { User } from 'src/generated/prisma/client';
import { publicMedia } from '../../common/media';
import {
  ApiMeAvatarSchema,
  type ApiMeAvatarDTO,
} from '../../common/schemas/api-me.schema';

@Injectable()
export class ApiMeAvatarService {
  private readonly logger = new Logger(ApiMeAvatarService.name);

  constructor(
    private readonly avatarService: AvatarService,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  async replaceAvatar(
    viewer: User,
    file: Express.Multer.File,
  ): Promise<ApiMeAvatarDTO> {
    const ability = this.abilityFactory.createForUser(viewer);
    ForbiddenError.from(ability).throwUnlessCan(
      'update',
      subject('User', viewer),
      'avatarUrl',
    );

    const user = await this.avatarService.replace(viewer.id, file);
    this.logger.log(`user ${viewer.id} replaced their avatar through the api`);

    return ApiMeAvatarSchema.parse({ avatarUrl: publicMedia(user.avatarUrl) });
  }
}
