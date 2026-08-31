// src/api/v1/me/avatar/avatar.controller.ts
import {
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiExtension,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiMeAvatarService } from './avatar.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CheckAbilities } from 'src/common/decorators/check-ability.decorator';
import type { User } from 'src/generated/prisma/client';
import { toOpenApi } from '../../common/openapi';
import { ApiSelfGuardDocs } from '../../common/api-docs';
import { ApiMeAvatarSchema } from '../../common/schemas/api-me.schema';

/**
 * Scalar builds its own snippets from the multipart media type, and they
 * carry a Content-Type header with no boundary. Curl repairs that on its
 * own, fetch does not: copied as is, the browser sends a body no server
 * can split. These samples are the ones to copy.
 */
const CODE_SAMPLES = [
  {
    lang: 'curl',
    label: 'cURL',
    source: [
      "curl -X POST 'https://your-host/v1/me/avatar' \\",
      "  --header 'X-API-Key: YOUR_SECRET_TOKEN' \\",
      "  --form 'file=@./avatar.jpg'",
    ].join('\n'),
  },
  {
    lang: 'js',
    label: 'JavaScript',
    source: [
      'const body = new FormData();',
      "body.append('file', input.files[0]);",
      '',
      '// Do not set Content-Type here. Only the caller that owns the body',
      '// can add the multipart boundary, and without it the upload fails.',
      "await fetch('https://your-host/v1/me/avatar', {",
      "  method: 'POST',",
      "  headers: { 'X-API-Key': 'YOUR_SECRET_TOKEN' },",
      '  body,',
      '});',
    ].join('\n'),
  },
];

@ApiTags('me')
@ApiSelfGuardDocs()
@Controller('v1/me/avatar')
export class ApiMeAvatarController {
  constructor(private readonly avatarService: ApiMeAvatarService) {}

  @Post()
  @HttpCode(200)
  @CheckAbilities(['update', 'User'])
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiExtension('x-codeSamples', CODE_SAMPLES)
  @ApiOperation({
    summary: 'Replace the avatar of the account behind the api key',
    description:
      'Takes one image field named file, up to 12 MB: jpeg, png, webp, avif, tiff, gif, heif or heic. It is re-encoded to a 512x512 webp, so the stored image is never the uploaded bytes and a file that does not decode is refused whatever type it claims to be.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ schema: toOpenApi(ApiMeAvatarSchema) })
  @ApiBadRequestResponse({
    description: 'No file, unsupported type, too large, or unreadable image.',
  })
  @ApiForbiddenResponse({
    description: 'Banned account, or one the policy keeps out of its avatar.',
  })
  uploadAvatar(
    @CurrentUser() viewer: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.avatarService.replaceAvatar(viewer, file);
  }
}
