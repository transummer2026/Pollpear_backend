// src/api/v1/me/avatar/avatar.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { AvatarService } from 'src/file-upload/avatar.service';
import {
  ApiMeAvatarSchema,
  type ApiMeAvatarDTO,
} from '../../common/schemas/api-me.schema';

/**
 * Storing the image is shared with the front facade so both write the same
 * object under the same key. Only the answer is narrowed: a client posting
 * an image wants the url back, not the whole profile.
 */
@Injectable()
export class ApiMeAvatarService {
  private readonly logger = new Logger(ApiMeAvatarService.name);

  constructor(private readonly avatarService: AvatarService) {}

  async replaceAvatar(
    ownerId: number,
    file: Express.Multer.File,
  ): Promise<ApiMeAvatarDTO> {
    const user = await this.avatarService.replace(ownerId, file);
    this.logger.log(`user ${ownerId} replaced their avatar through the api`);

    return ApiMeAvatarSchema.parse({ avatarUrl: user.avatarUrl });
  }
}
