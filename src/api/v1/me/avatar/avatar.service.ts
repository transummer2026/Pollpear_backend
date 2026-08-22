import { Injectable, Logger } from '@nestjs/common';
import { AvatarService } from 'src/file-upload/avatar.service';
import { rejectWhenOwnerIsGone } from '../owner';
import {
  ApiMeAvatarSchema,
  type ApiMeAvatarDTO,
} from '../../common/schemas/api-me.schema';

@Injectable()
export class ApiMeAvatarService {
  private readonly logger = new Logger(ApiMeAvatarService.name);

  constructor(private readonly avatarService: AvatarService) {}

  async replaceAvatar(
    ownerId: number,
    file: Express.Multer.File,
  ): Promise<ApiMeAvatarDTO> {
    const user = await this.avatarService
      .replace(ownerId, file)
      .catch(rejectWhenOwnerIsGone(this.logger, ownerId));
    this.logger.log(`user ${ownerId} replaced their avatar through the api`);

    return ApiMeAvatarSchema.parse({ avatarUrl: user.avatarUrl });
  }
}
